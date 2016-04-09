const fs = require('fs');

const FileUtils = {
  /**
   * @param {String} file
   * @return {Object?}
   */
  readJsonFile(file) {
    if (!fs.existsSync(file)) {
      return null;
    }

    const contents = fs.readFileSync(file, 'utf8');
    if (!contents) {
      // Protect against trying to parse empty files.
      return null;
    }

    return JSON.parse(contents);
  },
};

module.exports = FileUtils;
