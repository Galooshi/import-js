import glob from 'glob';

import lastUpdate from './lastUpdate';

export default function findAllFiles(workingDirectory) {
  return new Promise((resolve, reject) => {
    glob('./**/*.js*', {
      ignore: ['./node_modules/**'],
      cwd: workingDirectory,
    }, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      Promise.all(files.map((pathToFile) =>
        lastUpdate(pathToFile, workingDirectory)))
        .then(resolve);
    });
  });
}
