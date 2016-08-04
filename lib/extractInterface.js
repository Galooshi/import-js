// @flow

import fs from 'fs';

import xRegExp from 'xregexp';

/*
* REGEX_COMMENTS_AND_STRING_LITERALS has the purpose of identifying every
* comment, string literal, and template literal in a module for the purpose of
* removing them prior to using another regular expression to extract the xFace
* definition as expressed by ES6 export statements.
*
* There is one exception in that we must not remove the string literal
* in a moduleSpecification - after all, our purpose is to gather that info.
* To accomplish that, because we have no effective lookbehinds in ES6 regexps,
* we'll just match them and choose not to extrac them in the replace operation.
*/
const REGEX_COMMENTS_AND_STRING_LITERALS = xRegExp(`
(
 (\\/\\*[\\s\\S]*?\\*\\/)# match multiline comments
|(\\/\\/[\\s\\S]*?$)     # match single line comments
|(?:                     # start of string literal matching
  (?:
   (?:\\bfrom\\s+        # match from with single-quoted moduleSpecification
    '
    (?:
       \\\\\\r\\n        # JS line-escape
     | \\\\[\\s\\S]      # any escaped character
     | [^\\r|\\n']       # match anything else other than a newline
                         # or the quote type that started this.
    )*
    '                    # end of match single-quoted moduleSpecification
   )
  |(?:\\bfrom\\s+        # match from with double-quoted moduleSpecification
    "
    (?:
       \\\\\\r\\n        # JS line-escape
     | \\\\[\\s\\S]      # any escaped character
     | [^\\r|\\n"]       # match anything else other than a newline
                         # or the quote type that started this.
    )*
    "                    # end of match double-quoted moduleSpecification
   )
  |(?:'                  # match single-quoted strings
    (?:
       \\\\\\r\\n        # JS line-escape
     | \\\\[\\s\\S]      # any escaped character
     | [^\\r|\\n']       # match anything else other than a newline
                         # or the quote type that started this.
    )*
    '                    # end of match single-quoted strings
   )
  |(?:"                  # match double-quoted strings
    (?:
       \\\\\\r\\n        # JS line-escape
     | \\\\[\\s\\S]      # any escaped character
     | [^\\r|\\n"]       # match anything else other than a newline
                         # or the quote type that started this.
    )*
    "                    # end of match double-quoted strings
   )
  |(?:\\\`               # match template literals
    (?:
     \\\\[\\s\\S]        # any escaped character
    |\\$\\{              # template substitution start
     (?:
       \\\\[\\s\\S]      # any escaped character
     | [^{}\\\\]         # anything that doesn't look like a subst or escape
     | \\{               # consume nested braces so we don't prematurely
                         #   terminate substitution capture
        (?:[^{}]*        # anything that isn't a brace
         (?:\\{[^{}]*\\} # matched braces with anything between
         )?              #  0 or 1 time
        )*
       \\}               # end of nested braces
     )*
     \\}                 # template substitution end
    |[^\\\`\\\\]         # anything not end of template literal or escape
    )*
    \\\`                 # end of template literal
   )
  )
 )
)
  `, 'xgm' // free-spacing, global, and multiline
);

