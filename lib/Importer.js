'use strict';

const childProcess = require('child_process');

const StringScanner = require('StringScanner');
const escapeRegExp = require('lodash.escaperegexp');
const minimatch = require('minimatch');
const uniqWith = require('lodash.uniqwith');

const Configuration = require('./Configuration');
const ImportStatement = require('./ImportStatement');
const ImportStatements = require('./ImportStatements');
const JSModule = require('./JsModule');
const xRegExp = require('./xregexp');

// const REGEX_ESLINT_RESULT = /
//   :
//   (?<line>\d+)                # <line> line number
//   :\d+:
//   \s
//   (?<quote>["'])              # <quote> opening quote
//   (?<variableName>[^\1]+)    # <variableName>
//   \k<quote>
//   \s
//   (?<type>                    # <type>
//    is\sdefined\sbut\snever\sused         # is defined but never used
//    |
//    is\snot\sdefined                      # is not defined
//    |
//    must\sbe\sin\sscope\swhen\susing\sJSX # must be in scope when using JSX
//   )
// /;
//
//  ESLINT_STDOUT_ERROR_REGEXES = [
//    /Parsing error: /,
//    /Unrecoverable syntax error/,
//    /<text>:0:0: Cannot find module '.*'/,
//  ].freeze
//
//  ESLINT_STDERR_ERROR_REGEXES = [
//    /SyntaxError: /,
//    /eslint: command not found/,
//    /Cannot read config package: /,
//    /Cannot find module '.*'/,
//    /No such file or directory/,
//  ].freeze
//
//

const REGEX_SKIP_SECTION = xRegExp(`
  \\s*                      # preceding whitespace
  (?:
    (?<quote>['"])use\\sstrict\\k<quote>;? # 'use strict';
    |
    //.*                 # single-line comment
    |
    /*                   # open multi-line comment
    (?:\n|.)*?             # inside of multi-line comment
    \\*/                   # close multi-line comment
  )?                       # ? b/c we want to match on only whitespace
  \n                       # end of line
  `, 'xs' // free-spacing, dot-match-all
);

class Importer {
  constructor(editor) {
    this.editor = editor;
  }

  // Finds variable under the cursor to import.
  import() {
    this.reloadConfig();
    const variableName = this.editor.currentWord();
    if (!variableName) {
      this.message('No variable to import. Place your cursor on a variable, ' +
                   'then try again.');
      return;
    }

    const jsModule = this.findOneJsModule(variableName);
    if (!jsModule) {
      return;
    }

    const oldImports = this.findCurrentImports();
    const importStatement = jsModule.toImportStatement(variableName, this.config);
    oldImports.imports.push(importStatement);
    this.replaceImports(oldImports.range, oldImports.imports);
  }

  goto() {
    this.reloadConfig();
    const variableName = this.editor.currentWord();
    const jsModules = this.findJsModulesFor(variableName);

    const jsModule = this.resolveModuleUsingCurrentImports(
      jsModules, variableName);

    if (!jsModule) {
      // The current word is not mappable to one of the JS modules that we
      // found. This can happen if the user does not select one from the list.
      // We have nothing to go to, so we return early.
      this.message(`Could not resolve a module for \`${variableName}\``);
      return;
    }

    this.editor.openFile(jsModule.openFilePath(this.editor.pathToCurrentFile));
  }

  // Removes unused imports and adds imports for undefined variables
  // fixImports() {
  //   this.reloadConfig();
  //   const eslintResult = this.runEslintCommand();

  //   return if eslint_result.empty?

  //   unused_variables = {}
  //   undefined_variables = Set.new

  //   eslint_result.each do |line|
  //     match = REGEX_ESLINT_RESULT.match(line)
  //     next unless match
  //     if match[:type] == 'is defined but never used'
  //       unused_variables[match[:variableName]] ||= Set.new
  //       unused_variables[match[:variableName]].add match[:line].to_i
  //     else
  //       undefined_variables.add match[:variableName]
  //     end
  //   end

  //   return if unused_variables.empty? && undefined_variables.empty?

  //   old_imports = find_current_imports

