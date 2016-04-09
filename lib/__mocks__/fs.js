'use strict';

const fs = jest.genMockFromModule('fs');
const actualFs = require.requireActual('fs');

const mockFiles = Object.create(null);

function __setFile(file, contents) {
  if (contents === null) {
    delete mockFiles[file];
  } else {
    mockFiles[file] = contents;
  }
}

function existsSync(file) {
  return Object.prototype.hasOwnProperty.call(mockFiles, file);
}

function readFileSync(file) {
  if (!existsSync(file)) {
    return actualFs.readFileSync(file);
  }
  return mockFiles[file];
}

fs.__setFile = __setFile;
fs.existsSync = existsSync;
fs.readFileSync = readFileSync;

module.exports = fs;
