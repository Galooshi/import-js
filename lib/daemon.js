import readline from 'readline';

import Importer from './Importer';
import WatchmanFileCache from './WatchmanFileCache';
import log from './log';

const commandsToFunctionNames = {
  fix: 'fixImports',
  word: 'import',
  goto: 'goto',
  rewrite: 'rewriteImports',
  add: 'addImports',
};

export default function daemon() {
  log('STARTING daemon');
  WatchmanFileCache.initialize().then(() => {
    log('WATCHMAN file cache is enabled');
  }).catch((err: Object) => {
    log(`WATCHMAN file cache is not available. Error: ${err.stack}`);
  });

  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rlInterface.on('line', (jsonPayload: string) => {
    log(`RECEIVED payload: ${jsonPayload}`);
    // The json payload is an array containing a job id and job details.
    const payload = JSON.parse(jsonPayload);
    const importer = new Importer(
      payload.fileContent.split('\n'), payload.pathToFile);

    // TODO: don't automatically invoke function here because of security issues
    const functionName = commandsToFunctionNames[payload.command];
    importer[functionName](payload.commandArg).then((result: Object) => {
      const jsonResponse = JSON.stringify(result);
      log(`SENDING response: ${jsonResponse}`);
      process.stdout.write(`${jsonResponse}\n`);
    }).catch((error: Object) => {
      const jsonResponse = JSON.stringify({
        error: error.stack,
      });
      log(`ERROR response: ${jsonResponse}`);
      process.stdout.write(`${jsonResponse}\n`);
    });
  });
}
