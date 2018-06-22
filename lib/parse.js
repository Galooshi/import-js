export default function parse(fileContent: String): Object {
  // For some reason, we can't `import` babylon using an es6 import.
  // eslint-disable-next-line global-require
  const babelParser = require('@babel/parser');

  return babelParser.parse(fileContent, {
    allowImportExportEverywhere: true,
    plugins: [
      'jsx',
      'flow',
      'objectRestSpread',
      'decorators',
      'classProperties',
      'exportExtensions',
      'dynamicImport',
      'exportNamespaceFrom',
      'exportDefaultFrom',
    ],
    sourceType: 'module',
  });
}
