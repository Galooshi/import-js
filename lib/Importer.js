// @flow
import escapeRegExp from 'lodash.escaperegexp';

import CommandLineEditor from './CommandLineEditor';
import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import ImportStatements from './ImportStatements';
import JsModule from './JsModule';
import findCurrentImports from './findCurrentImports';
import findJsModulesFor from './findJsModulesFor';
import findUndefinedIdentifiers from './findUndefinedIdentifiers';
import findUsedIdentifiers from './findUsedIdentifiers';
import parse from './parse';

export default class Importer {
  ast: Object;
  config: Configuration;
  editor: CommandLineEditor;
  messages: Array<string>;
  pathToCurrentFile: string;
  unresolvedImports: Object;
  workingDirectory: string;

  constructor(
    lines: Array<string>,
    pathToFile: ?string,
    workingDirectory: string = process.cwd()
  ) {
    const pathToCurrentFile = pathToFile || '';
    this.editor = new CommandLineEditor(lines);
    this.ast = parse(this.editor.currentFileContent());
    this.config = new Configuration(pathToCurrentFile, workingDirectory);
    this.workingDirectory = workingDirectory;

    // Normalize the path to the current file so that we only have to deal with
    // local paths.
    this.pathToCurrentFile = pathToCurrentFile && pathToCurrentFile.replace(
      RegExp(`^${escapeRegExp(workingDirectory)}/`), '');

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
  import(variableName: string): Promise<Object> {
    return new Promise((resolve: Function, reject: Function) => {
      this.findOneJsModule(variableName).then((jsModule: JsModule) => {
        if (!jsModule) {
          this.message(`No JS module to import for \`${variableName}\``);
          resolve(this.results());
          return;
        }

        const jsModuleName = jsModule.displayName();
        if (jsModule.hasNamedExports) {
          this.message(`Imported \`${variableName}\` from \`${jsModuleName}\``);
        } else {
          this.message(`Imported \`${jsModuleName}\``);
        }

        const oldImports = this.findCurrentImports();
        const importStatement = jsModule.toImportStatement(this.config);
        oldImports.imports.push(importStatement);
        this.replaceImports(oldImports.range, oldImports.imports);

        resolve(this.results());
      }).catch((error: Object) => {
        reject(error);
      });
    });
  }

  goto(variableName: string): Promise<Object> {
    return new Promise((resolve: Function, reject: Function) => {
      findJsModulesFor(
        this.config,
        variableName,
        this.pathToCurrentFile
      ).then((jsModules: Array<JsModule>) => {
        const jsModule = this.resolveModuleUsingCurrentImports(
          jsModules, variableName);

        if (!jsModule) {
          // The current word is not mappable to one of the JS modules that we
          // found. This can happen if the user does not select one from the list.
          // We have nothing to go to, so we return early.
          this.message(`No JS module found for \`${variableName}\``);
          resolve(this.results());
          return;
        }

        const filePath = jsModule.resolvedFilePath(
          this.pathToCurrentFile, this.workingDirectory);
        const results = this.results();
        results.goto = filePath;
        resolve(results);
      }).catch((error: Object) => {
        reject(error);
      });
    });
  }

  // Removes unused imports and adds imports for undefined variables
  fixImports(): Promise<Object> {
    const undefinedVariables = findUndefinedIdentifiers(
      this.ast, this.config.get('globals'));
    const usedVariables = findUsedIdentifiers(this.ast);
    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.clone();

    const unusedImportVariables = new Set();
    oldImports.imports.forEach((importStatement: ImportStatement) => {
      importStatement.variables().forEach((variable: string) => {
        if (!usedVariables.has(variable)) {
          unusedImportVariables.add(variable);
        }
      });
    });
    newImports.deleteVariables(unusedImportVariables);

    const addedItems = new Set(this.injectSideEffectImports(newImports));

    return new Promise((resolve: Function, reject: Function) => {
      const allPromises = [];
      undefinedVariables.forEach((variable: string) => {
        allPromises.push(this.findOneJsModule(variable));
      });
      Promise.all(allPromises).then((results: Array<JsModule>) => {
        results.forEach((jsModule: JsModule) => {
          if (!jsModule) {
            return;
          }
          addedItems.add(jsModule.variableName);
          newImports.push(jsModule.toImportStatement(this.config));
        });

        this.replaceImports(oldImports.range, newImports);

        const message = this.fixImportsMessage(
          unusedImportVariables, addedItems);
        if (message) {
          this.message(message);
        }

        resolve(this.results());
      }).catch((error: Object) => {
        reject(error);
      });
    });
  }

  addImports(imports: Object): Promise<Object> {
    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.clone();

    const variables = Object.keys(imports);
    variables.forEach((variableName: string) => {
      const importPath = imports[variableName];
      newImports.push(new JsModule(
        { importPath, variableName }).toImportStatement(this.config));
    });

    if (variables.length === 1) {
      this.message(`Added import for \`${variables[0]}\``);
    } else {
      this.message(`Added ${variables.length} imports`);
    }

    this.replaceImports(oldImports.range, newImports);

    return new Promise((resolve: Function) => {
      resolve(this.results());
    });
  }

  rewriteImports(): Object {
    const oldImports = this.findCurrentImports();
    const newImports = new ImportStatements(this.config);

    return new Promise((resolve: Function, reject: Function) => {
      const variables = [];
      const sideEffectOnlyImports = [];
      oldImports.imports.forEach((imp: ImportStatement) => {
        if (imp.variables().length) {
          variables.push(...imp.variables());
        } else if (imp.hasSideEffects) {
          // side-effect imports don't have variable names. Tuck them away and just pass
          // them through to the end of this operation.
          sideEffectOnlyImports.push(imp);
        }
      });
      const promises = variables.map((variable: string): Promise<Array<JsModule>> =>
        findJsModulesFor(this.config, variable, this.pathToCurrentFile));

      Promise.all(promises).then((results: Array<Array<JsModule>>) => {
        results.forEach((jsModules: Array<JsModule>) => {
          if (!jsModules.length) {
            return;
          }

          const jsModule = this.resolveModuleUsingCurrentImports(
            jsModules, jsModules[0].variableName);

          if (!jsModule) {
            return;
          }

          newImports.push(jsModule.toImportStatement(this.config));
        });

        newImports.push(...sideEffectOnlyImports);

        this.replaceImports(oldImports.range, newImports);
        resolve(this.results());
      }).catch((error: Object) => {
        reject(error);
      });
    });
  }

  message(str: string) {
    this.messages.push(str);
  }

  findOneJsModule(variableName: string): Promise<JsModule> {
    return new Promise((resolve: Function, reject: Function) => {
      findJsModulesFor(
        this.config,
        variableName,
        this.pathToCurrentFile
      ).then((jsModules: Array<JsModule>) => {
        if (!jsModules.length) {
          resolve(null);
          return;
        }
        resolve(this.resolveOneJsModule(jsModules, variableName));
      }).catch((error: Object) => {
        reject(error);
      });
    });
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
    return findCurrentImports(
      this.config, this.editor.currentFileContent(), this.ast);
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
        filePath: jsModule.resolvedFilePath(
          this.pathToCurrentFile, this.workingDirectory),
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
      const { path: matchingPath } = matchingImportStatement;
      return jsModules.find((jsModule: JsModule): boolean => (
        matchingPath === jsModule.toImportStatement(this.config).path
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
      variableName,
    });

    return matchedModule;
  }

  fixImportsMessage(
    removedItems: Set<string>,
    addedItems: Set<string>
  ): ?string {
    const messageParts = [];

    const firstAdded = addedItems.values().next().value;
    const firstRemoved = removedItems.values().next().value;

    if (addedItems.size === 1 && firstAdded) {
      messageParts.push(`Imported \`${firstAdded}\`.`);
    } else if (addedItems.size) {
      messageParts.push(`Added ${addedItems.size} imports.`);
    }

    if (removedItems.size === 1 && firstRemoved) {
      messageParts.push(`Removed \`${firstRemoved}\`.`);
    } else if (removedItems.size) {
      messageParts.push(`Removed ${removedItems.size} imports.`);
    }

    if (messageParts.length === 0) {
      return undefined;
    }
    return messageParts.join(' ');
  }

  injectSideEffectImports(importStatements: ImportStatements): Array<string> {
    const addedImports = [];
    this.config.get('moduleSideEffectImports').forEach((path: string) => {
      const sizeBefore = importStatements.size();
      importStatements.push(new ImportStatement({
        namedImports: [],
        defaultImport: '',
        hasSideEffects: true,
        declarationKeyword: this.config.get('declarationKeyword'),
        importFunction: this.config.get('importFunction'),
        path,
      }));
      if (importStatements.size() > sizeBefore) {
        // The number of imports changed as part of adding the side-effect
        // import. This means that the import wasn't previously there.
        addedImports.push(path);
      }
    });
    return addedImports;
  }
}
