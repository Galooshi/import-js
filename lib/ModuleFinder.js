import fs from 'fs';
import path from 'path';

import logLevel from 'loglevel';

import ExportsCache from './ExportsCache';
import WatchmanFileCache from './WatchmanFileCache';
import findExports from './findExports';
import parse from './parse';

function normalizedExportName(string) {
  return string.toLowerCase().replace(/[-_]/g, '');
}

function defaultExportName(pathToFile) {
  const parsed = path.parse(pathToFile);
  if (/package\.json|index\.jsx?/.test(parsed.base)) {
    return normalizedExportName(path.basename(parsed.dir));
  }
  return normalizedExportName(parsed.name);
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
    this.watchmanFileCache =
      WatchmanFileCache.getForWorkingDirectory(workingDirectory, excludes);
    this.cache = new ExportsCache();
    this.queue = [];
    this.processingQueue = false;
  }

  initialize() {
    return this.watchmanFileCache.initialize().then(() => {
      this.watchmanFileCache.addListener(this);
    });
  }

  addExport(name, pathToFile, isDefault) {
    const normalizedName = normalizedExportName(name);
    this.cache.add(normalizedName, pathToFile, isDefault);
  }

  processQueue() {
    const pathToFile = this.queue.pop();
    if (!pathToFile) {
      this.processingQueue = false;
      logLevel.debug('Queue empty');
      return;
    }
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
      exports.forEach((name) => {
        this.addExport(name, pathToFile, false);
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

  fileAdded(pathToFile) {
    this.addExport(defaultExportName(pathToFile), pathToFile, true);
    this.queue.unshift(pathToFile);
    if (!this.processingQueue) {
      logLevel.debug('Kicking off queue');
      this.processQueue();
    }
  }

  fileDeleted(pathToFile) {
    this.cache.remove(pathToFile);
  }

  isEnabled() {
    return this.watchmanFileCache.isEnabled();
  }

  find(variableName) {
    return this.cache.get(variableName);
  }
}
