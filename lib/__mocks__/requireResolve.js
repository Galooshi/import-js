let resolvedPaths = {};

function __addResolvedPath(alias: string, path: string) {
  resolvedPaths[alias] = path;
}

function __reset() {
  resolvedPaths = {};
}

__reset();

export default function requireResolve(importPath: string): string {
  return resolvedPaths[importPath] || importPath;
}
requireResolve.__reset = __reset;
requireResolve.__addResolvedPath = __addResolvedPath;
