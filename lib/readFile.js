import fs from 'fs';

export default function readFile(pathToFile) {
  if (!pathToFile.startsWith('/')) {
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
