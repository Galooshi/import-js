import fs from 'fs';
import path from 'path';

const NODE_MODULES_PATTERN = /\/node_modules$/;

function findRecursive(directory) {
  if (directory === '/') {
    throw new Error('No project root found');
  }
  const pathToPackageJson = path.join(directory, 'package.json');
  const pathToNodeModulesFolder = path.join(directory, 'node_modules');
  const isPackageDependency = NODE_MODULES_PATTERN.test(path.dirname(directory));
  if (fs.existsSync(pathToPackageJson) &&
    (fs.existsSync(pathToNodeModulesFolder) || isPackageDependency)) {
    return directory;
  }
  return findRecursive(path.dirname(directory));
}

function makeAbsolute(pathToFile) {
  if (pathToFile.startsWith('/')) {
    return pathToFile;
  }
  return path.join(process.cwd(), pathToFile);
}

export default function findProjectRoot(pathToFile) {
  return findRecursive(path.dirname(makeAbsolute(pathToFile)));
}
