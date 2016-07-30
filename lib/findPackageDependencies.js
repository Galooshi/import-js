// @flow

import path from 'path';

import FileUtils from './FileUtils';

/**
 * Finds dependencies from package.json
 */
export default function findPackageDependencies(
  workingDirectory: string,
  includeDevDependencies: bool
): Array<string> {
  const packageJson = FileUtils.readJsonFile(
    path.join(workingDirectory, 'package.json'));
  if (!packageJson) {
    return [];
  }

  const keys = ['dependencies', 'peerDependencies'];
  if (includeDevDependencies) {
    keys.push('devDependencies');
  }
  const result = [];
  keys.forEach((key: string) => {
    if (Object.prototype.hasOwnProperty.call(packageJson, key)) {
      result.push(...Object.keys(packageJson[key]));
    }
  });
  return result;
}
