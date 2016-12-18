import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUndefinedIdentifiers(ast) {
  const result = [];
  visitIdentifierNodes(ast.program, ({
    isAssignment,
    isReference,
    isJSX,
    name,
    definedInScope,
  }) => {
    if (isJSX) {
      if (!definedInScope.includes('React')) {
        result.push('React'); // Implicit dependency
      }
      if (!definedInScope.includes(name)) {
        result.push(name);
      }
    } else if (isAssignment) {
      definedInScope.push(name);
    } else if (!isReference && !definedInScope.includes(name)) {
      result.push(name);
    }
  });
  return result;
}
