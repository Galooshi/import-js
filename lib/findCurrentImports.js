// @flow

import StringScanner from 'StringScanner';

import ImportStatement from './ImportStatement';
import ImportStatements from './ImportStatements';
import xRegExp from './xregexp';

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

export default function findCurrentImports(
  config: Object, // TODO change Object to Configuration
  currentFileContent: string
): Object {
  /* eslint-disable no-cond-assign */
  let importsStartAt = 0;
  let newlineCount = 0;

  const scanner = new StringScanner(`${currentFileContent}\n`);
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
    importsStartAt += count;
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

  return {
    imports,
    range: {
      start: importsStartAt,
      end: importsStartAt + newlineCount,
    },
  };
}
