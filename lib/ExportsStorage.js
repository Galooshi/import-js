import sqlite3 from 'sqlite3';
import lastUpdate from './lastUpdate';

const MAX_CHUNK_SIZE = 100;

function normalizedExportName(string) {
  return string.toLowerCase().replace(/[-_.]/g, '');
}

function normalizeRows(rows) {
  // currently just casts `isDefault` and `isType` to boolean
  return rows.map(({ isDefault, isType, ...other }) => ({
    isDefault: !!isDefault,
    isType: !!isType,
    ...other,
  }));
}

function inParam(sql, values) {
  // https://github.com/mapbox/node-sqlite3/issues/721
  return sql.replace('?#', values.map(() => '?').join(','));
}

function arrayToChunks(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export default class ExportsStorage {
  init(dbFilename) {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbFilename);
      this.db.all('PRAGMA table_info(exports)', (pragmaErr, result) => {
        if (pragmaErr) {
          reject(pragmaErr);
          return;
        }
        if (result.length) {
          // DB has already been initialized
          resolve({ isFreshInstall: false });
          return;
        }
        this.db.run(
          `
            CREATE TABLE exports (
              name VARCHAR(100),
              isDefault INTEGER,
              isType INTEGER,
              path TEXT,
              packageName VARCHAR(100)
            )
          `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            this.db.run(`
                CREATE VIRTUAL TABLE exports_full_text_search_index USING fts4(
                  name,
                  path,
                  isDefault,
                  isType,
                  packageName,
                )
              `);

            this.db.run(
              `
                CREATE TABLE mtimes (
                  path TEXT,
                  mtime NUMERIC
                )
              `,
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve({ isFreshInstall: true });
              },
            );
          },
        );
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  needsUpdate(files) {
    if (files.length > MAX_CHUNK_SIZE) {
      // sqlite has a max number for arguments passed. We need to execute in
      // chunks if we exceed the max.
      const promises = arrayToChunks(
        files,
        MAX_CHUNK_SIZE,
      ).map(chunk => this.needsUpdate(chunk));
      return Promise.all(promises)
        .then(chunks => chunks.reduce((a, b) => a.concat(b))); // flatten
    }

    return new Promise((resolve, reject) => {
      const filePaths = files.map(({ path: p }) => p);
      this.db.all(
        inParam(
          `
            SELECT path, mtime FROM mtimes
            WHERE (path IN (?#))
          `,
          filePaths,
        ),
        filePaths,
        (err, items) => {
          if (err) {
            reject(err);
            return;
          }
          const mtimes = {};
          items.forEach(({ path: pathToFile, mtime }) => {
            mtimes[pathToFile] = mtime;
          });
          const filtered = files.filter(({ path: pathToFile, mtime, exportsAll }) => (
            mtime !== mtimes[pathToFile] || exportsAll
          ));
          resolve(filtered);
        },
      );
    });
  }

  allFiles() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT path FROM mtimes', (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(files.map(({ path }) => path));
      });
    });
  }

  updateMtime(pathToFile, mtime) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT mtime FROM mtimes WHERE (path = ?)', pathToFile, (
        err,
        item,
      ) => {
        if (err) {
          reject(err);
          return;
        }
        if (item) {
          this.db.run(
            'UPDATE mtimes SET mtime = ? WHERE (path = ?)',
            mtime,
            pathToFile,
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            },
          );
        } else {
          this.db.run(
            'INSERT INTO mtimes (mtime, path) VALUES (?, ?)',
            mtime,
            pathToFile,
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            },
          );
        }
      });
    });
  }

  _insert({
    name, pathToFile, isDefault, isType, packageName, additional,
  }) {
    const exportName = isDefault ? normalizedExportName(name) : name;
    return Promise.all([
      new Promise((resolve, reject) => {
        this.db.run(
          'INSERT INTO exports (name, path, isDefault, isType, packageName) VALUES (?, ?, ?, ?, ?)',
          exportName,
          pathToFile,
          isDefault,
          isType,
          packageName,
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            resolve();
          },
        );
      }),
      new Promise((resolve, reject) => {
        // `additional` is a flag used to identify what to add to the full text search index
        // The reason for this is directory paths get appended to module name which results in noisy
        // search results
        if (!additional) {
          this.db.run(
            'INSERT INTO exports_full_text_search_index VALUES (?, ?, ?, ?, ?)',
            name,
            pathToFile,
            isDefault,
            isType,
            packageName,
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            },
          );
        } else {
          resolve();
        }
      }),
    ]);
  }

  update({
    names = [], types = [], defaultNames, pathToFile, mtime, packageName,
  }) {
    return this.remove(pathToFile).then(() =>
      this.updateMtime(pathToFile, mtime, packageName).then(() => {
        const promises = names.map(name =>
          this._insert({
            name, pathToFile, isDefault: false, isType: false, packageName,
          }));
        promises.push(types.map(name =>
          this._insert({
            name, pathToFile, isDefault: false, isType: true, packageName,
          })));
        promises.push(...defaultNames.map(({ name, additional }) =>
          this._insert({
            name, pathToFile, isDefault: true, isType: false, packageName, additional,
          })));
        return Promise.all(promises);
      }));
  }

  _remove(pattern, operator = '=') {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM exports WHERE (path ${operator} ?)`,
        pattern,
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          this.db.run(
            `DELETE FROM exports_full_text_search_index WHERE (path ${operator} ?)`,
            pattern,
          );

          this.db.run(
            `DELETE FROM mtimes WHERE (path ${operator} ?)`,
            pattern,
            (mErr) => {
              if (mErr) {
                reject(mErr);
                return;
              }
              resolve();
            },
          );
        },
      );
    });
  }

  remove(pathToFile) {
    return this._remove(pathToFile);
  }

  removeAll(globPattern) {
    return this._remove(globPattern, 'GLOB');
  }

  purgeDeadNodeModules(workingDirectory) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT path FROM mtimes WHERE (path LIKE "%/node_modules/%")',
        (err, files) => {
          if (err) {
            reject(err);
            return;
          }
          const promises = files.map(({ path: pathToFile }) => new Promise((removeResolve) => {
            lastUpdate(pathToFile, workingDirectory)
              .then(removeResolve)
              .catch(() => this.remove(pathToFile).then(removeResolve));
          }));
          Promise.all(promises).then(resolve).catch(reject);
        },
      );
    });
  }

  get(variableName) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
          SELECT name, path, isDefault, isType, packageName
          FROM exports WHERE (
            (name = ? AND isDefault = 0) OR
            (name = ? AND isDefault = 1)
          )
        `,
        variableName,
        normalizedExportName(variableName),
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(normalizeRows(rows));
        },
      );
    });
  }

  search(variableName) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
          SELECT name, path, isDefault, isType, packageName
          FROM exports_full_text_search_index WHERE name MATCH ?
          COLLATE NOCASE
        `,
        variableName,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(normalizeRows(rows));
        },
      );
    });
  }
}
