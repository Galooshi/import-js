import fs from 'fs';
import path from 'path';

import FileUtils from './FileUtils';

const isWinDriveRoot = /^[A-Z]:\\$/;

function isRootPackageJson(path) {
  if (!fs.existsSync(path)) {
    return false;
  }

  const packageJson = FileUtils.readJsonFile(path);

  if ('importjs' in packageJson && 'isRoot' in packageJson.importjs) {
    return packageJson.importjs.isRoot;
  }

  return true;
}

function findRecursive(directory) {
  if (directory === '/' || isWinDriveRoot.test(directory)) {
    throw new Error('No project root found, looking for a directory with a package.json file.');
  }

  const pathToPackageJson = path.join(directory, 'package.json');
  const pathToImportJs = path.join(directory, '.importjs-root');

  if (isRootPackageJson(pathToPackageJson) || fs.existsSync(pathToImportJs)) {
    return directory;
  }

  return findRecursive(path.dirname(directory));
}

function makeAbsolute(pathToFile) {
  if (path.isAbsolute(pathToFile)) {
    return pathToFile;
  }

  return path.join(process.cwd(), pathToFile);
}

export default function findProjectRoot(pathToFile) {
  return findRecursive(path.dirname(makeAbsolute(pathToFile)));
}
