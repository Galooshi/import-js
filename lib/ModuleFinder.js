import path from 'path';

import logLevel from 'loglevel';

import ExportsStorage from './ExportsStorage';
import Watcher from './Watcher';
import findExports from './findExports';
import parse from './parse';
import readFile from './readFile';

function defaultExportNames(pathToFile) {
  const parsed = path.parse(pathToFile);
  let fileName = parsed.name;
  let dirName = path.basename(parsed.dir);

  if (/package\.json|index\.jsx?/.test(parsed.base)) {
    fileName = dirName;
    dirName = path.basename(path.dirname(parsed.dir));
  }
  const result = [
    `${dirName}-${fileName}`,
    fileName,
  ];

  if (/e?s$/.test(dirName)) {
    result.push(`${dirName.replace(/e?s$/, '')}-${fileName}`);
  }
  return result;
}

const instances = {};

export default class ModuleFinder {
  /**
   * Factory method to get an instance for a specific working directory.
   */
  static getForWorkingDirectory(workingDirectory, excludes) {
    let instance = instances[workingDirectory];
    if (!instance) {
      instance = new ModuleFinder(workingDirectory, excludes);
      instances[workingDirectory] = instance;
    }
    return instance;
  }

  constructor(workingDirectory, excludes) {
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
    return this.storage.init(dbFilename);
  }

  startWatcher() {
    return this.watcher.initialize();
  }

  processQueue(done) {
    const file = this.queue.pop();
    if (!file) {
      this.processingQueue = false;
      logLevel.debug('Queue empty');
      done();
      return;
    }
    const { path: pathToFile, mtime } = file;
    this.processingQueue = true;
    logLevel.debug(`Processing ${pathToFile}`);
    readFile(path.join(this.workingDirectory, pathToFile)).then((data) => {
      let exports = { named: [], hasDefault: true };
      try {
        exports = findExports(parse(data));
      } catch (e) {
        logLevel.error(`Failed to parse ${pathToFile}`);
      }
      if (exports.named.length || exports.hasDefault) {
        const all = exports.named.slice(0);
        if (exports.hasDefault) {
          all.push('default');
        }
        logLevel.debug(
          `Found exports for ${pathToFile}:\n${all.join(', ')}`);
      } else {
        logLevel.debug(`No exports found for ${pathToFile}`);
      }
      this.storage.update({
        names: exports.named,
        defaultNames: exports.hasDefault ? defaultExportNames(pathToFile) : [],
        pathToFile,
        mtime,
      }).then(() => {
        this.processQueue(done);
      }).catch((error) => {
        logLevel.error(
          `Failed to update ${pathToFile} in storage. Reason: ${error.message}`);
        this.processQueue(done);
      });
    }).catch((err) => {
      logLevel.error(err.message);
      this.processQueue(done);
    });
  }

  handleFilesAdded(files) {
    return new Promise((resolve) => {
      logLevel.debug(`Checking ${files.length} files for potential updates`);
      this.storage.needsUpdate(files).then((filesToUpdate) => {
        logLevel.debug(`Got ${filesToUpdate.length} files to update`);
        if (!filesToUpdate.length) {
          resolve();
          return;
        }
        filesToUpdate.forEach((file) => {
          this.queue.unshift(file);
          if (!this.processingQueue) {
            logLevel.debug('Kicking off queue');
            this.processQueue(resolve);
          }
        });
      });
    });
  }

  handleFilesRemoved(files) {
    if (!files.length) {
      return Promise.resolve();
    }
    logLevel.debug(`Removing ${files.length} files`);
    const promises = files.map(({ path: pathToFile }) => {
      logLevel.debug(`Removing ${pathToFile}`);
      return this.storage.remove(pathToFile);
    });
    return Promise.all(promises);
  }

  find(variableName) {
    return this.storage.get(variableName);
  }
}
