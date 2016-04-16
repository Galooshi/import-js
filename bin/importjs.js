#!/usr/bin/env node

'use strict';

const fs = require('fs');
const program = require('commander');

const CommandLineEditor = require('../lib/CommandLineEditor');
const Importer = require('../lib/Importer');
const packageJson = require('../package.json');

/**
 * Grab lines from stdin or directly from the file.
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
 */
function runCommand(executor, pathToFile) {
  getLines(pathToFile, (lines) => {
    const editor = new CommandLineEditor(lines, program);
    const importer = new Importer(editor, pathToFile);
    executor(importer);
    if (program.overwrite) {
      fs.writeFile(pathToFile, editor.currentFileContent(), (err) => {
        if (err) throw err;
      });
    } else {
      console.log(JSON.stringify(editor.toJSON()));
    }
  });
}

program.version(packageJson.version)
  .option('--overwrite',
          'overwrite the file with the result after importing')
  .option('--resolvedImports <list>',
          'A list of resolved imports, e.g. Foo:0,Bar:1',
          (list) => {
            const result = {};
            list.split(',').forEach((string) => {
              const tuple = string.split(':');
              result[tuple[0]] = tuple[1];
            });
            return result;
          });

program.command('word <word> <pathToFile>')
  .action((word, pathToFile) => {
    runCommand(importer => importer.import(word), pathToFile);
  });

program.command('fix <pathToFile>')
  .action((pathToFile) => {
    runCommand(importer => importer.fixImports(), pathToFile);
  });

program.command('rewrite <pathToFile>')
  .action((pathToFile) => {
    runCommand(importer => importer.rewriteImports(), pathToFile);
  });

program.command('goto <word> <pathToFile>')
  .action((word, pathToFile) => {
    getLines(pathToFile, (lines) => {
      const editor = new CommandLineEditor(lines, program);
      console.log(new Importer(editor, pathToFile).goto(word));
    });
  });

program.parse(process.argv);
