'use strict';

const path = require('path');

const escapeRegExp = require('lodash.escaperegexp');

const ImportStatement = require('./ImportStatement');
const resolveImportPathAndMain = require('./resolveImportPathAndMain');

/**
 * @param {String} pathToNormalize
 * @return {String}
 */
function normalizePath(pathToNormalize) {
  if (!pathToNormalize) {
    return '';
  }
  return pathToNormalize.replace(/^\.\/?/, '');
}

// Class that represents a js module found in the file system
export default class JsModule {
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
  } = {}) {
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
    } else {
      jsModule.stripFromPath(stripFromPath);
    }
    return jsModule;
  }

  /**
   * @param {String} opts.hasNamedExports
   * @param {String} opts.importPath
   */
  constructor({
    hasNamedExports,
    importPath,
  } = {}) {
    this.hasNamedExports = hasNamedExports;
    this.importPath = importPath;
  }

  /**
   * @param {String} makeRelativeToPath
   */
  makeRelativeTo(makeRelativeToPath) {
    if (this.lookupPath === undefined || this.lookupPath === null) {
      return;
    }

    // First, strip out any absolute path up until the current directory
    let makeRelativeTo = makeRelativeToPath.replace(`^${process.cwd()}/`, '');

    // Ignore if the file to relate to is part of a different lookupPath
    if (!makeRelativeTo.startsWith(this.lookupPath)) {
      return;
    }

    // Strip out the lookupPath
    makeRelativeTo = makeRelativeTo.replace(
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

  /**
   * @param {String} prefix
   */
  stripFromPath(prefix) {
    if (!prefix) {
      return;
    }
    this.importPath = this.importPath.replace(
      RegExp(`^${escapeRegExp(prefix)}`), '');
  }

  /**
   * @return {String} a readable description of the module
   */
  displayName() {
    const parts = [this.importPath];
    if (this.mainFile) {
      parts.push(` (main: ${this.mainFile})`);
    }
    return parts.join('');
  }

  /**
   * @param {String} pathToCurrentFile
   * @return {String}
   */
  openFilePath(pathToCurrentFile) {
    if (this.filePath) {
      // There is a filePath. This happens for JSModules that are not aliases.
      if (!this.filePath.startsWith('/package.json')) {
        return this.filePath;
      }

      // The filePath points to a package.json file, so we want to look in
      // that package.json file for a `main` configuration value and open that
      // file instead.
      return this.filePath.replace(/package\.json$/, this.mainFile);
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

  /**
   * @param {String} variableName
   * @param {Configuration} config
   * @return {ImportStatement}
   */
  toImportStatement(variableName, config) {
    let namedImports;
    let defaultImport;
    if (this.hasNamedExports) {
      namedImports = [variableName];
    } else {
      defaultImport = variableName;
    }

    return new ImportStatement({
      declarationKeyword:
        config.get('declaration_keyword', { fromFile: this.filePath }),
      defaultImport,
      importFunction: config.get('import_function', { fromFile: this.filePath }),
      namedImports,
      path: this.importPath,
    });
  }
}
