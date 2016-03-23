'use strict';

const fs = require('fs');

const minimatch = require('minimatch');

const JsModule = require('./JsModule');
const regExpEscape = require('./regExpEscape');

const CONFIG_FILE = '.importjs.json';

const DEFAULT_CONFIG = {
  aliases: {},
  declaration_keyword: 'import',
  named_exports: {},
  environments: [],
  eslint_executable: 'eslint',
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
  use_relative_paths: false,
};

const ENVIRONMENT_CORE_MODULES = {
  // As listed in https://github.com/nodejs/node/tree/master/lib
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
    'process',
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
class Configuration {
  initialize(pathToCurrentFile) {
    this.pathToCurrentFile = this._normalizePath(pathToCurrentFile);
    this.configs = [];
    const userConfig = this._loadConfig(CONFIG_FILE);
    if (userConfig) {
      this.configs.concat(flatten([userConfig]).reverse);
    }
    this.configs.push(DEFAULT_CONFIG);

    this._checkCurrentVersion();
  }

  // this.return [Object] a configuration value
  get(key, opts) {
    return this.configs.find((config) => {
      const appliesTo = config.applies_to || '*';
      const appliesFrom = config.applies_from || '*';
      if (!(key in config)) {
        return null;
      }

      return minimatch(this._normalizePath(appliesTo), this.pathToCurrentFile) &&
        minimatch(this._normalizePath(appliesFrom),
                  this._normalizePath(opts.fromFile));
    })[key];
  }

  // this.param variable_name [String]
  // this.param path_to_current_file [String?]
  // this.return [ImportJS::JSModule?]
  resolveAlias(variableName, pathToCurrentFile) {
    let path = this.get('aliases')[variableName];
    if (!path) {
      return null;
    }

    path = path.path || path; // path may be an object

    if (pathToCurrentFile && pathToCurrentFile.length) {
      // aliases can have dynamic `{filename}` parts
      path = path.replace(/\{filename\}/,
        path.basename(pathToCurrentFile, path.extname(pathToCurrentFile)));
    }
    return new JsModule({ importPath: path });
  }

  // this.param variable_name [String]
  // this.return [ImportJS::JSModule?]
  resolveNamedExports(variableName) {
    const allNamedExports = this.get('named_exports');
    Object.keys(allNamedExports).forEach((importPath) => {
      const namedExports = allNamedExports[importPath];
      if (!namedExports.includes(variableName)) {
        return null;
      }

      const jsModule = new JsModule({ importPath });
      jsModule.hasNamedExports = true;
      return jsModule;
    });
  }

  // this.return [Array<String>]
  packageDependencies() {
    if (!fs.existsSync('package.json')) {
      return [];
    }

    const keys = ['dependencies', 'peerDependencies'];
    if (this.get('import_dev_dependencies')) {
      keys.push('devDependencies');
    }
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const result = [];
    keys.forEach((key) => {
      if (packageJson[key]) {
        result.push(...Object.keys(packageJson[key]));
      }
    });
    return result;
  }

  // this.return [Array<String>]
  environmentCoreModules() {
    const result = [];
    this.get('environments').forEach((environment) => {
      result.push(...ENVIRONMENT_CORE_MODULES[environment]);
    });
    return result;
  }


  // this.param file [File]
  // this.return [Hash]
  _loadConfig(file) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return null;
  }

  // this.param path [String]
  // this.return [String]
  _normalizePath(rawPath) {
    if (!rawPath) {
      return './';
    }
    let path = rawPath.replace(RegExp(`^${regExpEscape(process.cwd)}`), '.')
    if (!path.startsWith('.')) {
      path = './' + path;
    }
    return path;
  }

  // Checks that the current version is bigger than the `minimum_version`
  // defined in config. Raises an error if it doesn't match.
  _checkCurrentVersion() {
    const minimumVersion = this.get('minimum_version');
    return;

    //TODO: implement this
    // if ()
    // return if Gem::Dependency.new('', ">= #{minimum_version}")
    //                          .match?('', VERSION)

    // raise ClientTooOldError,
    //       'The .importjs.json file you are using requires version ' \
    //       "#{get('minimum_version')}. You are using #{VERSION}."
  }
}

module.exports = Configuration;
