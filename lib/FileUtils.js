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

    // Clear the require cache so that the file is read every time.
    delete require.cache[absoluteFilePath];

    return require(absoluteFilePath);
  },
};
