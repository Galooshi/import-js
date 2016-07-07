// @flow
import fs from 'fs';

export default {
  readJsonFile(absoluteFilePath: string): ?Object {
    if (!fs.existsSync(absoluteFilePath)) {
      return null;
    }

    const contents = fs.readFileSync(absoluteFilePath, 'utf8');
    if (!contents) {
      // Protect against trying to parse empty files.
      return null;
    }

    return JSON.parse(contents);
  },

  readJsFile(absoluteFilePath: string): ?Object {
    if (!fs.existsSync(absoluteFilePath)) {
      return null;
    }

    return require(absoluteFilePath); // eslint-disable-line global-require
  },
};
