import readline from 'readline';

import Importer from './Importer';

export default function daemon() {
  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rlInterface.on('line', (jsonCommand: string) => {
    const command = JSON.parse(jsonCommand);
    const importer = new Importer(
      command.fileContent.split('\n'), command.pathToFile);

    // TODO: don't automatically invoke function here because of security issues
    importer[command.command](...command.args).then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    }).catch((error) => {
      // TODO: print entire stack trace here
      process.stderr.write(error.toString());
    });
  });
}
