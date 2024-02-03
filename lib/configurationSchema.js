import Ajv from 'ajv';
import ajvInstanceof from 'ajv-keywords/dist/keywords/instanceof';
import globals from 'globals';
import findPackageDependencies from './findPackageDependencies';
import { DEFAULT_PARSER_PLUGINS } from './parse.js';
import crypto from 'crypto';
import path from 'path';
import os from 'os';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    aliases: {
      default: {},
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      ],
    },
    cacheLocation: {
      instanceof: 'Function',
      default: ({ config }) => {
        const hash = crypto
          .createHash('md5')
          .update(`${config.workingDirectory}-v4`)
          .digest('hex');
        return path.join(os.tmpdir(), `import-js-${hash}.db`);
      },
    },
    coreModules: {
      default: [],
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ],
    },
    danglingCommas: {
      default: true,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'boolean',
        },
      ],
    },
    declarationKeyword: {
      default: 'import',
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'string',
          enum: ['var', 'const', 'import'],
        },
      ],
    },
    emptyLineBetweenGroups: {
      default: true,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'boolean',
        },
      ],
    },
    environments: {
      default: [],
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
            enum: ['meteor', 'node', 'browser', 'jasmine', 'jest'],
          },
        },
      ],
    },
    excludes: {
      default: [],
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ],
    },
    globals: {
      default: ({ config }) =>
        findGlobalsFromEnvironments(config.get('environments')),
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ],
    },
    groupImports: {
      default: true,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'boolean',
        },
      ],
    },
    ignorePackagePrefixes: {
      default: [],
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ],
    },
    importDevDependencies: {
      default: false,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'boolean',
        },
      ],
    },
    importFunction: {
      default: 'require',
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'string',
        },
      ],
    },
    importStatementFormatter: {
      instanceof: 'Function',
      default: ({ importStatement }) => importStatement,
    },
    logLevel: {
      default: 'info',
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          default: 'info',
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error'],
        },
      ],
    },
    maxLineLength: {
      default: 80,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'integer',
          minimum: 10,
        },
      ],
    },
    mergableOptions: {
      type: 'object',
      default: {
        aliases: true,
        coreModules: true,
        namedExports: true,
        globals: true,
      },
      additionalProperties: false,
      properties: {
        aliases: { type: 'boolean' },
        coreModules: { type: 'boolean' },
        danglingCommas: { type: 'boolean' },
        declarationKeyword: { type: 'boolean' },
        environments: { type: 'boolean' },
        excludes: { type: 'boolean' },
        globals: { type: 'boolean' },
        groupImports: { type: 'boolean' },
        ignorePackagePrefixes: { type: 'boolean' },
        importDevDependencies: { type: 'boolean' },
        importFunction: { type: 'boolean' },
        importStatementFormatter: { type: 'boolean' },
        logLevel: { type: 'boolean' },
        maxLineLength: { type: 'boolean' },
        minimumVersion: { type: 'boolean' },
        moduleNameFormatter: { type: 'boolean' },
        namedExports: { type: 'boolean' },
        sortImports: { type: 'boolean' },
        stripFileExtensions: { type: 'boolean' },
        tab: { type: 'boolean' },
        useRelativePaths: { type: 'boolean' },
      },
    },
    minimumVersion: {
      default: '0.0.0',
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'string',
        },
      ],
    },
    moduleNameFormatter: {
      instanceof: 'Function',
      default: ({ moduleName }) => moduleName,
    },
    moduleSideEffectImports: {
      instanceof: 'Function',
      default: () => [],
    },
    namedExports: {
      default: {},
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      ],
    },
    packageDependencies: {
      default: ({ config }) =>
        findPackageDependencies(
          config.workingDirectory,
          config.get('importDevDependencies'),
        ),
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ],
    },
    parserPlugins: {
      default: DEFAULT_PARSER_PLUGINS,
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'string',
          },
          {
            type: 'array',
            minItems: 2,
            additionalItems: false,
            items: [
              {
                type: 'string',
              },
              {
                type: 'object',
                additionalProperties: {
                  type: 'string',
                },
              },
            ],
          },
        ],
      },
    },
    sortImports: {
      default: true,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'boolean',
        },
      ],
    },
    stripFileExtensions: {
      default: ['.js', '.jsx', '.ts', '.tsx'],
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      ],
    },
    tab: {
      default: '  ',
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'string',
        },
      ],
    },
    useRelativePaths: {
      default: true,
      anyOf: [
        {
          instanceof: 'Function',
        },
        {
          type: 'boolean',
        },
      ],
    },
  },
};

function findGlobalsFromEnvironments(environments) {
  const result = Object.keys(globals.builtin);

  environments.forEach((environment) => {
    const envGlobals = globals[environment];
    if (!envGlobals) {
      return;
    }
    result.push(...Object.keys(envGlobals));
  });
  return result;
}

export function getDefaultConfig() {
  return Object.entries(SCHEMA.properties).reduce((acc, [k, v]) => {
    if (typeof v !== `object` || v === null) {
      throw new Error(
        `Expected schema key '${k}' to be an object, but it was of type '${typeof v}'. Got: ${v}`,
      );
    }
    if (v.hasOwnProperty('default')) {
      acc[k] = v.default;
    }
    return acc;
  }, {});
}

export function validate(data) {
  const ajv = new Ajv();
  ajvInstanceof(ajv);

  const validate = ajv.compile(SCHEMA);

  if (!validate(data)) {
    return {
      error: true,
      messages: validate.errors
        .map((err) => {
          // report unknown identifiers the same as we have done in the past
          // so we can showcase that the move to Ajv didn't change previous
          // behaviors
          if (err.message === 'must NOT have additional properties') {
            // remove the extraneous identifier so we avoid later errors in code
            // instancePath is empty if root key
            const rootKey =
              err.instancePath.split('/')[1] || err.params.additionalProperty;
            delete data[rootKey];

            return (
              'Unknown configuration: `' +
              (err.instancePath ? err.instancePath + '.' : '') +
              err.params.additionalProperty +
              '`'
            );
          } else {
            // remove the failing identifier so we avoid later errors in code
            const rootKey = err.instancePath.split('/')[1];
            delete data[rootKey];

            console.error(err);

            return 'Invalid configuration: `' + err.instancePath.slice(1) + '`';
          }
        })
        .filter((val, index, a) => a.indexOf(val) === index)
        .filter(Boolean),
    };
  }

  return { error: false, messages: [] };
}
