// @flow

import minimatch from 'minimatch';
import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/uniqBy';

import Configuration from './Configuration';
import JsModule from './JsModule';
import ModuleFinder from './ModuleFinder';

function findImportsFromEnvironment(
  config: Configuration,
  variableName: string,
): Array<JsModule> {
  return config
    .get('coreModules')
    .filter((dep: string): boolean =>
      dep.toLowerCase() === variableName.toLowerCase())
    .map((dep: string): JsModule => new JsModule({
      importPath: dep,
      variableName,
    }));
}

function findJsModulesFromModuleFinder(
  config: Configuration,
  normalizedName: string,
  variableName: string,
  finder: ModuleFinder,
  pathToCurrentFile: string,
  options: Object = {},
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    let isWantedPackageDependency = Boolean;
    if (!config.get('importDevDependencies')) {
      const packageDependencies = config.get('packageDependencies');
      isWantedPackageDependency = (packageName: string): boolean =>
        packageDependencies.has(packageName);
    }

    const isSearch = !!options.search;
    const method = isSearch ? 'search' : 'find';

    finder[method](normalizedName)
      .then((exports: Array<Object>) => {
        const modules = exports.map(({
          name, path, isDefault, isType, packageName }: 
Object): ?JsModule => {
          // Filter out modules that are in the `excludes` config.
          const isExcluded = config.get('excludes')
            .some((glob: string): boolean => minimatch(path, glob));
          if (isExcluded) {
            return undefined;
          }

          if (packageName) {
            if (!isWantedPackageDependency(packageName)) {
              return undefined;
            }
            return new JsModule({
              importPath: packageName,
              variableName: isSearch ? name : variableName,
              hasNamedExports: !isDefault,
              isType,
            });
          }

          return JsModule.construct({
            hasNamedExports: !isDefault,
            isType,
            relativeFilePath: path,
            stripFileExtensions: config.get('stripFileExtensions', {
              pathToImportedModule: path,
            }),
            makeRelativeTo: config.get('useRelativePaths', {
              pathToImportedModule: path,
            }) &&
              config.pathToCurrentFile,
            variableName: isSearch ? name : variableName,
            workingDirectory: config.workingDirectory,
          });
        });
        resolve(modules.filter(Boolean));
      })
      .catch(reject);
  });
}

export function dedupeAndSort(modules: Array<JsModule>): Array<JsModule> {
  // We might end up having duplicate modules here.  In order to dedupe
  // these, we remove the module with the longest path
  const sorted = sortBy(
    modules,
    (module: JsModule): number => module.importPath.length,
  );
  const uniques = uniqBy(
    sorted,
    // Default export and named export with same name from the same module are not considered dupes
    (module: JsModule): string => [module.importPath, module.hasNamedExports].join(),
  );
  // Sorting by path, but with default exports before named exports
  return sortBy(uniques, (module: JsModule): string =>
    [module.importPath, module.hasNamedExports ? 1 : 0].join());
}

const NON_PATH_ALIAS_PATTERN = /^[a-zA-Z0-9-_]+$/;


type FindJsModulesForOptionsType = {
  search: boolean,
};

export default function findJsModulesFor(
  config: Configuration,
  variableName: string,
  options?: FindJsModulesForOptionsType,
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    let normalizedName = variableName;
    const alias = config.resolveAlias(variableName);
    if (alias) {
      if (NON_PATH_ALIAS_PATTERN.test(alias)) {
        // The alias is likely a package dependency. We can use it in the
        // ModuleFinder lookup.
        normalizedName = alias;
      } else {
        // The alias is a path of some sort. Use it directly as the moduleName
        // in the import.
        resolve([new JsModule({ importPath: alias, variableName })]);
        return;
      }
    }

    const namedImportsModule = config.resolveNamedExports(variableName);
    if (namedImportsModule) {
      resolve([namedImportsModule]);
      return;
    }

    const matchedModules = [];

    matchedModules.push(...findImportsFromEnvironment(config, variableName));

    const finder = ModuleFinder.getForWorkingDirectory(
      config.workingDirectory,
      {
        excludes: config.get('excludes'),
        ignorePackagePrefixes: config.get('ignorePackagePrefixes'),
      },
    );
    findJsModulesFromModuleFinder(
      config,
      normalizedName,
      variableName,
      finder,
      config.pathToCurrentFile,
      options,
    )
      .then((modules: Array<JsModule>) => {
        matchedModules.push(...modules);
        resolve(dedupeAndSort(matchedModules));
      })
      .catch((error: Object) => {
        reject(error);
      });
  });
}
