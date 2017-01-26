import fs from 'fs';
import path from 'path';

import parse from './parse';
import requireResolve from './requireResolve';

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

  if (node.declaration.type === 'FunctionDeclaration' ||
    node.declaration.type === 'ClassDeclaration') {
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

function findCommonJSExports(node, definedNames, absPathToFile) {
  if (node.type !== 'ExpressionStatement') {
    return [];
  }
  if (node.expression.type === 'CallExpression' &&
    node.expression.callee.type === 'MemberExpression' &&
    node.expression.callee.object.name === 'exports' &&
    node.expression.callee.property.name === 'use' &&
    node.expression.arguments.length &&
    node.expression.arguments[0].type === 'Identifier') {
    // exports.use(foo);
    return [node.expression.arguments[0].name];
  }
  const { left, right } = node.expression;
  if (!left || !right) {
    return [];
  }
  if ((left.object && left.object.name === 'module' && left.property.name === 'exports') ||
    left.name === 'exports') {
    if (right.type === 'CallExpression' &&
      right.callee.name === 'require' &&
      right.arguments.length === 1 &&
      right.arguments[0].type === 'StringLiteral') {
      // module.exports = require('someOtherFile.js');
      const pathToRequiredFile = requireResolve(
        path.resolve(path.dirname(absPathToFile), right.arguments[0].value));
      const requiredFileContent = fs.readFileSync(pathToRequiredFile, 'utf8');
      // eslint-disable-next-line no-use-before-define
      const { named } = findExports(requiredFileContent, pathToRequiredFile);
      return named;
    }
    // module.exports = { foo: 'foo' };
    if (right.type === 'ObjectExpression') {
      return right.properties.map(({ key }) => key.name).filter(Boolean);
    }
    if (right.type === 'Identifier') {
      return definedNames[right.name] || [];
    }
  }

  if (!left.object || !left.property) {
    return [];
  }

  if (left.object.type === 'MemberExpression' &&
    left.object.object.name === 'module' &&
    left.object.property.name === 'exports') {
    // module.exports.foo = 'bar';
    return [left.property.name];
  }

  if (left.type === 'MemberExpression' &&
    left.object.type === 'Identifier' &&
    left.object.name === 'exports') {
    // exports.foo = 'bar';
    return [left.property.name];
  }

  return [];
}

function findDefinedNames(node, definedNames) {
  if (node.type === 'ExpressionStatement') {
    const { left, right } = node.expression;
    if (left && right) {
      if (left.object) {
        (definedNames[left.object.name] || []).push(left.property.name);
      }
    }
  }
  if (node.type !== 'VariableDeclaration') {
    return;
  }
  node.declarations.forEach(({ id, init }) => {
    if (!init) {
      return;
    }
    if (init.type === 'ObjectExpression') {
      definedNames[id.name] = // eslint-disable-line no-param-reassign
        init.properties.map(({ key }) => key.name).filter(Boolean);
    } else if (init.type === 'FunctionExpression') {
      definedNames[id.name] = []; // eslint-disable-line no-param-reassign
    }
  });
}

function findNamedExports(nodes, absPathToFile, definedNames) {
  const result = [];
  nodes.forEach((node) => {
    result.push(...findESNamedExports(node));
    result.push(...findCommonJSExports(node, definedNames,
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
    if (left.name === 'exports') {
      return true;
    }
    if (!left.object || !left.property) {
      // foo = 'bar';
      return false;
    }
    return left.object.name === 'module' &&
      left.property.name === 'exports';
  });
}

const DEFAULT_EXPORT_PATTERN = /\smodule\.exports\s*=\s*(\w+)/;
function findRawModuleExportIdentifier(data) {
  const match = data.match(DEFAULT_EXPORT_PATTERN);
  if (match) {
    return match[1];
  }
  return undefined;
}

function findRootNodes(ast) {
  const realRootNodes = ast.program.body;
  if (realRootNodes.length > 1) {
    return realRootNodes;
  }
  try {
    // Try finding the function body from this case:
    //
    //   (function () {
    //     module.exports = { foo: 'foo' };
    //   }.call(this));
    //
    const { callee } = realRootNodes[0].expression;
    if (callee.object) {
      return callee.object.body.body;
    }
    return callee.body.body;
  } catch (e) {
    // ignore
  }
  return realRootNodes;
}

export default function findExports(data, absPathToFile) {
  const ast = parse(data);
  const rootNodes = findRootNodes(ast);
  const definedNames = {};
  rootNodes.forEach((node) => {
    findDefinedNames(node, definedNames);
  });
  const named = findNamedExports(rootNodes, absPathToFile, definedNames);
  let hasDefault = hasDefaultExport(rootNodes);
  if (!hasDefault) {
    const rawExportedId = findRawModuleExportIdentifier(data);
    hasDefault = !!rawExportedId;
    if (!named.length) {
      named.push(...(definedNames[rawExportedId] || []));
    }
  }
  return {
    named,
    hasDefault,
  };
}
