// @flow

import minimatch from 'minimatch';
import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import Configuration from './Configuration';
import JsModule from './JsModule';
import ModuleFinder from './ModuleFinder';

function findImportsFromEnvironment(
  config: Configuration,
  variableName: string,
): Array<JsModule> {
  return config
    .get('coreModules')
    .filter(
      (dep: string): boolean =>
        dep.toLowerCase() === variableName.toLowerCase(),
    )
    .map(
      (dep: string): JsModule => new JsModule({
        importPath: dep,
        variableName,
      }),
    );
}

const PACKAGE_NAME_PATTERN = /\.\/node_modules\/([^/]+)\//;

function findJsModulesFromModuleFinder(
  config: Configuration,
  normalizedName: string,
  variableName: string,
  finder: ModuleFinder,
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    let isWantedPackageDependency = Boolean;
    if (!config.get('importDevDependencies')) {
      const packageDependencies = config.get('packageDependencies');
      isWantedPackageDependency = (packageName: string): boolean =>
        packageDependencies.has(packageName);
    }

    finder
      .find(normalizedName)
      .then((exports: Array<Object>) => {
        const modules = exports.map((
          { path, isDefault }: Object,
        ): ?JsModule => {
          if (path.startsWith('./node_modules')) {
            const packageName = path.match(PACKAGE_NAME_PATTERN)[1];
            if (!isWantedPackageDependency(packageName)) {
              return undefined;
            }
            return new JsModule({
              importPath: packageName,
              variableName,
              hasNamedExports: !isDefault,
            });
          }

          // Filter out modules that are in the `excludes` config.
          if (config.get('excludes').some((glob: string): boolean =>
            minimatch(path, glob))) {
            return undefined;
          }

          return JsModule.construct({
            hasNamedExports: !isDefault,
            relativeFilePath: path,
            stripFileExtensions: config.get('stripFileExtensions', {
              pathToImportedModule: path,
            }),
            makeRelativeTo: config.get('useRelativePaths', {
              pathToImportedModule: path,
            }) &&
              config.pathToCurrentFile,
            variableName,
            workingDirectory: config.workingDirectory,
          });
        });
        resolve(modules.filter(Boolean));
      })
      .catch(reject);
  });
}

function dedupeAndSort(modules: Array<JsModule>): Array<JsModule> {
  // We might end up having duplicate modules here.  In order to dedupe
  // these, we remove the module with the longest path
  const sorted = sortBy(
    modules,
    (module: JsModule): number => module.importPath.length,
  );
  const uniques = uniqBy(
    sorted,
    (module: JsModule): string => module.importPath,
  );
  return sortBy(uniques, (module: JsModule): string => module.displayName());
}

const NON_PATH_ALIAS_PATTERN = /^[a-zA-Z0-9-_]+$/;

export default function findJsModulesFor(
  config: Configuration,
  variableName: string,
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
