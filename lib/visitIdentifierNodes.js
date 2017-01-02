const KEYS_USED_FOR_ASSIGNMENT =
  new Set(['id', 'imported', 'local', 'params']);
const KEYS_USED_IN_REFERENCE_TO_OBJECTS = new Set(['property']);

function normalizeNode(node, { key, definedInScope, parent }) {
  if (!parent) {
    return undefined;
  }

  if (node.type === 'JSXIdentifier') {
    if (key !== 'name' && key !== 'object') {
      return undefined;
    }
    if (parent.type === 'JSXOpeningElement' ||
      (parent.type === 'JSXMemberExpression' &&
      parent.parent.type === 'JSXOpeningElement')) {
      return {
        name: node.name,
        isJSX: true,
        definedInScope,
      };
    }
  }

  if (parent.type === 'GenericTypeAnnotation') {
    if (!node.name) {
      return undefined;
    }
    // flow
    return {
      name: node.name,
      definedInScope,
    };
  }

  if (node.type !== 'Identifier') {
    return undefined;
  }

  const isAssignment = KEYS_USED_FOR_ASSIGNMENT.has(key) ||
    (key === 'key' && parent.parent.type === 'ObjectPattern');
  if (isAssignment) {
    definedInScope.add(node.name);
  }

  const isReference = KEYS_USED_IN_REFERENCE_TO_OBJECTS.has(key) ||
    (key === 'key' && parent.parent.type !== 'ObjectPattern');

  return {
    isReference,
    isAssignment,
    definedInScope,
    name: node.name,
  };
}

export default function visitIdentifierNodes(
  node, visitor, context = { definedInScope: new Set([]), key: 'root' }) {
  if (Array.isArray(node)) {
    node.forEach((child) => {
      visitIdentifierNodes(child, visitor, context);
    });
    return;
  }

  const normalizedNode = normalizeNode(node, context);
  if (normalizedNode) {
    visitor(normalizedNode);
  }

  Object.keys(node).forEach((key) => {
    if (!node[key] || typeof node[key] !== 'object') {
      return;
    }
    const newContext = Object.assign({}, context, {
      key,
      parent: {
        type: node.type,
        parent: context.parent,
      },
    });
    if (key === 'body') {
      newContext.definedInScope = new Set([...context.definedInScope]);
    }

    visitIdentifierNodes(node[key], visitor, newContext);
  });
}
