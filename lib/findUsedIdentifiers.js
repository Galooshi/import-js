import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUsedIdentifiers(ast) {
  const result = new Set();
  visitIdentifierNodes(ast.program, ({ isAssignment, isReference, name }) => {
    if (!isReference && !isAssignment) {
      result.add(name);
    }
  });
  return result;
}
