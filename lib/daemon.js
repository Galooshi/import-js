import readline from 'readline';

import Importer from './Importer';

const commandsToFunctionNames = {
  fix: 'fixImports',
  word: 'import',
  goto: 'goto',
  rewrite: 'rewriteImports',
  add: 'addImports',
};

export default function daemon() {
  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rlInterface.on('line', (jsonPayload: string) => {
    const payload = JSON.parse(jsonPayload);
    const importer = new Importer(
      payload.fileContent.split('\n'), payload.pathToFile);

    // TODO: don't automatically invoke function here because of security issues
    const functionName = commandsToFunctionNames[payload.command];
    importer[functionName](payload.commandArg).then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    }).catch((error) => {
      // TODO: print entire stack trace here
      process.stdout.write(JSON.stringify({
        error: error.toString(),
      }));
    });
  });
}
