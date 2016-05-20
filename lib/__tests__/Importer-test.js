import FileUtils from '../FileUtils';
import Importer from '../Importer';
import findMatchingFiles from '../findMatchingFiles';
import requireResolve from '../requireResolve';

jest.mock('../FileUtils');
jest.mock('../findMatchingFiles');
jest.mock('../requireResolve');

describe('Importer', () => {
  let word;
  let text;
  let existingFiles;
  let packageJsonContent;
  let packageDependencies;
  let pathToCurrentFile;
  let configuration;
  let setup;

  beforeEach(() => {
    word = 'foo';
    text = 'foo';
    existingFiles = [];
    packageJsonContent = {};
    packageDependencies = [];

    pathToCurrentFile = 'test.js';
    configuration = {};

    setup = () => {
      FileUtils.__setJsonFile('.importjs.json', configuration);

      // Convert the array to an object, as it is in the package.json file.
      const dependencies = packageDependencies.reduce((depsObj, dependency) => (
        Object.assign({}, depsObj, { [dependency]: '1.0.0' })
      ), {});
      FileUtils.__setJsonFile('package.json', { dependencies });

      FileUtils.__setJsonFileFallback((file) => {
        if (file in packageJsonContent) {
          return packageJsonContent[file];
        }

        for (let i = 0; i < packageDependencies.length; i++) {
          const dep = packageDependencies[i];
          if (file.indexOf(dep) !== -1) {
            return { main: `${dep}-main.jsx` };
          }
        }
        return null;
      });

      const resolvedPaths = {};
      packageDependencies.forEach((dep) => {
        resolvedPaths[dep] = `node_modules/${dep}/${dep}-main.jsx`;
      });
      requireResolve.__setResolvedPaths(resolvedPaths);

      findMatchingFiles.__setExistingFiles(existingFiles);
    };
  });

  afterEach(() => {
    FileUtils.__reset();
    requireResolve.__reset();
  });

  describe('with deprecated configuration', () => {
    beforeEach(() => {
      configuration = { declaration_keyword: 'const' };
    });

    it('has a message about the deprecated configuration', () => {
      setup();
      const importer = new Importer(text.split('\n'), pathToCurrentFile);
      expect(importer.messages).toEqual([
        'Deprecated configuration: `declaration_keyword` has changed to `declarationKeyword`',
      ]);
    });
  });

  describe('#import', () => {
    let subject;
    let result;

    beforeEach(() => {
      subject = () => {
        setup();
        result = new Importer(text.split('\n'), pathToCurrentFile).import(word);
        return result.fileContent;
      };
    });

    describe('with a variable name that will not resolve', () => {
      it('leaves the buffer unchanged', () => {
        expect(subject()).toEqual(text);
      });

      it('displays a message', () => {
        subject();
        expect(result.messages).toEqual([
          `No JS module to import for \`${word}\``,
        ]);
      });

      it('does not ask you to resolve manually', () => {
        subject();
        expect(result.unresolvedImports).toEqual({});
      });
    });

    describe('with a variable name that will resolve', () => {
      beforeEach(() => {
        existingFiles = ['bar/foo.jsx'];
      });

      it('adds an import to the top of the buffer', () => {
        expect(subject()).toEqual(`
import foo from './bar/foo';

foo
        `.trim());
      });

      it('displays a message about the imported module', () => {
        subject();
        expect(result.messages).toEqual([
          'Imported `./bar/foo`',
        ]);
      });

      describe('when that import is already imported', () => {
        beforeEach(() => {
          text = `
import foo from './bar/foo';

foo
          `.trim();
        });

        it('leaves the buffer unchanged', () => {
          expect(subject()).toEqual(text);
        });

        describe('when there is a blank line above the import', () => {
          beforeEach(() => {
            text = `
import foo from './bar/foo';

foo`;
          });

          it('removes the blank line from the top', () => {
            expect(subject()).toEqual(text.trim());
          });
        });
      });

      describe("when 'use strict' is at the top of the file", () => {
        beforeEach(() => {
          text = `
'use strict';

foo
          `.trim();
        });

        it('adds the import below', () => {
          expect(subject()).toEqual(`
'use strict';

import foo from './bar/foo';

foo
            `.trim()
          );
        });

        describe("when 'use strict' is at the top of the file twice", () => {
          beforeEach(() => {
            text = `
'use strict';
'use strict';

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
'use strict';
'use strict';

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe("when there are other imports under 'use strict'", () => {
          beforeEach(() => {
            text = `
'use strict';
import bar from './bar';

foo + bar
            `.trim();
          });

          it('adds the import at the right place', () => {
            expect(subject()).toEqual(`
'use strict';
import bar from './bar';
import foo from './bar/foo';

foo + bar
            `.trim());
          });
        });

        describe("when there is no newline under a lonely 'use strict'", () => {
          beforeEach(() => {
            text = `
'use strict';
foo + bar
            `.trim();
          });

          it('adds a newline as part of importing ', () => {
            expect(subject()).toEqual(`
'use strict';
import foo from './bar/foo';

foo + bar
            `.trim());
          });
        });

        describe('when "use strict" is within double quotes', () => {
          beforeEach(() => {
            text = `
"use strict";

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
"use strict";

import foo from './bar/foo';

foo
            `.trim());
          });
        });

        describe('when a one-line comment is at the top of the file', () => {
          beforeEach(() => {
            text = `
// One-line comment

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
// One-line comment

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when multiple one-line comments are at the top of the file', () => {
          beforeEach(() => {
            text = `
// One-line comment
// Another one-line comment

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
// One-line comment
// Another one-line comment

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when just an empty line is at the top', () => {
          beforeEach(() => {
            text = `
foo`;
          });

          it('does not preserve the empty line', () => {
            expect(subject()).toEqual(`
import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when an empty line precedes a comment', () => {
          beforeEach(() => {
            text = `

// One-line comment

foo
            `.trimRight();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`

// One-line comment

import foo from './bar/foo';

foo
              `.trimRight()
            );
          });
        });

        describe('when one-line comments with empty lines are at the top', () => {
          beforeEach(() => {
            text = `
// One-line comment

// Another one-line comment

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
// One-line comment

// Another one-line comment

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when a multi-line comment is at the top of the file', () => {
          beforeEach(() => {
            text = `
/* Multi-line comment */

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
/* Multi-line comment */

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when a multi-line comment that spans lines is at the top', () => {
          beforeEach(() => {
            text = `
/*
  Multi-line comment
  that spans multiple lines
*/

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
/*
  Multi-line comment
  that spans multiple lines
*/

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when a multi-line comment is stacked weirdly', () => {
          beforeEach(() => {
            text = `
/* Single-line multi-line comment *//*
  Multi-line comment
  that spans multiple lines
*/

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
/* Single-line multi-line comment *//*
  Multi-line comment
  that spans multiple lines
*/

import foo from './bar/foo';

foo
              `.trim()
            );
          });
        });

        describe('when both comment styles are at the top of the file', () => {
          beforeEach(() => {
            text = `
// One-line comment
/* Multi-line comment */

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
// One-line comment
/* Multi-line comment */

import foo from './bar/foo';

foo
              `.trim());
          });
        });

        describe("when comments and 'use strict' are at the top of the file", () => {
          beforeEach(() => {
            text = `
'use strict';
// One-line comment
/* Multi-line comment */

foo
            `.trim();
          });

          it('adds the import below', () => {
            expect(subject()).toEqual(`
'use strict';
// One-line comment
/* Multi-line comment */

import foo from './bar/foo';

foo
            `.trim());
          });
        });

        describe('when the variable name matches last folder+filename', () => {
          beforeEach(() => {
            existingFiles = ['sko/bar/foo.jsx'];
            word = 'barFoo';
            text = 'barFoo';
          });

          it('resolves the import', () => {
            expect(subject()).toEqual(`
import barFoo from './sko/bar/foo';

barFoo
            `.trim());
          });

          describe('when the last folder ends with an "s"', () => {
            beforeEach(() => {
              existingFiles = ['sko/bars/foo.jsx'];
            });

            it('resolves the import', () => {
              expect(subject()).toEqual(`
import barFoo from './sko/bars/foo';

barFoo
              `.trim());
            });

            describe('when the variable also has "s" at the end', () => {
              beforeEach(() => {
                word = 'barsFoo';
                text = 'barsFoo';
              });

              it('resolves the import', () => {
                expect(subject()).toEqual(`
import barsFoo from './sko/bars/foo';

barsFoo
                `.trim());
              });
            });
          });

          describe('when the last folder ends with "es"', () => {
            beforeEach(() => {
              existingFiles = ['sko/statuses/foo.jsx'];
              word = 'statusFoo';
              text = 'statusFoo';
            });

            it('resolves the import', () => {
              expect(subject()).toEqual(`
import statusFoo from './sko/statuses/foo';

statusFoo
              `.trim());
            });

            describe('when the variable also has "es" at the end', () => {
              beforeEach(() => {
                word = 'statusesFoo';
                text = 'statusesFoo';
              });

              it('resolves the import', () => {
                expect(subject()).toEqual(`
import statusesFoo from './sko/statuses/foo';

statusesFoo
                `.trim());
              });
            });
          });
        });

        describe('when the variable name matches a few folders + filename', () => {
          beforeEach(() => {
            existingFiles = ['sko/bar/foo/ta.jsx'];
            word = 'BarFooTa';
            text = 'BarFooTa';
          });

          it('resolves the import', () => {
            expect(subject()).toEqual(`
import BarFooTa from './sko/bar/foo/ta';

BarFooTa
            `.trim());
          });

          describe('when the folders end with "s"', () => {
            beforeEach(() => {
              existingFiles = ['sko/bars/foos/ta.jsx'];
            });

            it('resolves the import', () => {
              expect(subject()).toEqual(`
import BarFooTa from './sko/bars/foos/ta';

BarFooTa
              `.trim());
            });

            describe('when the variable also has "s"', () => {
              beforeEach(() => {
                word = 'BarsFoosTa';
                text = 'BarsFoosTa';
              });

              it('resolves the import', () => {
                expect(subject()).toEqual(`
import BarsFoosTa from './sko/bars/foos/ta';

BarsFoosTa
                `.trim());
              });
            });
          });

          describe('when the folders end with "es"', () => {
            beforeEach(() => {
              existingFiles = ['sko/statuses/buses/ta.jsx'];
              word = 'statusBusTa';
              text = 'statusBusTa';
            });

            it('resolves the import', () => {
              expect(subject()).toEqual(`
import statusBusTa from './sko/statuses/buses/ta';

statusBusTa
              `.trim());
            });

            describe('when the variable also has "es"', () => {
              beforeEach(() => {
                word = 'StatusesBusesTa';
                text = 'StatusesBusesTa';
              });

              it('resolves the import', () => {
                expect(subject()).toEqual(`
import StatusesBusesTa from './sko/statuses/buses/ta';

StatusesBusesTa
                `.trim());
              });
            });
          });
        });
      });

      describe('when the variable resolves to a node.js conventional module', () => {
        beforeEach(() => {
          existingFiles = ['Foo/index.jsx'];
        });

        it('adds an import to the top of the buffer', () => {
          expect(subject()).toEqual(`
import foo from './Foo';

foo
          `.trim());
        });

        it('displays a message about the imported module', () => {
          subject();
          expect(result.messages).toEqual([
            'Imported `./Foo (main: index.jsx)`',
          ]);
        });

        describe('when that module has a dot in its name', () => {
          beforeEach(() => {
            existingFiles = ['Foo.io/index.jsx'];
            word = 'FooIO';
            text = 'FooIO';
          });

          it('imports that module with the dot', () => {
            expect(subject()).toEqual(`
import FooIO from './Foo.io';

FooIO
            `.trim());
          });
        });
      });

      describe('in a node environment', () => {
        beforeEach(() => {
          word = 'Readline';
          text = 'Readline';
          configuration.environments = ['node'];
        });

        it('adds an import to the top of the buffer', () => {
          expect(subject()).toEqual(`
import Readline from 'readline';

Readline
          `.trim());
        });
      });

      describe('when the import resolves to a dependency from package.json', () => {
        beforeEach(() => {
          packageDependencies = ['foo-bar'];
          word = 'fooBar';
          text = 'fooBar';
        });

        it('adds an import to the top of the buffer', () => {
          expect(subject()).toEqual(`
import fooBar from 'foo-bar';

fooBar
          `.trim());
        });

        it('displays a message about the imported module', () => {
          subject();
          expect(result.messages).toEqual([
            'Imported `foo-bar (main: foo-bar-main.jsx)`',
          ]);
        });

        describe('with an `ignorePackagePrefixes` configuration', () => {
          beforeEach(() => {
            configuration.ignorePackagePrefixes = ['foo-'];
          });

          describe('when the variable has the prefix', () => {
            it('still imports the package', () => {
              expect(subject()).toEqual(`
import fooBar from 'foo-bar';

fooBar
              `.trim());
            });
          });

          describe('when the variable does not have the prefix', () => {
            beforeEach(() => {
              word = 'bar';
              text = 'bar';
            });

            it('imports the package', () => {
              expect(subject()).toEqual(`
import bar from 'foo-bar';

bar
              `.trim());
            });
          });

          describe('when a package matches the prefix but not the word', () => {
            beforeEach(() => {
              word = 'baz';
              text = 'baz';
            });

            it('leaves the buffer unchanged', () => {
              expect(subject()).toEqual(`
baz
              `.trim());
            });
          });
        });
      });

      describe('when other imports exist', () => {
        beforeEach(() => {
          text = `
import zoo from './foo/zoo';
import bar from './foo/bar';

foo
          `.trim();
        });

        it('adds the import and sorts the entire list', () => {
          expect(subject()).toEqual(`
import bar from './foo/bar';
import foo from './bar/foo';
import zoo from './foo/zoo';

foo
          `.trim());
        });

        describe('when there are unconventional imports in the list', () => {
          // e.g. added through using the `importFunction` configuration option
          beforeEach(() => {
            text = `
const sko = customImportFunction('./sko');
import zoo from './foo/zoo';
import bar from './foo/bar';

foo
            `.trim();
          });

          it('adds the import and sorts the entire list with groups', () => {
            expect(subject()).toEqual(`
import bar from './foo/bar';
import foo from './bar/foo';
import zoo from './foo/zoo';

const sko = customImportFunction('./sko');

foo
            `.trim());
          });

          describe('and `groupImports` is false', () => {
            beforeEach(() => {
              configuration.groupImports = false;
            });

            it('adds the import and sorts all of them', () => {
              expect(subject()).toEqual(`
import bar from './foo/bar';
import foo from './bar/foo';
const sko = customImportFunction('./sko');
import zoo from './foo/zoo';

foo
              `.trim());
            });
          });
        });
      });

      describe('when there is an unconventional import', () => {
        beforeEach(() => {
          text = `
import zoo from './foo/zoo';
import tsar from './foo/bar').tsa;

foo
          `.trim();
        });

        it('adds the import and moves out the unconventional import', () => {
          expect(subject()).toEqual(`
import foo from './bar/foo';
import zoo from './foo/zoo';

import tsar from './foo/bar').tsa;

foo
        `.trim());
        });
      });

      describe('when there is a non-import inline with the imports', () => {
        beforeEach(() => {
          text = `
import bar from './bar';
import star from
  './star';
var { STRAWBERRY, CHOCOLATE } = bar.scoops;
import zoo from './foo/zoo';

foo
          `.trim();
        });

        it('breaks imports at that line', () => {
          // A better solution would perhaps be to find the `var zoo` import and
          // move it up there with the rest. But there's a lot of complexity
          // involved in that, so cutting off at the non-import is a simpler
          // solution.
          expect(subject()).toEqual(`
import bar from './bar';
import foo from './bar/foo';
import star from
  './star';

var { STRAWBERRY, CHOCOLATE } = bar.scoops;
import zoo from './foo/zoo';

foo
        `.trim());
        });
      });

      describe('when there is an import with line-breaks', () => {
        beforeEach(() => {
          text = `
import zoo from
  './foo/zoo';
import tsar from './foo/bar';

var import_foo = { from: b }
          `.trim();
        });

        it('adds the import, sorts the entire list and keeps the line-break', () => {
          expect(subject()).toEqual(`
import foo from './bar/foo';
import tsar from './foo/bar';
import zoo from
  './foo/zoo';

var import_foo = { from: b }
        `.trim());
        });
      });

      describe('when there is a blank line amongst current imports', () => {
        beforeEach(() => {
          text = `
import zoo from './foo/zoo';

import bar from './foo/bar';
foo
          `.trim();
        });

        it('adds the import, compacts, and sorts the entire list', () => {
          expect(subject()).toEqual(`
import bar from './foo/bar';
import foo from './bar/foo';
import zoo from './foo/zoo';

foo
          `.trim());
        });
      });

      describe('when there are multiple blank lines amongst current imports', () => {
        beforeEach(() => {
          text = `
import zoo from './foo/zoo';

import frodo from './bar/frodo';


import bar from './foo/bar';

foo
          `.trim();
        });

        it('compacts the list', () => {
          expect(subject()).toEqual(`
import bar from './foo/bar';
import foo from './bar/foo';
import frodo from './bar/frodo';
import zoo from './foo/zoo';

foo
          `.trim());
        });
      });

      describe('when multiple files resolve the variable', () => {
        beforeEach(() => {
          existingFiles = [
            'bar/foo.jsx',
            'zoo/foo.js',
            'zoo/goo/Foo/index.js',
          ];
        });

        it('records the alternatives to choose from', () => {
          subject();
          expect(result.unresolvedImports).toEqual({
            foo: [
              {
                displayName: './bar/foo',
                filePath: 'bar/foo.jsx',
                importPath: './bar/foo',
              },
              {
                displayName: './zoo/foo',
                filePath: 'zoo/foo.js',
                importPath: './zoo/foo',
              },
              {
                displayName: './zoo/goo/Foo (main: index.js)',
                filePath: 'zoo/goo/Foo/index.js',
                importPath: './zoo/goo/Foo',
              },
            ],
          });
        });
      });

      describe('when the same logical file is matched twice', () => {
        beforeEach(() => {
          existingFiles = [
            'Foo/lib/foo.jsx',
            'Foo/package.json',
            'zoo/foo.js',
          ];

          packageJsonContent = {
            'Foo/package.json': {
              main: 'lib/foo.jsx',
            },
          };
        });

        it('does not list logical duplicates', () => {
          subject();
          expect(result.unresolvedImports).toEqual({
            foo: [
              {
                displayName: './Foo (main: lib/foo.jsx)',
                filePath: 'Foo/lib/foo.jsx',
                importPath: './Foo',
              },
              {
                displayName: './zoo/foo',
                filePath: 'zoo/foo.js',
                importPath: './zoo/foo',
              },
            ],
          });
        });
      });
    });

    describe('importing a module with a package.json file', () => {
      beforeEach(() => {
        existingFiles = [
          'Foo/package.json',
          'Foo/build/main.js',
        ];
      });

      describe('when `main` points to a JS file', () => {
        beforeEach(() => {
          packageJsonContent = {
            'Foo/package.json': {
              main: 'build/main.js',
            },
          };
        });

        it('adds an import to the top of the buffer', () => {
          expect(subject()).toEqual(`
import foo from './Foo';

foo
          `.trim());
        });
      });

      describe('when `main` points to index.js in the same folder', () => {
        beforeEach(() => {
          existingFiles = [
            'Foo/package.json',
            'Foo/index.js',
          ];

          packageJsonContent = {
            'Foo/package.json': {
              main: 'index.js',
            },
          };
        });

        it('adds an import to the top of the buffer', () => {
          expect(subject()).toEqual(`
import foo from './Foo';

foo
          `.trim());
        });
      });

      describe('when the module is named something.js', () => {
        beforeEach(() => {
          existingFiles = [
            'Foo.js/package.json',
            'Foo.js/main.js',
          ];
          text = 'FooJS';
          word = 'FooJS';

          packageJsonContent = {
            'Foo.js/package.json': {
              main: 'main.js',
            },
          };
        });

        it('keeps the .js in the import', () => {
          expect(subject()).toEqual(`
import FooJS from './Foo.js';

FooJS
          `.trim());
        });
      });

      describe('when `main` is missing', () => {
        beforeEach(() => {
          packageJsonContent = {
            'Foo/package.json': {},
          };
        });

        it('does not add an import', () => {
          expect(subject()).toEqual(`
foo
          `.trim());
        });
      });
    });

    describe('line wrapping', () => {
      describe('when lines exceed the configured max width', () => {
        beforeEach(() => {
          configuration.maxLineLength = 40;
          existingFiles = ['fiz/bar/biz/baz/fiz/buz/boz/foo.jsx'];
        });

        describe('when configured to use a tab character', () => {
          beforeEach(() => {
            configuration.tab = '\t';
          });

          it('wraps them and indents with a tab', () => {
            expect(subject()).toEqual(`
import foo from
	'./fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
            `.trim());
          });
        });

        describe('when configured to use two spaces', () => {
          beforeEach(() => {
            configuration.tab = '  ';
          });

          it('wraps them and indents with two spaces', () => {
            expect(subject()).toEqual(`
import foo from
  './fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
            `.trim());
          });
        });
      });

      describe('when lines do not exceed the configured max width', () => {
        beforeEach(() => {
          configuration.maxLineLength = 80;
          existingFiles = ['bar/foo.jsx'];
        });

        it('does not wrap them', () => {
          expect(subject()).toEqual(`
import foo from './bar/foo';

foo
          `.trim());
        });
      });
    });

    describe('configuration', () => {
      describe('with aliases', () => {
        beforeEach(() => {
          configuration.aliases = { $: 'jquery' };
          text = '$';
          word = '$';
        });

        it('resolves aliased imports to the aliases', () => {
          expect(subject()).toEqual(`
import $ from 'jquery';

$
        `.trim());
        });

        describe('and an alias has a dynamic {filename}', () => {
          beforeEach(() => {
            configuration.aliases = { styles: './{filename}.scss' };
            text = 'styles';
            word = 'styles';
            pathToCurrentFile = 'bar/foo.jsx';
          });

          it('uses the filename of the current file', () => {
            expect(subject()).toEqual(`
import styles from './foo.scss';

styles
            `.trim());
          });

          describe('when editing an anonymous file', () => {
            describe('that is nil', () => {
              beforeEach(() => {
                pathToCurrentFile = null;
              });

              it('does not replace the dynamic part', () => {
                expect(subject()).toEqual(`
import styles from './{filename}.scss';

styles
                `.trim());
              });
            });

            describe('that is an empty string', () => {
              beforeEach(() => {
                pathToCurrentFile = '';
              });

              it('does not replace the dynamic part', () => {
                expect(subject()).toEqual(`
import styles from './{filename}.scss';

styles
                `.trim());
              });
            });
          });
        });

        describe('and an alias contains a slash', () => {
          // https://github.com/galooshi/import-js/issues/39
          beforeEach(() => {
            configuration.aliases = { $: 'jquery/jquery' };
          });

          it('keeps the slash in the alias path', () => {
            expect(subject()).toEqual(`
import $ from 'jquery/jquery';

$
          `.trim());
          });
        });
      });

      describe('with `namedExports` object', () => {
        beforeEach(() => {
          configuration.namedExports = {
            'lib/utils': [
              'foo',
              'bar',
            ],
          };
          text = 'foo';
          word = 'foo';
        });

        it('resolves that import using named imports', () => {
          expect(subject()).toEqual(`
import { foo } from 'lib/utils';

foo
          `.trim());
        });
      });

      describe('using `var`, `aliases` and a `namedExports` object', () => {
        beforeEach(() => {
          configuration = Object.assign(configuration, {
            declarationKeyword: 'var',
            namedExports: {
              underscore: [
                'memoize',
                'debounce',
              ],
            },
            aliases: {
              _: 'underscore',
            },
          });
          text = '_';
          word = '_';
        });

        it('resolves the main alias without destructuring', () => {
          expect(subject()).toEqual(`
var _ = require('underscore');

_
        `.trim());
        });

        describe('when a named import exists for the same module', () => {
          beforeEach(() => {
            text = `
var { memoize } = require('underscore');

_
            `.trim();
          });

          it('adds the default import', () => {
            expect(subject()).toEqual(`
var _ = require('underscore');
var { memoize } = require('underscore');

_
            `.trim());
          });
        });

        describe('when importing a named export', () => {
          beforeEach(() => {
            text = 'memoize';
            word = 'memoize';
          });

          it('resolves that import using destructuring', () => {
            expect(subject()).toEqual(`
var { memoize } = require('underscore');

memoize
            `.trim());
          });

          it('displays a message about the imported module', () => {
            subject();
            expect(result.messages).toEqual([
              'Imported `memoize` from `underscore`',
            ]);
          });

          describe('when the default import exists for the same module', () => {
            beforeEach(() => {
              text = `
var _ = require('underscore');

memoize
              `.trim();
            });

            it('adds the destructuring on a new line', () => {
              expect(subject()).toEqual(`
var _ = require('underscore');
var { memoize } = require('underscore');

memoize
              `.trim());
            });
          });

          describe('when the default is already imported for destructured var', () => {
            beforeEach(() => {
              text = `
var _ = require('underscore');
var foo = require('foo');

memoize
              `.trim();
            });

            it('adds the destructuring on a new line', () => {
              expect(subject()).toEqual(`
var _ = require('underscore');
var { memoize } = require('underscore');
var foo = require('foo');

memoize
              `.trim());
            });
          });

          describe('with other imports', () => {
            beforeEach(() => {
              text = `
const bar = require('foo/bar');
var { xyz } = require('alphabet');

memoize
              `.trim();
            });

            it('places the import at the right place', () => {
              expect(subject()).toEqual(`
const bar = require('foo/bar');

var { memoize } = require('underscore');
var { xyz } = require('alphabet');

memoize
              `.trim());
            });
          });

          describe('when other destructured imports exist for the same module', () => {
            beforeEach(() => {
              text = `
var { xyz, debounce } = require('underscore');

memoize
              `.trim();
            });

            it('combines the destructured import and sorts items', () => {
              expect(subject()).toEqual(`
var { debounce, memoize, xyz } = require('underscore');

memoize
              `.trim());
            });

            describe('when the module is already in the destructured object', () => {
              beforeEach(() => {
                text = `
var { debounce, memoize } = require('underscore');

memoize
                `.trim();
              });

              it('does not add a duplicate', () => {
                expect(subject()).toEqual(`
var { debounce, memoize } = require('underscore');

memoize
                `.trim());
              });
            });
          });
        });
      });

      describe('alias with `import` and a `namedExports` object', () => {
        beforeEach(() => {
          configuration = Object.assign(configuration, {
            declarationKeyword: 'import',
            namedExports: {
              underscore: [
                'memoize',
                'debounce',
              ],
            },
            aliases: {
              _: 'underscore',
            },
          });
          text = '_';
          word = '_';
        });

        it('resolves the main alias without a named import', () => {
          expect(subject()).toEqual(`
import _ from 'underscore';

_
          `.trim());
        });

        describe('when a named import exists for the same module', () => {
          beforeEach(() => {
            text = `
import { memoize } from 'underscore';

_
            `.trim();
          });

          it('adds the default import', () => {
            expect(subject()).toEqual(`
import _, { memoize } from 'underscore';

_
            `.trim());
          });
        });

        describe('when importing a named export', () => {
          beforeEach(() => {
            text = 'memoize';
            word = 'memoize';
          });

          it('uses a named import', () => {
            expect(subject()).toEqual(`
import { memoize } from 'underscore';

memoize
            `.trim());
          });

          describe('with other imports', () => {
            beforeEach(() => {
              text = `
import bar from 'foo/bar';
import { xyz } from 'alphabet';

memoize
              `.trim();
            });

            it('places the import at the right place', () => {
              expect(subject()).toEqual(`
import { memoize } from 'underscore';
import { xyz } from 'alphabet';
import bar from 'foo/bar';

memoize
              `.trim());
            });
          });

          describe('when other named imports exist for the same module', () => {
            beforeEach(() => {
              text = `
import { xyz, debounce } from 'underscore';

memoize
              `.trim();
            });

            it('combines the named import and sorts items', () => {
              expect(subject()).toEqual(`
import { debounce, memoize, xyz } from 'underscore';

memoize
              `.trim());
            });

            describe('when the module is already in the named imports', () => {
              beforeEach(() => {
                text = `
import { debounce, memoize, xyz } from 'underscore';

memoize
                `.trim();
              });

              it('does not add a duplicate', () => {
                expect(subject()).toEqual(`
import { debounce, memoize, xyz } from 'underscore';

memoize
                `.trim());
              });
            });
          });

          describe('when a default import exists for the same module', () => {
            beforeEach(() => {
              text = `
import _ from 'underscore';

memoize
              `.trim();
            });

            it('adds the named import', () => {
              expect(subject()).toEqual(`
import _, { memoize } from 'underscore';

memoize
              `.trim());
            });

            describe('when the module is already in the named import', () => {
              beforeEach(() => {
                text = `
import _, { memoize } from 'underscore';

memoize
                `.trim();
              });

              it('does not add a duplicate', () => {
                expect(subject()).toEqual(`
import _, { memoize } from 'underscore';

memoize
                `.trim());
              });
            });
          });
        });
      });

      describe('with a custom `importFunction`', () => {
        beforeEach(() => {
          existingFiles = ['bar/foo.js'];
        });

        describe('and `declarationKeyword=import`', () => {
          beforeEach(() => {
            configuration.importFunction = 'myRequire';
            configuration.declarationKeyword = 'import';
          });

          it('does nothing special', () => {
            expect(subject()).toEqual(`
import foo from './bar/foo';

foo
            `.trim());
          });
        });

        describe('and `declarationKeyword=const`', () => {
          beforeEach(() => {
            configuration.importFunction = 'myRequire';
            configuration.declarationKeyword = 'const';
          });

          it('uses the custom import function instead of "require"', () => {
            expect(subject()).toEqual(`
const foo = myRequire('./bar/foo');

foo
            `.trim());
          });
        });
      });

      describe('when stripFileExtensions is empty', () => {
        beforeEach(() => {
          existingFiles = ['bar/foo.js'];
          configuration.stripFileExtensions = [];
        });

        it('keeps the file ending in the import', () => {
          expect(subject()).toEqual(`
import foo from './bar/foo.js';

foo
          `.trim());
        });
      });

      describe('with excludes', () => {
        beforeEach(() => {
          existingFiles = ['bar/foo/foo.js'];
          configuration.excludes = ['**/foo/**'];
        });

        it('does not add an import', () => {
          expect(subject()).toEqual(`
foo
          `.trim());
        });

        it('displays a message', () => {
          subject();
          expect(result.messages).toEqual([
            `No JS module to import for \`${word}\``,
          ]);
        });
      });

      describe('with declarationKeyword=const', () => {
        beforeEach(() => {
          configuration.declarationKeyword = 'const';
        });

        describe('with a variable name that will resolve', () => {
          beforeEach(() => {
            existingFiles = ['bar/foo.jsx'];
          });

          it('adds an import to the top using the declarationKeyword', () => {
            expect(subject()).toEqual(`
const foo = require('./bar/foo');

foo
            `.trim());
          });

          describe('when that variable is already imported using `var`', () => {
            beforeEach(() => {
              text = `
var foo = require('./bar/foo');

foo
              `.trim();
            });

            it('changes the `var` to declarationKeyword', () => {
              expect(subject()).toEqual(`
const foo = require('./bar/foo');

foo
              `.trim());
            });
          });

          describe('when the import contains a line-break', () => {
            beforeEach(() => {
              text = `
var foo =
  require('./bar/foo');

foo
              `.trim();
            });

            it('changes the `var` to declarationKeyword and removes space', () => {
              expect(subject()).toEqual(`
const foo = require('./bar/foo');

foo
              `.trim());
            });
          });

          describe('when other imports exist', () => {
            beforeEach(() => {
              text = `
var zoo = require('foo/zoo');
let bar = require('foo/bar');

foo
              `.trim();
            });

            it('adds the import and sorts and groups the entire list', () => {
              expect(subject()).toEqual(`
const foo = require('./bar/foo');

var zoo = require('foo/zoo');

let bar = require('foo/bar');

foo
            `.trim());
            });
          });
        });
      });

      describe('with declarationKeyword=import', () => {
        beforeEach(() => {
          configuration.declarationKeyword = 'import';
        });

        describe('with a variable name that will resolve', () => {
          beforeEach(() => {
            existingFiles = [
              'bar/foo.jsx',
              'bar/fromfoo.jsx',
            ];
          });

          describe('when that variable is already imported using `var`', () => {
            beforeEach(() => {
              text = `
var foo = require('./bar/foo');

foo
              `.trim();
            });

            it('changes the `var` to declarationKeyword', () => {
              expect(subject()).toEqual(`
import foo from './bar/foo';

foo
              `.trim());
            });
          });

          describe('when that variable already exists with a different style', () => {
            beforeEach(() => {
              text = `
var foo = require("./bar/foo");

foo
              `.trim();
            });

            it('changes `var` to declarationKeyword and doubles to singles', () => {
              expect(subject()).toEqual(`
import foo from './bar/foo';

foo
              `.trim());
            });
          });

          describe('when the imported variable has "from" in it', () => {
            beforeEach(() => {
              word = 'fromfoo';
              text = `
var fromfoo = require('./bar/fromfoo');

fromfoo
              `.trim();
            });

            it('changes the `var` to declarationKeyword', () => {
              expect(subject()).toEqual(`
import fromfoo from './bar/fromfoo';

fromfoo
              `.trim());
            });
          });

          describe('when the import contains a line-break', () => {
            beforeEach(() => {
              text = `
var foo =
  require('./bar/foo');

foo
              `.trim();
            });

            it('changes the `var` to declarationKeyword and removes space', () => {
              expect(subject()).toEqual(`
import foo from './bar/foo';

foo
              `.trim());
            });
          });

          describe('when other imports exist', () => {
            beforeEach(() => {
              text = `
var zoo = require('foo/zoo');
let bar = require('foo/bar');

foo
              `.trim();
            });

            it('adds the import and sorts and groups the entire list', () => {
              expect(subject()).toEqual(`
import foo from './bar/foo';

var zoo = require('foo/zoo');

let bar = require('foo/bar');

foo
            `.trim());
            });
          });
        });
      });

      describe('with `useRelativePaths=true`', () => {
        beforeEach(() => {
          existingFiles = ['bar/foo.jsx'];
          text = 'foo';
          configuration.useRelativePaths = true;
          configuration.lookupPaths = ['bar'];
        });

        describe('when the current file is in the same lookupPath', () => {
          beforeEach(() => {
            pathToCurrentFile = 'bar/current.js';
          });

          it('uses a relative import path', () => {
            expect(subject()).toEqual(`
import foo from './foo';

foo
            `.trim());
          });
        });

        describe('when the current file is not in the same lookupPath', () => {
          beforeEach(() => {
            pathToCurrentFile = '/foo/bar/current.js';
          });

          it('does not use a relative import path', () => {
            expect(subject()).toEqual(`
import foo from 'foo';

foo
            `.trim());
          });
        });

        describe('when the current file is an absolute path in the same lookupPath', () => {
          beforeEach(() => {
            pathToCurrentFile = `${process.cwd()}/bar/test.js`;
          });

          it('uses a relative import path', () => {
            expect(subject()).toEqual(`
import foo from './foo';

foo
            `.trim());
          });
        });
      });

      describe('with local configuration defined in the main config file', () => {
        beforeEach(() => {
          existingFiles = ['bar/goo.jsx'];
          pathToCurrentFile = 'foo/bar.js';
          configuration.appliesTo = 'foo/**/*';
          configuration.declarationKeyword = 'var';
          text = 'goo';
          word = 'goo';
        });


        describe('when the pattern matches the file being edited', () => {
          it('uses local config', () => {
            expect(subject()).toEqual(`
var goo = require('../bar/goo');

goo
            `.trim());
          });
        });

        describe('when the pattern does not match the file being edited', () => {
          beforeEach(() => {
            configuration.appliesTo = 'car/**';
          });

          it('falls back to default config', () => {
            expect(subject()).toEqual(`
import goo from '../bar/goo';

goo
            `.trim());
          });
        });

        describe('with an appliesFrom pattern', () => {
          beforeEach(() => {
            configuration = Object.assign(configuration, {
              appliesFrom: 'bar/**/*',
              declarationKeyword: 'var',
              importFunction: 'quack',
              useRelativePaths: false,
              stripFileExtensions: [],
            });
          });

          describe('that matches the path of the file being imported', () => {
            it('uses local config', () => {
              expect(subject()).toEqual(`
var goo = quack('bar/goo.jsx');

goo
              `.trim());
            });
          });

          describe('that does not match the file being imported', () => {
            beforeEach(() => {
              configuration.appliesFrom = 'foo/**';
            });

            it('falls back to default config', () => {
              expect(subject()).toEqual(`
import goo from '../bar/goo';

goo
              `.trim());
            });
          });
        });
      });
    });
  });

  describe('#addImports', () => {
    let subject;
    let resolvedImports;
    let result;

    beforeEach(() => {
      subject = () => {
        setup();
        result = new Importer(text.split('\n'), pathToCurrentFile)
          .addImports(resolvedImports);
        return result.fileContent;
      };
    });

    describe('when adding one import', () => {
      beforeEach(() => {
        text = 'foo';
        resolvedImports = {
          foo: 'star/foo',
        };
      });

      it('adds imports based on variable name and import path', () => {
        expect(subject()).toEqual(`
import foo from 'star/foo';

foo
        `.trim());
      });

      it('displays a message', () => {
        subject();
        expect(result.messages).toEqual([
          'Added import for `foo`',
        ]);
      });
    });

    describe('when adding multiple imports', () => {
      beforeEach(() => {
        text = 'foo; bar;';
        resolvedImports = {
          foo: 'star/foo',
          bar: 'star/bar',
        };
      });

      it('adds imports based on variable name and import path', () => {
        expect(subject()).toEqual(`
import bar from 'star/bar';
import foo from 'star/foo';

foo; bar;
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Added 2 imports',
        ]);
      });
    });
  });

  describe('#fixImports', () => {
    let subject;
    let result;

    beforeEach(() => {
      subject = () => {
        setup();
        result = new Importer(text.split('\n'), pathToCurrentFile).fixImports();
        return result.fileContent;
      };
    });

    describe('when no undefined variables exist', () => {
      beforeEach(() => {
        text = `
const foo = require('foo');

foo();
        `.trim();
      });

      it('leaves the buffer unchanged', () => {
        expect(subject()).toEqual(text);
      });

      it('displays no message', () => {
        subject();
        expect(result.messages).toEqual([]);
      });
    });

    describe('when eslint can not parse', () => {
      beforeEach(() => {
        text = `
return if sd([
        `.trim();
      });

      it('leaves the buffer unchanged', () => {
        expect(subject()).toEqual(text);
      });
    });

    describe('when one undefined variable exists', () => {
      beforeEach(() => {
        existingFiles = ['bar/foo.jsx'];
        text = 'foo();';
      });

      it('imports that variable', () => {
        expect(subject()).toEqual(`
import foo from './bar/foo';

foo();
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Imported `foo`.',
        ]);
      });
    });


    describe('when multiple undefined variables exist', () => {
      beforeEach(() => {
        existingFiles = ['bar/foo.jsx', 'bar.js'];
        text = 'var a = foo + bar;';
      });

      it('imports all variables', () => {
        expect(subject()).toEqual(`
import bar from './bar';
import foo from './bar/foo';

var a = foo + bar;
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Added 2 imports.',
        ]);
      });
    });

    describe('when undefined variables are used multiple times', () => {
      beforeEach(() => {
        existingFiles = ['bar/foo.jsx', 'bar.js'];
        text = `
var a = foo + bar;
var b = bar + foo;
        `.trim();
      });

      it('imports all variables', () => {
        expect(subject()).toEqual(`
import bar from './bar';
import foo from './bar/foo';

var a = foo + bar;
var b = bar + foo;
        `.trim());
      });

      it('displays a message with the right count', () => {
        expect(result.messages).toEqual([
          'Added 2 imports.',
        ]);
      });
    });

    describe('when a React component is not imported', () => {
      beforeEach(() => {
        packageDependencies = ['react'];
        existingFiles = ['bar/foo.jsx'];
        text = `
import React from 'react';

const foo = <Foo/>;
        `.trim();
      });

      it('imports that component', () => {
        expect(subject()).toEqual(`
import React from 'react';

import Foo from './bar/foo';

const foo = <Foo/>;
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Imported `Foo`.',
        ]);
      });
    });

    describe('when a React component is already imported', () => {
      beforeEach(() => {
        packageDependencies = ['react'];
        text = `
import React from 'react';

import Foo from 'bar/foo';

const foo = <Foo/>;
        `.trim();
      });

      it('does not remove any imports', () => {
        expect(subject()).toEqual(text);
      });

      it('does not display any message', () => {
        subject();
        expect(result.messages).toEqual([]);
      });
    });

    describe('when an implicit React import is missing', () => {
      beforeEach(() => {
        text = 'var a = <span/>;';
      });

      describe('when react is not available', () => {
        it('leaves the buffer unchanged', () => {
          expect(subject()).toEqual(text);
        });
      });

      describe('when react is available', () => {
        beforeEach(() => {
          packageDependencies = ['react'];
        });

        it('imports React', () => {
          expect(subject()).toEqual(`
import React from 'react';

var a = <span/>;
          `.trim());
        });

        it('displays a message', () => {
          expect(result.messages).toEqual([
            'Imported `React`.',
          ]);
        });
      });
    });

    describe('when one unused import exists', () => {
      beforeEach(() => {
        text = `
import foo from 'bar/foo';
import zar from 'foo/zar';

zar
        `.trim();
      });

      it('removes that import', () => {
        expect(subject()).toEqual(`
import zar from 'foo/zar';

zar
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Removed `foo`.',
        ]);
      });

      describe('when that import is the last one', () => {
        beforeEach(() => {
          text = `
import foo from 'bar/foo';

bar
          `.trim();
        });

        it('removes that import and leaves no whitespace', () => {
          expect(subject()).toEqual(`
bar
          `.trim());
        });

        describe('and there is a comment above', () => {
          beforeEach(() => {
            text = `
// I'm a comment
import foo from 'bar/foo';

bar
            `.trim();
          });

          it('removes that import and leaves no whitespace', () => {
            expect(subject()).toEqual(`
// I'm a comment
bar
            `.trim());
          });

          describe('with whitespace after the comment', () => {
            beforeEach(() => {
              text = `
// I'm a comment

import foo from 'bar/foo';

bar
              `.trim();
            });

            it('removes that import and leaves one newline', () => {
              expect(subject()).toEqual(`
// I'm a comment

bar
              `.trim());
            });
          });
        });

        describe('and there is no previous whitespace', () => {
          beforeEach(() => {
            text = `
import foo from 'bar/foo';
bar
            `.trim();
          });

          it('removes that import and leaves no whitespace', () => {
            expect(subject()).toEqual(`
bar
            `.trim());
          });
        });
      });
    });

    describe('when the file consists of one line only', () => {
      describe('and that line is an import', () => {
        beforeEach(() => {
          text = "import foo from 'bar/foo';";
        });

        it('removes that import and leaves no whitespace', () => {
          expect(subject()).toEqual('');
        });

        it('displays a message', () => {
          subject();
          expect(result.messages).toEqual([
            'Removed `foo`.',
          ]);
        });
      });

      describe('and that line is not an import', () => {
        beforeEach(() => {
          text = 'const a = <span/>;';
        });

        it('leaves the file intact', () => {
          expect(subject()).toEqual(text);
        });

        it('does not tell you it removed `a`', () => {
          subject();
          expect(result.messages).toEqual([]);
        });
      });
    });

    describe('when multiple unused imports exist', () => {
      beforeEach(() => {
        text = `
import bar from 'foo/bar';
import baz from 'bar/baz';
import foo from 'bar/foo';

baz
        `.trim();
      });

      it('removes all unused imports', () => {
        expect(subject()).toEqual(`
import baz from 'bar/baz';

baz
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Removed 2 imports.',
        ]);
      });
    });

    describe('when an unused import and an undefined import exists', () => {
      beforeEach(() => {
        existingFiles = ['bar/foo.jsx'];
        text = `
import bar from 'foo/bar';

foo
        `.trim();
      });

      it('removes the unused import and adds the missing one', () => {
        expect(subject()).toEqual(`
import foo from './bar/foo';

foo
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Imported `foo`. Removed `bar`.',
        ]);
      });
    });

    describe('when a named import has an unused variable', () => {
      beforeEach(() => {
        text = `
import { bar, foo } from 'baz';

bar
        `.trim();
      });

      it('removes that variable from the named imports list', () => {
        expect(subject()).toEqual(`
import { bar } from 'baz';

bar
        `.trim());
      });

      it('displays a message', () => {
        expect(result.messages).toEqual([
          'Removed `foo`.',
        ]);
      });
    });

    describe('when the last import is removed from a named import', () => {
      beforeEach(() => {
        text = `
import bar from 'bar';
import { foo } from 'baz';

bar
        `.trim();
      });

      it('removes the whole import', () => {
        expect(subject()).toEqual(`
import bar from 'bar';

bar
        `.trim());
      });
    });

    describe('when an unused variable that shares its name with an import exists', () => {
      beforeEach(() => {
        text = `
import uuid from 'uuid';

function bar() {
  return uuid.v4();
}

export default function foo() {
  const things = {
    uuid: bar(),
    henric: 'is cool',
  };

  const { uuid, henric } = things;
  return henric;
}
        `.trim();
      });

      it('does not remove the import', () => {
        expect(subject()).toEqual(text);
      });

      it('does not display any message', () => {
        subject();
        expect(result.messages).toEqual([]);
      });
    });
  });

  describe('#rewriteImports', () => {
    let subject;

    beforeEach(() => {
      existingFiles = ['baz.jsx'];
      configuration.namedExports = {
        bar: ['foo'],
      };
      packageDependencies = ['bar'];
      pathToCurrentFile = 'bilbo/frodo.js';

      subject = () => {
        setup();
        return new Importer(text.split('\n'), pathToCurrentFile).
          rewriteImports().fileContent;
      };
    });


    describe('when imports exist', () => {
      beforeEach(() => {
        text = `
import baz from '../baz';
import bar, { foo } from 'bar';

bar
        `.trim();
      });

      describe('and we are not changing anything in config', () => {
        it('only sorts and groups imports', () => {
          expect(subject()).toEqual(`
import bar, { foo } from 'bar';

import baz from '../baz';

bar
          `.trim());
        });
      });

      describe('and `groupImports` is false', () => {
        beforeEach(() => {
          configuration.groupImports = false;
        });

        it('sorts imports', () => {
          expect(subject()).toEqual(`
import bar, { foo } from 'bar';
import baz from '../baz';

bar
          `.trim());
        });
      });

      describe('and we are switching declarationKeyword to `const`', () => {
        beforeEach(() => {
          configuration.declarationKeyword = 'const';
        });

        it('groups, sorts, and changes imports to use `const`', () => {
          expect(subject()).toEqual(`
const bar = require('bar');
const { foo } = require('bar');

const baz = require('../baz');

bar
          `.trim());
        });
      });
    });

    describe('when imports use a mix of relative and normal paths', () => {
      beforeEach(() => {
        text = `
import bar, { foo } from 'bar';
import baz from '../baz';

bar
        `.trim();
      });

      describe('and we are turning relative paths off', () => {
        beforeEach(() => {
          configuration.useRelativePaths = false;
        });

        it('sorts, groups, and changes to absolute paths', () => {
          expect(subject()).toEqual(`
import bar, { foo } from 'bar';

import baz from 'baz';

bar
          `.trim());
        });
      });
    });

    describe('when imports use normal paths', () => {
      beforeEach(() => {
        text = `
import bar, { foo } from 'bar';
import baz from 'baz';

bar
        `.trim();
      });

      describe('and we are turning relative paths on', () => {
        beforeEach(() => {
          configuration.useRelativePaths = true;
        });

        it('sorts, groups, and changes to relative paths', () => {
          expect(subject()).toEqual(`
import bar, { foo } from 'bar';

import baz from '../baz';

bar
          `.trim());
        });
      });
    });
  });

  describe('#goto', () => {
    let subject;
    let result;

    beforeEach(() => {
      subject = () => {
        setup();
        result = new Importer(text.split('\n'), pathToCurrentFile).goto(word);
        return result.goto;
      };
    });

    describe('with a variable name that will resolve', () => {
      beforeEach(() => {
        existingFiles = ['bar/foo.jsx'];
      });

      it('opens the file', () => {
        expect(subject()).toEqual('bar/foo.jsx');
      });

      it('does not show a message', () => {
        subject();
        expect(result.messages).toEqual([]);
      });
    });

    describe('with a variable name that will not resolve', () => {
      beforeEach(() => {
        existingFiles = ['bar/goo.jsx'];
      });

      it('opens nothing', () => {
        expect(subject()).toBeUndefined();
      });

      it('shows a message', () => {
        subject();
        expect(result.messages).toEqual([
          'No JS module found for `foo`',
        ]);
      });

      describe('when there is a current import for the variable', () => {
        beforeEach(() => {
          text = `
import foo from 'some-package';

foo
          `.trim();
        });

        describe('not matching a package dependency', () => {
          it('opens the import path', () => {
            expect(subject()).toEqual('some-package');
          });
        });

        describe('matching a package dependency', () => {
          beforeEach(() => {
            packageDependencies = ['some-package'];
          });

          it('opens the package main file', () => {
            expect(subject()).toEqual(
              'node_modules/some-package/some-package-main.jsx');
          });
        });
      });
    });

    describe('with a variable name that will resolve to a package dependency', () => {
      beforeEach(() => {
        packageDependencies = ['foo'];
      });

      it('opens the `main` file', () => {
        expect(subject()).toEqual('node_modules/foo/foo-main.jsx');
      });
    });

    describe('with a variable name matching an alias', () => {
      beforeEach(() => {
        word = 'styles';
        pathToCurrentFile = '/foo/bar/current.js';
      });

      describe('to a relative resource', () => {
        beforeEach(() => {
          configuration.aliases = { styles: './index.scss' };
        });

        it('opens the file relative to the file being edited', () => {
          expect(subject()).toEqual('/foo/bar/index.scss');
        });
      });

      describe('to an absolute resource', () => {
        beforeEach(() => {
          configuration.aliases = { styles: 'stylez' };
          packageDependencies = ['stylez'];
        });

        it('opens the alias main file', () => {
          expect(subject()).toEqual('node_modules/stylez/stylez-main.jsx');
        });
      });
    });

    describe('with a variable name that matches multiple files', () => {
      beforeEach(() => {
        existingFiles = [
          'bar/foo.jsx',
          'car/foo.jsx',
        ];
      });

      describe('when the variable has not been previously imported', () => {
        it('displays a message about selecting a module', () => {
          subject();
          expect(result.unresolvedImports).toEqual({
            foo: [
              {
                displayName: './bar/foo',
                importPath: './bar/foo',
                filePath: 'bar/foo.jsx',
              },
              {
                displayName: './car/foo',
                importPath: './car/foo',
                filePath: 'car/foo.jsx',
              },
            ],
          });
        });

        it('does not open the file', () => {
          expect(subject()).not.toBeDefined();
        });
      });

      describe('when the variable has been previously imported', () => {
        describe('as a default import', () => {
          beforeEach(() => {
            text = `
import foo from './bar/foo';

foo
            `.trim();
          });

          it('opens the file', () => {
            expect(subject()).toEqual('bar/foo.jsx');
          });

          describe('and there are other imports', () => {
            beforeEach(() => {
              text = `
import bar from './foo/bar';
import foo from './bar/foo';
import foobar from './bar/foobar';

foo
              `.trim();
            });

            it('opens the file', () => {
              expect(subject()).toEqual('bar/foo.jsx');
            });
          });
        });

        describe('as a named import', () => {
          beforeEach(() => {
            text = `
import { foo } from './bar/foo';

foo
            `.trim();
          });

          it('opens the file', () => {
            expect(subject()).toEqual('bar/foo.jsx');
          });
        });
      });
    });
  });
});
