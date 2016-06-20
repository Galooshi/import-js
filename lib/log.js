import fs from 'fs';

export default function log(message) {
  const timestamp = new Date().getTime();
  fs.appendFile(
    '/tmp/importjsd.log', `${timestamp}: ${message}\n`, (err) => {
      if (err) {
        throw new Error(err);
      }
    });
}
