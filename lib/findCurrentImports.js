const StringScanner = require('StringScanner');
const lodashRange = require('lodash.range');

const ImportStatement = require('./ImportStatement');
const ImportStatements = require('./ImportStatements');
const xRegExp = require('./xregexp');

const REGEX_SKIP_SECTION = xRegExp(`
  ^
  \\s*                     # preceding whitespace
  (?:
    (?<quote>['"])use\\sstrict\\k<quote>;? # 'use strict';
    |
    //[^\n]*               # single-line comment
    |
    /\\*                   # open multi-line comment
    (?:\n|.)*?             # inside of multi-line comment
    \\*/                   # close multi-line comment
  )?                       # ? b/c we want to match on only whitespace
  \n                       # end of line
  `, 'xs' // free-spacing, dot-match-all
);

/**
 * @param {Configuration} config
 * @param {String} currentFileContent
 * @return {Object}
 */
function findCurrentImports(config, currentFileContent) {
  /* eslint-disable no-cond-assign */
  let importsStartAtLineNumber = 1;
  let newlineCount = 0;

  const scanner = new StringScanner(currentFileContent);
  let skipped = '';
  let skipSection;
  while (skipSection = scanner.scan(REGEX_SKIP_SECTION)) {
    skipped += skipSection;
  }

  // We don't want to skip over blocks that are only whitespace
  if (xRegExp.test(skipped, xRegExp('^\\s+$', 's'))) {
    scanner.reset();
  } else {
    const count = (skipped.match(/\n/g) || []).length;
    importsStartAtLineNumber = importsStartAtLineNumber + count;
  }

  const imports = new ImportStatements(config);
  let potentialImport;
  while (potentialImport = scanner.scan(xRegExp('(^\\s*\\n)*^.*?;\\n', 's'))) {
    const importStatement = ImportStatement.parse(potentialImport.trim());
    if (!importStatement) {
      break;
    }

    imports.push(importStatement);
    const count = (potentialImport.match(/\n/g) || []).length;
    newlineCount += count;
  }

  const importsEndAtLineNumber = importsStartAtLineNumber + newlineCount + 1;
  return {
    imports,
    range: lodashRange(importsStartAtLineNumber, importsEndAtLineNumber),
  };
}

module.exports = findCurrentImports;
