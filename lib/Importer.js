import path from 'path';

import requireRelative from 'require-relative';

import CommandLineEditor from './CommandLineEditor';
import Configuration from './Configuration';
import ImportStatement from './ImportStatement';
import ImportStatements from './ImportStatements';
import JsModule from './JsModule';
import findCurrentImports from './findCurrentImports';
import findJsModulesFor from './findJsModulesFor';
import findUndefinedIdentifiers from './findUndefinedIdentifiers';
import findUsedIdentifiers from './findUsedIdentifiers';
import parse, { configureParserPlugins } from './parse';

function fixImportsMessage(removedItems, addedItems) {
  const messageParts = [];

  const firstAdded = addedItems.values().next().value;
  const firstRemoved = removedItems.values().next().value;

  if (addedItems.size === 1 && firstAdded) {
    messageParts.push(`Imported ${firstAdded}`);
  } else if (addedItems.size) {
    messageParts.push(`Added ${addedItems.size} imports`);
  }

  if (removedItems.size === 1 && firstRemoved) {
    messageParts.push(`Removed \`${firstRemoved}\`.`);
  } else if (removedItems.size) {
    messageParts.push(`Removed ${removedItems.size} imports.`);
  }

  if (messageParts.length === 0) {
    return undefined;
  }
  return messageParts.join('. ');
}

function findFilePathFromImports(imports, dirname, variableName) {
  const importStatement = imports.find((is) => is.hasVariable(variableName));

  if (!importStatement) {
    return undefined;
  }

  try {
    return requireRelative.resolve(importStatement.path, dirname);
  } catch {
    // it's expected that we can't resolve certain paths.
  }
  return undefined;
}

export default class Importer {
  ast;

  config;

  editor;

  messages;

  pathToCurrentFile;

  unresolvedImports;

  workingDirectory;

  constructor(lines, pathToCurrentFile, workingDirectory = process.cwd()) {
    this.pathToCurrentFile = pathToCurrentFile || '';
    this.editor = new CommandLineEditor(lines);
    this.config = new Configuration(this.pathToCurrentFile, workingDirectory);
    this.workingDirectory = workingDirectory;

    configureParserPlugins(this.config.get('parserPlugins'));

    this.messages = Array.from(this.config.messages);
    this.unresolvedImports = {};
    try {
      this.ast = parse(
        this.editor.currentFileContent(),
        this.pathToCurrentFile,
      );
    } catch (e) {
      if (e instanceof SyntaxError) {
        this.message(`SyntaxError: ${e.message}`);
        this.ast = parse('', '');
      } else {
        throw new Error(e);
      }
    }
  }

  results() {
    return {
      messages: this.messages, // array
      fileContent: this.editor.currentFileContent(), // string
      unresolvedImports: this.unresolvedImports, // object
    };
  }

