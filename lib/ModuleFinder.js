import path from 'path';

import requireRelative from 'require-relative';
import winston from 'winston';

import ExportsStorage from './ExportsStorage';
import Watcher from './Watcher';
import findExports from './findExports';
import findPackageDependencies from './findPackageDependencies';
import lastUpdate from './lastUpdate';
import readFile from './readFile';
import WindowsCompat from './WindowsCompat';

/**
 * Checks for package.json or npm-shrinkwrap.json inside a list of files and
 * expands the list of files to include package dependencies if so.
 */
function expandFiles(files, workingDirectory) {
  const promises = [];
  files.forEach((file) => {
    if (
      file.path !== './package.json' && file.path !== './npm-shrinkwrap.json'
    ) {
      promises.push(Promise.resolve(file));
      return;
    }
    findPackageDependencies(workingDirectory, true).forEach((dep) => {
      let resolvedPath;
      try {
        resolvedPath = WindowsCompat.pathToCanonical(
          path.relative(
            workingDirectory,
            requireRelative.resolve(dep, workingDirectory),
          )
        );
        if (!resolvedPath.startsWith('.')) {
          // path.relative won't add "./", but we need it further down the line
          resolvedPath = `./${resolvedPath}`;
        }
      } catch (e) {
        winston.error(`Failed to resolve "${dep}" relative to ${workingDirectory}`);
        return;
      }

      promises.push(
        lastUpdate.failSafe(resolvedPath, workingDirectory)
          .then(({ mtime }) =>
            Promise.resolve({
              path: resolvedPath,
              mtime,
              packageName: dep,
            })));
    });
  });
  return Promise.all(promises);
}

function aliasedExportNames(alias, ignorePackagePrefixes) {
  const result = [alias];
  ignorePackagePrefixes.forEach((prefix) => {
    if (alias.startsWith(prefix)) {
      result.push(alias.slice(prefix.length));
    }
  });
  return result;
}

function defaultExportNames(pathToFile) {
  const parsed = path.parse(pathToFile);
  let fileName = parsed.name;
  let dirName = path.basename(parsed.dir);

  if (/package\.json|index\.jsx?/.test(parsed.base)) {
    fileName = dirName;
    dirName = path.basename(path.dirname(parsed.dir));
  }
  if (dirName === '.') {
    return [fileName];
  }
  const result = [`${dirName}-${fileName}`, fileName];

  if (/e?s$/.test(dirName)) {
    // When the directory has an "s" (or "es") at the end, we assume it's a
    // plural form of something. We then add a third name to the list. As an
    // example, if we have './mocks/ModuleFinder.js' as the pathToFile, we add
    // 'mock-ModuleFinder' here, which will allow the user to find the module
    // with `MockModuleFinder` as the variable name.
    result.push(`${dirName.replace(/e?s$/, '')}-${fileName}`);
  }
  return result;
}

const instances = {};

export default class ModuleFinder {
  /**
   * Factory method to get an instance for a specific working directory.
   */
  static getForWorkingDirectory(
    workingDirectory,
    { excludes, ignorePackagePrefixes },
  ) {
    let instance = instances[workingDirectory];
    if (!instance) {
      instance = new ModuleFinder(workingDirectory, {
        excludes,
        ignorePackagePrefixes,
      });
      instances[workingDirectory] = instance;
    }
    return instance;
  }

  constructor(workingDirectory, { excludes, ignorePackagePrefixes }) {
    this.excludes = excludes;
    this.ignorePackagePrefixes = ignorePackagePrefixes;
    this.workingDirectory = workingDirectory;
    this.storage = new ExportsStorage();
    this.watcher = new Watcher({
      workingDirectory,
      excludes,
      onFilesAdded: this.handleFilesAdded.bind(this),
      onFilesRemoved: this.handleFilesRemoved.bind(this),
      storage: this.storage,
    });
    this.queue = [];
    this.processingQueue = false;
  }

  initializeStorage(dbFilename) {
    return this.storage
      .init(dbFilename)
      .then(({ isFreshInstall }) =>
        Promise.all(this.excludes.map(glob => this.storage.removeAll(glob)))
          .then(() => this.storage.purgeDeadNodeModules(this.workingDirectory))
          .then(() => Promise.resolve({ isFreshInstall })));
  }

  startWatcher() {
    return this.watcher.initialize();
  }

  processQueue(done) {
    const file = this.queue.pop();
    if (!file) {
      this.processingQueue = false;
      winston.debug('Queue empty');
      done();
      return;
    }
    const { path: pathToFile, mtime, packageName } = file;
    this.processingQueue = true;
    winston.debug(`Processing ${pathToFile}`);
    const fullPath = path.join(this.workingDirectory, pathToFile);
    readFile(fullPath)
      .then((data) => {
        let exports = { named: [], hasDefault: true };
        try {
          exports = findExports(data, fullPath);
        } catch (e) {
          winston.error(
            `Failed to parse ${pathToFile}: ${e.message}\n${e.stack}`,
          );
        }
        if (exports.named.length || exports.hasDefault) {
          const all = exports.named.slice(0);
          if (exports.hasDefault) {
            all.push('default');
          }
          winston.debug(`Found exports for ${pathToFile}:\n${all.join(', ')}`);
        } else {
          winston.debug(`No exports found for ${pathToFile}`);
        }
        const defaultNames = [];
        if (exports.hasDefault) {
          if (packageName) {
            defaultNames.push(
              ...aliasedExportNames(packageName, this.ignorePackagePrefixes),
            );
          } else {
            defaultNames.push(...defaultExportNames(pathToFile));
          }
        }
        this.storage
          .update({
            names: exports.named,
            defaultNames,
            pathToFile,
            mtime,
            packageName,
          })
          .then(() => {
            this.processQueue(done);
          })
          .catch((error) => {
            winston.error(
              `Failed to update ${pathToFile} in storage. Reason: ${error.message}`,
            );
            this.processQueue(done);
          });
      })
      .catch((err) => {
        winston.error(err.message);
        this.processQueue(done);
      });
  }

  handleFilesAdded(unexpandedFiles) {
    return new Promise((resolve) => {
      expandFiles(unexpandedFiles, this.workingDirectory).then((files) => {
        winston.debug(`Checking ${files.length} files for potential updates`);
        this.storage.needsUpdate(files).then((filesToUpdate) => {
          winston.debug(`Got ${filesToUpdate.length} files to update`);
          if (!filesToUpdate.length) {
            resolve();
            return;
          }
          filesToUpdate.forEach((file) => {
            this.queue.unshift(file);
            if (!this.processingQueue) {
              winston.debug('Kicking off queue');
              this.processQueue(resolve);
            }
          });
        });
      });
    });
  }

  handleFilesRemoved(files) {
    if (!files.length) {
      return Promise.resolve();
    }
    winston.debug(`Removing ${files.length} files`);
    const promises = files.map(({ path: pathToFile }) => {
      winston.debug(`Removing ${pathToFile}`);
      return this.storage.remove(pathToFile);
    });
    return Promise.all(promises);
  }

  find(variableName) {
    return this.storage.get(variableName);
  }
}
