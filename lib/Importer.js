'use strict';

const childProcess = require('child_process');

const StringScanner = require('StringScanner');
const escapeRegExp = require('lodash.escaperegexp');
const eslint = require('eslint');
const lodashRange = require('lodash.range');
const minimatch = require('minimatch');
const sortBy = require('lodash.sortby');
const uniqBy = require('lodash.uniqby');

const CommandLineEditor = require('./CommandLineEditor');
const Configuration = require('./Configuration');
const ImportStatement = require('./ImportStatement');
const ImportStatements = require('./ImportStatements');
const JsModule = require('./JsModule');
const xRegExp = require('./xregexp');

const REGEX_SKIP_SECTION = xRegExp(`
  ^
  \\s*                     # preceding whitespace
  (?:
    (?<quote>['"])use\\sstrict\\k<quote>;? # 'use strict';
    |
    //[^\n]*               # single-line comment
    |
    /\\*                   # open multi-line comment
    (?:\n|.)*?             # inside of multi-line comment
    \\*/                   # close multi-line comment
  )?                       # ? b/c we want to match on only whitespace
  \n                       # end of line
  `, 'xs' // free-spacing, dot-match-all
);

class Importer {
  constructor(lines, pathToCurrentFile) {
    this.editor = new CommandLineEditor(lines);
    this.config = new Configuration(pathToCurrentFile);
    this.pathToCurrentFile = pathToCurrentFile;
    this.messages = [];
    this.unresolvedImports = {};
  }

  /**
   * Imports one variable
   *
   * @return {Object}
   */
  results() {
    return {
      messages: this.messages, // array
      fileContent: this.editor.currentFileContent(), // string
      unresolvedImports: this.unresolvedImports, // object
    };
  }

  /**
   * Imports one variable
   *
   * @return {Object}
   */
  import(variableName) {
    if (!variableName) {
      this.message('No variable to import. Place your cursor on a variable, ' +
                   'then try again.');
      return this.results();
    }

    const jsModule = this.findOneJsModule(variableName);
    if (!jsModule) {
      return this.results();
    }

    const oldImports = this.findCurrentImports();
    const importStatement = jsModule.toImportStatement(variableName, this.config);
    oldImports.imports.push(importStatement);
    this.replaceImports(oldImports.range, oldImports.imports);

    return this.results();
  }

  goto(variableName) {
    const jsModules = this.findJsModulesFor(variableName);

    const jsModule = this.resolveModuleUsingCurrentImports(
      jsModules, variableName);

    if (!jsModule) {
      // The current word is not mappable to one of the JS modules that we
      // found. This can happen if the user does not select one from the list.
      // We have nothing to go to, so we return early.
      this.message(`Could not resolve a module for \`${variableName}\``);
      return this.results();
    }

    const filePath = jsModule.openFilePath(this.pathToCurrentFile);
    const results = this.results();
    results.goto = filePath;
    return results;
  }

  // Removes unused imports and adds imports for undefined variables
  fixImports() {
    const cli = new eslint.CLIEngine();
    const config = cli.getConfigForFile(this.pathToCurrentFile);

    // Reset rules to only the ones we care about.
    config.rules = {
      'no-undef': 2,
      'no-unused-vars': 2,
      'react/jsx-no-undef': 2,
      'react/react-in-jsx-scope': 2,
      'react/jsx-uses-vars': 2,
      'react/jsx-uses-react': 2,
    };
    const eslintResult = eslint.linter.verify(
      this.editor.currentFileContent(), config);

    const unusedVariables = {};
    const undefinedVariables = new Set();

    eslintResult.forEach((message) => {
      switch (message.ruleId) {
        case 'no-unused-vars': {
          const match = message.message.match(
            /'(.*)' is defined but never used/);
          const variableName = match[1];
          unusedVariables[variableName] = unusedVariables[variableName] || [];
          unusedVariables[variableName].push(message.line);
          break;
        }
        case 'no-undef':
        case 'react/jsx-no-undef': {
          const match = message.message.match(
            /'(.*)' is not defined/);
          undefinedVariables.add(match[1]);
          break;
        }
        case 'react/react-in-jsx-scope':
          undefinedVariables.add('React');
          break;
        default:
          break;
      }
    });

    if (!Object.keys(unusedVariables).length && !undefinedVariables.size) {
      // return early to avoid rewriting imports
      return this.results();
    }

    const oldImports = this.findCurrentImports();

    const unusedImportVariables = new Set();
    Object.keys(unusedVariables).forEach((variable) => {
      const lineNumbers = unusedVariables[variable];
      if (this.anyNumbersWithinRange(lineNumbers, oldImports.range)) {
        unusedImportVariables.add(variable);
      }
    });

    const newImports = oldImports.imports.clone();
    newImports.deleteVariables(unusedImportVariables);

    undefinedVariables.forEach((variable) => {
      const jsModule = this.findOneJsModule(variable);
      if (!jsModule) {
        return;
      }
      newImports.push(jsModule.toImportStatement(variable, this.config));
    });

    this.replaceImports(oldImports.range, newImports);

    return this.results();
  }

