'use strict';

let jsonFiles;
let jsonFileFallback;

function __setJsonFile(file, data) {
  jsonFiles[file] = data;
}

function __setJsonFileFallback(fn) {
  jsonFileFallback = fn;
}

function __reset() {
  jsonFiles = Object.create(null);
  jsonFileFallback = () => null;
}

function readJsonFile(file) {
  return jsonFiles[file] || jsonFileFallback(file);
}

__reset();

exports.__setJsonFile = __setJsonFile;
exports.__setJsonFileFallback = __setJsonFileFallback;
exports.__reset = __reset;
exports.readJsonFile = readJsonFile;
