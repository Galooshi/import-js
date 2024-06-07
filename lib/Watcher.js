import fbWatchman from 'fb-watchman';
import minimatch from 'minimatch';
import winston from 'winston';

import findAllFiles from './findAllFiles';
import normalizePath from './normalizePath';

const SUBSCRIPTION_NAME = 'import-js-subscription';

export default class Watcher {
  workingDirectory;

  excludes;

  onFilesAdded;

  onFilesRemoved;

  storage;

  constructor({
    workingDirectory = process.cwd(),
    excludes = [],
    onFilesAdded = () => Promise.resolve(),
    onFilesRemoved = () => Promise.resolve(),
    storage,
  }) {
    this.workingDirectory = workingDirectory;
    this.excludes = excludes;
    this.onFilesAdded = onFilesAdded;
    this.onFilesRemoved = onFilesRemoved;
    this.storage = storage;
  }

  subscribe({ client, fbWatch, relativePath }) {
    const subscription = {
      // Match javascript files
      expression: [
        'anyof',
        ['suffix', 'js'],
        ['suffix', 'jsx'],
        ['suffix', 'ts'],
        ['suffix', 'tsx'],
        ['suffix', 'json'],
      ],
      fields: ['name', 'exists', 'mtime_ms'],
      relative_root: relativePath,
    };

    return new Promise((resolve, reject) => {
      client.command(
        ['subscribe', fbWatch, SUBSCRIPTION_NAME, subscription],
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );

      client.on('subscription', (resp) => {
        if (resp.subscription !== SUBSCRIPTION_NAME) {
          return;
        }

        const added = [];
        const removed = [];
        resp.files.forEach((file) => {
          const normalizedPath = normalizePath(
            file.name,
            this.workingDirectory,
          );
          if (normalizedPath.indexOf('/node_modules/') !== -1) {
            return;
          }
          if (
            this.excludes.some((pattern) => minimatch(normalizedPath, pattern))
          ) {
            return;
          }
          if (file.exists) {
            added.push({ path: normalizedPath, mtime: +file.mtime_ms });
          } else {
            removed.push({ path: normalizedPath });
          }
        });
        if (added.length) {
          this.onFilesAdded(added);
        }
        if (removed.length) {
          this.onFilesRemoved(removed);
        }
      });
    });
  }

  startSubscription({ client }) {
    return new Promise((resolve, reject) => {
      client.command(
        ['watch-project', this.workingDirectory],
        (error, resp) => {
          if (error) {
            reject(error);
            return;
          }

          if ('warning' in resp) {
            winston.warn(
              `WARNING received during watchman init: ${resp.warning}`,
            );
          }

          this.subscribe({
            client,
            fbWatch: resp.watch,
            relativePath: resp.relative_path,
          })
            .then(resolve)
            .catch(reject);
        },
      );
    });
  }

  initialize() {
    return new Promise((resolve, reject) => {
      this.initializeWatchman()
        .then(resolve)
        .catch((error) => {
          winston.warn(`
          Couldn't initialize the Watchman watcher. This is most likely because
          you don't have Watchman installed. Follow instructions here if you
          want to rid this warning:
          https://facebook.github.io/watchman/docs/install.html

          ImportJS will fall back to polling instead. This is slower, and more
          resource-heavy. Plus, changes will not be immediately available.
          \n
          Reason: ${error.message}\n${error.stack}
        `);
          this.initializePolling().then(resolve).catch(reject);
        });
    });
  }

  /**
   * Get all files from the watchman-powered cache. Returns a promise that will
   * resolve if watchman is available, and the file cache is enabled. Will
   * resolve immediately if previously initialized.
   */
  initializeWatchman() {
    return new Promise((resolve, reject) => {
      const client = new fbWatchman.Client();
      client.on('error', (error) => {
        reject(error);
      });
      client.capabilityCheck(
        {
          optional: [],
          required: ['relative_root'],
        },
        (error) => {
          if (error) {
            client.end();
            reject(error);
          } else {
            this.startSubscription({ client }).then(resolve).catch(reject);
          }
        },
      );
    });
  }

  initializePolling() {
    setInterval(() => {
      this.poll();
    }, 30000);
    return this.poll();
  }

  poll() {
    return new Promise((resolve, reject) => {
      findAllFiles(this.workingDirectory, this.excludes)
        .then((files) => {
          const mtimes = {};
          files.forEach(({ path: pathToFile, mtime }) => {
            mtimes[pathToFile] = mtime;
          });
          this.storage.allFiles().then((storedFiles) => {
            const removedFiles = [];
            storedFiles.forEach((storedFile) => {
              if (storedFile.startsWith('./node_modules/')) {
                // Ignore this file, as it won't be in the list of all files (we
                // exclude node_modules by default).
                return;
              }
              const mtime = mtimes[storedFile];
              if (!mtime) {
                removedFiles.push({ path: storedFile });
              }
            });
            this.onFilesAdded(files)
              .then(() => this.onFilesRemoved(removedFiles))
              .then(resolve)
              .catch(reject);
          });
        })
        .catch(reject);
    });
  }
}
