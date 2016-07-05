// @flow

import escapeRegExp from 'lodash.escaperegexp';
import minimatch from 'minimatch';
import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import Configuration from './Configuration';
import JsModule from './JsModule';
import findMatchingFiles from './findMatchingFiles';
import formattedToRegex from './formattedToRegex';

function findImportsFromEnvironment(
  config: Configuration,
  variableName: string
): Array<JsModule> {
  return config.environmentCoreModules()
    .filter((dep: string): boolean => dep.toLowerCase() === variableName.toLowerCase())
    .map((dep: string): JsModule => new JsModule({
      importPath: dep,
      variableName,
    }));
}

function compact<T>(arr: Array<?T>): Array<T> {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (!!arr[i]) {
      result.push(arr[i]);
    }
  }
  return result;
}

function findImportsFromPackageJson(
  config: Configuration,
  variableName: string
): Array<JsModule> {
  const formattedVarName = formattedToRegex(variableName);

  const ignorePrefixes = config.get('ignorePackagePrefixes')
    .map((prefix: string): string => escapeRegExp(prefix));

  const depRegex = RegExp(
    `^(?:${ignorePrefixes.join('|')})?${formattedVarName}$`
  );

  const modules = config.packageDependencies()
    .filter((dep: string): boolean => depRegex.test(dep))
    .map((dep: string): ?JsModule => (
      JsModule.construct({
        lookupPath: 'node_modules',
        relativeFilePath: `node_modules/${dep}/package.json`,
        stripFileExtensions: [],
        variableName,
        workingDirectory: config.workingDirectory,
      })
    ));

  return compact(modules);
}

function findImportsFromLocalFiles(
  config: Configuration,
  variableName: string,
  pathToCurrentFile: string
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    const lookupPaths = config.get('lookupPaths');
    const promises = lookupPaths.map((lookupPath: string): Promise<Array<string>> =>
        findMatchingFiles(lookupPath, variableName, config.workingDirectory));

    Promise.all(promises).then((results: Array<Array<string>>) => {
      const matchedModules = [];
      results.forEach((files: Array<string>, index: number) => {
        // Grab the lookup path originally associated with the promise. Because
        // Promise.all maintains the order of promises, we can use the index
        // here.
        const lookupPath = lookupPaths[index];
        files.forEach((f: string) => {
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
            variableName,
            workingDirectory: config.workingDirectory,
          });

          if (module) {
            matchedModules.push(module);
          }
        });
      });
      resolve(matchedModules);
    }).catch((error: Object) => {
      reject(error);
    });
  });
}

export default function findJsModulesFor(
  config: Configuration,
  variableName: string,
  pathToCurrentFile: string
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    const aliasModule = config.resolveAlias(variableName, pathToCurrentFile);
    if (aliasModule) {
      resolve([aliasModule]);
      return;
    }

    const namedImportsModule = config.resolveNamedExports(variableName);
    if (namedImportsModule) {
      resolve([namedImportsModule]);
      return;
    }

    let matchedModules = [];

    matchedModules.push(...findImportsFromEnvironment(config, variableName));
    matchedModules.push(...findImportsFromPackageJson(config, variableName));

    findImportsFromLocalFiles(
      config, variableName, pathToCurrentFile).then((modules: Array<JsModule>) => {
        matchedModules.push(...modules);

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
        resolve(sortBy(
          matchedModules,
          (module: JsModule): string => module.displayName()
        ));
      }).catch((error: Object) => {
        reject(error);
      });
  });
}
