const childProcess = require('child_process');
const escapeRegExp = require('lodash.escaperegexp');
const minimatch = require('minimatch');
const sortBy = require('lodash.sortby');
const uniqBy = require('lodash.uniqby');

const JsModule = require('./JsModule');

/**
 * Takes a string in any of the following four formats:
 *   dash-separated
 *   snake_case
 *   camelCase
 *   PascalCase
 * and turns it into a star-separated lower case format, like so:
 *   star*separated
 *
 * @param {String} string
 * @return {String}
 */
function formattedToRegex(string) {
  // Based on
  // http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby

  // The pattern to match in between words. The "es" and "s" match is there
  // to catch pluralized folder names. There is a risk that this is overly
  // aggressive and will lead to trouble down the line. In that case, we can
  // consider adding a configuration option to control mapping a singular
  // variable name to a plural folder name (suggested by @lencioni in #127).
  // E.g.
  //
  // {
  //   "^mock": "./mocks/"
  // }
  const splitPattern = '(es|s)?.?';

  // Split up the string, allow pluralizing and a single (any) character
  // in between. This will make e.g. 'fooBar' match 'foos/bar', 'foo_bar',
  // and 'foobar'.
  return string
    .replace(/([a-z\d])([A-Z])/g, `$1${splitPattern}$2`) // camelCase
    .replace(/[-_]/g, splitPattern)
    .toLowerCase();
}

/**
 * @param {Configuration} config
 * @param {String} pathToCurrentFile
 * @param {String} variableName
 * @return {Array}
 */
function findJsModulesFor(config, pathToCurrentFile, variableName) {
  const aliasModule = config.resolveAlias(variableName, pathToCurrentFile);
  if (aliasModule) {
    return [aliasModule];
  }

  const namedImportsModule = config.resolveNamedExports(variableName);
  if (namedImportsModule) {
    return [namedImportsModule];
  }

  const formattedVarName = formattedToRegex(variableName);
  const egrepCommand =
    `egrep -i \"(/|^)${formattedVarName}(/index)?(/package)?\.js.*\"`;
  let matchedModules = [];
  config.get('lookup_paths').forEach((lookupPath) => {
    if (lookupPath === '') {
      // If lookupPath is an empty string, the `find` command will not work
      // as desired so we bail early.
      throw new Error(`lookup path cannot be empty (${lookupPath})`);
    }

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

    out.split('\n').forEach((f) => {
      // TODO: it looks like we process empty strings here too (f === '')
      if (config.get('excludes').some(
        (globPattern) => minimatch(f, globPattern))) {
        return;
      }

      const module = JsModule.construct({
        lookupPath,
        relativeFilePath: f,
        stripFileExtensions:
          config.get('strip_file_extensions', { fromFile: f }),
        makeRelativeTo:
          config.get('use_relative_paths', { fromFile: f }) &&
          pathToCurrentFile,
        stripFromPath:
          config.get('strip_from_path', { fromFile: f }),
      });
      if (module) {
        matchedModules.push(module);
      }
    });
  });

  // Find imports from package.json
  const ignorePrefixes = config.get('ignore_package_prefixes').map(
    (prefix) => escapeRegExp(prefix));

  const depRegex = RegExp(
    `^(?:${ignorePrefixes.join('|')})?${formattedVarName}$`);

  config.packageDependencies().forEach((dep) => {
    if (!dep.match(depRegex)) {
      return;
    }

    const jsModule = JsModule.construct({
      lookupPath: 'node_modules',
      relativeFilePath: `node_modules/${dep}/package.json`,
      stripFileExtensions: [],
    });

    if (jsModule) {
      matchedModules.push(jsModule);
    }
  });

  config.environmentCoreModules().forEach((dep) => {
    if (dep.toLowerCase() !== variableName.toLowerCase()) {
      return;
    }

    matchedModules.push(new JsModule({ importPath: dep }));
  });

  // If you have overlapping lookup paths, you might end up seeing the same
  // module to import twice. In order to dedupe these, we remove the module
  // with the longest path
  matchedModules = sortBy(matchedModules,
    (module) => module.importPath.length);
  matchedModules = uniqBy(matchedModules,
    (module) => module.filePath);
  return sortBy(matchedModules, (module) => module.displayName());
}

module.exports = findJsModulesFor;
