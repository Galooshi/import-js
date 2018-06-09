import fs from 'fs';
import path from 'path';
import FileUtils from './FileUtils';

const isWinDriveRoot = /^[A-Z]:\\$/;

function findRecursive(directory) {
  if (directory === '/' || isWinDriveRoot.test(directory)) {
    throw new Error('No project root found, looking for a directory with a package.json file.');
  }

  const pathToPackageJson = path.join(directory, 'package.json');

  if (fs.existsSync(pathToPackageJson)) {
    const packageDescription = FileUtils.readJsonFile(pathToPackageJson);
    const { isRoot = true } = packageDescription['import-js'] || {};

    if (isRoot) {
      return directory;
    }
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
