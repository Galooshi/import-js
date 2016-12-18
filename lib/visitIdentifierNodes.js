const KEYS_USED_FOR_ASSIGNMENT = ['id', 'imported', 'local'];
const KEYS_USED_IN_REFERENCE_TO_OBJECTS = ['property', 'key'];

function normalizeNode(node, key) {
  if (node.type === 'JSXOpeningElement') {
    return {
      name: node.name.name,
      isJSX: true,
    };
  }

  if (node.type !== 'Identifier') {
    return undefined;
  }

  return {
    isReference: KEYS_USED_IN_REFERENCE_TO_OBJECTS.includes(key),
    isAssignment: KEYS_USED_FOR_ASSIGNMENT.includes(key),
    name: node.name,
  };
}

export default function visitIdentifierNodes(
  node, visitor, definedInScope = ['module'], key = 'root') {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => {
      visitIdentifierNodes(child, visitor, definedInScope, key);
    });
    return;
  }

  const normalizedNode = normalizeNode(node, key);
  if (normalizedNode) {
    visitor(Object.assign(normalizedNode, { definedInScope }));
  }

  Object.keys(node).forEach((key) => {
    const newDefinedInScope = key === 'body' ?
      definedInScope.slice(0) : definedInScope;

    visitIdentifierNodes(node[key], visitor, newDefinedInScope, key);
  });
}
