import formattedToRegex from '../formattedToRegex';

let existingFiles = [];

export default function findMatchingFiles(lookupPath, variableName) {
  const formattedVarName = formattedToRegex(variableName);
  return existingFiles.filter(file => file.match(
      new RegExp(`(/|^)${formattedVarName}(/index)?(/package)?\.js.*`, 'i')));
}

findMatchingFiles.__setExistingFiles = function __setExistingFiles(files) {
  existingFiles = files;
};
