import escapeRegExp from 'lodash.escaperegexp';
import minimatch from 'minimatch';
import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import findMatchingFiles from './findMatchingFiles';
import formattedToRegex from './formattedToRegex';
import JsModule from './JsModule';

/**
 * @param {Configuration} config
 * @param {String} variableName
 * @return {Array<JsModule>}
 */
function findImportsFromEnvironment(config, variableName) {
  return config.environmentCoreModules()
    .filter(dep => dep.toLowerCase() === variableName.toLowerCase())
    .map(dep => new JsModule({ importPath: dep }));
}

/**
 * @param {Configuration} config
 * @param {String} variableName
 * @return {Array<JsModule>}
 */
function findImportsFromPackageJson(config, variableName) {
  const formattedVarName = formattedToRegex(variableName);

  const ignorePrefixes = config.get('ignorePackagePrefixes')
    .map(prefix => escapeRegExp(prefix));

  const depRegex = RegExp(
    `^(?:${ignorePrefixes.join('|')})?${formattedVarName}$`
  );

  return config.packageDependencies()
    .filter(dep => dep.match(depRegex))
    .map(dep => (
      JsModule.construct({
        lookupPath: 'node_modules',
        relativeFilePath: `node_modules/${dep}/package.json`,
        stripFileExtensions: [],
      })
    ))
    .filter(jsModule => !!jsModule);
}

/**
 * @param {Configuration} config
 * @param {String} variableName
 * @param {String} pathToCurrentFile
 * @return {Array<JsModule>}
 */
function findImportsFromLocalFiles(config, variableName, pathToCurrentFile) {
  const matchedModules = [];

  config.get('lookupPaths').forEach((lookupPath) => {
    findMatchingFiles(lookupPath, variableName).forEach((f) => {
      if (config.get('excludes').some(
        (globPattern) => minimatch(f, globPattern))) {
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

/**
 * @param {Configuration} config
 * @param {String} variableName
 * @param {String} pathToCurrentFile
 * @return {Array}
 */
export default function findJsModulesFor(
  config,
  variableName,
  pathToCurrentFile
) {
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
  matchedModules = sortBy(matchedModules,
    (module) => module.importPath.length);
  matchedModules = uniqBy(matchedModules,
    (module) => module.filePath);
  return sortBy(matchedModules, (module) => module.displayName());
}
