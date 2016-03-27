const fs = require('fs');

const FileUtils = {
  /**
   * @return {Object?}
   */
  readJsonFile(file) {
    if (!fs.existsSync(file)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  },
};

module.exports = FileUtils;
