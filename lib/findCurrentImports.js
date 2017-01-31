// @flow

import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import ImportStatements from './ImportStatements';

function convertToImportStatement(node: Object): ?ImportStatement {
  if (node.type === 'ImportDeclaration') {
    const defaultSpecifier = node.specifiers.find((spec: Object): boolean =>
        spec.type === 'ImportDefaultSpecifier');
    return new ImportStatement({
      declarationKeyword: 'import',
      defaultImport: defaultSpecifier ? defaultSpecifier.local.name : undefined,
      hasSideEffects: node.specifiers.length === 0,
      namedImports: node.specifiers.map((spec: Object): ?Array<string> => {
        if (spec.type !== 'ImportSpecifier') {
          return undefined;
        }
        return spec.local.name;
      }).filter(Boolean),
      path: node.source.value,
    });
  }

  if (node.type === 'ExpressionStatement') {
    if (!node.expression.callee) {
      return undefined;
    }
    if (node.expression.callee.name !== 'require') {
      return undefined;
    }

    if (node.expression.arguments.length !== 1) {
      return undefined;
    }

    return new ImportStatement({
      hasSideEffects: true,
      importFunction: 'require',
      path: node.expression.arguments[0].value,
    });
  }

  if (node.type === 'VariableDeclaration') {
    if (!node.declarations || node.declarations.length > 1) {
      return undefined;
    }

    const declaration = node.declarations[0];
    if (!declaration.init) {
      // e.g. `let foo;`
      return undefined;
    }
    if (declaration.init.type !== 'CallExpression') {
      return undefined;
    }

    if (declaration.init.arguments.length !== 1) {
      return undefined;
    }

    if (declaration.init.arguments[0].type !== 'StringLiteral') {
      return undefined;
    }

    const defaultImport = declaration.id.type === 'Identifier' ?
      declaration.id.name : undefined;

    const namedImports = declaration.id.type === 'ObjectPattern' ?
      declaration.id.properties.map((p: Object): String => p.value.name) : undefined;

    return new ImportStatement({
      declarationKeyword: node.kind,
      defaultImport,
      hasSideEffects: false,
      importFunction: declaration.init.callee.name,
      namedImports,
      path: declaration.init.arguments[0].value,
    });
  }
  return undefined;
}

export default function findCurrentImports(
  config: Configuration,
  currentFileContent: string,
  ast: Object,
): Object {
  const result = {
    imports: new ImportStatements(config),
    range: {
      start: ast.program.loc.end.line - 1,
      end: 0,
    },
  };

  let done = false;
  ast.program.body.forEach((node: Object) => {
    if (done) {
      return;
    }
    result.range.start = Math.min(result.range.start, node.loc.start.line - 1);

    const importStatement = convertToImportStatement(node);
    if (!importStatement) {
      // We've reached the end of the imports block
      done = true;
      return;
    }

    importStatement.originalImportString =
      currentFileContent.slice(node.start, node.end);
    result.imports.push(importStatement);
    result.range.end = node.loc.end.line;
  });

  if (!result.range.end) {
    result.range.end = result.range.start;
  }
  return result;
}
