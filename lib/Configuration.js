'use strict';

const path = require('path');

const escapeRegExp = require('lodash.escaperegexp');
const minimatch = require('minimatch');
const semver = require('semver');

const FileUtils = require('./FileUtils');
const JsModule = require('./JsModule');
const { version } = require('../package.json');

const CONFIG_FILE = '.importjs.json';

const DEFAULT_CONFIG = {
  aliases: {},
  declaration_keyword: 'import',
  named_exports: {},
  environments: [],
  excludes: [],
  group_imports: true,
  ignore_package_prefixes: [],
  import_dev_dependencies: false,
  import_function: 'require',
  lookup_paths: ['.'],
  max_line_length: 80,
  minimum_version: '0.0.0',
  strip_file_extensions: ['.js', '.jsx'],
  strip_from_path: null,
  tab: '  ',
  use_relative_paths: true,
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

// Class that initializes configuration from a .importjs.json file
export default class Configuration {
  constructor(pathToCurrentFile) {
    this.pathToCurrentFile = this._normalizePath(pathToCurrentFile);
    this.configs = [];
    const userConfig = FileUtils.readJsonFile(CONFIG_FILE);
    if (userConfig) {
      if (Array.isArray(userConfig)) {
        // Clone array to prevent mutating the original.
        this.configs.push(...Array.from(userConfig).reverse());
      } else {
        this.configs.push(userConfig);
      }
    }
    this.configs.push(DEFAULT_CONFIG);

    this._checkCurrentVersion();
  }

  /**
   * @param {String} key
   * @param {String} opts.fromFile
   * @return {Object} a configuration value
   */
  get(key, { fromFile } = {}) {
    return this.configs.find((config) => {
      const appliesTo = config.applies_to || '**';
      const appliesFrom = config.applies_from || '**';
      if (!(key in config)) {
        return false;
      }

      if (!minimatch(this.pathToCurrentFile, this._normalizePath(appliesTo))) {
        // This configuration does not apply to the current file being edited.
        return false;
      }

      if (!fromFile) {
        return true;
      }

      return minimatch(
        this._normalizePath(fromFile),
        this._normalizePath(appliesFrom)
      );
    })[key];
  }

  /**
   * @param {String} variableName
   * @param {?String} pathToCurrentFile
   * @return {?JsModule}
   */
  resolveAlias(variableName, pathToCurrentFile) {
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

  /**
   * @param {String} variableName
   * @return {?JsModule}
   */
  resolveNamedExports(variableName) {
    const allNamedExports = this.get('named_exports');
    const importPath = Object.keys(allNamedExports).find(
      (key) => allNamedExports[key].indexOf(variableName) !== -1);

    if (!importPath) {
      return undefined;
    }

    const jsModule = new JsModule({ importPath });
    jsModule.hasNamedExports = true;
    return jsModule;
  }

  /**
   * @return {Array<String>}
   */
  packageDependencies() {
    const packageJson = FileUtils.readJsonFile('package.json');
    if (!packageJson) {
      return [];
    }

    const keys = ['dependencies', 'peerDependencies'];
    if (this.get('import_dev_dependencies')) {
      keys.push('devDependencies');
    }
    const result = [];
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(packageJson, key)) {
        result.push(...Object.keys(packageJson[key]));
      }
    });
    return result;
  }

  /**
   * @return {Array<String>}
   */
  environmentCoreModules() {
    const result = [];
    this.get('environments').forEach((environment) => {
      result.push(...ENVIRONMENT_CORE_MODULES[environment]);
    });
    return result;
  }

  /**
   * @param {String} path
   * @return {String}
   */
  _normalizePath(rawPath) {
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
   * Checks that the current version is bigger than the `minimum_version`
   * defined in config.
   * @throws Error if current version is less than the `minimum_version` defined
   * in config.
   */
  _checkCurrentVersion() {
    const minimumVersion = this.get('minimum_version');

    if (semver.gte(version, minimumVersion)) {
      return;
    }

    throw Error(
      'The .importjs.json file for this project requires version ' +
      `${minimumVersion} or newer. You are using ${version}.`
    );
  }
}
