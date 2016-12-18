import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUndefinedIdentifiers(ast) {
  const result = new Set();
  visitIdentifierNodes(ast.program, ({
    isAssignment,
    isReference,
    isJSX,
    name,
    definedInScope,
  }) => {
    if (isJSX) {
      if (!definedInScope.has('React')) {
        result.add('React'); // Implicit dependency
      }
      if (!definedInScope.has(name)) {
        result.add(name);
      }
    } else if (isAssignment) {
      definedInScope.add(name);
    } else if (!isReference && !definedInScope.has(name)) {
      result.add(name);
    }
  });
  return result;
}
