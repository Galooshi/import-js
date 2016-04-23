'use strict';

const fs = require('fs');
const path = require('path');

const escapeRegExp = require('lodash.escaperegexp');

const FileUtils = require('./FileUtils');

/**
 * @param {String} directory
 * @return {String, null}
 */
function findIndex(directory) {
  return ['index.js', 'index.jsx'].find(indexFile => (
    fs.existsSync(`${directory}/${indexFile}`)
  ));
}

/**
 * @param {String} filePath
 * @return {?Array<?String, ?String>}
 */
function resolveForPackage(filePath) {
  if (!filePath.endsWith('/package.json')) {
    return null;
  }

  const json = FileUtils.readJsonFile(filePath);
  if (!json) {
    return [null, null];
  }

  let mainFile = json.main;
  const match = filePath.match(/(.*)\/package\.json/);
  const matchPackage = match[1];

  if (!mainFile) {
    const indexFile = findIndex(matchPackage);
    if (!indexFile) {
      return [null, null];
    }
    mainFile = indexFile;
  }

  const mainFilePath = `${matchPackage}/${mainFile}`;
  if (fs.existsSync(mainFilePath) && fs.lstatSync(mainFilePath).isDirectory()) {
    // The main in package.json refers to a directory, so we want to
    // resolve it to an index file.
    const indexFile = findIndex(mainFilePath);
    if (indexFile) {
      mainFile += `/${indexFile}`;
    }
  }

  return [matchPackage, path.normalize(mainFile)];
}

/**
 * @param {String} filePath
 * @param {Array} stripFileExtensions
 * @return {Array<?String, ?String>}
 */
function resolveImportPathAndMain(filePath, stripFileExtensions) {
  const resolvedForPackage = resolveForPackage(filePath);
  if (resolvedForPackage) {
    return resolvedForPackage;
  }

  const match = filePath.match(/(.*)\/(index\.js[^/]*)$/);
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

module.exports = resolveImportPathAndMain;
