// @flow

import childProcess from 'child_process';
import glob from 'glob';

import formattedToRegex from './formattedToRegex';

function findMatchingFilesWithFind(
  lookupPath: string,
  validFilesRegex: string
): Promise<Array<string>> {
  const findCommand = [
    `find ${lookupPath}`,
    '-name "**.js*"',
    '-not -path "./node_modules/*"',
  ].join(' ');
  const command = `${findCommand} | egrep -i \"${validFilesRegex}\"`;

  return new Promise((resolve: Function, reject: Function) => {
    // TODO switch to spawn so we can start processing the stream as it comes
    // in.
    childProcess.exec(command, (err: Object, stdout: string, stderr: string) => {
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
  lookupPath: string,
  validFilesRegex: string
): Promise<Array<string>> {
  return new Promise((resolve: Function, reject: Function) => {
    glob(`${lookupPath}/**/*.js*`, {
      ignore: './node_modules/**',
    }, (err: Object, result: Array<string>) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result.filter((filePath: string): bool =>
        new RegExp(validFilesRegex, 'i').test(filePath)));
    });
  });
}

/**
 * Finds files from the local file system matching the variable name.
 */
export default function findMatchingFiles(
  lookupPath: string,
  variableName: string
): Promise<Array<string>> {
  if (lookupPath === '') {
    // If lookupPath is an empty string, the `find` command will not work
    // as desired so we bail early.
    throw new Error(`lookup path cannot be empty (${lookupPath})`);
  }

  const formattedVarName = formattedToRegex(variableName);
  const validFilesRegex = `(/|^)${formattedVarName}(/index)?(/package)?\\.js.*`;

  if (/^win/.test(process.platform) || process.env.IMPORT_JS_USE_NODE_FINDER) {
    return findMatchingFilesWithNode(lookupPath, validFilesRegex);
  }
  return findMatchingFilesWithFind(lookupPath, validFilesRegex);
}
