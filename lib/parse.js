export default function parse(fileContent: String): Object {
  // For some reason, we can't `import` @babel/parser using an es6 import.
  // eslint-disable-next-line global-require
  const babelParser = require('@babel/parser');

  return babelParser.parse(fileContent, {
    allowImportExportEverywhere: true,
    plugins: [
      'jsx',
      'typescript',
      'flow',
      'doExpressions',
      'objectRestSpread',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'exportExtensions',
      'asyncGenerators',
      'functionBind',
      'functionSent',
      'dynamicImport',
      'numericSeparator',
      'optionalChaining',
      'importMeta',
      'bigInt',
      'optionalCatchBinding',
      'throwExpressions',
      'pipelineOperator',
      'nullishCoalescingOperator',
      'exportNamespaceFrom',
      'exportDefaultFrom',
    ],
    sourceType: 'module',
  });
}
