import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import util from 'util';

import loglevel from 'loglevel';

import Configuration from './Configuration';
import Importer from './Importer';
import WatchmanFileCache from './WatchmanFileCache';

const logFile = fs.createWriteStream(path.join(os.tmpdir(), 'importjs.log'), {
  flags: 'w',
});

/* eslint-disable no-console */
console.log = (...args) => {
  logFile.write(`${util.format.apply(null, args)}\n`);
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
  loglevel.setLevel('debug');
  loglevel.info('STARTING daemon');
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
