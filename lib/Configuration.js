// @flow

import crypto from 'crypto';
import os from 'os';
import path from 'path';

import globals from 'globals';
import semver from 'semver';

import FileUtils from './FileUtils';
import JsModule from './JsModule';
import findPackageDependencies from './findPackageDependencies';
import meteorEnvironment from './environments/meteorEnvironment';
import nodeEnvironment from './environments/nodeEnvironment';
import normalizePath from './normalizePath';
import version from './version';

const JSON_CONFIG_FILE = '.importjs.json';
const JS_CONFIG_FILE = '.importjs.js';

function findGlobalsFromEnvironments(
  environments: Array<string>,
): Array<string> {
  const result = Object.keys(globals.builtin);

  environments.forEach((environment: string) => {
    const envGlobals = globals[environment];
    if (!envGlobals) {
      return;
    }
    result.push(...Object.keys(envGlobals));
  });
  return result;
}

const DEFAULT_CONFIG = {
  aliases: {},
  declarationKeyword: 'import',
  cacheLocation: ({ config }: Object): string => {
    const hash = crypto
      .createHash('md5')
      .update(`${config.workingDirectory}-v4`)
      .digest('hex');
    return path.join(os.tmpdir(), `import-js-${hash}.db`);
  },
  coreModules: [],
  namedExports: {},
  environments: [],
  excludes: [],
  globals: ({ config }: Object): Array<string> =>
    findGlobalsFromEnvironments(config.get('environments')),
  groupImports: true,
  ignorePackagePrefixes: [],
  importDevDependencies: false,
  importFunction: 'require',
  importStatementFormatter: ({ importStatement }: Object): string =>
    importStatement,
  logLevel: 'info',
  maxLineLength: 80,
  minimumVersion: '0.0.0',
  moduleNameFormatter: ({ moduleName }: Object): string => moduleName,
  moduleSideEffectImports: (): Array<string> => [],
  sortImports: true,
  stripFileExtensions: ['.js', '.jsx'],
  tab: '  ',
  useRelativePaths: true,
  packageDependencies: ({ config }: Object): Set<string> =>
    findPackageDependencies(
      config.workingDirectory,
      config.get('importDevDependencies'),
    ),
};

// Default configuration options, and options inherited from environment
// configuration are overridden if they appear in user config. Some options,
// however, get merged with the parent configuration. This list specifies which
// ones are merged.
const MERGABLE_CONFIG_OPTIONS = [
  'aliases',
  'coreModules',
  'namedExports',
  'globals',
];

const KNOWN_CONFIGURATION_OPTIONS = [
  'aliases',
  'cacheLocation',
  'coreModules',
  'declarationKeyword',
  'environments',
  'excludes',
  'globals',
  'groupImports',
  'ignorePackagePrefixes',
  'importDevDependencies',
  'importFunction',
  'importStatementFormatter',
  'logLevel',
  'maxLineLength',
  'minimumVersion',
  'moduleNameFormatter',
  'moduleSideEffectImports',
  'namedExports',
  'sortImports',
  'stripFileExtensions',
  'tab',
  'useRelativePaths',
];

const ENVIRONMENTS = {
  node: nodeEnvironment,
  meteor: meteorEnvironment,
};

function checkForUnknownConfiguration(config: Object): Array<string> {
  const messages = [];

  Object.keys(config).forEach((option: string) => {
    if (KNOWN_CONFIGURATION_OPTIONS.indexOf(option) === -1) {
      messages.push(`Unknown configuration: \`${option}\``);
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
function checkCurrentVersion(minimumVersion: string) {
  if (semver.gte(version(), minimumVersion)) {
    return;
  }

  throw Error(
    `The configuration file for this project requires version ${minimumVersion} or newer. You are using ${version()}.`,
  );
}

function mergedValue(values: Array<any>, key: string, options: Object): any {
  let mergedResult;
  for (let i = 0; i < values.length; i += 1) {
    let value = values[i];
    if (typeof value === 'function') {
      value = value(options);
    }
    if (MERGABLE_CONFIG_OPTIONS.indexOf(key) === -1) {
      // This key shouldn't be merged
      return value;
    }
    if (Array.isArray(value)) {
      mergedResult = (mergedResult || []).concat(value);
    } else if (typeof value === 'object') {
      mergedResult = Object.assign(mergedResult || {}, value);
    } else {
      // Neither an object nor an array, so we just return the first value we
      // have.
      return value;
    }
  }
  return mergedResult;
}

// Class that initializes configuration from a .importjs.js file
export default class Configuration {
  pathToCurrentFile: string;
  messages: Array<string>;
  configs: Array<Object>;
  workingDirectory: string;

  constructor(
    pathToCurrentFile: string,
    workingDirectory: string = process.cwd(),
  ) {
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
      this.messages.push(...checkForUnknownConfiguration(userConfig));

      // Add configurations for the environments specified in the user config
      // file.
      (this.get('environments') || []).forEach((environment: string) => {
        const envConfig = ENVIRONMENTS[environment];
        if (envConfig) {
          this.configs.push(envConfig);
        }
      });
    }

    this.configs.push(DEFAULT_CONFIG);

    checkCurrentVersion(this.get('minimumVersion'));
  }

  get(
    key: string,
    {
      pathToImportedModule,
      moduleName,
      importStatement,
    }: {
      pathToImportedModule?: string,
      moduleName?: string,
      importStatement?: string,
    } = {},
  ): any {
    const applyingConfigs = this.configs.filter((config: Object): boolean =>
      Object.prototype.hasOwnProperty.call(config, key));

    return mergedValue(
      applyingConfigs.map((config: Object): any => config[key]),
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

  loadUserConfig(): ?Object {
    const jsConfig = FileUtils.readJsFile(
      path.join(this.workingDirectory, JS_CONFIG_FILE),
    );

    if (jsConfig && Object.keys(jsConfig).length === 0) {
      // If you forget to use `module.exports`, the config object will be `{}`.
      // To prevent subtle errors from happening, we surface an error message to
      // the user.
      throw new Error(
        `Nothing exported from ${JS_CONFIG_FILE}. You need to use \`module.exports\` to specify what gets exported from the file.`,
      );
    }

    if (jsConfig) {
      return jsConfig;
    }

    const jsonConfig = FileUtils.readJsonFile(
      path.join(this.workingDirectory, JSON_CONFIG_FILE),
    );

    if (jsonConfig) {
      this.messages.push(
        'Using JSON to configure ImportJS is deprecated and will go away in a future version. Use an `.importjs.js` file instead.',
      );
    }

    return jsonConfig;
  }

  resolveAlias(variableName: string): ?string {
    let importPath = this.get('aliases')[variableName];
    if (!importPath) {
      return null;
    }

    importPath = importPath.path || importPath; // path may be an object

    if (this.pathToCurrentFile !== './') {
      // aliases can have dynamic `{filename}` parts
      importPath = importPath.replace(
        /\{filename\}/,
        path.basename(this.pathToCurrentFile, path.extname(this.pathToCurrentFile)),
      );
    }
    return importPath;
  }

  resolveNamedExports(variableName: string): ?JsModule {
    const allNamedExports = this.get('namedExports');
    const importPath = Object.keys(allNamedExports)
      .find(
        (key: string): boolean =>
          allNamedExports[key].indexOf(variableName) !== -1,
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