/*
* REGEX_EXPORT is designed to gather all ExportNames and ModuleRequests from the
* export statements in an es7 module. Another stage will be required to extract
* ExportNames from any recognized exportsList or bindingList.
*
* This is not written for validation. It is permissive. For example, it would
* accept
*    export *;
*    export const not_initialized;
*
* Stripping comments beforehand would increase reliability.
*
* There are some areas where obscure stuff will make it miss exported variable
* names. For example,
*   "export const name1 = 'some string ;', name2 = 'another';
* where the first semicolon will cause it to stop and miss name2.
*
* Stripping string literals down to '' before running it could help that and
* many other fringe cases. That could be done in the same pass that strips
* comments.
*/
const REGEX_EXPORT = xRegExp(`
\\bexport\\b\\s*                      # match the export keyword
(?:(?:var|let|const)\\b\\s*
     (?<bindingList>[^;]*)            # <bindingList>
|  (?<default>default)                # <default> is all we need
|  function\\s+
     (?<functionName>[a-zA-Z$_]\\w*)  # <functionName>
|  function\\s*\\*\\s*
     (?<generatorName>[a-zA-Z$_]\\w*) # <generatorName>
|  class\\s+
     (?<className>[a-zA-Z$_]\\w*)     # <className>
| (?:
    (?<importName>\\*)|               # <importName> = '*'
    {\\s*(?<exportsList>[^}]*?)\\s*}  # <exportsList>
  )\\s*
  (?:
    from\\s*
    (?<quote>'|\\")                   # <quote> opening quote
    (?<moduleSpecifier>[^\\n]+?)      # <moduleSpecifier>
    \\k<quote>\\s*                    # closing quote
  )?
)
  `, 'xgm' // free-spacing, global, and multiline
);

const REGEX_EXPORTS_LIST = xRegExp(`
(?<identifier>[a-zA-Z$_][a-zA-Z\d_]*)            # <identifier>
(?:\s+as\s+(?<alias>[a-zA-Z$_][a-zA-Z\d_]*))?\s* # <alias>
,?  # can end in a comma
  `, 'xgm' // free-spacing, global, and multiline
);

/**
 * @param {String} The path to an ES6 or ES7 module.
 * @return (?Object) a parsed interface definition
 */
export default function extractInterface(
  pathToModule: string
): ?Set<string> {
  if (!fs.existsSync(pathToModule)) {
    return null;
  }
  let fileContent;
  try {
    fileContent = fs.readFileSync(pathToModule, 'utf-8');
  } catch (e) {
    return null;
  }

  // To make the export content extraction more reliable, strip comments,
  // literal strings (not including moduleSpecifiers, i.e. string literals
  // preceded by 'from'), and template literals. Replace the string and template
  // literals with empty ones.
  // If this proves unreliable without a lexer, Chiffon might do as a
  // lightweight option. But then, if you go that far, why not Babel for the
  // whole thing?
  fileContent = fileContent.replace(REGEX_COMMENTS_AND_STRING_LITERALS, (match: string): string => {
    if (match.startsWith('from')) {
      // Don't strip string literals preceded by 'from'
      return match;
    }
    if (!match.startsWith('/')) {
      // Completely strip the comments
      return '';
    }
    // Return an empty string or template literal
    return `${match[0]}${match[0]}`;
  });

  const exports = new Set();
  xRegExp.forEach(fileContent, REGEX_EXPORT, (match: Array<string>) => {
    if (match.default) {
      exports.add('default');
    } else if (match.functionName) {
      exports.add(match.functionName);
    } else if (match.generatorName) {
      exports.add(match.generatorName);
    } else if (match.className) {
      exports.add(match.className);
    } else if (match.exportsList) {
      xRegExp.forEach(match.exportsList, REGEX_EXPORTS_LIST, (match: Array<string>) => {
        if (match.alias) {
          exports.add(match.alias);
        } else if (match.identifier) {
          exports.add(match.identifier);
        }
      });
    } else if (match.bindingList) {
      // TODO: This is the one that I think is the breaker for this approach.
      // It is likely possible to parse it with a regex, but I see no simple
      // cheat to just return the bindingIdentifiers while ignoring the rest.
      // It can have virtually any type of expression in the way. The regex has
      // to be fairly complicated to skip what we don't want without skipping
      // what we do. I don't know if I could ever be confident in it.
    } else if (match.importName) {
      if (match.alias) {
        exports.add(match.alias);
      } else if (match.moduleSpecifier) {
        // The caller needs to find this module, call extractInterface again,
        // and combine results,,, recursively. Watch out for cycles, they are
        // allowed in ES6!
        exports.add(`*${match.moduleSpecifier}`);
      }
    }
  });
  return exports;
}
