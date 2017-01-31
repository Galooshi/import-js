// @flow

/**
 * Thin wrapper around `require.resolve()` to avoid errors thrown, and to make
 * it easier to mock in tests.
 */
export default function requireResolve(
  absolutePath: string,
): string {
  if (!absolutePath.startsWith('/')) {
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
