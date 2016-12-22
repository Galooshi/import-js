const KEYS_USED_FOR_ASSIGNMENT =
  new Set(['id', 'imported', 'local', 'params', 'key']);
const KEYS_USED_IN_REFERENCE_TO_OBJECTS = new Set(['property']);

function normalizeNode(node, key, definedInScope) {
  if (node.type === 'JSXOpeningElement') {
    return {
      name: node.name.name || node.name.object.name,
      isJSX: true,
      definedInScope,
    };
  }

  if (node.type !== 'Identifier') {
    return undefined;
  }

  const isAssignment = KEYS_USED_FOR_ASSIGNMENT.has(key);
  if (isAssignment) {
    definedInScope.add(node.name);
  }

  return {
    isReference: KEYS_USED_IN_REFERENCE_TO_OBJECTS.has(key),
    isAssignment,
    definedInScope,
    name: node.name,
  };
}

export default function visitIdentifierNodes(
  node, visitor, definedInScope = new Set(['module']), key = 'root') {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => {
      visitIdentifierNodes(child, visitor, definedInScope, key);
    });
    return;
  }

  const normalizedNode = normalizeNode(node, key, definedInScope);
  if (normalizedNode) {
    visitor(normalizedNode);
  }

  Object.keys(node).forEach((key) => {
    const newDefinedInScope = key === 'body' ?
      new Set([...definedInScope]) : definedInScope;

    visitIdentifierNodes(node[key], visitor, newDefinedInScope, key);
  });
}
