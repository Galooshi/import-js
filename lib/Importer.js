'use strict';

const eslint = require('eslint');

const CommandLineEditor = require('./CommandLineEditor');
const Configuration = require('./Configuration');
const ImportStatements = require('./ImportStatements');
const JsModule = require('./JsModule');
const findCurrentImports = require('./findCurrentImports');
const findJsModulesFor = require('./findJsModulesFor');

/**
 * @param {Array<Number>} numbers
 * @param {Array<Number>} range
 * @return {Boolean}
 */
function anyNumbersWithinRange(numbers, range) {
  for (let i = 0; i < numbers.length; i++) {
    if (range.indexOf(numbers[i]) !== -1) {
      return true;
    }
  }
  return false;
}

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
    const jsModule = this.findOneJsModule(variableName);
    if (!jsModule) {
      this.message(`No JS module to import for variable \`${variableName}\``);
      return this.results();
    }

    const jsModuleName = jsModule.displayName();
    if (jsModule.hasNamedExports) {
      this.message(`Imported \`${variableName}\` from \`${jsModuleName}\``);
    } else {
      this.message(`Imported \`${jsModuleName}\``);
    }

    const oldImports = this.findCurrentImports();
    const importStatement = jsModule.toImportStatement(variableName, this.config);
    oldImports.imports.push(importStatement);
    this.replaceImports(oldImports.range, oldImports.imports);

    return this.results();
  }

  goto(variableName) {
    const jsModules = findJsModulesFor(
      this.config,
      this.pathToCurrentFile,
      variableName
    );

    const jsModule = this.resolveModuleUsingCurrentImports(
      jsModules, variableName);

    if (!jsModule) {
      // The current word is not mappable to one of the JS modules that we
      // found. This can happen if the user does not select one from the list.
      // We have nothing to go to, so we return early.
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
      if (/^Definition for rule '.*?' was not found$/.test(message.message)) {
        return;
      }

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
          const match = message.message.match(/'(.*)' is not defined/);
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
      if (anyNumbersWithinRange(lineNumbers, oldImports.range)) {
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
   * @param {Array<Object>} imports
   */
  addImports(imports) {
    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.clone();

    const variables = Object.keys(imports);
    variables.forEach((variableName) => {
      const importPath = imports[variableName];
      newImports.push(new JsModule({ importPath }).toImportStatement(
        variableName, this.config));
    });

    if (variables.length === 1) {
      this.message(`Added import for \`${variables[0]}\``);
    } else {
      this.message(`Added ${variables.length} imports`);
    }

    this.replaceImports(oldImports.range, newImports);

    return this.results();
  }

  rewriteImports() {
    const oldImports = this.findCurrentImports();
    const newImports = new ImportStatements(this.config);

    oldImports.imports.forEach((imp) => {
      imp.variables().forEach((variable) => {
        const jsModule = this.resolveModuleUsingCurrentImports(
          findJsModulesFor(this.config, this.pathToCurrentFile, variable),
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
   * @param {String} variableName
   * @return {?JsModule}
   */
  findOneJsModule(variableName) {
    const jsModules = findJsModulesFor(
      this.config,
      this.pathToCurrentFile,
      variableName
    );

    if (!jsModules.length) {
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
    return findCurrentImports(this.config, this.editor.currentFileContent());
  }

  /**
   * @param {Array} jsModules
   * @param {String} variableName
   * @return {JsModule}
   */
  resolveOneJsModule(jsModules, variableName) {
    if (jsModules.length === 1) {
      const jsModule = jsModules[0];
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
}

module.exports = Importer;
