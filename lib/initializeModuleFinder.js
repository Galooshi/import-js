import fs from 'fs';
import path from 'path';

import Configuration from './Configuration';
import ModuleFinder from './ModuleFinder';

const REQUIRED_FILES = ['.importjs.js', 'package.json', '.importjs-root'];

const alreadyInitializedFinders = new Set();

function checkWorkingDirectory(workingDirectory) {
  return new Promise((resolve, reject) => {
    if (
      REQUIRED_FILES.some(file =>
        fs.existsSync(path.join(workingDirectory, file)))
    ) {
      // We're in a good place
      resolve();
      return;
    }

    // It's possible that this folder is the home folder. If we enable the
    // ModuleFinder here, we're going to have too many files to deal with.
    reject(new Error(`ModuleFinder is disabled for ${workingDirectory} ` +
          `(none of ${REQUIRED_FILES.join(', ')} were found).`));
  });
}

export default function initializeModuleFinder(workingDirectory = process.cwd()): Promise {
  const config = new Configuration('importjs', workingDirectory);
  const moduleFinder = ModuleFinder.getForWorkingDirectory(workingDirectory, {
    excludes: config.get('excludes'),
    useUnsafeRequireParsing: config.get('useUnsafeRequireParsing'),
    ignorePackagePrefixes: config.get('ignorePackagePrefixes'),
  });
  if (alreadyInitializedFinders.has(moduleFinder)) {
    return Promise.resolve({});
  }
  alreadyInitializedFinders.add(moduleFinder);
  return new Promise((resolve, reject) => {
    checkWorkingDirectory(workingDirectory)
      .then(() => moduleFinder.initializeStorage(config.get('cacheLocation')))
      .then(({ isFreshInstall }): Promise =>
        moduleFinder.startWatcher().then(() => {
          resolve({ isFreshInstall });
        }))
      .catch(reject);
  });
}
