import os from 'os';
import path from 'path';
import readline from 'readline';

import commander from 'commander';
import loglevel from 'loglevel';
import loglevelMessagePrefix from 'loglevel-message-prefix';

import Configuration from './Configuration';
import Importer from './Importer';
import WatchmanFileCache from './WatchmanFileCache';
import rerouteConsoleLog from './rerouteConsoleLog';
import version from './version';

const pathToLogFile = path.join(os.tmpdir(), 'importjs.log');
const originalConsoleLog = rerouteConsoleLog(pathToLogFile);

const commandsToFunctionNames = {
  fix: 'fixImports',
  word: 'import',
  goto: 'goto',
  rewrite: 'rewriteImports',
  add: 'addImports',
};

commander.command('start')
  .description('start the daemon')
  .option('--parent-pid <n>', parseInt)
  .action(() => {
    // The `importjsd` here is mostly a dummy file because config relies on a
    // `pathToCurrentFile`. Normally, this is the javascript file you are editing.
    const config = new Configuration('importjsd');

    loglevel.setLevel(config.get('logLevel'));
    loglevelMessagePrefix(loglevel, {
      prefixes: ['timestamp', 'level'],
      staticPrefixes: [`PID:${commander.parentPid}`],
    });
    originalConsoleLog(
      `ImportJS (v${version()}) DAEMON active. Logs will go to: ${pathToLogFile}`);

    WatchmanFileCache.getForWorkingDirectory(process.cwd()).initialize()
      .then(() => {
        loglevel.info(`WATCHMAN file cache is enabled for ${process.cwd()}`);
      })
      .catch((err: Object) => {
        loglevel.info(
          `WATCHMAN file cache is not available. Reason:\n${err.stack}`);
      });

    if (commander.parentPid) {
      // Editor plugins should provide a `--parent-pid=<pid>` argument on startup,
      // so that we can check that the daemon process hasn't turned into a zombie
      // once in a while.
      setInterval(() => {
        loglevel.debug('Making sure that the parent process ' +
                      `(PID=${commander.parentPid}) is still running.`);
        try {
          process.kill(commander.parentPid, 0);
        } catch (error) {
          loglevel.info('Parent process seems to have died. Exiting.');
          process.exit(1);
        }
      }, 30000);
    }

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

      const functionName = commandsToFunctionNames[payload.command];
      if (!functionName) {
        const errorString =
          `Unknown command: ${payload.command}. ` +
          `Valid ones are ${Object.keys(commandsToFunctionNames).join(', ')}`;
        loglevel.error(errorString);
        const jsonResponse = JSON.stringify({ error: errorString });
        process.stdout.write(`${jsonResponse}\n`);
        return;
      }

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
  });

commander.command('logpath')
  .description('show path to log file')
  .action(() => {
    process.stdout.write(`${pathToLogFile}\n`);
  });

export default function daemon(argv: Array<string>) {
  commander.parse(argv);

  if (argv.length <= 2) {
    // no arguments were given, so default to help
    commander.help();
  }
}
