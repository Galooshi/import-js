// @flow

import path from 'path';

import escapeRegExp from 'lodash.escaperegexp';
import minimatch from 'minimatch';
import semver from 'semver';

import FileUtils from './FileUtils';
import JsModule from './JsModule';
import version from './version';

const CONFIG_FILE = '.importjs.json';

const DEFAULT_CONFIG = {
  aliases: {},
  declarationKeyword: 'import',
  namedExports: {},
  environments: [],
  excludes: [],
  groupImports: true,
  ignorePackagePrefixes: [],
  importDevDependencies: false,
  importFunction: 'require',
  lookupPaths: ['.'],
  maxLineLength: 80,
  minimumVersion: '0.0.0',
  stripFileExtensions: ['.js', '.jsx'],
  stripFromPath: null,
  tab: '  ',
  useRelativePaths: true,
};

const ENVIRONMENT_CORE_MODULES = {
  // As listed in https://github.com/nodejs/node/tree/master/lib
  //
  // Note that we do not include `process` in this list because that is
  // available globally in node environments and will cause the following error
  // if imported:
  //
  //   Error: Cannot find module 'process' from 'Foo.js'
  node: [
    'assert',
    'buffer',
    'child_process',
    'cluster',
    'console',
    'constants',
    'crypto',
    'dgram',
    'dns',
    'domain',
    'events',
    'fs',
    'http',
    'https',
    'module',
    'net',
    'os',
    'path',
    'punycode',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'sys',
    'timers',
    'tls',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'zlib',
  ],
};

const RENAMED_CONFIGURATION_OPTIONS = {
  applies_to: 'appliesTo',
  applies_from: 'appliesFrom',
  declaration_keyword: 'declarationKeyword',
  named_exports: 'namedExports',
  group_imports: 'groupImports',
  ignore_package_prefixes: 'ignorePackagePrefixes',
  import_dev_dependencies: 'importDevDependencies',
  import_function: 'importFunction',
  lookup_paths: 'lookupPaths',
  max_line_length: 'maxLineLength',
  minimum_version: 'minimumVersion',
  strip_file_extensions: 'stripFileExtensions',
  strip_from_path: 'stripFromPath',
  use_relative_paths: 'useRelativePaths',
};

const KNOWN_CONFIGURATION_OPTIONS = [
  'aliases',
  'appliesFrom',
  'appliesTo',
  'declarationKeyword',
  'environments',
  'excludes',
  'groupImports',
  'ignorePackagePrefixes',
  'importDevDependencies',
  'importFunction',
  'lookupPaths',
  'maxLineLength',
  'minimumVersion',
  'namedExports',
  'stripFileExtensions',
  'stripFromPath',
  'tab',
  'useRelativePaths',
];

function convertRenamedConfiguration(config: Object): Object {
  const convertedConfig = Object.assign({}, config);
  const messages = [];

  Object.keys(RENAMED_CONFIGURATION_OPTIONS).forEach((oldKey: string) => {
    const newKey = RENAMED_CONFIGURATION_OPTIONS[oldKey];
    if (Object.prototype.hasOwnProperty.call(config, oldKey)) {
      convertedConfig[newKey] = convertedConfig[oldKey];
      delete convertedConfig[oldKey];

      messages.push(
        `Deprecated configuration: \`${oldKey}\` has changed to \`${newKey}\``
      );
    }
  });

  return { config: convertedConfig, messages };
}

function checkForUnknownConfiguration(config: Object): Array<string> {
  const messages = [];

  Object.keys(config).forEach((option: string) => {
    if (KNOWN_CONFIGURATION_OPTIONS.indexOf(option) === -1) {
      messages.push(`Unknown configuration: \`${option}\``);
    }
  });

  return messages;
}

function normalizePath(rawPath: string): string {
  if (!rawPath) {
    return './';
  }
  const normalized = rawPath.replace(RegExp(`^${escapeRegExp(process.cwd())}`), '.');
  if (normalized.startsWith('.')) {
    return normalized;
  }
  return `./${normalized}`;
}

