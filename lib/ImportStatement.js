//
function isLineTooLong(line, maxLineLength) {
  return !!maxLineLength && line.length > maxLineLength;
}

function equalsAndValue({ declarationKeyword, importFunction, path }) {
  if (declarationKeyword === 'import') {
    return { equals: 'from', value: `'${path}';` };
  }
  return { equals: '=', value: `${importFunction || 'require'}('${path}');` };
}

/**
 * Class that represents an import statement, e.g.
 * `const foo = require('foo');`
 * `var foo = myCustomRequire('foo');`
 * `import foo from 'foo';`
 */
export default class ImportStatement {
  assignment;

  declarationKeyword;

  hasTypeKeyword;

  defaultImport;

  hasSideEffects;

  importFunction;

  namedImports;

  areOnlyTypes; // true if namedImports are all 'type' imports

  originalImportString;

  leadingContent;

  path;

  danglingCommas;

  constructor({
    assignment,
    declarationKeyword,
    hasTypeKeyword,
    defaultImport,
    hasSideEffects,
    importFunction,
    namedImports = [],
    areOnlyTypes = false,
    originalImportString,
    leadingContent,
    path,
    danglingCommas = true,
  } = {}) {
    this.assignment = assignment;
    this.declarationKeyword = declarationKeyword;
    this.hasTypeKeyword = hasTypeKeyword;
    this.defaultImport = defaultImport;
    this.hasSideEffects = hasSideEffects;
    this.importFunction = importFunction;
    this.namedImports = namedImports;
    this.areOnlyTypes = areOnlyTypes;
    this.originalImportString = originalImportString;
    this.leadingContent = leadingContent;
    this.path = path;
    this.danglingCommas = danglingCommas;
  }

  hasVariable(variableName) {
    if (variableName === this.defaultImport) {
      return true;
    }
    return !!this.namedImports.find(
      ({ localName }) => localName === variableName,
    );
  }

  /**
   * Deletes a variable from an already existing default import or set of
   * named imports.
   */
  deleteVariable(variableName) {
    let touched = false;

    if (this.defaultImport === variableName) {
      delete this.defaultImport;
      touched = true;
    }

    if (this.hasNamedImports()) {
      const variableIndex = this.namedImports.findIndex(
        ({ localName }) => localName === variableName,
      );
      if (variableIndex !== -1) {
        this.namedImports.splice(variableIndex, 1);
        touched = true;
      }
    }

    if (touched) {
      this._clearImportStringCache();
    }
  }

  /**
   * @return {Boolean} true if there are named imports
   */
  hasNamedImports() {
    return !!this.namedImports && this.namedImports.length > 0;
  }

  /**
   * @return {Boolean} true if there is no default import, no named imports, and
   *   no side effects.
   */
  isEmpty() {
    return (
      !this.defaultImport && !this.hasNamedImports() && !this.hasSideEffects
    );
  }

  /**
   * @return {Boolean} true if this instance was created through parsing an
   *   existing import and it hasn't been altered since it was created.
   */
  isParsedAndUntouched() {
    return !!this.originalImportString;
  }

  /**
   * @return {Array} an array that can be used in `sort` and `uniq`
   */
  toNormalized() {
    if (!this.defaultImport && !this.hasNamedImports() && this.hasSideEffects) {
      return [this.path];
    }
    return [this.defaultImport || '', ...this.localNames()];
  }

  localNames() {
    if (!this.namedImports) {
      return [];
    }
    return this.namedImports.map(({ localName }) => localName);
  }

  /**
   * @return {Array<String>} Array of all variables that this ImportStatement
   *   imports.
   */
  variables() {
    return [this.defaultImport, ...this.localNames()].filter(Boolean);
  }

  toImportStrings(maxLineLength, tab) {
    const strings = this._importStrings(maxLineLength, tab);

    if (this.leadingContent && strings.length > 0) {
      strings[0] = this.leadingContent + strings[0];
    }

    return strings;
  }

