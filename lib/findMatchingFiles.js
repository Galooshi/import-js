// @flow

import childProcess from 'child_process';
import glob from 'glob';

import FileUtils from './FileUtils';
import formattedToRegex from './formattedToRegex';

const WATCHED_FILES = FileUtils.readJsonFile('.importjs.index.json');

function findMatchingFilesWithFind(
  lookupPath: string,
  validFilesRegex: string
): Array<string> {
  const findCommand = [
    `find ${lookupPath}`,
    '-name "**.js*"',
    '-not -path "./node_modules/*"',
  ].join(' ');
  const command = `${findCommand} | egrep -i \"${validFilesRegex}\"`;

  // TODO switch to spawn so we can start processing the stream as it comes
  // in.
  let out = '';
  let err = '';
  try {
    out = String(childProcess.execSync(command));
  } catch (error) {
    err = String(error.stderr);
  }

  if (err !== '') {
    throw new Error(err);
  }

  // Filter out empty lines before returning
  return out.split('\n').filter((file: string): boolean => !!file);
}

function findMatchingFilesWithNode(
  lookupPath: string,
  validFilesRegex: string
): Array<string> {
  return glob.sync(`${lookupPath}/**/*.js*`, {
    ignore: './node_modules/**',
  }).filter((filePath: string): bool =>
    new RegExp(validFilesRegex, 'i').test(filePath));
}

/**
 * Finds files from the local file system matching the variable name.
 */
export default function findMatchingFiles(
  lookupPath: string,
  variableName: string
): Array<string> {
  if (lookupPath === '') {
    // If lookupPath is an empty string, the `find` command will not work
    // as desired so we bail early.
    throw new Error(`lookup path cannot be empty (${lookupPath})`);
  }

  const formattedVarName = formattedToRegex(variableName);
  const validFilesRegex = `(/|^)${formattedVarName}(/index)?(/package)?\\.js.*`;

  if (WATCHED_FILES) {
    return WATCHED_FILES.filter((filePath: string): bool =>
      new RegExp(validFilesRegex, 'i').test(filePath));
  }
  if (/^win/.test(process.platform) || process.env.IMPORT_JS_USE_NODE_FINDER) {
    return findMatchingFilesWithNode(lookupPath, validFilesRegex);
  }
  return findMatchingFilesWithFind(lookupPath, validFilesRegex);
}