  //   # Filter out unused variables that do not appear within the imports block.
  //   unused_variables.select! do |_, line_numbers|
  //     this.anyNumbersWithinRange?(line_numbers, old_imports[:range])
  //   end

  //   new_imports = old_imports[:imports].clone
  //   new_imports.delete_variables!(unused_variables.keys)

  //   undefined_variables.each do |variable|
  //     js_module = find_one_js_module(variable)
  //     next unless js_module
  //     new_imports << js_module.to_import_statement(variable, this.config)
  //   end

  //   replace_imports(old_imports[:range], new_imports)
  // end

  rewriteImports() {
    this.reloadConfig();

    const oldImports = this.findCurrentImports();
    const newImports = oldImports.imports.slice(0);

    oldImports.imports.forEach((imp) => {
      imp.variables.forEach((variable) => {
        const jsModule = this.resolveModuleUsingCurrentImports(
          this.findJsModulesFor(variable),
          variable
        );

        if (!jsModule) {
          return;
        }

        newImports.push(jsModule.toImportStatement(variable, this.config));
      });
    });

    this.replaceImports(oldImports.range, newImports);
  }

  // The configuration is relative to the current file, so we need to make sure
  // that we are operating with the appropriate configuration when we perform
  // certain actions.
  reloadConfig() {
    this.config = new Configuration(this.editor.pathToCurrentFile());
  }

  message(str) {
    this.editor.message(`ImportJS: ${str}`);
  }

  // @param numbers [Set]
  // @param range [Range]
  // @return [Boolean]
  anyNumbersWithinRange(numbers, range) {
    return numbers.some(n => range.include(n));
  }

  // @return [Array<String>] the output from eslint, line by line
  runEslintCommand() {
    const command = [
      this.config.get('eslint_executable'),
      '--stdin',
      `--stdin-filename ${this.editor.pathToCurrentFile()}`,
      '--format unix',
      "--rule 'no-undef: 2'",
      `--rule 'no-unused-vars: [2, { "vars": "all", "args": "none" }]'`,
    ].join(' ');
    // out, err = Open3.capture3(command,
    //                           stdin_data: this.editor.current_file_content)

    // if ESLINT_STDOUT_ERROR_REGEXES.any? { |regex| out =~ regex }
    //   raise ParseError.new, out
    // end

    // if ESLINT_STDERR_ERROR_REGEXES.any? { |regex| err =~ regex }
    //   raise ParseError.new, err
    // end

    // out.split("\n")
  }

  // @param variableName [String]
  // @return [ImportJS::JSModule?]
  findOneJsModule(variableName) {
    const jsModules = this.findJsModulesFor(variableName);
    if (!jsModules) {
      this.message(`No JS module to import for variable \`${variableName}\``);
      return null;
    }

    return this.resolveOneJsModule(jsModules, variableName);
  }

  // # @param oldImportsRange [Range]
  // # @param newImports [ImportJS::ImportStatements]
  replaceImports(oldImportsRange, newImports) {
    const importStrings = newImports.toArray();

    // Ensure that there is a blank line after the block of all imports
    if (oldImportsRange.size + importStrings.length > 0 &&
        this.editor.readLine(oldImportsRange.last) !== '') {
      this.editor.appendLine(oldImportsRange.last - 1, '');
    }

    // Find old import strings so we can compare with the new import strings
    // and see if anything has changed.
    const oldImportStrings = [];
    oldImportsRange.forEach((lineNumber) => {
      oldImportStrings.push(this.editor.readLine(lineNumber));
    });

    // If nothing has changed, bail to prevent unnecessarily dirtying the buffer
    if (JSON.stringify(importStrings) === JSON.stringify(oldImportStrings)) {
      return;
    }

    // Delete old imports, then add the modified list back in.
    oldImportsRange.forEach(() => this.editor.deleteLine(oldImportsRange.first));

    if (importStrings.length === 0 &&
        this.editor.readLine(oldImportsRange.first) === '') {
      // We have no newlines to write back to the file. Clearing out potential
      // whitespace where the imports used to be leaves the file in a better
      // state.
      this.editor.deleteLine(oldImportsRange.first);
      return;
    }

    importStrings.reverse().forEach((importString) => {
      // We need to add each line individually because the Vim buffer will
      // convert newline characters to `~@`.
      if (importString.indexOf('\n') !== -1) {
        importString.split('\n').reverse().forEach((line) => {
          this.editor.appendLine(oldImportsRange.first - 1, line);
        });
      } else {
        this.editor.appendLine(oldImportsRange.first - 1, importString);
      }
    });
  }

