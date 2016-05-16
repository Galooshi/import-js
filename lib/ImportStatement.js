// @flow

import xRegExp from 'xregexp';

const REGEX_CONST_LET_VAR = xRegExp(`
  ^
  (?<declarationKeyword>const|let|var)\\s+ # <declarationKeyword>
  (?<assignment>.+?)                       # <assignment> variable assignment
  \\s*=\\s*
  (?<importFunction>\\w+?)\\(              # <importFunction> variable assignment
    (?<quote>'|\")                         # <quote> opening quote
    (?<path>[^\n]+?)                       # <path> module path
    \\k<quote>                             # closing quote
  \\);?
  \\s*
  $
  `, 'xs' // free-spacing, dot-match-all
);

const REGEX_IMPORT = xRegExp(`
  ^
  (?<declarationKeyword>import)\\s+ # <declarationKeyword>
  (?<assignment>.*?)                # <assignment> variable assignment
  \\s+from\\s+
  (?<quote>'|\\")                   # <quote> opening quote
  (?<path>[^\n]+?)                  # <path> module path
  \\k<quote>                        # closing quote
  ;?\\s*
  $
  `, 'xs' // free-spacing, dot-match-all
);

const REGEX_NAMED = xRegExp(`
  ^
  (?:                # non-capturing group
    (?<default>.*?)  # <default> default import
    ,\\s*
  )?
  {
    \\s*
    (?<named>.*?)    # <named> named imports
    \\s*
  }
  $
  `, 'xs' // free-spacing, dot-match-all
);

type ImportStatementConstructorType = {
  assignment?: ?string,
  declarationKeyword: string,
  defaultImport: string,
  importFunction: string,
  namedImports: Array<string>,
  originalImportString?: ?string,
  path: string,
};

/**
 * Class that represents an import statement, e.g.
 * `const foo = require('foo');`
 * `var foo = myCustomRequire('foo');`
 * `import foo from 'foo';`
 */
export default class ImportStatement {
  assignment: ?string;
  declarationKeyword: string;
  defaultImport: string;
  importFunction: string;
  namedImports: Array<string>;
  originalImportString: ?string;
  path: string;

  /**
   * @param {String} string a possible import statement, e.g.
   *   `const foo = require('foo');`
   *   `var foo = myCustomRequire('foo');`
   *   `import foo from 'foo';`
   * @return {?ImportStatement} a parsed statement, or null if the
   *   string can't be parsed
   */
  static parse(string: string): ?ImportStatement {
    const match = xRegExp.exec(string, REGEX_CONST_LET_VAR) ||
                  xRegExp.exec(string, REGEX_IMPORT);
    if (!match) {
      return null;
    }

    const importFunction = match.importFunction;

    const destMatch = xRegExp.exec(match.assignment, REGEX_NAMED);
    let defaultImport = '';
    let namedImports = [];

    if (destMatch) {
      defaultImport = destMatch.default;
      namedImports = destMatch.named
        .split(/,\s*/)
        .map((s: string): string => s.trim())
        .filter((s: string): boolean => !!s);
    } else {
      defaultImport = match.assignment;
      if (!/^\S+$/.test(defaultImport)) {
        return null;
      }
    }

    return new ImportStatement({
      assignment: match.assignment,
      declarationKeyword: match.declarationKeyword,
      defaultImport,
      importFunction,
      namedImports,
      originalImportString: match.input,
      path: match.path,
    });
  }

  constructor({
    assignment,
    declarationKeyword,
    defaultImport,
    importFunction,
    namedImports,
    originalImportString,
    path,
  }: ImportStatementConstructorType = {}) {
    this.assignment = assignment;
    this.declarationKeyword = declarationKeyword;
    this.defaultImport = defaultImport;
    this.importFunction = importFunction;
    this.namedImports = namedImports;
    this.originalImportString = originalImportString;
    this.path = path;
  }

