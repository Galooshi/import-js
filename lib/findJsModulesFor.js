// @flow

import escapeRegExp from 'lodash.escaperegexp';
import minimatch from 'minimatch';
import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import findMatchingFiles from './findMatchingFiles';
import formattedToRegex from './formattedToRegex';
import JsModule from './JsModule';

function findImportsFromEnvironment(
  config: Object, // TODO change Object to Configuration
  variableName: string
): Array<JsModule> {
  return config.environmentCoreModules()
    .filter((dep: string): boolean => dep.toLowerCase() === variableName.toLowerCase())
    .map((dep: string): JsModule => new JsModule({ importPath: dep }));
}

function findImportsFromPackageJson(
  config: Object,
  variableName: string
): Array<JsModule> {
  const formattedVarName = formattedToRegex(variableName);

  const ignorePrefixes = config.get('ignorePackagePrefixes')
    .map((prefix: string): string => escapeRegExp(prefix));

  const depRegex = RegExp(
    `^(?:${ignorePrefixes.join('|')})?${formattedVarName}$`
  );

  return config.packageDependencies()
    .filter((dep: string): boolean => depRegex.test(dep))
    .map((dep: string): ?JsModule => (
      JsModule.construct({
        lookupPath: 'node_modules',
        relativeFilePath: `node_modules/${dep}/package.json`,
        stripFileExtensions: [],
      })
    ))
    .filter((jsModule: ?JsModule): boolean => !!jsModule);
}

function findImportsFromLocalFiles(
  config: Object,
  variableName: string,
  pathToCurrentFile: string
): Array<JsModule> {
  const matchedModules = [];

  config.get('lookupPaths').forEach((lookupPath: string) => {
    findMatchingFiles(lookupPath, variableName).forEach((f: string) => {
      const isExcluded = config.get('excludes')
        .some((globPattern: string): boolean => minimatch(f, globPattern));
      if (isExcluded) {
        return;
      }

      const module = JsModule.construct({
        lookupPath,
        relativeFilePath: f,
        stripFileExtensions:
          config.get('stripFileExtensions', { fromFile: f }),
        makeRelativeTo:
          config.get('useRelativePaths', { fromFile: f }) &&
          pathToCurrentFile,
        stripFromPath: config.get('stripFromPath', { fromFile: f }),
      });

      if (module) {
        matchedModules.push(module);
      }
    });
  });

  return matchedModules;
}

export default function findJsModulesFor(
  config: Object,
  variableName: string,
  pathToCurrentFile: string
): Array<JsModule> {
  const aliasModule = config.resolveAlias(variableName, pathToCurrentFile);
  if (aliasModule) {
    return [aliasModule];
  }

  const namedImportsModule = config.resolveNamedExports(variableName);
  if (namedImportsModule) {
    return [namedImportsModule];
  }

  let matchedModules = [];

  matchedModules.push(...findImportsFromEnvironment(config, variableName));
  matchedModules.push(...findImportsFromPackageJson(config, variableName));
  matchedModules.push(
    ...findImportsFromLocalFiles(config, variableName, pathToCurrentFile)
  );

  // If you have overlapping lookup paths, you might end up seeing the same
  // module to import twice. In order to dedupe these, we remove the module
  // with the longest path
  matchedModules = sortBy(
    matchedModules,
    (module: JsModule): number => module.importPath.length
  );
  matchedModules = uniqBy(
    matchedModules,
    (module: JsModule): string => module.filePath
  );
  return sortBy(
    matchedModules,
    (module: JsModule): string => module.displayName()
  );
}
