export default function visitNodes(node, visitor, definedInScope = ['module']) {
  if (typeof node !== 'object') {
    return;
  }
  Object.keys(node).forEach((key) => {
    const item = node[key];
    if (!item || typeof item !== 'object') {
      return;
    }
    const newDefinedInScope = key === 'body' ?
      definedInScope.slice(0) : definedInScope;

    if (Array.isArray(item)) {
      item.forEach((child) => {
        visitNodes(child, visitor, newDefinedInScope);
      });
    } else {
      visitor({ node: item, key, definedInScope });
      visitNodes(item, visitor, newDefinedInScope);
    }
  });
}
