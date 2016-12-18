import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUsedIdentifiers(ast) {
  const result = [];
  visitIdentifierNodes(ast.program, ({
    isAssignment,
    isReference,
    isJSX,
    name,
  }) => {
    if (isJSX) {
      result.push('React');
    }
    if (!isReference && !isAssignment) {
      result.push(name);
    }
  });
  return result;
}
