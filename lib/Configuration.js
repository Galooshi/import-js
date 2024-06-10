//

import os from 'os';
import path from 'path';
import has from 'lodash/has';

import semver from 'semver';

import FileUtils from './FileUtils';
import JsModule from './JsModule';
import meteorEnvironment from './environments/meteorEnvironment';
import nodeEnvironment from './environments/nodeEnvironment';
import normalizePath from './normalizePath';
import version from './version';
import { validate, getDefaultConfig } from './configurationSchema.js';

const JSON_CONFIG_FILE = '.importjs.json';
const JS_CONFIG_FILES = ['.importjs.js', '.importjs.cjs', '.importjs.mjs'];

const DEFAULT_CONFIG = getDefaultConfig();

const DEPRECATED_CONFIGURATION_OPTIONS = [];

const ENVIRONMENTS = {
  node: nodeEnvironment,
  meteor: meteorEnvironment,
};

function checkConfiguration(config) {
  const result = validate(config);

  return result.messages;
}

function checkForDeprecatedConfiguration(config) {
  const messages = [];

  Object.keys(config).forEach((option) => {
    if (DEPRECATED_CONFIGURATION_OPTIONS.indexOf(option) !== -1) {
      messages.push(
        `Using ${option} to configure ImportJS is deprecated and ` +
          'will go away in a future version.',
      );
    }
  });

  return messages;
}

/**
 * Checks that the current version is bigger than the `minimumVersion`
 * defined in config.
 * @throws Error if current version is less than the `minimumVersion` defined
 * in config.
 */
function checkCurrentVersion(minimumVersion) {
  if (semver.gte(version(), minimumVersion)) {
    return;
  }

  throw Error(
    `The configuration file for this project requires version ${minimumVersion} or newer. You are using ${version()}.`,
  );
}

function mergedValue(values, key, options) {
  let mergedResult;
  for (let i = 0; i < values.length; i += 1) {
    let value = values[i];
    if (typeof value === 'function') {
      value = value(options);
    }
    // Prevent an endless loop of mergedValue calls
    // The mergableOptions key will get merged by skipping this check
    if (key !== 'mergableOptions') {
      const mergableOptions = options.config.get('mergableOptions');
      if (mergableOptions[key] !== true) {
        // This key shouldn't be merged
        return value;
      }
    }
    if (Array.isArray(value)) {
      mergedResult = (mergedResult || []).concat(value);
    } else if (typeof value === 'object') {
      mergedResult = { ...value, ...(mergedResult || {}) };
    } else {
      // Neither an object nor an array, so we just return the first value we
      // have.
      return value;
    }
  }
  return mergedResult;
}

/**
 * returns configuration from a JS file in home directory if it exists, or null
 */
function loadGlobalJsConfig() {
  for (let i = 0; i < JS_CONFIG_FILES.length; i += 1) {
    const jsConfigFile = JS_CONFIG_FILES[i];
    const globalConfig = FileUtils.readJsFile(
      path.join(os.homedir(), jsConfigFile),
    );
    if (globalConfig) {
      return globalConfig;
    }
  }

  return null;
}

// Class that initializes configuration from a .importjs.js file
export default class Configuration {
  pathToCurrentFile;

  messages;

  configs;

  workingDirectory;

  constructor(pathToCurrentFile, workingDirectory = process.cwd()) {
    this.workingDirectory = workingDirectory;
    this.pathToCurrentFile = normalizePath(pathToCurrentFile, workingDirectory);

    this.messages = [];
    this.configs = [];

    let userConfig;
    try {
      userConfig = this.loadUserConfig();
    } catch (error) {
      this.messages.push(
        `Unable to parse configuration file. Reason:\n${error.stack}`,
      );
    }

    if (userConfig) {
      this.configs.push(userConfig);
      this.messages.push(...checkConfiguration(userConfig));
      this.messages.push(...checkForDeprecatedConfiguration(userConfig));

      // Add configurations for the environments specified in the user config
      // file.
      // Don't use `this.get` because the config hasn't finished initalizing.
      // Use userConfig instead since it's the only one declared
      if (typeof userConfig.environments === 'function') {
        userConfig.environments = userConfig.environments({
          config: this,
          pathToCurrentFile: this.pathToCurrentFile,
        });
      }
      (userConfig.environments || []).forEach((environment) => {
        const envConfig = ENVIRONMENTS[environment];
        if (envConfig) {
          this.configs.push(envConfig);
        }
      });
    }

    this.configs.push(DEFAULT_CONFIG);

    checkCurrentVersion(this.get('minimumVersion'));
  }

  get(key, { pathToImportedModule, moduleName, importStatement } = {}) {
    const applyingConfigs = this.configs.filter((config) =>
      Object.prototype.hasOwnProperty.call(config, key),
    );

    return mergedValue(
      applyingConfigs.map((config) => config[key]),
      key,
      {
        pathToImportedModule,
        moduleName,
        config: this,
        pathToCurrentFile: this.pathToCurrentFile,
        importStatement,
      },
    );
  }

  loadUserConfig() {
    return (
      this.loadLocalJsConfig() ||
      this.loadLocalJsonConfig() ||
      loadGlobalJsConfig()
    );
  }

  loadLocalJsConfig() {
    for (let i = 0; i < JS_CONFIG_FILES.length; i += 1) {
      const jsConfigFile = JS_CONFIG_FILES[i];
      const jsConfig = FileUtils.readJsFile(
        path.join(this.workingDirectory, jsConfigFile),
      );

      if (jsConfig && Object.keys(jsConfig).length === 0) {
        // If you forget to use `module.exports`, the config object will be `{}`.
        // To prevent subtle errors from happening, we surface an error message to
        // the user.
        throw new Error(
          `Nothing exported from ${jsConfigFile}. You need to use \`module.exports\` to specify what gets exported from the file.`,
        );
      }

      if (jsConfig) {
        return jsConfig;
      }
    }

    return null;
  }

  loadLocalJsonConfig() {
    const jsonConfig = FileUtils.readJsonFile(
      path.join(this.workingDirectory, JSON_CONFIG_FILE),
    );

    if (jsonConfig) {
      this.messages.push(
        'Using JSON to configure ImportJS is deprecated and will go away in a future version. Use an `.importjs.js` file instead.',
      );
      return jsonConfig;
    }

    return null;
  }

  resolveAlias(variableName) {
    if (!has(this.get('aliases'), variableName)) {
      return null;
    }

    let importPath = this.get('aliases')[variableName];

    importPath = importPath.path || importPath; // path may be an object

    if (this.pathToCurrentFile !== './') {
      // aliases can have dynamic `{filename}` parts
      importPath = importPath.replace(
        /\{filename\}/,
        path.basename(
          this.pathToCurrentFile,
          path.extname(this.pathToCurrentFile),
        ),
      );
    }
    return importPath;
  }

  resolveNamedExports(variableName) {
    const allNamedExports = this.get('namedExports');
    const importPath = Object.keys(allNamedExports).find(
      (key) => allNamedExports[key].indexOf(variableName) !== -1,
    );

    if (!importPath) {
      return undefined;
    }

    const jsModule = new JsModule({
      importPath,
      hasNamedExports: true,
      variableName,
    });
    return jsModule;
  }
}
