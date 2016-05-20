let resolvedPaths;

function __setResolvedPaths(paths: object) {
  resolvedPaths = paths;
}

function __reset() {
  resolvedPaths = {};
}

__reset();

export default function requireResolve(importPath: string): string {
  return resolvedPaths[importPath] || importPath;
}
requireResolve.__reset = __reset;
requireResolve.__setResolvedPaths = __setResolvedPaths;
