import glob from 'glob';

import lastUpdate from './lastUpdate';

export default function findAllFiles(workingDirectory, excludes) {
  return new Promise((resolve, reject) => {
    glob(
      './**/*.{j,t}s*',
      {
        ignore: ['./node_modules/**'].concat(excludes),
        cwd: workingDirectory,
      },
      (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        Promise.all(files.map((pathToFile) => lastUpdate(pathToFile, workingDirectory)))
          .then(resolve);
      },
    );
  });
}
