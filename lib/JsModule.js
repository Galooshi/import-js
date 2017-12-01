// @flow

import path from 'path';

import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import forwardSlashes from './forwardSlashes';
import requireResolve from './requireResolve';
import resolveImportPathAndMain from './resolveImportPathAndMain';

// TODO figure out a more holistic solution than stripping node_modules
function stripNodeModules(path: string): string {
  if (path.startsWith('node_modules/')) {
    return path.slice(13);
  }

  return path;
}

// Class that represents a js module found in the file system
export default class JsModule {
  hasNamedExports: ?boolean;
  isType: boolean;
  importPath: string;
  filePath: string;
  variableName: string;
  workingDirectory: string;

  /**
   * @param {Boolean} hasNamedExports
   * @param {Boolean} isType
   * @param {String|null} opts.makeRelativeTo a path to a different file which
   *   the resulting import path should be relative to.
   * @param {String} opts.relativeFilePath a full path to the file, relative to
   *   the project root.
   * @param {Array} opts.stripFileExtensions a list of file extensions to strip,
   *   e.g. ['.js', '.jsx']
   * @param {String} opts.variableName
   * @param {String} opts.workingDirectory
   * @return {JsModule}
   */
  static construct({
    hasNamedExports,
    isType = false,
    makeRelativeTo,
    relativeFilePath,
    stripFileExtensions,
    variableName,
    workingDirectory = process.cwd(),
  }: {
      hasNamedExports?: boolean,
      isType?: boolean,
      makeRelativeTo?: ?string,
      relativeFilePath: string,
      stripFileExtensions: Array<string>,
      variableName: string,
      workingDirectory: string,
    } = {}): ?JsModule {
    const jsModule = new JsModule();
    jsModule.filePath = relativeFilePath;

    const importPathAndMainFile = resolveImportPathAndMain(
      jsModule.filePath,
      stripFileExtensions,
      workingDirectory,
    );
    const importPath = importPathAndMainFile[0];
    const mainFile = importPathAndMainFile[1];

    if (!importPath) {
      return null;
    }

    if (mainFile) {
      jsModule.filePath = forwardSlashes(path.normalize(path.join(importPath, mainFile)));
    }

    jsModule.importPath = importPath;
    jsModule.hasNamedExports = hasNamedExports;
    jsModule.isType = isType;
    jsModule.variableName = variableName;
    if (makeRelativeTo) {
      jsModule.makeRelativeTo(makeRelativeTo);
    } else {
      jsModule.importPath = jsModule.importPath.replace(/^\.\//, '');
    }
    return jsModule;
  }

  constructor({
    hasNamedExports,
    isType = false,
    importPath,
    variableName,
  }: {
      hasNamedExports?: boolean,
      isType?: boolean,
      importPath: string,
      variableName: string,
    } = {}) {
    this.hasNamedExports = hasNamedExports;
    this.isType = isType;
    this.importPath = importPath;
    this.variableName = variableName;
  }

  makeRelativeTo(makeRelativeToPath: string) {
    let importPath = path.relative(
      path.dirname(makeRelativeToPath),
      this.importPath,
    );

    importPath = forwardSlashes(importPath);

    // `path.relative` will not add "./" automatically
    if (!importPath.startsWith('.')) {
      importPath = `./${importPath}`;
    }

    this.importPath = importPath;
  }

  resolvedFilePath(
    pathToCurrentFile: string,
    workingDirectory: string = process.cwd(),
  ): string {
    if (this.filePath) {
      return this.filePath;
    }

    // There is no filePath. This likely means that we are working with an
    // alias, so we want to expand it to a full path if we can.
    if (this.importPath.startsWith('.')) {
      // The import path in the alias starts with a ".", which means that it is
      // relative to the current file. In order to open this file, we need to
      // expand it to a full path.
      return forwardSlashes(path.resolve(path.dirname(pathToCurrentFile), this.importPath));
    }

    // If all of the above fails to find a path, we fall back to using
    // require.resolve() to find the file path.
    const unresolved = path.join(workingDirectory, this.importPath);
    const resolved = requireResolve(unresolved);
    if (unresolved !== resolved) {
      // We found a location for the import
      return resolved;
    }
    // as a last resort, assume it's a package dependency
    return requireResolve(path.join(workingDirectory, 'node_modules', this.importPath));
  }

  toImportStatement(config: Configuration): ImportStatement {
    let namedImports = [];
    let defaultImport = '';
    if (this.hasNamedExports) {
      namedImports = [{ localName: this.variableName, isType: this.isType }];
    } else {
      defaultImport = this.variableName;
    }

    // TODO figure out a more holistic solution than stripping node_modules
    const pathToImportedModule = stripNodeModules(this.resolvedFilePath(
      config.pathToCurrentFile,
      config.workingDirectory,
    ));

    return new ImportStatement({
      declarationKeyword: config.get('declarationKeyword', {
        pathToImportedModule,
      }),
      defaultImport,
      hasSideEffects: false,
      importFunction: config.get('importFunction', { pathToImportedModule }),
      namedImports,
      areOnlyTypes: this.isType,
      danglingCommas: config.get('danglingCommas'),
      path: config.get('moduleNameFormatter', {
        pathToImportedModule,
        // TODO figure out a more holistic solution than stripping node_modules
        moduleName: stripNodeModules(this.importPath),
      }),
    });
  }
}