  // # @return [Hash]
  findCurrentImports() {
    let importsStartAtLineNumber = 1;
    let newlineCount = 0;

    let scanner = new StringScanner(this.editor.currentFileContent());
    let skipped = '';
    let skipSection;
    while (skipSection = scanner.scan(REGEX_SKIP_SECTION)) {
      skipped += skipSection;
    }

    // We don't want to skip over blocks that are only whitespace
    if (skipped.match(/\A(\s*\n)+\Z/)) {
      scanner = StringScanner.new(this.editor.currentFileContent());
    } else {
      const count = (skipped.match(/\n/g) || []).length;
      importsStartAtLineNumber = importsStartAtLineNumber + count;
    }

    const imports = new ImportStatements(this.config);
    let potentialImport;
    while (potentialImport = scanner.scan(/(^\s*\n)*^.*?;\n/m)) {
      const importStatement = ImportStatement.parse(potentialImport.trim());
      if (!ImportStatement) {
        break;
      }

      imports.push(importStatement);
      const count = (potentialImport.match(/\n/) || []).length;
      newlineCount += count;
    }

    const importsEndAtLineNumber = importsStartAtLineNumber + newlineCount;
    return {
      imports,
      range: {
        start: importsStartAtLineNumber,
        end: importsEndAtLineNumber,
      },
    };
  }

  // @param variableName [String]
  // @return [Array]
  findJsModulesFor(variableName) {
    const pathToCurrentFile = this.editor.pathToCurrentFile();

    const aliasModule = this.config.resolveAlias(variableName, pathToCurrentFile);
    if (aliasModule) {
      return [aliasModule];
    }

    const namedImportsModule = this.config.resolveNamedExports(variableName);
    if (namedImportsModule) {
      return [namedImportsModule];
    }

    const formattedVarName = this.formattedToRegex(variableName);
    const egrepCommand =
      `egrep -i \"(/|^)${formattedVarName}(/index)?(/package)?\.js.*\"`;
    let matchedModules = [];
    this.config.get('lookup_paths').forEach((lookupPath) => {
      if (lookupPath === '') {
        // If lookupPath is an empty string, the `find` command will not work
        // as desired so we bail early.
        throw new Error(`lookup path cannot be empty (${lookupPath})`);
      }

      const findCommand = [
        `find ${lookupPath}`,
        '-name "**.js*"',
        '-not -path "./node_modules/*"',
      ].join(' ');
      const command = `${findCommand} | ${egrepCommand}`;

      const out = childProcess.execSync(command);
      const err = '';// TODO: catch stderr here

      if (err !== '') {
        throw new Error(err);
      }

      matchedModules.concat(
        out.toString().split('\n').map((f) => {
          const shouldBeExcluded = false;
          if (this.config.get('excludes').some(
            (globPattern) => minimatch(globPattern, f))) {
            return null;
          }

          return JSModule.construct({
            lookupPath,
            relativeFilePath: f,
            stripFileExtensions:
              this.config.get('strip_file_extensions', { fromFile: f }),
            makeRelativeTo:
              this.config.get('use_relative_paths', { fromFile: f }) &&
              pathToCurrentFile,
            stripFromPath:
              this.config.get('strip_from_path', { fromFile: f }),
          });
        }).filter(jsModule => jsModule) // compact
      );
    });

    // Find imports from package.json
    const ignorePrefixes = this.config.get('ignore_package_prefixes').map(
      (prefix) => escapeRegExp(prefix));

    const depRegex = xRegExp(`
      ^(?:
      ${ignorePrefixes.join('|')}
      )?
      ${formattedVarName}
      $
    `);

    this.config.packageDependencies().forEach((dep) => {
      if (!dep.match(depRegex)) {
        return;
      }

      const jsModule = JSModule.construct({
        lookupPath: 'node_modules',
        relativeFilePath: `node_modules/${dep}/package.json`,
        stripFileExtensions: [],
      });

      if (jsModule) {
        matchedModules.push(jsModule);
      }
    });

    this.config.environmentCoreModules().forEach((dep) => {
      if (dep.toLowerCase() === variableName.toLowerCase()) {
        return;
      }

      matchedModules.push(new JSModule({ importPath: dep }));
    });

    // If you have overlapping lookup paths, you might end up seeing the same
    // module to import twice. In order to dedupe these, we remove the module
    // with the longest path
    matchedModules.sort((a, b) => a.importPath.length - b.importPath.length);
    matchedModules = uniqWith(matchedModules, m => `${m.lookupPath}/${m.lookupPath}`);
    matchedModules.sort((a, b) => a.displayName.localCompare(b.displayName));
  }

