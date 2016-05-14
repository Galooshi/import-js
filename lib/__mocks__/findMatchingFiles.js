import formattedToRegex from '../formattedToRegex';

let existingFiles = [];

function __setExistingFiles(files) {
  existingFiles = files;
}

function findMatchingFiles(lookupPath, variableName) {
  const formattedVarName = formattedToRegex(variableName);
  return existingFiles.filter(file => file.match(
      new RegExp(`(/|^)${formattedVarName}(/index)?(/package)?\.js.*`, 'i')));
}

findMatchingFiles.__setExistingFiles = __setExistingFiles;
export default findMatchingFiles;
