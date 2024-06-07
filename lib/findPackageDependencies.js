//

import path from 'path';

import FileUtils from './FileUtils';

/**
 * Finds dependencies from package.json
 */
export default function findPackageDependencies(
  workingDirectory,
  includeDevDependencies,
) {
  const packageJson = FileUtils.readJsonFile(
    path.join(workingDirectory, 'package.json'),
  );
  if (!packageJson) {
    return new Set([]);
  }

  const keys = ['dependencies', 'peerDependencies'];
  if (includeDevDependencies) {
    keys.push('devDependencies');
  }
  const result = new Set();
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(packageJson, key)) {
      Object.keys(packageJson[key]).forEach((packageName) => {
        result.add(packageName);
      });
    }
  });
  return result;
}