  // @param js_modules [Array]
  // @param variableName [String]
  // @return [ImportJS::JSModule]
  resolveOneJsModule(jsModules, variableName) {
    if (jsModules.length === 1) {
      const jsModule = jsModules[0];
      const jsModuleName = jsModule.displayName;
      let imported;
      if (jsModule.hasNamedExports()) {
        imported = `'${variableName}' from '${jsModuleName}'`;
      } else {
        imported = `'${jsModuleName}'`;
      }
      this.message(`Imported ${imported}`);
      return jsModule;
    }

    const selectedIndex = this.editor.askForSelection(
      variableName,
      jsModules.map((jsModule) => jsModule.displayName)
    );

    if (typeof selectedIndex === 'undefined') {
      return null;
    }
    if (selectedIndex < 0 || selectedIndex >= jsModules.length) {
      return null;
    }
    return jsModules[selectedIndex];
  }

  // @param js_modules [Array]
  // @param variableName [String]
  // @return [ImportJS::JSModule]
  resolveModuleUsingCurrentImports(jsModules, variableName) {
    if (jsModules.length === 1) {
      return jsModules[0];
    }

    // Look at the current imports and grab what is already imported for the
    // variable.
    const matchingImportStatement = this.findCurrentImports.imports.find((ist) => {
      if (variableName === ist.defaultImport) {
        return true;
      }
      if (!ist.namedImports) {
        return false;
      }
      return ist.namedImports.indexOf(variableName) !== -1;
    });

    if (matchingImportStatement) {
      if (jsModules.length === 0) {
        // We couldn't resolve any module for the variable. As a fallback, we
        // can use the matching import statement. If that maps to a package
        // dependency, we will still open the right file.
        const matchedModule = new JSModule({
          importPath: matchingImportStatement.path,
        });
        if (matchingImportStatement.hasNamedImports()) {
          matchedModule.setHasNamedExports(
            matchingImportStatement.namedImports.indexOf(variableName) !== -1);
        }
        return matchedModule;
      }

      // Look for a module matching what is already imported
      return jsModules.find(jsModule => (
        matchingImportStatement.path === jsModule.importPath
      ));
    }

    // Fall back to asking the user to resolve the ambiguity
    this.resolveOneJsModule(jsModules, variableName);
  }

  // Takes a string in any of the following four formats:
  //   dash-separated
  //   snake_case
  //   camelCase
  //   PascalCase
  // and turns it into a star-separated lower case format, like so:
  //   star*separated
  //
  // @param string [String]
  // @return [String]
  formattedToRegex(string) {
    // Based on
    // http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby

    // The pattern to match in between words. The "es" and "s" match is there
    // to catch pluralized folder names. There is a risk that this is overly
    // aggressive and will lead to trouble down the line. In that case, we can
    // consider adding a configuration option to control mapping a singular
    // variable name to a plural folder name (suggested by @lencioni in #127).
    // E.g.
    //
    // {
    //   "^mock": "./mocks/"
    // }
    const splitPattern = '(es|s)?.?';

    // Split up the string, allow pluralizing and a single (any) character
    // in between. This will make e.g. 'fooBar' match 'foos/bar', 'foo_bar',
    // and 'foobar'.
    return string
      .replace(/([a-z\d])([A-Z])/g, `$1${splitPattern}$2`) // camelCase
      .replace(/[-_]/g, splitPattern)
      .toLowerCase();
  }
}

module.exports = Importer;