  _importStrings(maxLineLength, tab) {
    if (this.originalImportString) {
      return [this.originalImportString];
    }

    if (this.hasSideEffects && !this.hasNamedImports() && !this.defaultImport) {
      // this is a side-effect import only
      return [this._assignmentLessImportString()];
    }

    if (this.declarationKeyword === 'import') {
      // ES2015 Modules (ESM) syntax can support default imports and
      // named imports on the same line.
      if (this.hasNamedImports()) {
        return [this._namedImportString(maxLineLength, tab)];
      }
      return [this._defaultImportString(maxLineLength, tab)];
    }

    // const/var
    const strings = [];
    if (this.defaultImport) {
      strings.push(this._defaultImportString(maxLineLength, tab));
    }
    if (this.hasNamedImports()) {
      strings.push(this._namedImportString(maxLineLength, tab));
    }
    return strings;
  }

  /**
   * Merge another ImportStatement into this one.
   */
  merge(importStatement) {
    if (
      importStatement.defaultImport &&
      this.defaultImport !== importStatement.defaultImport
    ) {
      this.defaultImport = importStatement.defaultImport;
      this._clearImportStringCache();
    }

    if (
      importStatement.hasSideEffects &&
      this.hasSideEffects !== importStatement.hasSideEffects
    ) {
      // If a module is ever thought to have side-effects, then assume it does.
      this.hasSideEffects = true;
      this._clearImportStringCache();
    }

    if (importStatement.hasNamedImports()) {
      this.namedImports = this.namedImports || [];
      const originalNamedImports = this.namedImports.slice(0); // clone array

      let modified = false;

      importStatement.namedImports.forEach((named) => {
        const namedImport = originalNamedImports.find(
          ({ localName }) => localName === named.localName,
        );
        if (!namedImport) {
          this.namedImports.push(named);
          modified = true;
          if (this.areOnlyTypes && !named.isType) {
            this.areOnlyTypes = false;
          }
        }
      });
      if (modified) {
        this.namedImports.sort((a, b) => {
          if (a.localName < b.localName) {
            return -1;
          }
          if (a.localName > b.localName) {
            return 1;
          }
          return 0;
        });
        this._clearImportStringCache();
      }
    }

    if (this.declarationKeyword !== importStatement.declarationKeyword) {
      this.declarationKeyword = importStatement.declarationKeyword;
      this._clearImportStringCache();
    }
  }

  _assignmentLessImportString() {
    if (this.declarationKeyword === 'import') {
      return `import '${this.path}';`;
    }

    return `${this.importFunction || 'require'}('${this.path}');`;
  }

  _defaultImportString(maxLineLength, tab) {
    const { equals, value } = equalsAndValue({
      declarationKeyword: this.declarationKeyword,
      importFunction: this.importFunction,
      path: this.path,
    });

    const line = `${this.declarationKeyword || ''} ${this.defaultImport || ''} ${equals} ${value}`;
    if (!isLineTooLong(line, maxLineLength)) {
      return line;
    }

    return `${this.declarationKeyword || ''} ${this.defaultImport || ''} ${equals}\n${tab}${value}`;
  }

  _namedImportString(maxLineLength, tab) {
    const { equals, value } = equalsAndValue({
      declarationKeyword: this.declarationKeyword,
      importFunction: this.importFunction,
      path: this.path,
    });

    let prefix = '';
    if (this.declarationKeyword === 'import') {
      if (this.defaultImport) {
        prefix = `${this.defaultImport}, `;
      } else if (this.areOnlyTypes) {
        prefix = 'type ';
      }
    }

    const named = this.namedImports.map(
      ({ localName, importedName, isType }) => {
        const typePrefix =
          isType && (!this.areOnlyTypes || this.defaultImport) ? 'type ' : '';
        if (!importedName) {
          return `${typePrefix}${localName}`;
        }
        return `${typePrefix}${importedName} as ${localName}`;
      },
    );

    const namedOneLine = `{ ${named.join(', ')} }`;
    const line = `${this.declarationKeyword || ''} ${prefix}${namedOneLine} ${equals} ${value}`;
    if (!isLineTooLong(line, maxLineLength)) {
      return line;
    }

    const tabJoined = named.join(`,\n${tab}`);
    const namedMultiLine = `{\n${tab}${tabJoined}${this.danglingCommas ? ',' : ''}\n}`;
    return `${this.declarationKeyword || ''} ${prefix}${namedMultiLine} ${equals} ${value}`;
  }

  _clearImportStringCache() {
    delete this.originalImportString;
  }
}
