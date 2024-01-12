import fs from 'fs';
import path from 'path';

export default function lastUpdate(pathToFile, workingDirectory) {
  return new Promise((resolve, reject) => {
    fs.lstat(path.join(workingDirectory, pathToFile), (err, stat) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        path: pathToFile,
        mtime: stat ? stat.mtime.getTime() : undefined,
      });
    });
  });
}

lastUpdate.failSafe = (pathToFile, workingDirectory) => new Promise((resolve) => {
  lastUpdate(pathToFile, workingDirectory)
    .then(resolve)
    .catch(() => resolve({
      path: pathToFile,
      mtime: 0,
    }));
});
