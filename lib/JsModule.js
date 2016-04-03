'use strict';

const fs = require('fs');
const path = require('path');

const escapeRegExp = require('lodash.escaperegexp');
const xRegExp = require('xregexp');

const FileUtils = require('./FileUtils');
const ImportStatement = require('./ImportStatement');

// @param pathToNormalize [String]
// @return [String]
function normalizePath(pathToNormalize) {
  if (!pathToNormalize) {
    return '';
  }
  return pathToNormalize.replace(/^\.\/?/, '');
}

// @param directory [String]
// @return [String, null]
function findIndex(directory) {
  return ['index.js', 'index.jsx'].find(indexFile => (
    fs.existsSync(`${directory}/${indexFile}`)
  ));
}

// @param file_path [String]
// @param strip_file_extensions [Array]
// @return [String, String]
function resolveImportPathAndMain(filePath, stripFileExtensions) {
  if (filePath.endsWith('/package.json')) {
    const json = FileUtils.readJsonFile(filePath);
    if (!json) {
      return [undefined, undefined];
    }

    let mainFile = json.main;
    const match = xRegExp.exec(
      filePath, xRegExp('(?<package>.*)/package\.json'));

    if (!mainFile) {
      const indexFile = findIndex(match.package);
      if (!indexFile) {
        return [null, null];
      }
      mainFile = indexFile;
    }

    const mainFilePath = `${match.package}/${mainFile}`;
    if (fs.existsSync(mainFilePath) && fs.lstatSync(mainFilePath).isDirectory()) {
      // The main in package.json refers to a directory, so we want to
      // resolve it to an index file.
      const indexFile = findIndex(mainFilePath);
      if (indexFile) {
        mainFile += `/${indexFile}`;
      }
    }

    return [match.package, mainFile];
  }

  const match = xRegExp.exec(filePath, xRegExp('(.*)/(index\.js[^/]*)$'));
  if (match) {
    return [match[1], match[2]];
  }

  if (!stripFileExtensions) {
    return [filePath, null];
  }


  const extensions = stripFileExtensions.map(ext => escapeRegExp(ext));
  const importPath = filePath.replace(RegExp(`(${extensions.join('|')})$`), '');
  return [importPath, null];
}

// Class that represents a js module found in the file system
class JsModule {
  // @param lookup_path [String] the lookup path in which this module was found
  // @param relative_file_path [String] a full path to the file, relative to
  //   the project root.
  // @param strip_file_extensions [Array] a list of file extensions to strip,
  //   e.g. ['.js', '.jsx']
  // @param make_relative_to [String|null] a path to a different file which the
  //   resulting import path should be relative to.
  // @param strip_from_path [String]
  static construct(opts) {
    const jsModule = new JsModule();
    jsModule.lookupPath = normalizePath(opts.lookupPath);
    jsModule.filePath = normalizePath(opts.relativeFilePath);

    const importPathAndMainFile = resolveImportPathAndMain(
      jsModule.filePath, opts.stripFileExtensions);
    let importPath = importPathAndMainFile[0];
    const mainFile = importPathAndMainFile[1];

    if (!importPath) {
      return null;
    }

    if (mainFile) {
      // Normalize the filePath so that we can later dedupe equal modules
      jsModule.filePath = `${importPath}/${mainFile}`;
    }

    importPath = importPath.replace(
      RegExp(`^${escapeRegExp(jsModule.lookupPath)}\/`), '');

    jsModule.importPath = importPath;
    jsModule.mainFile = mainFile;
    if (opts.makeRelativeTo) {
      jsModule.makeRelativeTo(opts.makeRelativeTo);
    } else {
      jsModule.stripFromPath(opts.stripFromPath);
    }
    return jsModule;
  }

  // @param import_path [String]
  constructor(opts) {
    this.importPath = opts && opts.importPath;
  }

  // @param makeRelativeToPath [String]
  makeRelativeTo(makeRelativeToPath) {
    if (!this.lookupPath) {
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

  // @param prefix [String]
  stripFromPath(prefix) {
    if (!prefix) {
      return;
    }
    this.importPath = this.importPath.replace(
      RegExp(`^${escapeRegExp(prefix)}`), '');
  }

  // @return [String] a readable description of the module
  displayName() {
    const parts = [this.importPath];
    if (this.mainFile) {
      parts.push(` (main: ${this.mainFile})`);
    }
    return parts.join('');
  }

  // @param path_to_current_file [String]
  // @return [String]
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

    // There is no file_path. This likely means that we are working with an
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

  // @param variable_name [String]
  // @param config [ImportJS::Configuration]
  // @return [ImportJS::ImportStatement]
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

module.exports = JsModule;
