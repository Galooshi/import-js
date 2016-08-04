// @flow

import path from 'path';

import escapeRegExp from 'lodash.escaperegexp';

import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import requireResolve from './requireResolve';
import resolveImportPathAndMain from './resolveImportPathAndMain';

function normalizePath(pathToNormalize: string): string {
  if (!pathToNormalize) {
    return '';
  }
  return pathToNormalize.replace(/^\.\/?/, '');
}

// Class that represents a js module found in the file system
export default class JsModule {
  hasNamedExports: ?boolean;
  importPath: string;
  lookupPath: string;
  filePath: string;
  mainFile: ?string;
  variableName: string;
  workingDirectory: string;

  /**
   * @param {String} opts.lookupPath the lookup path in which this module was
   *   found
   * @param {Boolean} hasNamedExports
   * @param {String|null} opts.makeRelativeTo a path to a different file which
   *   the resulting import path should be relative to.
   * @param {String} opts.relativeFilePath a full path to the file, relative to
   *   the project root.
   * @param {Array} opts.stripFileExtensions a list of file extensions to strip,
   *   e.g. ['.js', '.jsx']
   * @param {String} opts.stripFromPath
   * @param {String} opts.variableName
   * @param {String} opts.workingDirectory
   * @return {JsModule}
   */
  static construct({
    hasNamedExports,
    lookupPath,
    makeRelativeTo,
    relativeFilePath,
    stripFileExtensions,
    stripFromPath,
    variableName,
    workingDirectory = process.cwd(),
  } : {
    hasNamedExports?: boolean,
    lookupPath: string,
    makeRelativeTo?: ?string,
    relativeFilePath: string,
    stripFileExtensions: Array<string>,
    stripFromPath?: string,
    variableName: string,
    workingDirectory: string
  } = {}): ?JsModule {
    const jsModule = new JsModule();
    jsModule.lookupPath = normalizePath(lookupPath);
    jsModule.filePath = normalizePath(relativeFilePath);

    const importPathAndMainFile = resolveImportPathAndMain(
      jsModule.filePath, stripFileExtensions, workingDirectory);
    let importPath = importPathAndMainFile[0];
    const mainFile = importPathAndMainFile[1];

    if (!importPath) {
      return null;
    }

    if (mainFile) {
      jsModule.filePath = path.normalize(`${importPath}/${mainFile}`);
    }

    importPath = importPath.replace(
      RegExp(`^${escapeRegExp(jsModule.lookupPath)}\/`), '');

    jsModule.importPath = importPath;
    jsModule.mainFile = mainFile;
    jsModule.hasNamedExports = hasNamedExports;
    jsModule.variableName = variableName;
    if (makeRelativeTo) {
      jsModule.makeRelativeTo(makeRelativeTo);
    } else if (stripFromPath) {
      jsModule.stripFromPath(stripFromPath);
    }
    return jsModule;
  }

  constructor({
    hasNamedExports,
    importPath,
    variableName,
  } : {
    hasNamedExports?: boolean,
    importPath: string,
    variableName: string,
  } = {}) {
    this.hasNamedExports = hasNamedExports;
    this.importPath = importPath;
    this.variableName = variableName;
  }

  makeRelativeTo(makeRelativeToPath: string) {
    if (this.lookupPath === undefined || this.lookupPath === null) {
      return;
    }

    // Ignore if the file to relate to is part of a different lookupPath
    if (!makeRelativeToPath.startsWith(this.lookupPath)) {
      return;
    }

    // Strip out the lookupPath
    const makeRelativeTo = makeRelativeToPath.replace(
      RegExp(`^${escapeRegExp(this.lookupPath)}/`), '');

    let importPath = path.relative(
      path.dirname(makeRelativeTo),
      this.importPath
    );

    // `path.relative` will not add "./" automatically
    if (!importPath.startsWith('.')) {
      importPath = `./${importPath}`;
    }

    this.importPath = importPath;
  }

  stripFromPath(prefix: string) {
    if (!prefix) {
      return;
    }
    this.importPath = this.importPath.replace(
      RegExp(`^${escapeRegExp(prefix)}`), '');
  }

  displayName(): string {
    const parts = [this.importPath];
    if (this.mainFile) {
      parts.push(` (main: ${this.mainFile})`);
    }
    return parts.join('');
  }

  resolvedFilePath(
    pathToCurrentFile: string,
    workingDirectory: string = process.cwd()
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
      return path.resolve(path.dirname(pathToCurrentFile), this.importPath);
    }

    // If all of the above fails to find a path, we fall back to using
    // require.resolve() to find the file path.
    return requireResolve(this.importPath, workingDirectory || process.cwd());
  }

  toImportStatement(
    config: Configuration
  ): ImportStatement {
    let namedImports = [];
    let defaultImport = '';
    if (this.hasNamedExports) {
      namedImports = [this.variableName];
    } else {
      defaultImport = this.variableName;
    }

    const pathToImportedModule = this.resolvedFilePath(config.pathToCurrentFile,
                                                       config.workingDirectory);

    return new ImportStatement({
      declarationKeyword:
        config.get('declarationKeyword', { pathToImportedModule }),
      defaultImport,
      hasSideEffects: false,
      importFunction: config.get('importFunction', { pathToImportedModule }),
      namedImports,
      path: config.get('moduleNameFormatter', {
        pathToImportedModule,
        moduleName: this.importPath,
      }),
    });
  }
}
