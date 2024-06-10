//
let resolvedPaths = {};

function __addResolvedPath(alias, path) {
  resolvedPaths[alias] = path;
}

function __reset() {
  resolvedPaths = {};
}

__reset();

export default function requireResolve(importPath) {
  return resolvedPaths[importPath] || importPath;
}
requireResolve.__reset = __reset;
requireResolve.__addResolvedPath = __addResolvedPath;
