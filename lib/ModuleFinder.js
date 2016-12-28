import fs from 'fs';
import path from 'path';

import logLevel from 'loglevel';

import ExportsCache from './ExportsCache';
import WatchmanFileCache from './WatchmanFileCache';
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
    this.watchmanFileCache = new WatchmanFileCache(workingDirectory, excludes);
    this.cache = new ExportsCache(workingDirectory);
    this.queue = [];
    this.processingQueue = false;
  }

  initialize() {
    return this.watchmanFileCache.initialize()
      .then(() => this.cache.init()).then(() => {
        this.watchmanFileCache.addListener(this);
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
      this.cache.update({
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
    this.cache.needsUpdate(files).then((filesToUpdate) => {
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
      this.cache.remove(pathToFile);
    });
  }

  isEnabled() {
    return this.watchmanFileCache.isEnabled();
  }

  find(variableName) {
    return this.cache.get(variableName);
  }
}
