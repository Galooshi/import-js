import formattedToRegex from '../formattedToRegex';

let existingFiles = [];

export default function findMatchingFiles(variableName) {
  const formattedVarName = formattedToRegex(variableName);
  const files = existingFiles.filter(file => file.match(
      new RegExp(`(/|^)${formattedVarName}(/index)?(/package)?\.js.*`, 'i')));
  return Promise.resolve(files);
}

findMatchingFiles.__setExistingFiles = function __setExistingFiles(files) {
  existingFiles = files;
};
