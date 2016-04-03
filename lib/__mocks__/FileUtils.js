'use strict';

const jsonFiles = Object.create(null);
let jsonFileFallback = () => null;

function __setJsonFile(file, data) {
  jsonFiles[file] = data;
}

function __setJsonFileFallback(fn) {
  jsonFileFallback = fn;
}

function readJsonFile(file) {
  return jsonFiles[file] || jsonFileFallback(file);
}

exports.__setJsonFile = __setJsonFile;
exports.__setJsonFileFallback = __setJsonFileFallback;
exports.readJsonFile = readJsonFile;
