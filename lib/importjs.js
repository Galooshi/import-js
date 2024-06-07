//
import fs from 'fs';
import os from 'os';
import path from 'path';

import program from 'commander';

import Configuration from './Configuration';
import Importer from './Importer';
import daemon from './daemon';
import findProjectRoot from './findProjectRoot';
import initializeLogging from './initializeLogging';
import initializeModuleFinder from './initializeModuleFinder';
import packageJson from '../package.json';

const pathToLogFile = path.join(os.tmpdir(), 'importjs.log');
initializeLogging(pathToLogFile);

function stdoutWrite(str) {
  process.stdout.write(`${str}\n`);
}

function stderrWrite(str) {
  process.stderr.write(`${str}\n`);
}

/**
 * Grab lines from stdin or directly from the file.
 */
function getLines(pathToFile) {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      fs.readFile(pathToFile, 'utf-8', (err, fileContent) => {
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
    process.stdin.on('data', (data) => {
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
function runCommand(executor, pathToFile, { overwrite }) {
  const workingDirectory = findProjectRoot(pathToFile);
  return initializeModuleFinder(workingDirectory)
    .then(() =>
      getLines(pathToFile).then((lines) => {
        const importer = new Importer(lines, pathToFile, workingDirectory);
        return executor(importer).then((result) => {
          if (overwrite) {
            fs.writeFile(pathToFile, result.fileContent, (err) => {
              if (err) throw err;
              process.exit(0);
            });
          } else {
            stdoutWrite(JSON.stringify(result));
            process.exit(0);
          }
        });
      }),
    )
    .catch((error) => {
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

program
  .command('word <word> <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((word, pathToFile, options) => {
    const executor = (importer) => importer.import(word);
    runCommand(executor, pathToFile, options);
  });

program
  .command('search <word> <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((word, pathToFile, options) => {
    const executor = (importer) =>
      importer.search(word).then(({ modules }) => modules);
    runCommand(executor, pathToFile, options);
  });

program
  .command('fix <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((pathToFile, options) => {
    const executor = (importer) => importer.fixImports();
    runCommand(executor, pathToFile, options);
  });

program
  .command('rewrite <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((pathToFile, options) => {
    const executor = (importer) => importer.rewriteImports();
    runCommand(executor, pathToFile, options);
  });

program
  .command('add <imports> <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((imports, pathToFile, options) => {
    const executor = (importer) => importer.addImports(JSON.parse(imports));
    runCommand(executor, pathToFile, options);
  });

program.command('goto <word> <pathToFile>').action((word, pathToFile) => {
  const workingDirectory = findProjectRoot(pathToFile);
  initializeModuleFinder(workingDirectory)
    .then(() =>
      getLines(pathToFile).then((lines) => {
        new Importer(lines, pathToFile, workingDirectory)
          .goto(word)
          .then((result) => {
            stdoutWrite(JSON.stringify(result));
            process.exit(0);
          });
      }),
    )
    .catch((error) => {
      stderrWrite(error.message);
      process.exit(1);
    });
});

program
  .command('start')
  .description('start a daemon')
  .option('--parent-pid <n>', parseInt)
  .action(({ parentPid }) => {
    initializeLogging.parentPid = parentPid;
    daemon(parentPid, pathToLogFile);
  });

program
  .command('cachepath')
  .description('show path to cache file')
  .action(() => {
    stdoutWrite(new Configuration('importjs').get('cacheLocation'));
  });

program
  .command('logpath')
  .description('show path to log file')
  .action(() => {
    stdoutWrite(pathToLogFile);
  });

program.on('--help', () => {
  const examples = [
    'word someModule path/to/file.js',
    'search someModule* path/to/file.js',
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
  examples.forEach((example) => {
    stdoutWrite(`    $ importjs ${example}`);
  });
  stdoutWrite('');
});

export default function importjs(argv) {
  program.parse(argv);

  if (!argv.slice(2).length) {
    program.outputHelp();
  }
}
