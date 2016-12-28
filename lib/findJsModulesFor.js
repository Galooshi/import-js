// @flow

import escapeRegExp from 'lodash.escaperegexp';
import minimatch from 'minimatch';
import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import Configuration from './Configuration';
import JsModule from './JsModule';
import ModuleFinder from './ModuleFinder';
import findMatchingFiles from './findMatchingFiles';
import formattedToRegex from './formattedToRegex';

function findImportsFromEnvironment(
  config: Configuration,
  variableName: string
): Array<JsModule> {
  return config.get('coreModules')
    .filter((dep: string): boolean => dep.toLowerCase() === variableName.toLowerCase())
    .map((dep: string): JsModule => new JsModule({
      importPath: dep,
      variableName,
    }));
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

  return config.get('packageDependencies')
    .filter((dep: string): boolean => depRegex.test(dep))
    .map((dep: string): ?JsModule => (
      JsModule.construct({
        relativeFilePath: `node_modules/${dep}/package.json`,
        stripFileExtensions: [],
        variableName,
        workingDirectory: config.workingDirectory,
      })
    ))
    .filter(Boolean);
}

function findImportsFromLocalFiles(
  config: Configuration,
  variableName: string,
  pathToCurrentFile: string
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    findMatchingFiles(variableName, config.workingDirectory)
    .then((files: Array<string>) => {
      const matchedModules = [];
      const excludes = config.get('excludes');
      files.forEach((f: string) => {
        const isExcluded = excludes
          .some((globPattern: string): boolean => minimatch(f, globPattern));
        if (isExcluded) {
          return;
        }

        const module = JsModule.construct({
          relativeFilePath: f,
          stripFileExtensions:
            config.get('stripFileExtensions', { pathToImportedModule: f }),
          makeRelativeTo:
            config.get('useRelativePaths', { pathToImportedModule: f }) &&
            pathToCurrentFile,
          variableName,
          workingDirectory: config.workingDirectory,
        });

        if (module) {
          matchedModules.push(module);
        }
      });
      resolve(matchedModules);
    }).catch((error: Object) => {
      reject(error);
    });
  });
}

function findImportsFromModuleFinder(
  config: Configuration,
  variableName: string,
  finder: ModuleFinder,
  pathToCurrentFile: string
): Array<JsModule> {
  return new Promise((resolve: Function, reject: Function) => {
    finder.find(variableName).then((exports: Array<Object>) => {
      const modules = exports.map(({ path, name }: Object): JsModule =>
        JsModule.construct({
          hasNamedExports: name !== 'default',
          relativeFilePath: path,
          stripFileExtensions:
            config.get('stripFileExtensions', { pathToImportedModule: path }),
          makeRelativeTo:
            config.get('useRelativePaths', { pathToImportedModule: path }) &&
            pathToCurrentFile,
          variableName,
          workingDirectory: config.workingDirectory,
        })
      );
      resolve(modules);
    }).catch(reject);
  });
}

function dedupeAndSort(modules: Array<JsModule>): Array<JsModule> {
  // We might end up having duplicate modules here.  In order to dedupe
  // these, we remove the module with the longest path
  const sorted = sortBy(
    modules,
    (module: JsModule): number => module.importPath.length
  );
  const uniques = uniqBy(
    sorted,
    (module: JsModule): string => module.filePath
  );
  return sortBy(
    uniques,
    (module: JsModule): string => module.displayName()
  );
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

    const matchedModules = [];

    matchedModules.push(...findImportsFromEnvironment(config, variableName));
    matchedModules.push(...findImportsFromPackageJson(config, variableName));

    const finder = ModuleFinder.getForWorkingDirectory(config.workingDirectory);
    if (finder.isEnabled()) {
      findImportsFromModuleFinder(config, variableName, finder, pathToCurrentFile)
        .then((modules: Array<JsModule>) => {
          matchedModules.push(...modules);
          resolve(dedupeAndSort(matchedModules));
        }).catch((error: Object) => {
          reject(error);
        });
    } else {
      findImportsFromLocalFiles(config, variableName, pathToCurrentFile)
        .then((modules: Array<JsModule>) => {
          matchedModules.push(...modules);
          resolve(dedupeAndSort(matchedModules));
        }).catch((error: Object) => {
          reject(error);
        });
    }
  });
}
