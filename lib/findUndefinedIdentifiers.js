function iter(node, definedInScope = ['module']) {
  const result = [];
  if (typeof node !== 'object') {
    return result;
  }
  Object.keys(node).forEach((key) => {
    const item = node[key];
    if (!item) {
      return;
    }
    const newDefinedInScope = key === 'body' ?
      definedInScope.slice(0) : definedInScope;

    if (Array.isArray(item)) {
      item.forEach((child) => {
        result.push(...iter(child, newDefinedInScope));
      });
    } else if (item.type !== 'Identifier') {
      if (item.type === 'JSXOpeningElement') {
        if (!definedInScope.includes(item.name.name)) {
          result.push(item.name.name);
        }
      }
      result.push(...iter(item, newDefinedInScope));
    } else if (['id', 'imported', 'local'].includes(key)) {
      definedInScope.push(item.name);
    } else if (['callee', 'object', 'expression'].includes(key)) {
      if (!definedInScope.includes(item.name)) {
        result.push(item.name);
      }
    }
  });
  return result;
}

export default function findUndefinedIdentifiers(ast) {
  return iter(ast.program);
}
