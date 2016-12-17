import visitNodes from './visitNodes';

export default function findUndefinedIdentifiers(ast) {
  const result = [];
  visitNodes(ast.program, ({ node, key, definedInScope }) => {
    if (node.type !== 'Identifier') {
      if (node.type === 'JSXOpeningElement') {
        if (!definedInScope.includes(node.name.name)) {
          result.push(node.name.name);
        }
      }
    } else if (['id', 'imported', 'local'].includes(key)) {
      definedInScope.push(node.name);
    } else if (['callee', 'object', 'expression'].includes(key)) {
      if (!definedInScope.includes(node.name)) {
        result.push(node.name);
      }
    }
  });
  return result;
}
