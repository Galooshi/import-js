// @flow
const TYPESCRIPT_FILE_PATH_REGEX = /\.tsx?$/

function getParserPlugins(absolutePathToFile: string): Array<string | [string, Object]> {
  const typePlugin = TYPESCRIPT_FILE_PATH_REGEX.test(absolutePathToFile)
    ? 'typescript'
    : 'flow'

  return [
      typePlugin,
      'jsx',
      'doExpressions',
      'objectRestSpread',
      'decorators',
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
      ['pipelineOperator', {
        proposal: 'minimal',
      }],
      'nullishCoalescingOperator',
      'exportNamespaceFrom',
      'exportDefaultFrom',
  ];
}

export default function parse(fileContent: string, absolutePathToFile: string): Object {
  // For some reason, we can't `import` @babel/parser using an es6 import.
  // eslint-disable-next-line global-require
  const babelParser = require('@babel/parser');

  return babelParser.parse(fileContent, {
    allowImportExportEverywhere: true,
    plugins: getParserPlugins(absolutePathToFile),
    sourceType: 'module',
  });
}
