import escapeRegExp from 'lodash.escaperegexp';

/**
 * Thin wrapper around `require.resolve()` to avoid errors thrown, normalize
 * paths, and to make it easier to mock in tests.
 */
export default function requireResolve(importPath: string): string {
  try {
    const path = require.resolve(importPath);
    return path.replace(RegExp(`^${escapeRegExp(process.cwd())}/`), '');
  } catch (e) {
    if (/^Cannot find module/.test(e.message)) {
      return importPath;
    }
    throw e;
  }
}
