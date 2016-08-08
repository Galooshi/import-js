// @flow

import fs from 'fs';

import { parse } from 'babylon';

import EsModule from './EsModule';

// eslint-disable-next-line no-duplicate-imports
import type { ExportEntryType, ImportEntryType } from './EsModule';

/*
* Encapsulates and manipulates interface information about a module that is
* defined by ECMAScript source text as parsed with the goal symbol "Module".
*
* The constructor parses the module for its interface information as defined by
* its import and export declarations.
*
* Note: This class is roughly patterned after the concrete subclass "source text
*   module record" defined at
*   https://tc39.github.io/ecma262/#sec-source-text-module-records.
*/
export default class EsModuleModule extends EsModule {

  constructor({
    // This is expected to receive a filePath that will work in readFileSync.
    modulePath,
    hostResolveImportedModule,
  }: {
    modulePath: string,
    hostResolveImportedModule: (referencingModule: EsModule, specifier: string) => ?EsModule;
  }) {
    super({ modulePath, hostResolveImportedModule });

    this._parseModule();
  }

  /*
  * Note: this routine's logic closely follows the pseudocode at
  * https://tc39.github.io/ecma262/#sec-parsemodule
  */
  _parseModule() {
    // Get an AST for the module.
    const babylonOptions = {
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      sourceType: 'module',
      plugins: [
        'jsx',
        'flow',
      ],
    };
    const code = fs.readFileSync(this.modulePath);
    const ast = parse(code, babylonOptions);

    // Gather the exportEntries and importEntries defined in the module.
    ast.program.body.forEach((declaration: Object) => {
      switch (declaration.type) {
        case 'ImportDeclaration':
          this._handleImportDeclaration(declaration);
          break;
        case 'ExportAllDeclaration':
          this._handleExportAllDeclaration(declaration);
          break;
        case 'ExportNamedDeclaration':
          this._handleExportNamedDeclaration(declaration);
          break;
        case 'ExportDefaultDeclaration':
          this._handleExportDefaultDeclaration(declaration);
          break;
        default:
      }
    });

    // let importedBoundNames be the localNames of importEntries.
    this.importEntries.forEach((ie: ImportEntryType) => {
      // side-effect imports don't have local names, so skip them.
      if (ie.localName) {
        this.importedBoundNames.add(ie.localName);
      }
    });

    // step 11 of the ParseModule operation described in
    // https://tc39.github.io/ecma262/#sec-parsemodule
    this.exportEntries.forEach((ee: ExportEntryType) => {
      if (!ee.moduleRequest) {
        if (!ee.localName) {
          throw new Error('ExportEntryType localName cannot be null when moduleRequest is null');
        }
        if (!this.importedBoundNames.has(ee.localName)) {
          this.localExportEntries.push(ee);
        } else {
          const ie = this.importEntries.find((ie: ImportEntryType): boolean =>
            ie.localName === ee.localName);
          if (ie.importName === '*') {
            // Assert: is a re-export of an imported module namespace object.
            this.localExportEntries.push(ee);
          } else {
            // this is a re-export of a single name,
            this.indirectExportEntries.push({
              exportName: ee.exportName,
              moduleRequest: ie.moduleRequest,
              importName: ie.importName,
              localName: null,
              location: ee.location,
            });
          }
        }
      } else if (ee.importName === '*') {
        this.starExportEntries.push(ee);
      } else {
        this.indirectExportEntries.push(ee);
      }
    });
  }


  _handleImportDeclaration(declaration: Object) {
    const moduleRequest = declaration.source.value;

    if (declaration.specifiers.length === 0) {
      super.importEntries.push({
        moduleRequest,
        importName: null,
        localName: null,
        location: declaration.loc,
      });
      return;
    }

    declaration.specifiers.forEach((specifier: Object) => {
      switch (specifier.type) {
        case 'ImportSpecifier':
          super.importEntries.push({
            moduleRequest,
            importName: specifier.imported.name,
            localName: specifier.local.name,
            location: declaration.loc,
          });
          break;
        case 'ImportDefaultSpecifier':
          super.importEntries.push({
            moduleRequest,
            importName: 'default',
            localName: specifier.local.name,
            location: declaration.loc,
          });
          break;
        case 'ImportNamespaceSpecifier':
          super.importEntries.push({
            moduleRequest,
            importName: '*',
            localName: specifier.local.name,
            location: declaration.loc,
          });
          break;
        default:
      }
    });
  }

  _handleExportAllDeclaration(declaration: Object) {
    super.exportEntries.push({
      exportName: null,
      moduleRequest: declaration.source.value,
      importName: '*',
      localName: null,
      location: declaration.loc,
    });
  }

  _handleExportNamedDeclaration(declaration: Object) {
    if (declaration.source) {
      declaration.specifiers.forEach((specifier: Object) => {
        const moduleRequest = declaration.source.value;

        super.exportEntries.push({
          exportName: specifier.exported.name,
          moduleRequest,
          importName: specifier.local.name,
          localName: null,
          location: declaration.loc,
        });
      });
    } else if (declaration.declaration) {
      if (declaration.declaration.type === 'FunctionDeclaration') {
        super.exportEntries.push({
          exportName: declaration.declaration.id.name,
          moduleRequest: null,
          importName: null,
          localName: declaration.declaration.identifier.name,
          location: declaration.loc,
        });
      } else if (declaration.declaration.type === 'VariableDeclaration') {
        declaration.declaration.declarations.forEach((d: Object) => {
          super.exportEntries.push({
            exportName: d.id.name,
            moduleRequest: null,
            importName: null,
            localName: declaration.declaration.identifier.name,
            location: declaration.loc,
          });
        });
      }
    } else if (declaration.specifiers) {
      declaration.specifiers.forEach((specifier: Object) => {
        super.exportEntries.push({
          exportName: specifier.exported.name,
          moduleRequest: null,
          importName: null,
          localName: specifier.local.name,
          location: declaration.loc,
        });
      });
    }
  }

  _handleExportDefaultDeclaration(declaration: Object) {
    super.exportEntries.push({
      exportName: 'default',
      moduleRequest: null,
      importName: null,
      localName: declaration.declaration.id ? declaration.declaration.id.name : '*default*',
      location: declaration.loc,
    });
  }
}
