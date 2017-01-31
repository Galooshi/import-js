import path from 'path';

import glob from 'glob';

import lastUpdate from './lastUpdate';

export default function findAllFiles(workingDirectory, excludes) {
  return new Promise((resolve, reject) => {
    glob('./**/*.js*', {
      ignore: ['./node_modules/**'].concat(excludes),
      cwd: workingDirectory,
    }, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      Promise.all(files.map((pathToFile) =>
        lastUpdate(path.join(workingDirectory, pathToFile))))
        .then(resolve);
    });
  });
}