  /**
   * @param {Array<Object>} jsonImports
   */
  addImports(imports) {
    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.clone();

    Object.keys(imports).forEach((variableName) => {
      const importPath = imports[variableName];
      newImports.push(new JsModule({ importPath }).toImportStatement(
        variableName, this.config));
    });

    this.replaceImports(oldImports.range, newImports);

    return this.results();
  }

  rewriteImports() {
    const oldImports = this.findCurrentImports();
    const newImports = new ImportStatements(this.config);

    oldImports.imports.forEach((imp) => {
      imp.variables().forEach((variable) => {
        const jsModule = this.resolveModuleUsingCurrentImports(
          this.findJsModulesFor(variable),
          variable
        );

        if (!jsModule) {
          return;
        }

        newImports.push(jsModule.toImportStatement(variable, this.config));
      });
    });

    this.replaceImports(oldImports.range, newImports);

    return this.results();
  }

  /**
   * @param {string} str
   */
  message(str) {
    this.messages.push(`ImportJS: ${str}`);
  }

  /**
   * @param {Array<Number>} numbers
   * @param {Array<Number>} range
   * @return {Boolean}
   */
  anyNumbersWithinRange(numbers, range) {
    for (let i = 0; i < numbers.length; i++) {
      if (range.indexOf(numbers[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {String} variableName
   * @return {?JsModule}
   */
  findOneJsModule(variableName) {
    const jsModules = this.findJsModulesFor(variableName);
    if (!jsModules.length) {
      this.message(`No JS module to import for variable \`${variableName}\``);
      return null;
    }

    return this.resolveOneJsModule(jsModules, variableName);
  }

  /**
   * @param {Array<Number>} oldImportsRange
   * @param {ImportStatements} newImports
   */
  replaceImports(oldImportsRange, newImports) {
    const importStrings = newImports.toArray();

    // Ensure that there is a blank line after the block of all imports
    const lastNumInRange = oldImportsRange[oldImportsRange.length - 1];
    if (oldImportsRange.length + importStrings.length > 1 &&
        this.editor.readLine(lastNumInRange) !== '') {
      this.editor.appendLine(lastNumInRange - 1, '');
    }

    // Find old import strings so we can compare with the new import strings
    // and see if anything has changed.
    const oldImportStrings = [];
    oldImportsRange.slice(0, oldImportsRange.length - 1).forEach((lineNumber) => {
      oldImportStrings.push(this.editor.readLine(lineNumber));
    });

    // If nothing has changed, bail to prevent unnecessarily dirtying the buffer
    if (JSON.stringify(importStrings) === JSON.stringify(oldImportStrings)) {
      return;
    }

    // Delete old imports, then add the modified list back in.
    oldImportsRange.slice(0, oldImportsRange.length - 1).forEach(
      () => this.editor.deleteLine(oldImportsRange[0]));

    if (importStrings.length === 0 &&
        this.editor.readLine(oldImportsRange[0]) === '') {
      // We have no newlines to write back to the file. Clearing out potential
      // whitespace where the imports used to be leaves the file in a better
      // state.
      this.editor.deleteLine(oldImportsRange[0]);
      return;
    }

    importStrings.reverse().forEach((importString) => {
      // We need to add each line individually because the Vim buffer will
      // convert newline characters to `~@`.
      if (importString.indexOf('\n') !== -1) {
        importString.split('\n').reverse().forEach((line) => {
          this.editor.appendLine(oldImportsRange[0] - 1, line);
        });
      } else {
        this.editor.appendLine(oldImportsRange[0] - 1, importString);
      }
    });
  }

  /**
   * @return {Object}
   */
  findCurrentImports() {
    /* eslint-disable no-cond-assign */
    let importsStartAtLineNumber = 1;
    let newlineCount = 0;

    const scanner = new StringScanner(this.editor.currentFileContent());
    let skipped = '';
    let skipSection;
    while (skipSection = scanner.scan(REGEX_SKIP_SECTION)) {
      skipped += skipSection;
    }

    // We don't want to skip over blocks that are only whitespace
    if (xRegExp.test(skipped, xRegExp('^\\s+$', 's'))) {
      scanner.reset();
    } else {
      const count = (skipped.match(/\n/g) || []).length;
      importsStartAtLineNumber = importsStartAtLineNumber + count;
    }

    const imports = new ImportStatements(this.config);
    let potentialImport;
    while (potentialImport = scanner.scan(xRegExp('(^\\s*\\n)*^.*?;\\n', 's'))) {
      const importStatement = ImportStatement.parse(potentialImport.trim());
      if (!importStatement) {
        break;
      }

      imports.push(importStatement);
      const count = (potentialImport.match(/\n/g) || []).length;
      newlineCount += count;
    }

    const importsEndAtLineNumber = importsStartAtLineNumber + newlineCount + 1;
    return {
      imports,
      range: lodashRange(importsStartAtLineNumber, importsEndAtLineNumber),
    };
  }

  /**
   * @param {String} variableName
   * @return {Array}
   */
  findJsModulesFor(variableName) {
    const aliasModule = this.config.resolveAlias(
      variableName, this.pathToCurrentFile);
    if (aliasModule) {
      return [aliasModule];
    }

    const namedImportsModule = this.config.resolveNamedExports(variableName);
    if (namedImportsModule) {
      return [namedImportsModule];
    }

    const formattedVarName = this.formattedToRegex(variableName);
    const egrepCommand =
      `egrep -i \"(/|^)${formattedVarName}(/index)?(/package)?\.js.*\"`;
    let matchedModules = [];
    this.config.get('lookup_paths').forEach((lookupPath) => {
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
        if (this.config.get('excludes').some(
          (globPattern) => minimatch(f, globPattern))) {
          return;
        }

        const module = JsModule.construct({
          lookupPath,
          relativeFilePath: f,
          stripFileExtensions:
            this.config.get('strip_file_extensions', { fromFile: f }),
          makeRelativeTo:
            this.config.get('use_relative_paths', { fromFile: f }) &&
            this.pathToCurrentFile,
          stripFromPath:
            this.config.get('strip_from_path', { fromFile: f }),
        });
        if (module) {
          matchedModules.push(module);
        }
      });
    });

    // Find imports from package.json
    const ignorePrefixes = this.config.get('ignore_package_prefixes').map(
      (prefix) => escapeRegExp(prefix));

    const depRegex = RegExp(
      `^(?:${ignorePrefixes.join('|')})?${formattedVarName}$`);

    this.config.packageDependencies().forEach((dep) => {
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

    this.config.environmentCoreModules().forEach((dep) => {
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

  /**
   * @param {Array} jsModules
   * @param {String} variableName
   * @return {JsModule}
   */
  resolveOneJsModule(jsModules, variableName) {
    if (jsModules.length === 1) {
      const jsModule = jsModules[0];
      const jsModuleName = jsModule.displayName();
      let imported;
      if (jsModule.hasNamedExports) {
        imported = `\`${variableName}\` from \`${jsModuleName}\``;
      } else {
        imported = `\`${jsModuleName}\``;
      }
      this.message(`Imported ${imported}`);
      return jsModule;
    }

    this.unresolvedImports[variableName] =
      jsModules.map((jsModule) => ({
        displayName: jsModule.displayName(),
        importPath: jsModule.importPath,
        filePath: jsModule.openFilePath(this.pathToCurrentFile),
      })
    );

    return undefined;
  }

  /**
   * @param {Array} jsModules
   * @param {String} variableName
   * @return {JsModule}
   */
  resolveModuleUsingCurrentImports(jsModules, variableName) {
    if (jsModules.length === 1) {
      return jsModules[0];
    }

    // Look at the current imports and grab what is already imported for the
    // variable.
    let matchingImportStatement;
    this.findCurrentImports().imports.forEach((ist) => {
      if (variableName === ist.defaultImport ||
         (ist.namedImports && ist.namedImports.indexOf(variableName) !== -1)) {
        matchingImportStatement = ist;
      }
    });

    if (matchingImportStatement) {
      if (jsModules.length === 0) {
        // We couldn't resolve any module for the variable. As a fallback, we
        // can use the matching import statement. If that maps to a package
        // dependency, we will still open the right file.
        let hasNamedExports = false;
        if (matchingImportStatement.hasNamedImports()) {
          hasNamedExports =
            matchingImportStatement.namedImports.indexOf(variableName) !== -1;
        }

        const matchedModule = new JsModule({
          importPath: matchingImportStatement.path,
          hasNamedExports,
        });

        return matchedModule;
      }

      // Look for a module matching what is already imported
      return jsModules.find(jsModule => (
        matchingImportStatement.path === jsModule.importPath
      ));
    }

    // Fall back to asking the user to resolve the ambiguity
    return this.resolveOneJsModule(jsModules, variableName);
  }

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
  formattedToRegex(string) {
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
}

module.exports = Importer;
