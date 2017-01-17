// @flow

import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import Configuration from './Configuration';
import JsModule from './JsModule';
import ModuleFinder from './ModuleFinder';

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

const PACKAGE_NAME_PATTERN = /\.\/node_modules\/([^/]+)\//;

function findJsModulesFromModuleFinder(
  config: Configuration,
  variableName: string,
  finder: ModuleFinder,
  pathToCurrentFile: string
): Promise<Array<JsModule>> {
  return new Promise((resolve: Function, reject: Function) => {
    let isWantedPackageDependency = Boolean;
    if (!config.get('importDevDependencies')) {
      const packageDependencies = config.get('packageDependencies');
      isWantedPackageDependency = (packageName: string): Boolean =>
        packageDependencies.indexOf(packageName) !== -1;
    }

    finder.find(variableName).then((exports: Array<Object>) => {
      const modules = exports.map(({ path, isDefault }: Object): ?JsModule => {
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
        return JsModule.construct({
          hasNamedExports: !isDefault,
          relativeFilePath: path,
          stripFileExtensions:
            config.get('stripFileExtensions', { pathToImportedModule: path }),
          makeRelativeTo:
            config.get('useRelativePaths', { pathToImportedModule: path }) &&
            pathToCurrentFile,
          variableName,
          workingDirectory: config.workingDirectory,
        });
      });
      resolve(modules.filter(Boolean));
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

    const finder = ModuleFinder.getForWorkingDirectory(
      config.workingDirectory, config.get('excludes'));
    findJsModulesFromModuleFinder(config, variableName, finder, pathToCurrentFile)
      .then((modules: Array<JsModule>) => {
        matchedModules.push(...modules);
        resolve(dedupeAndSort(matchedModules));
      }).catch((error: Object) => {
        reject(error);
      });
  });
}
