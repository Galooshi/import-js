// @flow

import childProcess from 'child_process';

import glob from 'glob';

import WatchmanFileCache from './WatchmanFileCache';
import formattedToRegex from './formattedToRegex';

function findMatchingFilesWithFind(
  validFilesPattern: string,
  workingDirectory: string
): Promise<Array<string>> {
  const findCommand = [
    'find .',
    '-name "**.js*"',
    '-not -path "./node_modules/*"',
  ].join(' ');
  const command = `${findCommand} | egrep -i "${validFilesPattern}"`;

  return new Promise((resolve: Function, reject: Function) => {
    // TODO switch to spawn so we can start processing the stream as it comes
    // in.
    childProcess.exec(
      command,
      { cwd: workingDirectory },
      (err: ?Error, stdout: Buffer, stderr: Buffer) => {
        if (String(stderr) !== '') {
          reject(String(stderr));
          return;
        }
        // Filter out empty lines before returning
        resolve(String(stdout).split('\n').filter(
          (file: string): boolean => !!file));
      });
  });
}

function findMatchingFilesWithNode(
  validFilesPattern: string,
  workingDirectory: string
): Promise<Array<string>> {
  const validFilesRegex = new RegExp(validFilesPattern, 'i');
  return new Promise((resolve: Function, reject: Function) => {
    glob('./**/*.js*', {
      ignore: './node_modules/**',
      cwd: workingDirectory,
    }, (err: Object, result: Array<string>) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result.filter((filePath: string): bool =>
        validFilesRegex.test(filePath)));
    });
  });
}

function findMatchingFilesWithWatchman(
  validFilesPattern: string,
  workingDirectory: string
): Promise<Array<string>> {
  const validFilesRegex = new RegExp(validFilesPattern, 'i');
  return new Promise((resolve: Function) => {
    const matches = [];
    // `getFiles()` returns a Set, so we can't use `filter` here.
    WatchmanFileCache.getForWorkingDirectory(workingDirectory).getFiles()
      .forEach((filePath: string) => {
        if (validFilesRegex.test(filePath)) {
          matches.push(filePath);
        }
      });
    resolve(matches);
  });
}

/**
 * Finds files from the local file system matching the variable name.
 */
export default function findMatchingFiles(
  variableName: string,
  workingDirectory: string = process.cwd()
): Promise<Array<string>> {
  const formattedVarName = formattedToRegex(variableName);
  const validFilesPattern = `(/|^)${formattedVarName}(/index)?(/package)?\\.js.*`;

  if (WatchmanFileCache.getForWorkingDirectory(workingDirectory).isEnabled()) {
    return findMatchingFilesWithWatchman(validFilesPattern, workingDirectory);
  }
  if (/^win/.test(process.platform) ||
      process.env.IMPORT_JS_USE_NODE_FINDER) {
    return findMatchingFilesWithNode(validFilesPattern, workingDirectory);
  }
  return findMatchingFilesWithFind(validFilesPattern, workingDirectory);
}
