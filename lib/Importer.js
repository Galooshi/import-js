// @flow

import escapeRegExp from 'lodash.escaperegexp';
import eslint from 'eslint';

import CommandLineEditor from './CommandLineEditor';
import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import ImportStatements from './ImportStatements';
import JsModule from './JsModule';
import findCurrentImports from './findCurrentImports';
import findJsModulesFor from './findJsModulesFor';

function anyNumbersWithinRange(numbers: Array<number>, range: Object): boolean {
  for (let i = 0; i < numbers.length; i++) {
    if (range.start <= numbers[i] && numbers[i] < range.end) {
      return true;
    }
  }
  return false;
}

export default class Importer {
  editor: CommandLineEditor;
  config: Configuration;
  pathToCurrentFile: string;
  messages: Array<string>;
  unresolvedImports: Object;

  constructor(lines: Array<string>, pathToCurrentFile: string) {
    this.editor = new CommandLineEditor(lines);
    this.config = new Configuration(pathToCurrentFile);

    // Normalize the path to the current file so that we only have to deal with
    // local paths.
    this.pathToCurrentFile = pathToCurrentFile && pathToCurrentFile.replace(
      RegExp(`^${escapeRegExp(process.cwd())}/`), '');

    this.messages = Array.from(this.config.messages);
    this.unresolvedImports = {};
  }

  results(): Object {
    return {
      messages: this.messages, // array
      fileContent: this.editor.currentFileContent(), // string
      unresolvedImports: this.unresolvedImports, // object
    };
  }

