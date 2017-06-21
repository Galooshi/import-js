export default function parse(fileContent: String): Object {
  // For some reason, we can't `import` babylon using an es6 import.
  // eslint-disable-next-line global-require
  const babylon = require('babylon');

  return babylon.parse(fileContent, {
    allowImportExportEverywhere: true,
    plugins: [
      'jsx',
      'flow',
      'objectRestSpread',
      'decorators',
      'classProperties',
      'exportExtensions',
      'dynamicImport',
    ],
    sourceType: 'module',
  });
}
