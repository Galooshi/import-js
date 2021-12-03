// @flow
import semver from 'semver';
import path from 'path';

import FileUtils from './FileUtils';

/**
 * Finds version of package from package.json
 */
export default function findDependencyVersion(
  packageName: string,
  workingDirectory: string,
  includeDevDependencies: boolean,
): ?string {
  const packageJson = FileUtils.readJsonFile(path.join(workingDirectory, 'package.json'));
  if (!packageJson) {
    return null;
  }
  const keys = ['dependencies', 'peerDependencies'];
  if (includeDevDependencies) {
    keys.push('devDependencies');
  }
  const dependencyList = keys.map((key: string): any => packageJson[key]);
  const mergedDependencies = Object.assign({}, ...dependencyList);
  const rawVersion = mergedDependencies[packageName];
  const ver = semver.coerce(rawVersion);
  return ver && ver.version;
}
