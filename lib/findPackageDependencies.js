// @flow

import path from 'path';

import FileUtils from './FileUtils';

/**
 * Finds dependencies from package.json
 */
export default function findPackageDependencies(
  workingDirectory: string,
  includeDevDependencies: boolean,
): Set<string> {
  const packageJson = FileUtils.readJsonFile(path.join(workingDirectory, 'package.json'));
  if (!packageJson) {
    return new Set([]);
  }

  const keys = ['dependencies', 'peerDependencies'];
  if (includeDevDependencies) {
    keys.push('devDependencies');
  }
  const result = new Set();
  keys.forEach((key: string) => {
    if (Object.prototype.hasOwnProperty.call(packageJson, key)) {
      Object.keys(packageJson[key]).forEach((packageName: string) => {
        result.add(packageName);
      });
    }
  });
  return result;
}
