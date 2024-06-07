//

export const DEFAULT_PARSER_PLUGINS = [
  'jsx',
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
  [
    'pipelineOperator',
    {
      proposal: 'minimal',
    },
  ],
  'nullishCoalescingOperator',
  'exportNamespaceFrom',
  'exportDefaultFrom',
];

const TYPESCRIPT_FILE_PATH_REGEX = /\.tsx?$/;
let parserPlugins = DEFAULT_PARSER_PLUGINS;

export function configureParserPlugins(newParserPlugins) {
  parserPlugins = newParserPlugins;
  return;
}

function getParserPlugins(absolutePathToFile) {
  const typePlugin = TYPESCRIPT_FILE_PATH_REGEX.test(absolutePathToFile)
    ? 'typescript'
    : 'flow';

  return [typePlugin, ...parserPlugins];
}

export default function parse(fileContent, absolutePathToFile) {
  // For some reason, we can't `import` @babel/parser using an es6 import.
  const babelParser = require('@babel/parser');

  return babelParser.parse(fileContent, {
    allowImportExportEverywhere: true,
    plugins: getParserPlugins(absolutePathToFile),
    sourceType: 'module',
  });
}
