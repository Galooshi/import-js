// @flow

/**
 * Thin wrapper around `require.resolve()` to avoid errors thrown, and to make
 * it easier to mock in tests.
 */
export default function requireResolve(
  absolutePath: string,
): string {
  try {
    return require.resolve(absolutePath);
  } catch (e) {
    if (/^Cannot find module/.test(e.message)) {
      return absolutePath;
    }
    throw e;
  }
}
