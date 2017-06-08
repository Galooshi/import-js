const KEYS_USED_FOR_ASSIGNMENT = new Set(['id', 'imported', 'local', 'params']);
const KEYS_USED_IN_REFERENCE_TO_OBJECTS = new Set(['property']);

function normalizeNode(node, { key, definedInScope, parent }) {
  if (!parent) {
    return undefined;
  }

  if (node.type === 'JSXIdentifier') {
    if (key !== 'name' && key !== 'object') {
      return undefined;
    }
    if (
      parent.type === 'JSXOpeningElement' ||
      (parent.type === 'JSXMemberExpression' &&
        parent.parent.type === 'JSXOpeningElement')
    ) {
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
    (key === 'key' && parent.parent.type === 'ObjectPattern') ||
    (key === 'left' && parent.type === 'AssignmentPattern');
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
  rootAstNode,
  visitor,
  context = { definedInScope: new Set([]), key: 'root' },
) {
  const queue = [{ node: rootAstNode, context }];
  let current;

  while (queue.length) {
    current = queue.shift();
    if (Array.isArray(current.node)) {
      if (current.context.key === 'body') {
        // A new scope has started. Copy whatever we have from the parent scope
        // into a new one.
        current.context.definedInScope = new Set([...current.context.definedInScope]);
      }
      // eslint-disable-next-line no-loop-func
      const itemsToAdd = current.node.map(node => ({
        node,
        context: current.context,
      }));
      queue.unshift(...itemsToAdd);
      continue; // eslint-disable-line no-continue
    }
    const normalizedNode = normalizeNode(current.node, current.context);
    if (normalizedNode) {
      visitor(normalizedNode);
    }

    const itemsToAdd = [];
    // eslint-disable-next-line no-loop-func
    Object.keys(current.node).forEach((key) => {
      if (!current.node[key] || typeof current.node[key] !== 'object') {
        return;
      }
      const newContext = Object.assign({}, current.context, {
        key,
        parent: {
          type: current.node.type,
          parent: current.context.parent,
        },
      });
      const itemToPush = {
        node: current.node[key],
        context: newContext,
      };
      if (key === 'body') {
        // Delay traversing function bodies, so that we can finish finding all
        // defined variables in scope first.
        queue.push(itemToPush);
      } else {
        itemsToAdd.push(itemToPush);
      }
    });
    queue.unshift(...itemsToAdd);
  }
}
