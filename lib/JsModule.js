// @flow

import path from 'path';

import escapeRegExp from 'lodash.escaperegexp';

import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import resolveImportPathAndMain from './resolveImportPathAndMain';

function normalizePath(pathToNormalize: string): string {
  if (!pathToNormalize) {
    return '';
  }
  return pathToNormalize.replace(/^\.\/?/, '');
}

type JsModuleConstructType = {
  hasNamedExports?: boolean,
  lookupPath: string,
  makeRelativeTo?: ?string,
  relativeFilePath: string,
  stripFileExtensions: Array<string>,
  stripFromPath?: string,
};

type JsModuleConstructorType = {
  hasNamedExports?: boolean,
  importPath: string,
};

// Class that represents a js module found in the file system
export default class JsModule {
  hasNamedExports: ?boolean;
  importPath: string;
  lookupPath: string;
  filePath: string;
  mainFile: ?string;

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
   * @return {JsModule}
   */
  static construct({
    hasNamedExports,
    lookupPath,
    makeRelativeTo,
    relativeFilePath,
    stripFileExtensions,
    stripFromPath,
  }: JsModuleConstructType = {}): ?JsModule {
    const jsModule = new JsModule();
    jsModule.lookupPath = normalizePath(lookupPath);
    jsModule.filePath = normalizePath(relativeFilePath);

    const importPathAndMainFile = resolveImportPathAndMain(
      jsModule.filePath, stripFileExtensions);
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
  }: JsModuleConstructorType = {}) {
    this.hasNamedExports = hasNamedExports;
    this.importPath = importPath;
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

  openFilePath(pathToCurrentFile: string): string {
    if (this.filePath) {
      // There is a filePath. This happens for JSModules that are not aliases.
      if (!this.filePath.startsWith('/package.json')) {
        return this.filePath;
      }

      if (this.mainFile) {
        // The filePath points to a package.json file, so we want to look in
        // that package.json file for a `main` configuration value and open that
        // file instead.
        return this.filePath.replace(/package\.json$/, this.mainFile);
      }
    }

    // There is no filePath. This likely means that we are working with an
    // alias, so we want to expand it to a full path if we can.
    if (this.importPath.startsWith('.')) {
      // The import path in the alias starts with a ".", which means that it is
      // relative to the current file. In order to open this file, we need to
      // expand it to a full path.
      return path.resolve(path.dirname(pathToCurrentFile), this.importPath);
    }

    // This is likely an alias that points to a package, so let's try to find
    // its main file from its package.json file.
    const filePath = `node_modules/${this.importPath}/package.json`;
    const main = resolveImportPathAndMain(filePath, [])[1];
    if (main) {
      return `node_modules/${this.importPath}/${main}`;
    }

    return this.importPath;
  }

  toImportStatement(
    variableName: string,
    config: Configuration
  ): ImportStatement {
    let namedImports = [];
    let defaultImport = '';
    if (this.hasNamedExports) {
      namedImports = [variableName];
    } else {
      defaultImport = variableName;
    }

    return new ImportStatement({
      declarationKeyword:
        config.get('declarationKeyword', { fromFile: this.filePath }),
      defaultImport,
      importFunction: config.get('importFunction', { fromFile: this.filePath }),
      namedImports,
      path: this.importPath,
    });
  }
}
