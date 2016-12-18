import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUndefinedIdentifiers(ast, globalVariables = []) {
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
  }, new Set(globalVariables));
  return result;
}
