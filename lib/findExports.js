import path from 'path';

function findES6NamedExports(node) {
  if (node.type !== 'ExportNamedDeclaration') {
    return [];
  }

  if (node.specifiers.length) {
    return node.specifiers.map(({ exported: { name } }) => name);
  }
  if (node.declaration) {
    return node.declaration.declarations.map(({ id: { name } }) => name);
  }
  return [];
}

function findCommonJSExports(node, definedObjectExpressions) {
  if (node.type !== 'ExpressionStatement') {
    return [];
  }
  // Potential CommonJS export
  const { left, right } = node.expression;
  if (!left || !right) {
    return [];
  }
  if (left.object.name === 'module' &&
    left.property.name === 'exports') {
    let objectExpression;
    if (right.type === 'ObjectExpression') {
      objectExpression = right;
    }
    if (right.type === 'Identifier') {
      objectExpression = definedObjectExpressions[right.name];
    }
    if (objectExpression) {
      return objectExpression.properties.map(({ key }) => key.name);
    }
  }
  return [];
}

function findDefinedObjectExpressions(node) {
  if (node.type !== 'VariableDeclaration') {
    return {};
  }
  const result = {};
  node.declarations.forEach(({ id, init }) => {
    if (init.type !== 'ObjectExpression') {
      return;
    }
    result[id.name] = init;
  });
  return result;
}

function findNamedExports(nodes) {
  const result = [];
  const definedObjectExpressions = {};
  nodes.forEach((node) => {
    Object.assign(definedObjectExpressions, findDefinedObjectExpressions(node));
    result.push(...findES6NamedExports(node));
    result.push(...findCommonJSExports(node, definedObjectExpressions));
  });
  return result;
}

export default function findExports(ast, pathToFile) {
  const fileName = path.parse(pathToFile).name;
  return {
    default: fileName,
    named: findNamedExports(ast.program.body),
  };
}
