export default function parse(fileContent: String): Object {
  // For some reason, we can't `import` @babel/parser using an es6 import.
  // eslint-disable-next-line global-require
  const parser = require('@babel/parser');

  return parser.parse(fileContent, {
    allowImportExportEverywhere: true,
    plugins: [
      'jsx',
      'typescript',
      'objectRestSpread',
      'decorators',
      'classProperties',
      'exportExtensions',
      'dynamicImport',
    ],
    sourceType: 'module',
  });
}
