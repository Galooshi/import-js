import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import util from 'util';

import loglevel from 'loglevel';

import Configuration from './Configuration';
import Importer from './Importer';
import WatchmanFileCache from './WatchmanFileCache';

const pathToLogFile = path.join(os.tmpdir(), 'importjs.log');
const logStream = fs.createWriteStream(pathToLogFile, {
  flags: 'w',
});

/* eslint-disable no-console */
const originalConsoleLog = console.log;
console.log = (...args) => {
  logStream.write(`${util.format.apply(null, args)}\n`);
};
console.trace = console.log;
console.debug = console.log;
console.info = console.log;
console.warn = console.log;
console.error = console.log;
/* eslint-enable no-console */

const commandsToFunctionNames = {
  fix: 'fixImports',
  word: 'import',
  goto: 'goto',
  rewrite: 'rewriteImports',
  add: 'addImports',
};

export default function daemon() {
  // The `importjsd` here is mostly a dummy file because config relies on a
  // `pathToCurrentFile`. Normally, this is the javascript file you are editing.
  const config = new Configuration('importjsd');

  loglevel.setLevel(config.get('logLevel'));
  originalConsoleLog(`DAEMON active. Logs will go to: \n${pathToLogFile}`);

  WatchmanFileCache.initialize().then(() => {
    loglevel.info('WATCHMAN file cache is enabled');
  }).catch((err: Object) => {
    loglevel.info(`WATCHMAN file cache is not available. Reason:\n${err.stack}`);
  });

  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rlInterface.on('line', (jsonPayload: string) => {
    loglevel.debug(`RECEIVED payload: ${jsonPayload}`);
    // The json payload is an array containing a job id and job details.
    const payload = JSON.parse(jsonPayload);
    const importer = new Importer(
      payload.fileContent.split('\n'), payload.pathToFile);

    // TODO: don't automatically invoke function here because of security issues
    const functionName = commandsToFunctionNames[payload.command];
    importer[functionName](payload.commandArg).then((result: Object) => {
      const jsonResponse = JSON.stringify(result);
      loglevel.debug(`SENDING response: ${jsonResponse}`);
      process.stdout.write(`${jsonResponse}\n`);
    }).catch((error: Object) => {
      const jsonResponse = JSON.stringify({
        error: error.stack,
      });
      loglevel.error(`ERROR response: ${jsonResponse}`);
      process.stdout.write(`${jsonResponse}\n`);
    });
  });
}
