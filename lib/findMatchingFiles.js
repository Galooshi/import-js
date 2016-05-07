import childProcess from 'child_process';

import formattedToRegex from './formattedToRegex';

/**
 * Finds files from the local file system matching the variable name.
 *
 * @param {String} lookupPath
 * @param {String} variableName
 * @return {Array<String>} a list of paths to files that match
 */
export default function findMatchingFiles(lookupPath, variableName) {
  if (lookupPath === '') {
    // If lookupPath is an empty string, the `find` command will not work
    // as desired so we bail early.
    throw new Error(`lookup path cannot be empty (${lookupPath})`);
  }

  const formattedVarName = formattedToRegex(variableName);
  const egrepCommand =
    `egrep -i \"(/|^)${formattedVarName}(/index)?(/package)?\.js.*\"`;

  const findCommand = [
    `find ${lookupPath}`,
    '-name "**.js*"',
    '-not -path "./node_modules/*"',
  ].join(' ');
  const command = `${findCommand} | ${egrepCommand}`;

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
  return out.split('\n').filter(file => file);
}