  /**
   * Imports one variable
   */
  import(variableName) {
    return new Promise((resolve, reject) => {
      this.findOneJsModule(variableName)
        .then((jsModule) => {
          if (!jsModule) {
            if (!Object.keys(this.unresolvedImports).length) {
              this.message(`No JS module to import for \`${variableName}\``);
            }
            resolve(this.results());
            return;
          }

          const imported = jsModule.hasNamedExports
            ? `{ ${variableName} }`
            : variableName;

          this.message(`Imported ${imported} from '${jsModule.importPath}'`);

          const oldImports = this.findCurrentImports();
          const importStatement = jsModule.toImportStatement(this.config);
          oldImports.imports.push(importStatement);
          this.replaceImports(oldImports.range, oldImports.imports);

          resolve(this.results());
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   * Searches for an export
   */
  search(variableName) {
    return findJsModulesFor(this.config, variableName, { search: true }).then(
      (modules) => ({
        modules,
        messages: this.messages,
      }),
    );
  }

  goto(variableName) {
    const { imports } = this.findCurrentImports();
    const filePath = findFilePathFromImports(
      imports,
      path.dirname(this.pathToCurrentFile),
      variableName,
    );
    if (filePath) {
      return Promise.resolve({
        goto: filePath,
        ...this.results(),
      });
    }

    return new Promise((resolve, reject) => {
      findJsModulesFor(this.config, variableName)
        .then((jsModules) => {
          if (!jsModules.length) {
            // The current word is not mappable to one of the JS modules that we
            // found. This can happen if the user does not select one from the list.
            // We have nothing to go to, so we return early.
            this.message(`No JS module found for \`${variableName}\``);
            resolve(this.results());
            return;
          }

          const filePath = jsModules[0].resolvedFilePath(
            this.pathToCurrentFile,
            this.workingDirectory,
          );
          const results = this.results();
          results.goto = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.workingDirectory, filePath);
          resolve(results);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  // Removes unused imports and adds imports for undefined variables
  fixImports() {
    const undefinedVariables = findUndefinedIdentifiers(
      this.ast,
      this.config.get('globals'),
    );
    const usedVariables = findUsedIdentifiers(this.ast);
    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.clone();

    const unusedImportVariables = new Set();
    oldImports.imports.forEach((importStatement) => {
      importStatement.variables().forEach((variable) => {
        if (!usedVariables.has(variable)) {
          unusedImportVariables.add(variable);
        }
      });
    });
    newImports.deleteVariables(unusedImportVariables);

    const addedItems = new Set(this.injectSideEffectImports(newImports));

    return new Promise((resolve, reject) => {
      const allPromises = [];
      undefinedVariables.forEach((variable) => {
        allPromises.push(this.findOneJsModule(variable));
      });
      Promise.all(allPromises)
        .then((results) => {
          results.forEach((jsModule) => {
            if (!jsModule) {
              return;
            }
            const imported = jsModule.hasNamedExports
              ? `{ ${jsModule.variableName} }`
              : jsModule.variableName;
            addedItems.add(`${imported} from '${jsModule.importPath}'`);
            newImports.push(jsModule.toImportStatement(this.config));
          });

          this.replaceImports(oldImports.range, newImports);

          const message = fixImportsMessage(unusedImportVariables, addedItems);
          if (message) {
            this.message(message);
          }

          resolve(this.results());
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  addImports(imports) {
    return new Promise((resolve, reject) => {
      const oldImports = this.findCurrentImports();
      const newImports = oldImports.imports.clone();

      const variables = Object.keys(imports);
      const promises = variables.map((variableName) =>
        findJsModulesFor(this.config, variableName)
          .then((jsModules) => {
            const importData = imports[variableName];
            const dataIsObject = typeof importData === 'object';
            const importPath = dataIsObject
              ? importData.importPath
              : importData;
            const hasNamedExports = dataIsObject
              ? importData.isNamedExport
              : undefined;

            const foundModule = jsModules.find(
              (jsModule) =>
                jsModule.importPath === importPath &&
                (hasNamedExports === undefined ||
                  jsModule.hasNamedExports === hasNamedExports),
            );

            if (foundModule) {
              newImports.push(foundModule.toImportStatement(this.config));
            } else {
              newImports.push(
                new JsModule({
                  importPath,
                  variableName,
                  hasNamedExports,
                }).toImportStatement(this.config),
              );
            }
          })
          .catch(reject),
      );

      Promise.all(promises).then(() => {
        if (variables.length === 1) {
          this.message(`Added import for \`${variables[0]}\``);
        } else {
          this.message(`Added ${variables.length} imports`);
        }

        this.replaceImports(oldImports.range, newImports);

        resolve(this.results());
      });
    });
  }

  rewriteImports() {
    const oldImports = this.findCurrentImports();
    const newImports = new ImportStatements(this.config);

    return new Promise((resolve, reject) => {
      const variables = [];
      const sideEffectOnlyImports = [];
      oldImports.imports.forEach((imp) => {
        if (imp.variables().length) {
          variables.push(...imp.variables());
        } else if (imp.hasSideEffects) {
          // side-effect imports don't have variable names. Tuck them away and just pass
          // them through to the end of this operation.
          sideEffectOnlyImports.push(imp);
        }
      });
      const promises = variables.map((variable) =>
        findJsModulesFor(this.config, variable),
      );

      Promise.all(promises)
        .then((results) => {
          results.forEach((jsModules) => {
            if (!jsModules.length) {
              return;
            }

            const { variableName } = jsModules[0];
            const jsModule =
              this.resolveModuleUsingCurrentImports(jsModules, variableName) ||
              this.resolveOneJsModule(jsModules, variableName);

            if (!jsModule) {
              return;
            }

            newImports.push(jsModule.toImportStatement(this.config));
          });

          newImports.push(...sideEffectOnlyImports);

          this.replaceImports(oldImports.range, newImports);
          resolve(this.results());
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  message(str) {
    this.messages.push(str);
  }

  findOneJsModule(variableName) {
    return new Promise((resolve, reject) => {
      findJsModulesFor(this.config, variableName)
        .then((jsModules) => {
          if (!jsModules.length) {
            resolve(null);
            return;
          }
          resolve(this.resolveOneJsModule(jsModules, variableName));
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  replaceImports(oldImportsRange, newImports) {
    const importStrings = newImports.toArray();

    // Ensure that there is a blank line after the block of all imports
    if (importStrings.length && this.editor.get(oldImportsRange.end) !== '') {
      this.editor.insertBefore(oldImportsRange.end, '');
    }

    // Delete old imports, then add the modified list back in.
    for (let i = oldImportsRange.end - 1; i >= oldImportsRange.start; i -= 1) {
      this.editor.remove(i);
    }

    if (
      importStrings.length === 0 &&
      this.editor.get(oldImportsRange.start) === ''
    ) {
      // We have no newlines to write back to the file. Clearing out potential
      // whitespace where the imports used to be leaves the file in a better
      // state.
      this.editor.remove(oldImportsRange.start);
      return;
    }

    importStrings.reverse().forEach((importString) => {
      // We need to add each line individually because the Vim buffer will
      // convert newline characters to `~@`.
      if (importString.indexOf('\n') !== -1) {
        importString
          .split('\n')
          .reverse()
          .forEach((line) => {
            this.editor.insertBefore(oldImportsRange.start, line);
          });
      } else {
        this.editor.insertBefore(oldImportsRange.start, importString);
      }
    });

    while (this.editor.get(0) === '') {
      this.editor.remove(0);
    }
  }

  findCurrentImports() {
    return findCurrentImports(
      this.config,
      this.editor.currentFileContent(),
      this.ast,
    );
  }

  resolveOneJsModule(jsModules, variableName) {
    if (jsModules.length === 1) {
      const jsModule = jsModules[0];
      return jsModule;
    }

    if (!jsModules.length) {
      return undefined;
    }

    const countSeparators = (importPath) => {
      const separators = importPath.match(/\//g);
      return separators ? separators.length : 0;
    };

    this.unresolvedImports[variableName] = jsModules
      .map((jsModule) => ({
        displayName: jsModule
          .toImportStatement(this.config)
          .toImportStrings(Infinity, '  ')[0],
        importPath: jsModule.importPath, // backward compatibility
        data: {
          importPath: jsModule.importPath,
          filePath: jsModule.resolvedFilePath(
            this.pathToCurrentFile,
            this.workingDirectory,
          ),
          isNamedExport: jsModule.hasNamedExports,
        },
      }))
      .sort(
        (a, b) =>
          countSeparators(a.data.importPath) -
          countSeparators(b.data.importPath),
      );

    return undefined;
  }

  resolveModuleUsingCurrentImports(jsModules, variableName) {
    if (jsModules.length === 1) {
      return jsModules[0];
    }

    // Look at the current imports and grab what is already imported for the
    // variable.
    const matchingImportStatement = this.findCurrentImports().imports.find(
      (ist) => ist.hasVariable(variableName),
    );

    if (!matchingImportStatement) {
      return undefined;
    }

    if (jsModules.length > 0) {
      // Look for a module matching what is already imported
      const { path: matchingPath } = matchingImportStatement;
      return jsModules.find(
        (jsModule) =>
          matchingPath === jsModule.toImportStatement(this.config).path,
      );
    }

    // We couldn't resolve any module for the variable. As a fallback, we
    // can use the matching import statement. If that maps to a package
    // dependency, we will still open the right file.
    const hasNamedExports =
      matchingImportStatement.defaultImport !== variableName;

    const matchedModule = new JsModule({
      importPath: matchingImportStatement.path,
      hasNamedExports,
      variableName,
    });

    return matchedModule;
  }

  injectSideEffectImports(importStatements) {
    const addedImports = [];
    this.config.get('moduleSideEffectImports').forEach((path) => {
      const sizeBefore = importStatements.size();
      importStatements.push(
        new ImportStatement({
          namedImports: [],
          defaultImport: '',
          hasSideEffects: true,
          declarationKeyword: this.config.get('declarationKeyword'),
          importFunction: this.config.get('importFunction'),
          danglingCommas: this.config.get('danglingCommas'),
          path,
        }),
      );
      if (importStatements.size() > sizeBefore) {
        // The number of imports changed as part of adding the side-effect
        // import. This means that the import wasn't previously there.
        addedImports.push(`'${path}'`);
      }
    });
    return addedImports;
  }
}
