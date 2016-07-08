let files;
let fileFallback;

function __setFile(file, data) {
  files[file] = data;
}

function __setFileFallback(fn) {
  fileFallback = fn;
}

function __reset() {
  files = Object.create(null);
  fileFallback = () => null;
}

function readJsonFile(file) {
  return files[file] || fileFallback(file);
}

function readJsFile(file) {
  return files[file];
}

__reset();

exports.__setFile = __setFile;
exports.__setFileFallback = __setFileFallback;
exports.__reset = __reset;
exports.readJsonFile = readJsonFile;
exports.readJsFile = readJsFile;
