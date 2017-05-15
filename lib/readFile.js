import fs from 'fs';
import path from 'path';

export default function readFile(pathToFile) {
  if (!path.isAbsolute(pathToFile)) {
    return Promise.reject(new Error(`File path not absolue: ${pathToFile}`));
  }
  return new Promise((resolve, reject) => {
    fs.readFile(pathToFile, 'utf-8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}
