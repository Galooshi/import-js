import visitNodes from './visitNodes';

export default function findUsedIdentifiers(ast) {
  const result = [];
  visitNodes(ast.program, ({ node, key }) => {
    if (node.type !== 'Identifier') {
      if (node.type === 'JSXOpeningElement') {
        result.push(node.name.name);
      }
    } else if (['callee', 'object', 'expression'].includes(key)) {
      result.push(node.name);
    }
  });
  return result;
}
