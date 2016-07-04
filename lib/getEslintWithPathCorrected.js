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
export default function getEslintWithPathCorrected(
  workingDirectory: string
): Object {
  const oldPath = process.env.NODE_PATH || '';
  const localNodeModulesPath = `${workingDirectory}/node_modules/`;
  /* eslint-disable global-require */
  if (oldPath.indexOf(localNodeModulesPath) === -1) {
    process.env.NODE_PATH = `${oldPath || ''}:${localNodeModulesPath}`;
    require('module').Module._initPaths(); // eslint-disable-line no-underscore-dangle
  }
  return require('eslint');
  /* eslint-enable global-require */
}
