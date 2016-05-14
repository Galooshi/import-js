const fs = jest.genMockFromModule('fs');
const actualFs = require.requireActual('fs');

const mockFiles = Object.create(null);

function __setFile(file, contents, stats) {
  if (contents === null) {
    delete mockFiles[file];
  } else {
    mockFiles[file] = { contents, stats };
  }
}

function existsSync(file) {
  return Object.prototype.hasOwnProperty.call(mockFiles, file);
}

function lstatSync(file) {
  if (!existsSync(file)) {
    return actualFs.lstatSync(file);
  }
  return mockFiles[file].stats;
}

function readFileSync(file) {
  if (!existsSync(file)) {
    return actualFs.readFileSync(file);
  }
  return mockFiles[file].contents;
}

fs.__setFile = __setFile;
fs.existsSync = existsSync;
fs.lstatSync = lstatSync;
fs.readFileSync = readFileSync;

module.exports = fs;