/**
  * Checks that the current version is bigger than the `minimumVersion`
  * defined in config.
  * @throws Error if current version is less than the `minimumVersion` defined
  * in config.
  */
function checkCurrentVersion(minimumVersion: string) {
  if (semver.gte(version(), minimumVersion)) {
    return;
  }

  throw Error(
    'The .importjs.json file for this project requires version ' +
    `${minimumVersion} or newer. You are using ${version()}.`
  );
}

// Class that initializes configuration from a .importjs.json file
export default class Configuration {
  pathToCurrentFile: string;
  messages: Array<string>;
  configs: Array<Object>;

  constructor(pathToCurrentFile: string) {
    this.pathToCurrentFile = normalizePath(pathToCurrentFile);

    this.messages = [];
    this.configs = [];
    let userConfig = FileUtils.readJsonFile(CONFIG_FILE);
    if (userConfig) {
      // Check for deprecated configuration and add messages if we find any.
      if (!Array.isArray(userConfig)) {
        userConfig = [userConfig];
      }

      // Clone array to prevent mutating the original.
      Array.from(userConfig).reverse().forEach((config: Object) => {
        const convertedConfig = convertRenamedConfiguration(config);
        this.configs.push(convertedConfig.config);
        this.messages.push(...convertedConfig.messages);
        this.messages.push(...checkForUnknownConfiguration(convertedConfig.config));
      });
    }
    this.configs.push(DEFAULT_CONFIG);

    checkCurrentVersion(this.get('minimumVersion'));
  }

  get(
    key: string,
    { fromFile } : { fromFile: string } = {}
  ): any {
    return this.configs.find((config: Object): boolean => {
      const {
        appliesTo = '**',
        appliesFrom = '**',
      } = config;

      if (!(key in config)) {
        return false;
      }

      if (!minimatch(this.pathToCurrentFile, normalizePath(appliesTo))) {
        // This configuration does not apply to the current file being edited.
        return false;
      }

      if (!fromFile) {
        return true;
      }

      return minimatch(
        normalizePath(fromFile),
        normalizePath(appliesFrom)
      );
    })[key];
  }

  resolveAlias(variableName: string, pathToCurrentFile: ?string): ?JsModule {
    let importPath = this.get('aliases')[variableName];
    if (!importPath) {
      return null;
    }

    importPath = importPath.path || importPath; // path may be an object

    if (pathToCurrentFile && pathToCurrentFile.length) {
      // aliases can have dynamic `{filename}` parts
      importPath = importPath.replace(/\{filename\}/,
        path.basename(pathToCurrentFile, path.extname(pathToCurrentFile)));
    }
    return new JsModule({ importPath });
  }

  resolveNamedExports(variableName: string): ?JsModule {
    const allNamedExports = this.get('namedExports');
    const importPath = Object.keys(allNamedExports).find((key: string): boolean => (
      allNamedExports[key].indexOf(variableName) !== -1
    ));

    if (!importPath) {
      return undefined;
    }

    const jsModule = new JsModule({ importPath });
    jsModule.hasNamedExports = true;
    return jsModule;
  }

  packageDependencies(): Array<string> {
    const packageJson = FileUtils.readJsonFile('package.json');
    if (!packageJson) {
      return [];
    }

    const keys = ['dependencies', 'peerDependencies'];
    if (this.get('importDevDependencies')) {
      keys.push('devDependencies');
    }
    const result = [];
    keys.forEach((key: string) => {
      if (Object.prototype.hasOwnProperty.call(packageJson, key)) {
        result.push(...Object.keys(packageJson[key]));
      }
    });
    return result;
  }

  environmentCoreModules(): Array<string> {
    const result = [];
    this.get('environments').forEach((environment: string) => {
      result.push(...ENVIRONMENT_CORE_MODULES[environment]);
    });
    return result;
  }
}
