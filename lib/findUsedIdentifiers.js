import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUsedIdentifiers(ast, reactVersionLT17 = false) {
  const result = new Set();
  visitIdentifierNodes(ast.program, ({
    isAssignment,
    isReference,
    isJSX,
    name,
  }) => {
    if (reactVersionLT17 && isJSX) {
      result.add('React');
    }
    if (!isReference && !isAssignment) {
      result.add(name);
    }
  });
  return result;
}
