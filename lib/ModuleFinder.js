import path from 'path';

import logLevel from 'loglevel';

import ExportsStorage from './ExportsStorage';
import Watcher from './Watcher';
import findExports from './findExports';
import parse from './parse';
import readFile from './readFile';

function defaultExportNames(pathToFile) {
  const parsed = path.parse(pathToFile);
  let parts = parsed.dir.split(path.sep);

  if (!/package\.json|index\.jsx?/.test(parsed.base)) {
    parts.push(parsed.name);
  }

  if (parts.length > 3) {
    parts = parts.slice(parts.length - 3);
  }

  const result = [];
  let part;
  // eslint-disable-next-line no-cond-assign
  while (part = parts.pop()) {
    const first = result[0];
    if (first) {
      result.unshift(`${part}-${first}`);
      if (/e?s$/.test(part)) {
        result.unshift(`${part.replace(/e?s$/, '')}-${first}`);
      }
    } else {
      result.push(part);
    }
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
    this.watcher = new Watcher({
      workingDirectory,
      excludes,
      onFilesAdded: this.handleFilesAdded.bind(this),
      onFilesRemoved: this.handleFilesRemoved.bind(this),
    });
    this.storage = new ExportsStorage(workingDirectory);
    this.queue = [];
    this.processingQueue = false;
  }

  initializeStorage(dbFilename = '.importjs.db') {
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
      let exports = [];
      try {
        exports = findExports(parse(data));
      } catch (e) {
        logLevel.error(`Failed to parse ${pathToFile}`);
      }
      if (exports.length) {
        logLevel.debug(
          `Found named exports for ${pathToFile}:\n${exports.join(', ')}`);
      } else {
        logLevel.debug(`No named exports found for ${pathToFile}`);
      }
      this.storage.update({
        names: exports,
        defaultNames: defaultExportNames(pathToFile),
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
    const promises = files.map(({ path: pathToFile }) =>
      this.storage.remove(pathToFile));
    return Promise.all(promises);
  }

  find(variableName) {
    return this.storage.get(variableName);
  }
}
