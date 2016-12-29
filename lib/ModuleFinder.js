import fs from 'fs';
import path from 'path';

import logLevel from 'loglevel';

import ExportsStorage from './ExportsStorage';
import Watcher from './Watcher';
import findAllFiles from './findAllFiles';
import findExports from './findExports';
import parse from './parse';

function defaultExportName(pathToFile) {
  const parsed = path.parse(pathToFile);
  if (/package\.json|index\.jsx?/.test(parsed.base)) {
    return path.basename(parsed.dir);
  }
  return parsed.name;
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
    this.excludes = excludes;
    this.watcher = new Watcher(workingDirectory, excludes);
    this.storage = new ExportsStorage(workingDirectory);
    this.queue = [];
    this.processingQueue = false;
  }

  initialize() {
    return this.storage.init()
      .then(() => this.watcher.initialize())
      .then(() => this.watcher.addListener(this));
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
    fs.readFile(pathToFile, 'utf-8', (err, data) => {
      if (err) {
        logLevel.error(err.message);
        this.processQueue(done);
        return;
      }
      let exports = [];
      try {
        exports = findExports(parse(data));
      } catch (e) {
        logLevel.error(`Failed to parse ${pathToFile}`);
      }
      this.storage.update({
        names: exports,
        defaultName: defaultExportName(pathToFile),
        pathToFile,
        mtime,
      });
      if (exports.length) {
        logLevel.debug(
          `Found named exports for ${pathToFile}:\n${exports.join(', ')}`);
      } else {
        logLevel.debug(`No named exports found for ${pathToFile}`);
      }
      this.processQueue(done);
    });
  }

  filesAdded(files) {
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

  filesDeleted(files) {
    const promises = files.map(({ path: pathToFile }) =>
      this.storage.remove(pathToFile));
    return Promise.all(promises);
  }

  ensureUpToDate() {
    if (this.watcher.isEnabled()) {
      // When the watcher is active, we're always up-to-date
      return Promise.resolve();
    }

    // No watcher available, let's grab everything and compare with what we
    // have.
    return new Promise((resolve, reject) => {
      findAllFiles(this.workingDirectory, this.excludes).then((files) => {
        const mtimes = {};
        files.forEach(({ path: pathToFile, mtime }) => {
          mtimes[pathToFile] = mtime;
        });
        this.storage.allFiles().then((storedFiles) => {
          const removedFiles = [];
          storedFiles.forEach((storedFile) => {
            const mtime = mtimes[storedFile];
            if (!mtime) {
              removedFiles.push({ path: storedFile });
            }
          });
          this.filesAdded(files)
            .then(() => this.filesDeleted(removedFiles))
            .then(resolve)
            .catch(reject);
        });
      }).catch(reject);
    });
  }

  find(variableName) {
    return this.storage.get(variableName);
  }
}
