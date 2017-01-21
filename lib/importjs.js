// @flow
import fs from 'fs';

import program from 'commander';

import Configuration from './Configuration';
import Importer from './Importer';
import daemon, { pathToLogFile } from './daemon';
import findProjectRoot from './findProjectRoot';
import initializeModuleFinder from './initializeModuleFinder';
import packageJson from '../package.json';

function stdoutWrite(str: string) {
  process.stdout.write(`${str}\n`);
}

function stderrWrite(str: string) {
  process.stderr.write(`${str}\n`);
}

/**
 * Grab lines from stdin or directly from the file.
 */
function getLines(pathToFile: string): Promise<Array<string>> {
  return new Promise((resolve: Function, reject: Function) => {
    if (process.stdin.isTTY) {
      fs.readFile(pathToFile, 'utf-8', (err: ?Error, fileContent: string) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(fileContent.split('\n'));
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
      resolve(parts.join('').split('\n'));
    });
  });
}

/**
 * Run a command/method on an importer instance
 */
function runCommand(
  executor: Function,
  pathToFile: string,
  { overwrite }: { overwrite: boolean }
): Promise<*> {
  const workingDirectory = findProjectRoot(pathToFile);
  return initializeModuleFinder(workingDirectory).then((): Promise<*> =>
    getLines(pathToFile).then((lines: Array<string>): Promise<*> => {
      const importer = new Importer(lines, pathToFile, workingDirectory);
      return executor(importer).then((result: Object) => {
        if (overwrite) {
          fs.writeFile(pathToFile, result.fileContent, (err: Error) => {
            if (err) throw err;
            process.exit(0);
          });
        } else {
          stdoutWrite(JSON.stringify(result));
          process.exit(0);
        }
      });
    })
  ).catch((error: Object) => {
    stderrWrite(error.message);
    process.exit(1);
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
    const workingDirectory = findProjectRoot(pathToFile);
    initializeModuleFinder(workingDirectory).then((): Promise<*> =>
      getLines(pathToFile).then((lines: Array<string>) => {
        new Importer(lines, pathToFile, workingDirectory).goto(word).then((result: Object) => {
          stdoutWrite(JSON.stringify(result));
          process.exit(0);
        });
      })
    ).catch((error: Error) => {
      stderrWrite(error.message);
      process.exit(1);
    });
  });

program.command('start')
  .description('start a daemon')
  .option('--parent-pid <n>', parseInt)
  .action(({ parentPid }: Object) => {
    daemon(parentPid);
  });

program.command('cachepath')
  .description('show path to cache file')
  .action(() => {
    stdoutWrite(new Configuration('importjs').get('cacheLocation'));
  });

program.command('logpath')
  .description('show path to log file')
  .action(() => {
    process.stdout.write(`${pathToLogFile}\n`);
  });

program.on('--help', () => {
  const examples = [
    'word someModule path/to/file.js',
    'fix path/to/file.js',
    'rewrite --overwrite path/to/file.js',
    'add \'{ "foo": "path/to/foo", "bar": "path/to/bar" }\' path/to/file.js',
    'goto someModule path/to/file.js',
    'cachepath',
    'logpath',
    'start --parent-pid=12345',
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
