import fs from 'fs';
import path from 'path';

import parse from './parse';

function findESNamedExports(node) {
  if (node.type !== 'ExportNamedDeclaration') {
    return [];
  }

  if (node.specifiers.length) {
    return node.specifiers.map(({ exported }) => exported.name);
  }

  if (!node.declaration) {
    return [];
  }

  if (node.declaration.type === 'FunctionDeclaration') {
    return [node.declaration.id.name];
  }

  const result = [];
  node.declaration.declarations.forEach(({ id }) => {
    if (id.type === 'ObjectPattern') {
      // export const { foo, bar } = something();
      result.push(...id.properties.map(({ key }) => key.name));
    } else {
      result.push(id.name);
    }
  });
  return result;
}

function findCommonJSExports(node, definedObjectExpressions, absPathToFile) {
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
    if (right.type === 'CallExpression' &&
      right.callee.name === 'require' &&
      right.arguments.length === 1 &&
      right.arguments[0].type === 'StringLiteral') {
      // module.exports = require('someOtherFile.js');
      const pathToRequiredFile = path.resolve(path.dirname(absPathToFile),
        right.arguments[0].value);
      const requiredFileContent = fs.readFileSync(pathToRequiredFile, 'utf8');
      // eslint-disable-next-line no-use-before-define
      return findNamedExports(parse(requiredFileContent).program.body,
        pathToRequiredFile);
    }
    // module.exports = { foo: 'foo' };
    let objectExpression;
    if (right.type === 'ObjectExpression') {
      objectExpression = right;
    }
    if (right.type === 'Identifier') {
      objectExpression = definedObjectExpressions[right.name];
    }
    if (objectExpression) {
      return objectExpression.properties.map(({ key }) => key.name).filter(Boolean);
    }
  }

  if (left.object.type === 'MemberExpression' &&
    left.object.object.name === 'module' &&
    left.object.property.name === 'exports') {
    // module.exports.foo = 'bar';
    return [left.property.name];
  }

  return [];
}

function findDefinedObjectExpressions(node) {
  if (node.type !== 'VariableDeclaration') {
    return {};
  }
  const result = {};
  node.declarations.forEach(({ id, init }) => {
    if (!init || init.type !== 'ObjectExpression') {
      return;
    }
    result[id.name] = init;
  });
  return result;
}

function findNamedExports(nodes, absPathToFile) {
  const result = [];
  const definedObjectExpressions = {};
  nodes.forEach((node) => {
    Object.assign(definedObjectExpressions, findDefinedObjectExpressions(node));
    result.push(...findESNamedExports(node));
    result.push(...findCommonJSExports(node, definedObjectExpressions,
      absPathToFile));
  });
  return result;
}

function hasDefaultExport(nodes) {
  return nodes.some((node) => {
    if (node.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (node.type !== 'ExpressionStatement') {
      return false;
    }
    // Potential CommonJS export
    const { left, right } = node.expression;
    if (!left || !right) {
      return false;
    }
    return left.object.name === 'module' &&
      left.property.name === 'exports';
  });
}

export default function findExports(data, absPathToFile) {
  const ast = parse(data);
  return {
    named: findNamedExports(ast.program.body, absPathToFile),
    hasDefault: hasDefaultExport(ast.program.body),
  };
}
