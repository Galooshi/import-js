// @flow

import fs from 'fs';
import program from 'commander';

import Importer from './Importer';
import packageJson from '../package.json';

function stdoutWrite(str: string) {
  process.stdout.write(`${str}\n`);
}

/**
 * Grab lines from stdin or directly from the file.
 */
function getLines(pathToFile: string, callback: Function) {
  if (process.stdin.isTTY) {
    fs.readFile(pathToFile, 'utf-8', (err: ?Error, fileContent: string) => {
      if (err) throw err;
      callback(fileContent.split('\n'));
    });
    return;
  }
  const parts = [];
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (data: string) => {
    parts.push(data);
  });
  process.stdin.on('end', () => {
    callback(parts.join('').split('\n'));
  });
}

/**
 * Run a command/method on an importer instance
 */
function runCommand(
  executor: Function,
  pathToFile: string,
  { overwrite } : { overwrite: boolean }
) {
  getLines(pathToFile, (lines: Array<string>) => {
    const importer = new Importer(lines, pathToFile);
    executor(importer).then((result: Object) => {
      if (overwrite) {
        fs.writeFile(pathToFile, result.fileContent, (err: Error) => {
          if (err) throw err;
        });
      } else {
        stdoutWrite(JSON.stringify(result));
      }
    }).catch((error: Object) => {
      console.error(error); // eslint-disable-line no-console
      process.exit(1);
    });
  });
}

program.version(packageJson.version);

// Some options that are shared by multiple commands
const sharedOptions = {
  overwrite: [
    '--overwrite',
    'overwrite the file with the result after importing',
  ],
};

program.command('word <word> <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((word: string, pathToFile: string, options: Object) => {
    const executor = (importer: Importer): Promise<Object> => importer.import(word);
    runCommand(executor, pathToFile, options);
  });

program.command('fix <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((pathToFile: string, options: Object) => {
    const executor = (importer: Importer): Promise<Object> => importer.fixImports();
    runCommand(executor, pathToFile, options);
  });

program.command('rewrite <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((pathToFile: string, options: Object) => {
    const executor = (importer: Importer): Promise<Object> => importer.rewriteImports();
    runCommand(executor, pathToFile, options);
  });

program.command('add <imports> <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((imports: string, pathToFile: string, options: Object) => {
    const executor =
      (importer: Importer): Promise<Object> => importer.addImports(JSON.parse(imports));
    runCommand(executor, pathToFile, options);
  });

program.command('goto <word> <pathToFile>')
  .action((word: string, pathToFile: string) => {
    getLines(pathToFile, (lines: Array<string>) => {
      new Importer(lines, pathToFile).goto(word).then((result: Object) => {
        stdoutWrite(JSON.stringify(result));
      });
    });
  });

program.on('--help', () => {
  const examples = [
    'word someModule path/to/file.js',
    'fix path/to/file.js',
    'rewrite --overwrite path/to/file.js',
    'add \'{ "foo": "path/to/foo", "bar": "path/to/bar" }\' path/to/file.js',
    'goto someModule path/to/file.js',
  ];

  stdoutWrite('  Examples:');
  stdoutWrite('');
  examples.forEach((example: string) => {
    stdoutWrite(`    $ importjs ${example}`);
  });
  stdoutWrite('');
});

export default function importjs(argv: Array<string>) {
  program.parse(argv);

  if (!argv.slice(2).length) {
    program.outputHelp();
  }
}
