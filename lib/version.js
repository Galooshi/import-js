// @flow

// This gets its own module so that it can be more easily mocked out in tests.

import packageJson from '../package.json';

/**
 * @return {String}
 */
export default function version(): string {
  return packageJson.version;
}
