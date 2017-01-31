import fs from 'fs';

export default function lastUpdate(pathToFile) {
  return new Promise((resolve, reject) => {
    fs.lstat(pathToFile, (err, stat) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ path: pathToFile, mtime: stat ? stat.mtime.getTime() : undefined });
    });
  });
}
