const fs = jest.genMockFromModule('fs');
const actualFs = require.requireActual('fs');

let mockFiles;

fs.__reset = function __reset() {
  mockFiles = Object.create(null);
};
fs.__reset();

fs.__setFile = function __setFile(file, contents, stats) {
  if (contents === null) {
    delete mockFiles[file];
  } else {
    mockFiles[file] = { contents, stats };
  }
};

fs.existsSync = function existsSync(file) {
  return Object.prototype.hasOwnProperty.call(mockFiles, file);
};

fs.lstatSync = function lstatSync(file) {
  if (!this.existsSync(file)) {
    return actualFs.lstatSync(file);
  }
  return mockFiles[file].stats;
};

fs.readFileSync = function readFileSync(file) {
  if (!this.existsSync(file)) {
    return actualFs.readFileSync(file);
  }
  return mockFiles[file].contents;
};

module.exports = fs;
