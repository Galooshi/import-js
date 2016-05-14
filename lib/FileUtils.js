// @flow
import fs from 'fs';

export default {
  readJsonFile(file: string): ?Object {
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
