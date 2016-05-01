// This is hacky, but necessary to make eslint find plugins local to the files
// being linted. Without it, you'll get an error message of the following kind:
//
//   Error: Cannot find module 'eslint-config-brigade'
//
// This is because eslint will look for modules relative to where it installed.
// The eslint we are using is local to import-js, so any plugin referenced for
// the file we are linting will have to be looked up relative to that file.
//
// Technique from http://stackoverflow.com/questions/11969175
const oldPath = process.env.NODE_PATH;
process.env.NODE_PATH = `${oldPath || ''}:${process.cwd()}/node_modules/`;
require('module').Module._initPaths(); // eslint-disable-line no-underscore-dangle

import fs from 'fs';
import program from 'commander';

import Importer from './Importer';
import packageJson from '../package.json';

/**
 * @param {String} str
 */
function stdoutWrite(str) {
  process.stdout.write(`${str}\n`);
}

/**
 * Grab lines from stdin or directly from the file.
 * @param {String} pathToFile
 * @param {Function} callback
 */
function getLines(pathToFile, callback) {
  if (process.stdin.isTTY) {
    fs.readFile(pathToFile, 'utf-8', (err, fileContent) => {
      if (err) throw err;
      callback(fileContent.split('\n'));
    });
    return;
  }
  const lines = [];
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', data => lines.push(...data.split('\n')));
  process.stdin.on('end', () => callback(lines));
}

/**
 * Run a command/method on an importer instance
 * @param {Function} executor
 * @param {String} pathToFile
 * @param {Boolean} options.overwrite
 */
function runCommand(executor, pathToFile, { overwrite }) {
  getLines(pathToFile, (lines) => {
    const importer = new Importer(lines, pathToFile);
    const result = executor(importer);
    if (overwrite) {
      fs.writeFile(pathToFile, result.fileContent, (err) => {
        if (err) throw err;
      });
    } else {
      stdoutWrite(JSON.stringify(result));
    }
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
  .action((word, pathToFile, options) => {
    runCommand(importer => importer.import(word), pathToFile, options);
  });

program.command('fix <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((pathToFile, options) => {
    runCommand(importer => importer.fixImports(), pathToFile, options);
  });

program.command('rewrite <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((pathToFile, options) => {
    runCommand(importer => importer.rewriteImports(), pathToFile, options);
  });

program.command('add <imports> <pathToFile>')
  .option(...sharedOptions.overwrite)
  .action((imports, pathToFile, options) => {
    runCommand(importer => importer.addImports(JSON.parse(imports)),
               pathToFile, options);
  });

program.command('goto <word> <pathToFile>')
  .action((word, pathToFile) => {
    getLines(pathToFile, (lines) => {
      stdoutWrite(JSON.stringify(new Importer(lines, pathToFile).goto(word)));
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
  examples.forEach(example => {
    stdoutWrite(`    $ importjs ${example}`);
  });
  stdoutWrite('');
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
