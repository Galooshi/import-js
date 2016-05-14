// @flow

// Class that sorts ImportStatements as they are pushed in
import flattenDeep from 'lodash.flattendeep';
import partition from 'lodash.partition';
import sortBy from 'lodash.sortby';
import uniqBy from 'lodash.uniqby';

import Configuration from './Configuration';
import ImportStatement from './ImportStatement';

const STYLE_IMPORT = 'import';
const STYLE_CONST = 'const';
const STYLE_VAR = 'var';
const STYLE_CUSTOM = 'custom';

// Order is significant here
const STYLES = Object.freeze([
  STYLE_IMPORT,
  STYLE_CONST,
  STYLE_VAR,
  STYLE_CUSTOM,
]);

const PATH_TYPE_CORE_MODULE = 'core_module';
const PATH_TYPE_PACKAGE = 'package';
const PATH_TYPE_NON_RELATIVE = 'non_relative';
const PATH_TYPE_RELATIVE = 'relative';

// Order is significant here
const PATH_TYPES = Object.freeze([
  PATH_TYPE_CORE_MODULE,
  PATH_TYPE_PACKAGE,
  PATH_TYPE_NON_RELATIVE,
  PATH_TYPE_RELATIVE,
]);

const GROUPINGS_ARRAY = Object.freeze(flattenDeep(
  STYLES.map((style: string): Array<string> => (
    PATH_TYPES.map((location: string): string => `${style} ${location}`)
  )))
);

const GROUPINGS = {};
GROUPINGS_ARRAY.forEach((group: string, index: number) => {
  GROUPINGS[group] = index;
});
Object.freeze(GROUPINGS);

export default class ImportStatements {
  imports: Object;
  config: Configuration;

  constructor(config: Configuration, imports: Object = {}) {
    this.config = config;
    this.imports = imports;
  }

  clone(): ImportStatements {
    return new ImportStatements(this.config, Object.assign({}, this.imports));
  }

  /**
   * Method added to make it behave like an array.
   */
  forEach(callback: Function) {
    Object.keys(this.imports).forEach((key: string) => {
      callback(this.imports[key]);
    });
  }

  push(importStatement: ImportStatement): ImportStatements {
    const existingStatement = this.imports[importStatement.path];
    if (existingStatement) {
      // Import already exists, so this line is likely one of a named imports
      // pair. Combine it into the same ImportStatement.
      existingStatement.merge(importStatement);
    } else {
      // This is a new import, so we just add it to the hash.
      this.imports[importStatement.path] = importStatement;
    }

    return this; // for chaining
  }

  empty(): boolean {
    return Object.keys(this.imports).length === 0;
  }

  deleteVariables(variableNames: Array<string>): ImportStatements {
    Object.keys(this.imports).forEach((key: string) => {
      const importStatement = this.imports[key];
      variableNames.forEach((variableName: string) => {
        importStatement.deleteVariable(variableName);
      });
      if (importStatement.isEmpty()) {
        delete this.imports[key];
      }
    });

    return this; // for chaining
  }

  /**
   * Convert the import statements into an array of strings, with an empty
   * string between each group.
   */
  toArray(): Array<string> {
    const maxLineLength = this.config.get('maxLineLength');
    const tab = this.config.get('tab');

    const strings = [];
    this._toGroups().forEach((group: Array<ImportStatement>) => {
      group.forEach((importStatement: ImportStatement) => {
        strings.push(...importStatement.toImportStrings(maxLineLength, tab));
      });
      strings.push(''); // Add a blank line between groups.
    });

    // We don't want to include a trailing newline at the end of all the
    // groups here.
    if (strings[strings.length - 1] === '') {
      strings.pop();
    }

    return strings;
  }

  /**
   * Sort the import statements by path and group them based on our heuristic
   * of style and path type.
   */
  _toGroups(): Array<Array<ImportStatement>> {
    const groups = [];

    const importsArray = Object.keys(this.imports)
      .map((key: string): ImportStatement => this.imports[key]);

    // There's a chance we have duplicate imports (can happen when switching
    // declaration_keyword for instance). By first sorting imports so that new
    // ones are first, then removing duplicates, we guarantee that we delete
    // the old ones that are now redundant.
    let result = partition(
      importsArray,
      (importStatement: ImportStatement): boolean => (
        !importStatement.isParsedAndUntouched()
      )
    );
    result = flattenDeep(result);
    result = sortBy(
      result,
      (is: ImportStatement): Array<string> => is.toNormalized()
    );
    result = uniqBy(
      result,
      (is: ImportStatement): Array<string> => is.toNormalized()
    );

    if (!this.config.get('groupImports')) {
      return [result];
    }

    const packageDependencies = this.config.packageDependencies();
    const coreModules = this.config.environmentCoreModules();
    result.forEach((importStatement: ImportStatement) => {
      // Figure out what group to put this import statement in
      const groupIndex = this._importStatementGroupIndex(
        importStatement,
        packageDependencies,
        coreModules
      );

      // Add the import statement to the group
      groups[groupIndex] = groups[groupIndex] || [];
      groups[groupIndex].push(importStatement);
    });

    if (groups.length) {
      groups.filter((group: Array<ImportStatement>): boolean => !!group); // compact
    }
    return groups;
  }

  _importStatementGroupIndex(
    importStatement: ImportStatement,
    packageDependencies: Array<string>,
    coreModules: Array<string>
  ): number {
    const style = this._importStatementStyle(importStatement);
    const pathType = this._importStatementPathType(
      importStatement, packageDependencies, coreModules);

    return GROUPINGS[`${style} ${pathType}`];
  }

  /**
   * Determine import statement style (e.g. 'import', 'const', 'var', or
   * 'custom')
   */
  _importStatementStyle(importStatement: ImportStatement): string {
    if (importStatement.declarationKeyword === 'import') {
      return STYLE_IMPORT;
    }

    if (importStatement.importFunction === 'require') {
      if (importStatement.declarationKeyword === 'const') {
        return STYLE_CONST;
      }
      if (importStatement.declarationKeyword === 'var') {
        return STYLE_VAR;
      }
    }

    return STYLE_CUSTOM;
  }

  /**
   * Determine import path type (e.g. 'package, 'non-relative', 'relative')
   */
  _importStatementPathType(
    importStatement: ImportStatement,
    packageDependencies: Array<string>,
    coreModules: Array<string>
  ): string {
    if (importStatement.path.startsWith('.')) {
      return PATH_TYPE_RELATIVE;
    }

    if (coreModules.indexOf(importStatement.path) !== -1) {
      return PATH_TYPE_CORE_MODULE;
    }

    // If there is a slash in the path, remove that and everything after it.
    // This is so that imports for modules inside package dependencies end up
    // in the right group (PATH_TYPE_PACKAGE).
    const path = importStatement.path.replace(/^(.*?)\/.*$/, '$1');
    if (packageDependencies.indexOf(path) !== -1) {
      return PATH_TYPE_PACKAGE;
    }

    return PATH_TYPE_NON_RELATIVE;
  }
}
