// @flow

export type CharLocationType = {
  line: number;
  column: number;
}
export type LocationType = {
  start: CharLocationType;
  end: CharLocationType;
}

/*
* Each exportEntry has the form
*   exportName: string - THe name used to export this binding by this module
*   moduleRequest: The string value of the ModuleSpecifier of the
*     ExportDeclaration. null if the ExportDeclaration does not have a
*     moduleSpecifier.
*   importName: The name that is used to locally access the exported value
*     from within the importing module. null if the exported value is not
*     locally accessible from within the module.
*   localName: The name that is used to locally access the exported value from
*     within the importing module. null if the exported value is not locally
*     accessible from within the module.
*   location: The location of the including statement in the source.
*/
export type ExportEntryType = {
  exportName: ?string;
  moduleRequest: ?string;
  importName: ?string;
  localName: ?string;
  location: LocationType;
};

/*
* Each importEntry has the form
*  moduleRequest: String value of the ModuleSpecifier of the
*    ImportDeclaration.
*  importName: string - The name under which the desired binding is
*    exported by the module identified by [[ModuleRequest]]. The value "*"
*    indicates that the import request is for the target module's namespace
*    object.
*  localName: The name that is used to locally access the imported value
*    from within the importing module.
*  location: The location of the including statement in the source.
*  Note: The above is derived from https://tc39.github.io/ecma262/#table-39.
*  Note: That definition has been extended to hold a side-effect import by
*    having a null importName and null localName.
*/
export type ImportEntryType = {
  moduleRequest: string;
  importName: ?string;
  localName: ?string;
  location: LocationType;
};

/*
* Abstract class that encapsulates interface information about a single module. that is
* defined by ECMAScript source text as parsed with the goal symbol "Module".
*
* It is generally expected for performance reasons that a pool of EsModules
* exists at a higher level from which the provided hostResolveImportedModule
* function is pulling when possible. It would be keyed by modulePath. Thus
* modulePath should be unique amongst all module records.
*
* The constructor parses the module for its interface information as defined by
* its import and export declarations.
*
* Note: This class is roughly patterned after selected aspects of the "Abstract
*   Module Record" defined in the ES7 specification at
*   https://tc39.github.io/ecma262/#sec-abstract-module-records and its single
*   defined concrete subclass "source text module record" defined at
*   https://tc39.github.io/ecma262/#sec-source-text-module-records.
*/
export default class EsModule {
  // This path is expected to be absolute, truly, no symbolic links and not
  // relative to the project directory. Thus, it can be used as a unique key
  // for this module.
  modulePath: string;
  /*
  * HostResolveImportedModule is an implementation defined abstract operation
  *   that provides the concrete Module Record subclass instance that
  *   corresponds to the ModuleSpecifier String, specifier, occurring within
  *   the context of the module represented by the Module Record
  *   referencingModule.
  *
  * Note: The expected functionality of this function is that specified by
  *   https://tc39.github.io/ecma262/#sec-hostresolveimportedmodule
  */
  hostResolveImportedModule: (referencingModule: EsModule, specifier: string) => ?EsModule;

  exportEntries: Array<ExportEntryType>;
  importEntries: Array<ImportEntryType>;
  importedBoundNames: Set<string>;

  localExportEntries: Array<ExportEntryType>;
  indirectExportEntries: Array<ExportEntryType>;
  starExportEntries: Array<ExportEntryType>;

  constructor({
    // This is expected to receive a filePath that will work in readFileSync.
    modulePath,
    hostResolveImportedModule,
  }: {
    modulePath: string,
    hostResolveImportedModule: (referencingModule: EsModule, specifier: string) => ?EsModule;
  }) {
    this.modulePath = modulePath;
    this.hostResolveImportedModule = hostResolveImportedModule;

    this.importEntries = [];
    this.exportEntries = [];
    this.importedBoundNames = new Set();

    this.localExportEntries = [];
    this.indirectExportEntries = [];
    this.starExportEntries = [];
  }

  /*
  * Patterned after the "getExportedNames( exportStarSet ) Concrete Method"
  * at https://tc39.github.io/ecma262/#sec-getexportednames
  */
  getExportedNames(exportStarSet: Set<EsModule>): Array<string> {
    if (exportStarSet.has(this)) {
      return [];
    }
    exportStarSet.add(this);
    const exportedNames = new Set();
    this.localExportEntries
      .forEach((e: Object) => { exportedNames.add(e.exportName); });
    this.indirectExportEntries
      .forEach((e: Object) => { exportedNames.add(e.exportName); });
    this.starExportEntries.forEach((e: Object) => {
      // Note that this explicitly violates the spec stating this should throw
      // exceptions. Think it is the right way to go for this tool though.
      try {
        const requestedModule = this.hostResolveImportedModule(this, e.moduleRequest);
        if (requestedModule) {
          const starNames = requestedModule.getExportedNames(exportStarSet);
          starNames.forEach((starName: string) => {
            if (starName !== 'default') {
              exportedNames.add(starName);
            }
          });
        }
      } catch (e) {
        // This tool is designed to work with coding in progress. Ignore this
        // error and move on.
      }
    });
    // TODO: When https://github.com/facebook/flow/pull/1668 is fixed, the
    // typecast can be changed back. Just straight [...exportedNames] fails now.
    return [...(exportedNames: any)];
  }
}
