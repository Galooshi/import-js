/**
 * Thin wrapper around `require.resolve()` to avoid errors thrown and to make it
 * easier to mock in tests.
 */
export default function requireResolve(importPath: string): string {
  try {
    return require.resolve(importPath);
  } catch (e) {
    if (/^Cannot find module/.test(e.message)) {
      return importPath;
    }
    throw e;
  }
}
