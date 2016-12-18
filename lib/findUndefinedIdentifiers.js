import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUndefinedIdentifiers(ast) {
  const result = new Set();
  visitIdentifierNodes(ast.program, ({
    isReference,
    isJSX,
    name,
    definedInScope,
  }) => {
    if (isJSX && !definedInScope.has('React')) {
      result.add('React'); // Implicit dependency
    }
    if (!isReference && !definedInScope.has(name)) {
      result.add(name);
    }
  });
  return result;
}