  /**
   * Imports one variable
   */
  import(variableName: string): Object {
    const jsModule = this.findOneJsModule(variableName);
    if (!jsModule) {
      this.message(`No JS module to import for \`${variableName}\``);
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

  goto(variableName: string): Object {
    const jsModules = findJsModulesFor(
      this.config,
      variableName,
      this.pathToCurrentFile
    );

    const jsModule = this.resolveModuleUsingCurrentImports(
      jsModules, variableName);

    if (!jsModule) {
      // The current word is not mappable to one of the JS modules that we
      // found. This can happen if the user does not select one from the list.
      // We have nothing to go to, so we return early.
      this.message(`No JS module found for \`${variableName}\``);
      return this.results();
    }

    const filePath = jsModule.openFilePath(this.pathToCurrentFile);
    const results = this.results();
    results.goto = filePath;
    return results;
  }

  // Removes unused imports and adds imports for undefined variables
  fixImports(): Object {
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

    eslintResult.forEach((message: Object) => {
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

    const oldImports = this.findCurrentImports();

    const unusedImportVariables = new Set();
    Object.keys(unusedVariables).forEach((variable: string) => {
      const lines = unusedVariables[variable]
        .map((line: number): number => line - 1);
      if (anyNumbersWithinRange(lines, oldImports.range)) {
        unusedImportVariables.add(variable);
      }
    });

    const newImports = oldImports.imports.clone();
    newImports.deleteVariables(unusedImportVariables);

    const addedVariables = new Set();
    undefinedVariables.forEach((variable: string) => {
      const jsModule = this.findOneJsModule(variable);
      if (!jsModule) {
        return;
      }
      addedVariables.add(variable);
      newImports.push(jsModule.toImportStatement(variable, this.config));
    });

    if (!unusedImportVariables.size && !addedVariables.size) {
      // return early to avoid unnecessary computation
      return this.results();
    }

    this.replaceImports(oldImports.range, newImports);

    this.message(this.fixImportsMessage(
      unusedImportVariables, addedVariables));

    return this.results();
  }

  addImports(imports: Object): Object {
    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.clone();

    const variables = Object.keys(imports);
    variables.forEach((variableName: string) => {
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

  rewriteImports(): Object {
    const oldImports = this.findCurrentImports();
    const newImports = new ImportStatements(this.config);

    oldImports.imports.forEach((imp: ImportStatement) => {
      imp.variables().forEach((variable: string) => {
        const jsModule = this.resolveModuleUsingCurrentImports(
          findJsModulesFor(this.config, variable, this.pathToCurrentFile),
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

  message(str: string) {
    this.messages.push(str);
  }

  findOneJsModule(variableName: string): ?JsModule {
    const jsModules = findJsModulesFor(
      this.config,
      variableName,
      this.pathToCurrentFile
    );

    if (!jsModules.length) {
      return null;
    }

    return this.resolveOneJsModule(jsModules, variableName);
  }

  replaceImports(oldImportsRange: Object, newImports: ImportStatements) {
    const importStrings = newImports.toArray();

    // Ensure that there is a blank line after the block of all imports
    if (importStrings.length &&
        this.editor.get(oldImportsRange.end) !== '') {
      this.editor.insertBefore(oldImportsRange.end, '');
    }

    // Delete old imports, then add the modified list back in.
    for (let i = oldImportsRange.end - 1; i >= oldImportsRange.start; i--) {
      this.editor.remove(i);
    }

    if (importStrings.length === 0 &&
        this.editor.get(oldImportsRange.start) === '') {
      // We have no newlines to write back to the file. Clearing out potential
      // whitespace where the imports used to be leaves the file in a better
      // state.
      this.editor.remove(oldImportsRange.start);
      return;
    }

    importStrings.reverse().forEach((importString: string) => {
      // We need to add each line individually because the Vim buffer will
      // convert newline characters to `~@`.
      if (importString.indexOf('\n') !== -1) {
        importString.split('\n').reverse().forEach((line: string) => {
          this.editor.insertBefore(oldImportsRange.start, line);
        });
      } else {
        this.editor.insertBefore(oldImportsRange.start, importString);
      }
    });
  }

  findCurrentImports(): Object {
    return findCurrentImports(this.config, this.editor.currentFileContent());
  }

  resolveOneJsModule(
    jsModules: Array<JsModule>,
    variableName: string
  ): ?JsModule {
    if (jsModules.length === 1) {
      const jsModule = jsModules[0];
      return jsModule;
    }

    if (!jsModules.length) {
      return undefined;
    }

    this.unresolvedImports[variableName] =
      jsModules.map((jsModule: JsModule): Object => ({
        displayName: jsModule.displayName(),
        importPath: jsModule.importPath,
        filePath: jsModule.openFilePath(this.pathToCurrentFile),
      })
    );

    return undefined;
  }

  resolveModuleUsingCurrentImports(
    jsModules: Array<JsModule>,
    variableName: string
  ): ?JsModule {
    if (jsModules.length === 1) {
      return jsModules[0];
    }

    // Look at the current imports and grab what is already imported for the
    // variable.
    let matchingImportStatement;
    this.findCurrentImports().imports.forEach((ist: ImportStatement) => {
      if (variableName === ist.defaultImport ||
         (ist.namedImports && ist.namedImports.indexOf(variableName) !== -1)) {
        matchingImportStatement = ist;
      }
    });

    if (!matchingImportStatement) {
      // Fall back to asking the user to resolve the ambiguity
      return this.resolveOneJsModule(jsModules, variableName);
    }

    if (jsModules.length > 0) {
      // Look for a module matching what is already imported
      const { path } = matchingImportStatement;
      return jsModules.find((jsModule: JsModule): boolean => (
        path === jsModule.importPath
      ));
    }

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

  fixImportsMessage(removedVariables: Set, addedVariables: Set): string {
    const messageParts = [];
    if (addedVariables.size === 1) {
      messageParts.push(
        `Imported \`${addedVariables.values().next().value}\`.`);
    } else if (addedVariables.size) {
      messageParts.push(`Added ${addedVariables.size} imports.`);
    }

    if (removedVariables.size === 1) {
      messageParts.push(
        `Removed \`${removedVariables.values().next().value}\`.`);
    } else if (removedVariables.size) {
      messageParts.push(`Removed ${removedVariables.size} imports.`);
    }

    return messageParts.join(' ');
  }
}
