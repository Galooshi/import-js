// @flow
import path from 'path';

/**
 * Thin wrapper around `require.resolve()` to avoid errors thrown, and to make
 * it easier to mock in tests.
 */
export default function requireResolve(absolutePath: string): string {
  if (!path.isAbsolute(absolutePath)) {
    throw new Error(`Path must be absolute: ${absolutePath}`);
  }
  try {
    return require.resolve(absolutePath);
  } catch (e) {
    if (/^Cannot find module/.test(e.message)) {
      return absolutePath;
    }
    throw e;
  }
}
