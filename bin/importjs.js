#!/usr/bin/env node

'use strict';

const fs = require('fs');
const program = require('commander');

const CommandLineEditor = require('../lib/CommandLineEditor');
const Importer = require('../lib/Importer');
const packageJson = require('../package.json');

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
 * @param {Object} options
 * @param {Boolean} options.overwrite
 * @param {Object} options.resolvedImports
 */
function runCommand(executor, pathToFile, options) {
  const overwrite = options.overwrite;
  const resolvedImports = options.resolvedImports;

  getLines(pathToFile, (lines) => {
    const editor = new CommandLineEditor(lines, { resolvedImports });
    const importer = new Importer(editor, pathToFile);
    executor(importer);
    if (overwrite) {
      fs.writeFile(pathToFile, editor.currentFileContent(), (err) => {
        if (err) throw err;
      });
    } else {
      stdoutWrite(JSON.stringify(editor.toJSON()));
    }
  });
}

program.version(packageJson.version);

// Some options that are shared by multiple commands
const options = {
  overwrite: [
    '--overwrite',
    'overwrite the file with the result after importing',
  ],
  resolvedImports: [
    '--resolvedImports <list>',
    'A list of resolved imports, e.g. Foo:0,Bar:1',
    (list) => {
      const result = {};
      list.split(',').forEach((string) => {
        const tuple = string.split(':');
        result[tuple[0]] = tuple[1];
      });
      return result;
    },
  ],
};

program.command('word <word> <pathToFile>')
  .option(...options.overwrite)
  .option(...options.resolvedImports)
  .action((word, pathToFile, options) => {
    runCommand(importer => importer.import(word), pathToFile, options);
  });

program.command('fix <pathToFile>')
  .option(...options.overwrite)
  .option(...options.resolvedImports)
  .action((pathToFile, options) => {
    runCommand(importer => importer.fixImports(), pathToFile, options);
  });

program.command('rewrite <pathToFile>')
  .option(...options.overwrite)
  .action((pathToFile, options) => {
    runCommand(importer => importer.rewriteImports(), pathToFile, options);
  });

program.command('goto <word> <pathToFile>')
  .action((word, pathToFile) => {
    getLines(pathToFile, (lines) => {
      const editor = new CommandLineEditor(lines, program);
      stdoutWrite(new Importer(editor, pathToFile).goto(word));
    });
  });

program.parse(process.argv);
