import readline from 'readline';

import winston from 'winston';

import Importer from './Importer';
import findProjectRoot from './findProjectRoot';
import initializeModuleFinder from './initializeModuleFinder';
import version from './version';

const commandsToFunctionNames = {
  add: 'addImports',
  fix: 'fixImports',
  goto: 'goto',
  rewrite: 'rewriteImports',
  search: 'search',
  word: 'import',
};

export default function daemon(parentPid, pathToLogFile) {
  process.stdout.write(`ImportJS (v${version()}) DAEMON active. Logs will go to: ${pathToLogFile}\n`);
  if (parentPid) {
    // Editor plugins should provide a `--parent-pid=<pid>` argument on startup,
    // so that we can check that the daemon process hasn't turned into a zombie
    // once in a while.
    setInterval(
      () => {
        winston.debug(`Making sure that the parent process (PID=${parentPid}) is still running.`);
        try {
          process.kill(parentPid, 0);
        } catch (error) {
          winston.info('Parent process seems to have died. Exiting.');
          process.exit(1);
        }
      },
      30000,
    );
  }

  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rlInterface.on('line', (jsonPayload: string) => {
    winston.debug(`RECEIVED payload: ${jsonPayload}`);

    const payload = JSON.parse(jsonPayload);

    const workingDirectory = findProjectRoot(payload.pathToFile);
    winston.debug(`Using ${workingDirectory} as project root for ${payload.pathToFile}`);

    if (payload.command === 'init') {
      initializeModuleFinder(workingDirectory).then(() => {
        winston.debug(`ImportJS is initializing for ${workingDirectory}. Results will be more accurate in a few moments.`);
        process.stdout.write('\n');
      });

      return;
    }

    const importer = new Importer(
      payload.fileContent.split('\n'),
      payload.pathToFile,
      workingDirectory,
    );

    const functionName = commandsToFunctionNames[payload.command];
    if (!functionName) {
      const errorString = `Unknown command: ${payload.command}. Valid ones are ${Object.keys(commandsToFunctionNames).join(', ')}`;
      winston.error(errorString);
      const jsonResponse = JSON.stringify({ error: errorString });
      process.stdout.write(`${jsonResponse}\n`);
      return;
    }

    initializeModuleFinder(workingDirectory).then(({ isFreshInstall }) => {
      importer[functionName](payload.commandArg)
        .then((result: Object) => {
          if (isFreshInstall) {
            result.messages.unshift(`ImportJS is initializing for ${workingDirectory}. Results will be more accurate in a few moments.`);
          }
          const jsonResponse = JSON.stringify(result);
          winston.debug(`SENDING response: ${jsonResponse}`);
          process.stdout.write(`${jsonResponse}\n`);
        })
        .catch(({ message, stack }: Object) => {
          const errorParts = [message];
          if (stack) {
            errorParts.push(stack);
          }
          const jsonResponse = JSON.stringify({
            error: errorParts.join('\n'),
          });
          winston.error(`ERROR response: ${jsonResponse}`);
          process.stdout.write(`${jsonResponse}\n`);
        });
    });
  });
}
