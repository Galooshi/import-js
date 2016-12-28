import fs from 'fs';
import path from 'path';

import logLevel from 'loglevel';

import ExportsStorage from './ExportsStorage';
import Watcher from './Watcher';
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
    this.watcher = new Watcher(workingDirectory, excludes);
    this.storage = new ExportsStorage(workingDirectory);
    this.queue = [];
    this.processingQueue = false;
  }

  initialize() {
    return this.watcher.initialize()
      .then(() => this.storage.init()).then(() => {
        this.watcher.addListener(this);
      });
  }

  processQueue() {
    const file = this.queue.pop();
    if (!file) {
      this.processingQueue = false;
      logLevel.debug('Queue empty');
      return;
    }
    const { path: pathToFile, mtime } = file;
    this.processingQueue = true;
    logLevel.debug(`Processing ${pathToFile}`);
    fs.readFile(pathToFile, 'utf-8', (err, data) => {
      if (err) {
        logLevel.error(err.message);
        this.processQueue();
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
      this.processQueue();
    });
  }

  filesAdded(files) {
    logLevel.debug(`Checking ${files.length} files for potential updates`);
    this.storage.needsUpdate(files).then((filesToUpdate) => {
      logLevel.debug(`Got ${filesToUpdate.length} files to update`);
      filesToUpdate.forEach((file) => {
        this.queue.unshift(file);
        if (!this.processingQueue) {
          logLevel.debug('Kicking off queue');
          this.processQueue();
        }
      });
    });
  }

  filesDeleted(files) {
    files.forEach(({ path: pathToFile }) => {
      this.storage.remove(pathToFile);
    });
  }

  isEnabled() {
    return this.watcher.isEnabled();
  }

  find(variableName) {
    return this.storage.get(variableName);
  }
}