  /**
   * Deletes a variable from an already existing default import or set of
   * named imports.
   */
  deleteVariable(variableName: string) {
    let touched = false;

    if (this.defaultImport === variableName) {
      delete this.defaultImport;
      touched = true;
    }

    if (this.hasNamedImports()) {
      const variableIndex = this.namedImports.indexOf(variableName);
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
  hasNamedImports(): boolean {
    return !!this.namedImports && this.namedImports.length > 0;
  }

  /**
   * @return {Boolean} true if there is no default import and there are no
   *   named imports
   */
  isEmpty(): boolean {
    return !this.defaultImport && !this.hasNamedImports();
  }

  /**
   * @return {Boolean} true if this instance was created through parsing an
   *   existing import and it hasn't been altered since it was created.
   */
  isParsedAndUntouched(): boolean {
    return !!this.originalImportString;
  }

  /**
   * @return {Array} an array that can be used in `sort` and `uniq`
   */
  toNormalized(): Array<string> {
    return [this.defaultImport || '', ...(this.namedImports || [])];
  }

  /**
   * @return {Array<String>} Array of all variables that this ImportStatement
   *   imports.
   */
  variables(): Array<string> {
    return [this.defaultImport, ...(this.namedImports || [])]
      .filter((v: string): boolean => !!v);
  }

  toImportStrings(maxLineLength: number, tab: string): Array<string> {
    if (this.originalImportString) {
      return [this.originalImportString];
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
  merge(importStatement: ImportStatement) {
    if (importStatement.defaultImport &&
       this.defaultImport !== importStatement.defaultImport) {
      this.defaultImport = importStatement.defaultImport;
      this._clearImportStringCache();
    }

    if (importStatement.hasNamedImports()) {
      this.namedImports = this.namedImports || [];
      const originalNamedImports = this.namedImports.slice(0); // clone array

      const importsSet = new Set([
        ...this.namedImports,
        ...importStatement.namedImports,
      ].sort());

      // TODO We should probably just use Sets for namedImports instead of
      // converting back to arrays.
      this.namedImports = Array.from(importsSet);

      if (originalNamedImports !== this.namedImports) {
        this._clearImportStringCache();
      }
    }

    if (this.declarationKeyword !== importStatement.declarationKeyword) {
      this.declarationKeyword = importStatement.declarationKeyword;
      this._clearImportStringCache();
    }
  }

  _isLineTooLong(line: string, maxLineLength: number): boolean {
    return !!maxLineLength && line.length > maxLineLength;
  }

  _equalsAndValue(): Array<string> {
    if (this.declarationKeyword === 'import') {
      return ['from', `'${this.path}';`];
    }
    return ['=', `${this.importFunction || 'require'}('${this.path}');`];
  }

  _defaultImportString(maxLineLength: number, tab: string): string {
    const equalsAndValue = this._equalsAndValue();
    const equals = equalsAndValue[0];
    const value = equalsAndValue[1];
    const line =
      `${this.declarationKeyword} ${this.defaultImport} ${equals} ${value}`;
    if (!this._isLineTooLong(line, maxLineLength)) {
      return line;
    }

    return `${this.declarationKeyword} ${this.defaultImport} ${equals}\n${tab}${value}`;
  }

  _namedImportString(maxLineLength: number, tab: string): string {
    const equalsAndValue = this._equalsAndValue();
    const equals = equalsAndValue[0];
    const value = equalsAndValue[1];
    let prefix = '';
    if (this.declarationKeyword === 'import' && this.defaultImport) {
      prefix = `${this.defaultImport}, `;
    }

    const namedOneLine = `{ ${this.namedImports.join(', ')} }`;
    const line =
      `${this.declarationKeyword} ${prefix}${namedOneLine} ${equals} ${value}`;
    if (!this._isLineTooLong(line, maxLineLength)) {
      return line;
    }

    const tabJoined = this.namedImports.join(`,\n${tab}`);
    const namedMultiLine = `{\n${tab}${tabJoined},\n}`;
    return `${this.declarationKeyword} ${prefix}${namedMultiLine} ${equals} ${value}`;
  }

  _clearImportStringCache() {
    delete this.originalImportString;
  }
}
