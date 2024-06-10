// Class that sorts ImportStatements as they are pushed in
import flattenDeep from 'lodash/flattenDeep';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/uniqBy';

const STYLE_SIDE_EFFECT = 'side-effect';
const STYLE_IMPORT = 'import';
const STYLE_CONST = 'const';
const STYLE_VAR = 'var';
const STYLE_CUSTOM = 'custom';

// Order is significant here
const STYLES = Object.freeze([
  STYLE_SIDE_EFFECT,
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

const GROUPINGS_ARRAY = Object.freeze(
  flattenDeep(
    STYLES.map((style) => PATH_TYPES.map((location) => `${style} ${location}`)),
  ),
);

const GROUPINGS = {};
GROUPINGS_ARRAY.forEach((group, index) => {
  GROUPINGS[group] = index;
});
Object.freeze(GROUPINGS);

/**
 * Determine import path type (e.g. 'package, 'non-relative', 'relative')
 */
function importStatementPathType(
  importStatement,
  packageDependencies,
  coreModules,
) {
  if (importStatement.path.startsWith('.')) {
    return PATH_TYPE_RELATIVE;
  }

  if (coreModules.indexOf(importStatement.path) !== -1) {
    return PATH_TYPE_CORE_MODULE;
  }

  // Match if any of the packageDependencies exactly match path or match the
  // start of the path up to a path divider. This is so that imports for
  // modules inside package dependencies end up in the right group
  // (PATH_TYPE_PACKAGE).
  if (
    Array.from(packageDependencies).some(
      (pkg) =>
        importStatement.path === pkg ||
        importStatement.path.startsWith(`${pkg}/`),
    )
  ) {
    return PATH_TYPE_PACKAGE;
  }

  return PATH_TYPE_NON_RELATIVE;
}

/**
 * Determine import statement style (e.g. 'import', 'const', 'var', or
 * 'custom')
 */
function importStatementStyle(importStatement) {
  if (importStatement.hasSideEffects) {
    return STYLE_SIDE_EFFECT;
  }

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

function importStatementGroupIndex(
  importStatement,
  packageDependencies,
  coreModules,
) {
  const style = importStatementStyle(importStatement);
  const pathType = importStatementPathType(
    importStatement,
    packageDependencies,
    coreModules,
  );

  return GROUPINGS[`${style} ${pathType}`];
}

export default class ImportStatements {
  imports;

  config;

  constructor(config, imports = {}) {
    this.config = config;
    this.imports = imports;
  }

  clone() {
    return new ImportStatements(this.config, { ...this.imports });
  }

  /**
   * Method added to make it behave like an array.
   */
  forEach(callback) {
    Object.keys(this.imports).forEach((key) => {
      callback(this.imports[key]);
    });
  }

  /**
   * Method added to make it behave like an array.
   */
  find(callback) {
    const key = Object.keys(this.imports).find((key) =>
      callback(this.imports[key]),
    );
    if (!key) {
      return undefined;
    }
    return this.imports[key];
  }

  push(...importStatements) {
    importStatements.forEach((importStatement) => {
      const existingStatement = this.imports[importStatement.path];
      if (existingStatement) {
        // Import already exists, so this line is likely one of a named imports
        // pair. Combine it into the same ImportStatement.
        existingStatement.merge(importStatement);
      } else {
        // This is a new import, so we just add it to the hash.
        this.imports[importStatement.path] = importStatement;
      }
    });

    return this; // for chaining
  }

  empty() {
    return this.size() === 0;
  }

  size() {
    return Object.keys(this.imports).length;
  }

  deleteVariables(variableNames) {
    Object.keys(this.imports).forEach((key) => {
      const importStatement = this.imports[key];
      variableNames.forEach((variableName) => {
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
  toArray() {
    const maxLineLength = this.config.get('maxLineLength');
    const tab = this.config.get('tab');

    const strings = [];
    this._toGroups().forEach((group) => {
      group.forEach((importStatement) => {
        const importStrings = importStatement
          .toImportStrings(maxLineLength, tab)
          .map((importString) =>
            this.config.get('importStatementFormatter', {
              importStatement: importString,
              moduleName: importStatement.path,
            }),
          );
        strings.push(...importStrings);
      });

      if (this.config.get('emptyLineBetweenGroups')) {
        strings.push(''); // Add a blank line between groups.
      }
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
  _toGroups() {
    const groups = [];

    const importsArray = Object.keys(this.imports).map(
      (key) => this.imports[key],
    );

    // There's a chance we have duplicate imports (can happen when switching
    // declaration_keyword for instance). By first sorting imports so that new
    // ones are first, then removing duplicates, we guarantee that we delete
    // the old ones that are now redundant.
    let result = partition(
      importsArray,
      (importStatement) => !importStatement.isParsedAndUntouched(),
    );
    result = flattenDeep(result);

    if (this.config.get('sortImports')) {
      result = sortBy(result, (is) => is.toNormalized());
    }

    result = uniqBy(result, (is) => is.toNormalized());

    if (!this.config.get('groupImports')) {
      return [result];
    }

    const packageDependencies = this.config.get('packageDependencies');
    const coreModules = this.config.get('coreModules');
    result.forEach((importStatement) => {
      // Figure out what group to put this import statement in
      const groupIndex = importStatementGroupIndex(
        importStatement,
        packageDependencies,
        coreModules,
      );

      // Add the import statement to the group
      groups[groupIndex] = groups[groupIndex] || [];
      groups[groupIndex].push(importStatement);
    });

    if (groups.length) {
      groups.filter(Boolean); // compact
    }
    return groups;
  }
}
