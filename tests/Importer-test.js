const child_process = require('child_process');
const path = require('path');

const mkdirp = require('mkdirp');

const CommandLineEditor = require('../lib/CommandLineEditor');
const Importer = require('../lib/Importer');

describe(Importer, () => {
  beforeEach(() => {
    this.tmpDir = './tmp';
    fs.mkdirSync(this.tmpDir);

    this.word = 'foo';
    this.text = 'foo';
    this.existingFiles = [];
    this.packageJsonContent = undefined;
    this.packageDependencies = [];
    this.pathToCurrentFile = this.tmpDir + '/test.js';
    this.configuration = {
      lookup_paths: path.basename(this.tmpDir),
    };
    this.selections = {};
    this.editor = new CommandLineEditor(text.split("\n"), {
      word: word,
      path_to_file: path_to_current_file,
      selections: selections
    });
  });

  beforeEach(() => {
    const allow = (object, methodName, matrix) => {
      spyOn(object, methodName).and.callFake(function(original, arg) {
        if (Object.keys(matrix).includes(arg)) {
          return matrix[arg];
        }
        return original(arg);
      }.bind(object, object[methodName]));
    };

    allow(fs, 'existsSync', {
     '.importjs.json': true,
     'package.json': true,
    });

    allow(fs, 'readFileSync', {
     '.importjs.json': JSON.stringify(this.configuration),
     'package.json': JSON.stringify({
       dependencies: this.packageDependencies,
     }),
    });

    this.existingFiles.forEach((file) => {
      const fullPath = this.tmpDir + '/' + file;
      mkdirp.sync(path.dirname(fullPath))
      fs.closeSync(fs.openSync(fullPath, 'w')); // touch
    });

    package_dependencies.each do |dep|
      allow(File).to receive(:exist?)
        .with(`node_modules/${dep}/package.json`)
        .and_return(true)
      allow(File).to receive(:read)
        .with(`node_modules/${dep}/package.json`)
        .and_return(`{ \"main\": \"${dep}-main.jsx\" }`)
    });

    if package_json_content
      File.open(File.join(tmp_dir, 'Foo/package.json'), 'w') do |f|
        f.write(package_json_content.to_json)
      });
    });
  });

  afterEach(() => {
    child_process.execSync(`rm -r ./tmp`);
  });

  describe '#import' do
    subject do
      described_class.new(editor).import
      editor.current_file_content
    });

    describe('when lookup_paths is just an empty string', () => {
      this.configuration = { lookup_paths: [''] };

      it('throws an error', () => {
        expect { subject }.to raise_error(ImportJS::FindError)
      });
    });

    describe('with a variable name that will not resolve', () => {
      it('leaves the buffer unchanged', () => {
        expect(this.subject()).toEqual(text)});
      });

      it('displays a message', () => {
        subject
        expect(editor.messages).to start_with(
          `ImportJS: No JS module to import for variable `${word}``)
      });
    });

    describe('with no word under the cursor', () => {
      this.word = '';

      it('leaves the buffer unchanged', () => {
        expect(this.subject()).toEqual(text)});
      });

      it('displays a message', () => {
        subject
        expect(editor.messages).to eq(
          'ImportJS: No variable to import. Place your cursor on a variable, '\
          'then try again.'
        )
      });
    });

    describe('with a variable name that will resolve', () => {
      this.existing_files = ['bar/foo.jsx'];

      it('adds an import to the top of the buffer', () => {
        expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
        `.trim();
      });

      it('displays a message about the imported module', () => {
        subject
        expect(editor.messages).to start_with(
          'ImportJS: Imported `bar/foo`')
      });

      describe('when that import is already imported', () => {
        this.text = `;
import foo from 'bar/foo';

foo
        `.trim();

        it('leaves the buffer unchanged', () => {
          expect(this.subject()).toEqual(text)});
        });

        describe('when there is a blank line above the import', () => {
          this.text = <<-`.trim();.rstrip;

import foo from 'bar/foo';

foo
          `.trim();

          it('removes the blank line from the top', () => {
            expect(this.subject()).toEqual(text.strip)});
          });
        });
      });

      describe("when 'use strict' is at the top of the file", () => {
        this.text = `;
'use strict';

foo
        `.trim();

        it('adds the import below', () => {
          expect(this.subject()).toEqual(`)});
'use strict';

import foo from 'bar/foo';

foo
          `.trim();
        });

        describe("when 'use strict' is at the top of the file twice", () => {
          this.text = `;
'use strict';
'use strict';

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
'use strict';
'use strict';

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when a one-line comment is at the top of the file', () => {
          this.text = `;
// One-line comment

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
// One-line comment

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when multiple one-line comments are at the top of the file', () => {
          this.text = `;
// One-line comment
// Another one-line comment

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
// One-line comment
// Another one-line comment

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when just an empty line is at the top', () => {
          this.text = <<-`.trim();.rstrip;

foo
          `.trim();

          it('does not preserve the empty line', () => {
            expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when an empty line precedes a comment', () => {
          this.text = <<-`.trim();.rstrip;

// One-line comment

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(<<-`.trim();.rstrip)});

// One-line comment

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when one-line comments with empty lines are at the top', () => {
          this.text = `;
// One-line comment

// Another one-line comment

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
// One-line comment

// Another one-line comment

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when a multi-line comment is at the top of the file', () => {
          this.text = `;
/* Multi-line comment */

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
/* Multi-line comment */

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when a multi-line comment that spans lines is at the top', () => {
          this.text = `;
/*
  Multi-line comment
  that spans multiple lines
*/

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
/*
  Multi-line comment
  that spans multiple lines
*/

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when a multi-line comment is stacked weirdly', () => {
          this.text = `;
/* Single-line multi-line comment *//*
  Multi-line comment
  that spans multiple lines
*/

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
/* Single-line multi-line comment *//*
  Multi-line comment
  that spans multiple lines
*/

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when both comment styles are at the top of the file', () => {
          this.text = `;
// One-line comment
/* Multi-line comment */

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
// One-line comment
/* Multi-line comment */

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe("when comments and 'use strict' are at the top of the file", () => {
          this.text = `;
'use strict';
// One-line comment
/* Multi-line comment */

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
'use strict';
// One-line comment
/* Multi-line comment */

import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('when the variable name matches last folder+filename', () => {
          this.existing_files = ['sko/bar/foo.jsx'];
          this.word = 'barFoo';
          this.text = 'barFoo';

          it('resolves the import', () => {
            expect(this.subject()).toEqual(`)});
import barFoo from 'sko/bar/foo';

barFoo
            `.trim();
          });

          describe('when the last folder });s with an "s"', () => {
            this.existing_files = ['sko/bars/foo.jsx'];

            it('resolves the import', () => {
              expect(this.subject()).toEqual(`)});
import barFoo from 'sko/bars/foo';

barFoo
              `.trim();
            });

            describe('when the variable also has "s" at the });', () => {
              this.word = 'barsFoo';
              this.text = 'barsFoo';

              it('resolves the import', () => {
                expect(this.subject()).toEqual(`)});
import barsFoo from 'sko/bars/foo';

barsFoo
                `.trim();
              });
            });
          });

          describe('when the last folder });s with "es"', () => {
            this.existing_files = ['sko/statuses/foo.jsx'];
            this.word = 'statusFoo';
            this.text = 'statusFoo';

            it('resolves the import', () => {
              expect(this.subject()).toEqual(`)});
import statusFoo from 'sko/statuses/foo';

statusFoo
              `.trim();
            });

            describe('when the variable also has "es" at the });', () => {
              this.word = 'statusesFoo';
              this.text = 'statusesFoo';

              it('resolves the import', () => {
                expect(this.subject()).toEqual(`)});
import statusesFoo from 'sko/statuses/foo';

statusesFoo
                `.trim();
              });
            });
          });
        });

        describe('when the variable name matches a few folders + filename', () => {
          this.existing_files = ['sko/bar/foo/ta.jsx'];
          this.word = 'BarFooTa';
          this.text = 'BarFooTa';

          it('resolves the import', () => {
            expect(this.subject()).toEqual(`)});
import BarFooTa from 'sko/bar/foo/ta';

BarFooTa
            `.trim();
          });

          describe('when the folders }); with "s"', () => {
            this.existing_files = ['sko/bars/foos/ta.jsx'];

            it('resolves the import', () => {
              expect(this.subject()).toEqual(`)});
import BarFooTa from 'sko/bars/foos/ta';

BarFooTa
              `.trim();
            });

            describe('when the variable also has "s"', () => {
              this.word = 'BarsFoosTa';
              this.text = 'BarsFoosTa';

              it('resolves the import', () => {
                expect(this.subject()).toEqual(`)});
import BarsFoosTa from 'sko/bars/foos/ta';

BarsFoosTa
                `.trim();
              });
            });
          });

          describe('when the folders }); with "es"', () => {
            this.existing_files = ['sko/statuses/buses/ta.jsx'];
            this.word = 'statusBusTa';
            this.text = 'statusBusTa';

            it('resolves the import', () => {
              expect(this.subject()).toEqual(`)});
import statusBusTa from 'sko/statuses/buses/ta';

statusBusTa
              `.trim();
            });

            describe('when the variable also has "es"', () => {
              this.word = 'StatusesBusesTa';
              this.text = 'StatusesBusesTa';

              it('resolves the import', () => {
                expect(this.subject()).toEqual(`)});
import StatusesBusesTa from 'sko/statuses/buses/ta';

StatusesBusesTa
                `.trim();
              });
            });
          });
        });

        describe("when there are other imports under 'use strict'", () => {
          this.text = `;
'use strict';
import bar from 'bar';

foo + bar
          `.trim();

          it('adds the import at the right place', () => {
            expect(this.subject()).toEqual(`)});
'use strict';
import bar from 'bar';
import foo from 'bar/foo';

foo + bar
            `.trim();
          });
        });

        describe("when there is no newline under a lonely 'use strict'", () => {
          this.text = `;
'use strict';
foo + bar
          `.trim();

          it('adds a newline as part of importing ', () => {
            expect(this.subject()).toEqual(`)});
'use strict';
import foo from 'bar/foo';

foo + bar
            `.trim();
          });
        });

        describe('when "use strict" is within double quotes', () => {
          this.text = `;
"use strict";

foo
          `.trim();

          it('adds the import below', () => {
            expect(this.subject()).toEqual(`)});
"use strict";

import foo from 'bar/foo';

foo
            `.trim();
          });
        });
      });

      describe('when the variable resolves to a node.js conventional module', () => {
        this.existing_files = ['Foo/index.jsx'];

        it('adds an import to the top of the buffer', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'Foo';

foo
          `.trim();
        });

        it('displays a message about the imported module', () => {
          subject
          expect(editor.messages).to start_with(
            'ImportJS: Imported `Foo (main: index.jsx)`')
        });

        describe('when that module has a dot in its name', () => {
          this.existing_files = ['Foo.io/index.jsx'];
          this.word = 'FooIO';
          this.text = 'FooIO';

          it('imports that module with the dot', () => {
            expect(this.subject()).toEqual(`)});
import FooIO from 'Foo.io';

FooIO
            `.trim();
          });
        });
      });

      describe('in a node environment', () => {
        this.word = 'Readline';
        this.text = 'Readline';

        let(:configuration) do
          super().merge('environments' => ['node'])
        });

        it('adds an import to the top of the buffer', () => {
          expect(this.subject()).toEqual(`)});
import Readline from 'readline';

Readline
          `.trim();
        });
      });

      describe('when the import resolves to a dependency from package.json', () => {
        this.existing_files = [];
        this.package_dependencies = ['foo-bar'];
        this.word = 'fooBar';
        this.text = 'fooBar';

        it('adds an import to the top of the buffer', () => {
          expect(this.subject()).toEqual(`)});
import fooBar from 'foo-bar';

fooBar
          `.trim();
        });

        it('displays a message about the imported module', () => {
          subject
          expect(editor.messages).to start_with(
            'ImportJS: Imported `foo-bar (main: foo-bar-main.jsx)`')
        });

        describe('with an `ignore_package_prefixes` configuration', () => {
          let(:configuration) do
            super().merge('ignore_package_prefixes' => ['foo-'])
          });

          describe('when the variable has the prefix', () => {
            it('still imports the package', () => {
              expect(this.subject()).toEqual(`)});
import fooBar from 'foo-bar';

fooBar
              `.trim();
            });
          });

          describe('when the variable does not have the prefix', () => {
            this.word = 'bar';
            this.text = 'bar';

            it('imports the package', () => {
              expect(this.subject()).toEqual(`)});
import bar from 'foo-bar';

bar
              `.trim();
            });
          });

          describe('when a package matches the prefix but not the word', () => {
            this.word = 'baz';
            this.text = 'baz';

            it('leaves the buffer unchanged', () => {
              expect(this.subject()).toEqual(`)});
baz
              `.trim();
            });
          });
        });
      });

      describe('when other imports exist', () => {
        this.text = `;
import zoo from 'foo/zoo';
import bar from 'foo/bar';

foo
        `.trim();

        it('adds the import and sorts the entire list', () => {
          expect(this.subject()).toEqual(`)});
import bar from 'foo/bar';
import foo from 'bar/foo';
import zoo from 'foo/zoo';

foo
          `.trim();
        });

        describe('when there are unconventional imports in the list', () => {
          # e.g. added through using the `import_function` configuration option
          this.text = `;
const sko = customImportFunction('sko');
import zoo from 'foo/zoo';
import bar from 'foo/bar';

foo
          `.trim();

          it('adds the import and sorts the entire list with groups', () => {
            expect(this.subject()).toEqual(`)});
import bar from 'foo/bar';
import foo from 'bar/foo';
import zoo from 'foo/zoo';

const sko = customImportFunction('sko');

foo
            `.trim();
          });

          describe('and `group_imports` is false', () => {
            let(:configuration) do
              super().merge('group_imports' => false)
            });

            it('adds the import and sorts all of them', () => {
              expect(this.subject()).toEqual(`)});
import bar from 'foo/bar';
import foo from 'bar/foo';
const sko = customImportFunction('sko');
import zoo from 'foo/zoo';

foo
              `.trim();
            });
          });
        });
      });

      describe('when there is an unconventional import', () => {
        this.text = `;
import zoo from 'foo/zoo';
import tsar from 'foo/bar').tsa;

foo
        `.trim();

        it('adds the import and moves out the unconventional import', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';
import zoo from 'foo/zoo';

import tsar from 'foo/bar').tsa;

foo
        `.trim();
        });
      });

      describe('when there is a non-import inline with the imports', () => {
        this.text = `;
import bar from 'bar';
import star from
  'star';
var { STRAWBERRY, CHOCOLATE } = bar.scoops;
import zoo from 'foo/zoo';

foo
        `.trim();

        it('breaks imports at that line', () => {
          # A better solution would perhaps be to find the `var zoo` import and
          # move it up there with the rest. But there's a lot of complexity
          # involved in that, so cutting off at the non-import is a simpler
          # solution.
          expect(this.subject()).toEqual(`)});
import bar from 'bar';
import foo from 'bar/foo';
import star from
  'star';

var { STRAWBERRY, CHOCOLATE } = bar.scoops;
import zoo from 'foo/zoo';

foo
        `.trim();
        });
      });

      describe('when there is an import with line-breaks', () => {
        this.text = `;
import zoo from
  'foo/zoo';
import tsar from 'foo/bar';

var import_foo = { from: b }
        `.trim();

        it('adds the import, sorts the entire list and keeps the line-break', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';
import tsar from 'foo/bar';
import zoo from
  'foo/zoo';

var import_foo = { from: b }
        `.trim();
        });
      });

      describe('when there is a blank line amongst current imports', () => {
        this.text = `;
import zoo from 'foo/zoo';

import bar from 'foo/bar';
foo
        `.trim();

        it('adds the import, compacts, and sorts the entire list', () => {
          expect(this.subject()).toEqual(`)});
import bar from 'foo/bar';
import foo from 'bar/foo';
import zoo from 'foo/zoo';

foo
          `.trim();
        });
      });

      describe('when there are multiple blank lines amongst current imports', () => {
        this.text = `;
import zoo from 'foo/zoo';

import frodo from 'bar/frodo';


import bar from 'foo/bar';

foo
        `.trim();

        it('compacts the list', () => {
          expect(this.subject()).toEqual(`)});
import bar from 'foo/bar';
import foo from 'bar/foo';
import frodo from 'bar/frodo';
import zoo from 'foo/zoo';

foo
          `.trim();
        });
      });

      describe('when multiple files resolve the variable', () => {
        let(:existing_files) do
          [
            'bar/foo.jsx',
            'zoo/foo.js',
            'zoo/goo/Foo/index.js',
          ]
        });

        it('records the alternatives to choose from', () => {
          subject
          expect(editor.ask_for_selections).to include(
            word: 'foo',
            alternatives: [
              'bar/foo',
              'zoo/foo',
              'zoo/goo/Foo (main: index.js)',
            ]
          )
        });

        describe('and the user selects', () => {
          let(:selections) do
            {
              'foo' => selection,
            }
          });

          describe('the first alternative', () => {
            this.selection = 0;

            it('picks the first one', () => {
              expect(this.subject()).toEqual(<<-eos.strip)});
import foo from 'bar/foo';

foo
              eos
            });
          });

          describe('the second alternative', () => {
            this.selection = 1;

            it('picks the second one', () => {
              expect(this.subject()).toEqual(`)});
import foo from 'zoo/foo';

foo
              `.trim();
            });
          });

          describe('an index larger than the list', () => {
            # Apparently, this can happen when you use `inputlist`
            this.selection = 5;

            it('picks nothing', () => {
              expect(this.subject()).toEqual(`)});
foo
              `.trim();
            });
          });

          describe('an index < 0', () => {
            this.selection = -1;

            it('picks nothing', () => {
              expect(this.subject()).toEqual(`)});
foo
              `.trim();
            });
          });
        });
      });

      describe('when the same logical file is matched twice', () => {
        let(:existing_files) do
          [
            'Foo/lib/foo.jsx',
            'Foo/package.json',
            'zoo/foo.js',
          ]
        });

        let(:package_json_content) do
          {
            main: 'lib/foo.jsx',
          }
        });

        it('lists the version of the file resolved through package.json', () => {
          subject
          expect(editor.ask_for_selections[0][:alternatives]).to include(
            'Foo (main: lib/foo.jsx)')
        });

        it('does not list the file also resolved through package.json', () => {
          subject
          expect(editor.ask_for_selections[0][:alternatives]).to_not include(
            'Foo/lib/foo.jsx')
        });
      });
    });

    describe('importing a module with a package.json file', () => {
      this.existing_files = ['Foo/package.json', 'Foo/build/main.js'];

      describe('when `main` points to a JS file', () => {
        let(:package_json_content) do
          {
            main: 'build/main.js',
          }
        });

        it('adds an import to the top of the buffer', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'Foo';

foo
          `.trim();
        });
      });

      describe('when `main` points to index.js in the same folder', () => {
        this.existing_files = ['Foo/package.json', 'Foo/index.js'];

        let(:package_json_content) do
          {
            main: 'index.js',
          }
        });

        it('adds an import to the top of the buffer', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'Foo';

foo
          `.trim();
        });
      });

      describe('when the module is named something.js', () => {
        this.existing_files = ['Foo.js/package.json', 'Foo.js/main.js'];
        this.text = 'FooJS';
        this.word = 'FooJS';

        before do
          File.open(File.join(tmp_dir, 'Foo.js/package.json'), 'w') do |f|
            f.write({ main: 'main.js' }.to_json)
          });
        });

        it('keeps the .js in the import', () => {
          expect(this.subject()).toEqual(`)});
import FooJS from 'Foo.js';

FooJS
          `.trim();
        });
      });

      describe('when `main` is missing', () => {
        this.package_json_content = {};

        it('does not add an import', () => {
          expect(this.subject()).toEqual(`)});
foo
          `.trim();
        });
      });
    });

    describe 'line wrapping' do
      this.tab = '  ';
      let(:configuration) do
        super().merge(
          'max_line_length' => max_line_length,
          'tab' => tab
        )
      });

      describe('when lines exceed the configured max width', () => {
        this.max_line_length = 40;
        this.existing_files = ['fiz/bar/biz/baz/fiz/buz/boz/foo.jsx'];

        describe('when configured to use a tab character', () => {
          this.tab = "\t";

          it('wraps them and indents with a tab', () => {
            expect(this.subject()).toEqual(`)});
import foo from
	'fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
            `.trim();
          });
        });

        describe('when configured to use two spaces', () => {
          this.tab = '  ';

          it('wraps them and indents with two spaces', () => {
            expect(this.subject()).toEqual(`)});
import foo from
  'fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
            `.trim();
          });
        });
      });

      describe('when lines do not exceed the configured max width', () => {
        this.max_line_length = 80;
        this.existing_files = ['bar/foo.jsx'];

        it('does not wrap them', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
          `.trim();
        });
      });
    });

    describe('configuration', () => {
      describe('with aliases', () => {
        let(:configuration) do
          super().merge('aliases' => { '$' => 'jquery' })
        });
        this.text = '$';
        this.word = '$';

        it('resolves aliased imports to the aliases', () => {
          expect(this.subject()).toEqual(`)});
import $ from 'jquery';

$
        `.trim();
        });

        describe('and an alias has a dynamic {filename}', () => {
          let(:configuration) do
            super().merge('aliases' => { 'styles' => './{filename}.scss' })
          });
          this.text = 'styles';
          this.word = 'styles';
          this.path_to_current_file = 'bar/foo.jsx';

          it('uses the filename of the current file', () => {
            expect(this.subject()).toEqual(`)});
import styles from './foo.scss';

styles
            `.trim();
          });

          describe('when editing an anonymous file', () => {
            describe('that is nil', () => {
              this.path_to_current_file = nil;

              it('does not replace the dynamic part', () => {
                expect(this.subject()).toEqual(`)});
import styles from './{filename}.scss';

styles
                `.trim();
              });
            });

            describe('that is an empty string', () => {
              this.path_to_current_file = '';

              it('does not replace the dynamic part', () => {
                expect(this.subject()).toEqual(`)});
import styles from './{filename}.scss';

styles
                `.trim();
              });
            });
          });
        });

        describe('and an alias contains a slash', () => {
          # https://github.com/trotzig/import-js/issues/39
          let(:configuration) do
            super().merge('aliases' => { '$' => 'jquery/jquery' })
          });

          it('keeps the slash in the alias path', () => {
            expect(this.subject()).toEqual(`)});
import $ from 'jquery/jquery';

$
          `.trim();
          });
        });
      });

      describe('with `named_exports` object', () => {
        let(:configuration) do
          super().merge(
            'named_exports' => {
              'lib/utils' => %w[
                foo
                bar
              ],
            }
          )
        });
        this.text = 'foo';
        this.word = 'foo';

        it('resolves that import using named imports', () => {
          expect(this.subject()).toEqual(`)});
import { foo } from 'lib/utils';

foo
          `.trim();
        });
      });

      describe('using `var`, `aliases` and a `named_exports` object', () => {
        let(:configuration) do
          super().merge(
            'declaration_keyword' => 'var',
            'named_exports' => {
              'underscore' => %w[
                memoize
                debounce
              ],
            },
            'aliases' => {
              '_' => 'underscore',
            }
          )
        });
        this.text = '_';
        this.word = '_';

        it('resolves the main alias without destructuring', () => {
          expect(this.subject()).toEqual(`)});
var _ = require('underscore');

_
        `.trim();
        });

        describe('when a named import exists for the same module', () => {
          this.text = `;
var { memoize } = require('underscore');

_
          `.trim();

          it('adds the default import', () => {
            expect(this.subject()).toEqual(`)});
var _ = require('underscore');
var { memoize } = require('underscore');

_
            `.trim();
          });
        });

        describe('when importing a named export', () => {
          this.text = 'memoize';
          this.word = 'memoize';

          it('resolves that import using destructuring', () => {
            expect(this.subject()).toEqual(`)});
var { memoize } = require('underscore');

memoize
            `.trim();
          });

          it('displays a message about the imported module', () => {
            subject
            expect(editor.messages).to start_with(
              'ImportJS: Imported `memoize` from `underscore`')
          });

          describe('when the default import exists for the same module', () => {
            this.text = `;
var _ = require('underscore');

memoize
            `.trim();

            it('adds the destructuring on a new line', () => {
              expect(this.subject()).toEqual(`)});
var _ = require('underscore');
var { memoize } = require('underscore');

memoize
              `.trim();
            });
          });

          describe('when the default is already imported for destructured var', () => {
            this.text = `;
var _ = require('underscore');
var foo = require('foo');

memoize
            `.trim();

            it('adds the destructuring on a new line', () => {
              expect(this.subject()).toEqual(`)});
var _ = require('underscore');
var { memoize } = require('underscore');
var foo = require('foo');

memoize
              `.trim();
            });
          });

          describe('with other imports', () => {
            this.text = `;
const bar = require('foo/bar');
var { xyz } = require('alphabet');

memoize
            `.trim();

            it('places the import at the right place', () => {
              expect(this.subject()).toEqual(`)});
const bar = require('foo/bar');

var { memoize } = require('underscore');
var { xyz } = require('alphabet');

memoize
              `.trim();
            });
          });

          describe('when other destructured imports exist for the same module', () => {
            this.text = `;
var { xyz, debounce } = require('underscore');

memoize
            `.trim();

            it('combines the destructured import and sorts items', () => {
              expect(this.subject()).toEqual(`)});
var { debounce, memoize, xyz } = require('underscore');

memoize
              `.trim();
            });

            describe('when the module is already in the destructured object', () => {
              this.text = `;
var { debounce, memoize } = require('underscore');

memoize
              `.trim();

              it('does not add a duplicate', () => {
                expect(this.subject()).toEqual(`)});
var { debounce, memoize } = require('underscore');

memoize
                `.trim();
              });
            });
          });
        });
      });

      describe('alias with `import` and a `named_exports` object', () => {
        let(:configuration) do
          {
            'declaration_keyword' => 'import',
            'named_exports' => {
              'underscore' => %w[
                memoize
                debounce
              ],
            },
            'aliases' => {
              '_' => 'underscore',
            },
          }
        });
        this.text = '_';
        this.word = '_';

        it('resolves the main alias without a named import', () => {
          expect(this.subject()).toEqual(`)});
import _ from 'underscore';

_
        `.trim();
        });

        describe('when a named import exists for the same module', () => {
          this.text = `;
import { memoize } from 'underscore';

_
          `.trim();

          it('adds the default import', () => {
            expect(this.subject()).toEqual(`)});
import _, { memoize } from 'underscore';

_
            `.trim();
          });
        });

        describe('when importing a named export', () => {
          this.text = 'memoize';
          this.word = 'memoize';

          it('uses a named import', () => {
            expect(this.subject()).toEqual(`)});
import { memoize } from 'underscore';

memoize
            `.trim();
          });

          describe('with other imports', () => {
            this.text = `;
import bar from 'foo/bar';
import { xyz } from 'alphabet';

memoize
            `.trim();

            it('places the import at the right place', () => {
              expect(this.subject()).toEqual(`)});
import { memoize } from 'underscore';
import { xyz } from 'alphabet';
import bar from 'foo/bar';

memoize
              `.trim();
            });
          });

          describe('when other named imports exist for the same module', () => {
            this.text = `;
import { xyz, debounce } from 'underscore';

memoize
            `.trim();

            it('combines the named import and sorts items', () => {
              expect(this.subject()).toEqual(`)});
import { debounce, memoize, xyz } from 'underscore';

memoize
              `.trim();
            });

            describe('when the module is already in the named imports', () => {
              this.text = `;
import { debounce, memoize, xyz } from 'underscore';

memoize
              `.trim();

              it('does not add a duplicate', () => {
                expect(this.subject()).toEqual(`)});
import { debounce, memoize, xyz } from 'underscore';

memoize
                `.trim();
              });
            });
          });

          describe('when a default import exists for the same module', () => {
            this.text = `;
import _ from 'underscore';

memoize
            `.trim();

            it('adds the named import', () => {
              expect(this.subject()).toEqual(`)});
import _, { memoize } from 'underscore';

memoize
              `.trim();
            });

            describe('when the module is already in the named import', () => {
              this.text = `;
import _, { memoize } from 'underscore';

memoize
              `.trim();

              it('does not add a duplicate', () => {
                expect(this.subject()).toEqual(`)});
import _, { memoize } from 'underscore';

memoize
                `.trim();
              });
            });
          });
        });
      });

      describe('with a custom `import_function`', () => {
        this.existing_files = ['bar/foo.js'];

        describe('and `declaration_keyword=import`', () => {
          let(:configuration) do
            super().merge(
              'import_function' => 'myRequire',
              'declaration_keyword' => 'import'
            )
          });

          it('does nothing special', () => {
            expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('and `declaration_keyword=const`', () => {
          let(:configuration) do
            super().merge(
              'import_function' => 'myRequire',
              'declaration_keyword' => 'const'
            )
          });

          it('uses the custom import function instead of "require"', () => {
            expect(this.subject()).toEqual(`)});
const foo = myRequire('bar/foo');

foo
            `.trim();
          });
        });
      });

      describe('when strip_file_extensions is empty', () => {
        this.existing_files = ['bar/foo.js'];
        let(:configuration) do
          super().merge('strip_file_extensions' => [])
        });

        it('keeps the file });ing in the import', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'bar/foo.js';

foo
          `.trim();
        });
      });

      describe('with excludes', () => {
        this.existing_files = ['bar/foo/foo.js'];
        let(:configuration) do
          super().merge('excludes' => ['**/foo/**'])
        });

        it('does not add an import', () => {
          expect(this.subject()).toEqual(`)});
foo
          `.trim();
        });

        it('displays a message', () => {
          subject
          expect(editor.messages).to start_with(
            `ImportJS: No JS module to import for variable `${word}``)
        });
      });

      describe('with declaration_keyword=const', () => {
        let(:configuration) do
          super().merge('declaration_keyword' => 'const')
        });

        describe('with a variable name that will resolve', () => {
          this.existing_files = ['bar/foo.jsx'];

          it('adds an import to the top using the declaration_keyword', () => {
            expect(this.subject()).toEqual(`)});
const foo = require('bar/foo');

foo
            `.trim();
          });

          describe('when that variable is already imported using `var`', () => {
            this.text = `;
var foo = require('bar/foo');

foo
            `.trim();

            it('changes the `var` to declaration_keyword', () => {
              expect(this.subject()).toEqual(`)});
const foo = require('bar/foo');

foo
              `.trim();
            });
          });

          describe('when the import contains a line-break', () => {
            this.text = `;
var foo =
  require('bar/foo');

foo
            `.trim();

            it('changes the `var` to declaration_keyword and removes space', () => {
              expect(this.subject()).toEqual(`)});
const foo = require('bar/foo');

foo
              `.trim();
            });
          });

          describe('when other imports exist', () => {
            this.text = `;
var zoo = require('foo/zoo');
let bar = require('foo/bar');

foo
            `.trim();

            it('adds the import and sorts and groups the entire list', () => {
              expect(this.subject()).toEqual(`)});
const foo = require('bar/foo');

var zoo = require('foo/zoo');

let bar = require('foo/bar');

foo
            `.trim();
            });
          });
        });
      });

      describe('with declaration_keyword=import', () => {
        let(:configuration) do
          super().merge('declaration_keyword' => 'import')
        });

        describe('with a variable name that will resolve', () => {
          this.existing_files = ['bar/foo.jsx', 'bar/fromfoo.jsx'];

          describe('when that variable is already imported using `var`', () => {
            this.text = `;
var foo = require('bar/foo');

foo
            `.trim();

            it('changes the `var` to declaration_keyword', () => {
              expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
              `.trim();
            });
          });

          describe('when that variable already exists with a different style', () => {
            this.text = `;
var foo = require("bar/foo");

foo
            `.trim();

            it('changes `var` to declaration_keyword and doubles to singles', () => {
              expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
              `.trim();
            });
          });

          describe('when the imported variable has "from" in it', () => {
            this.word = 'fromfoo';
            this.text = `;
var fromfoo = require('bar/fromfoo');

fromfoo
            `.trim();

            it('changes the `var` to declaration_keyword', () => {
              expect(this.subject()).toEqual(`)});
import fromfoo from 'bar/fromfoo';

fromfoo
              `.trim();
            });
          });

          describe('when the import contains a line-break', () => {
            this.text = `;
var foo =
  require('bar/foo');

foo
            `.trim();

            it('changes the `var` to declaration_keyword and removes space', () => {
              expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
              `.trim();
            });
          });

          describe('when other imports exist', () => {
            this.text = `;
var zoo = require('foo/zoo');
let bar = require('foo/bar');

foo
            `.trim();

            it('adds the import and sorts and groups the entire list', () => {
              expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

var zoo = require('foo/zoo');

let bar = require('foo/bar');

foo
            `.trim();
            });
          });
        });
      });

      describe('with `use_relative_paths=true`', () => {
        this.existing_files = ['bar/foo.jsx'];
        this.text = `;
foo
        `.trim();

        let(:configuration) do
          super().merge('use_relative_paths' => true)
        });

        describe('when the current file is in the same lookup_path', () => {
          this.path_to_current_file = File.join(tmp_dir, 'bar/current.js');

          it('uses a relative import path', () => {
            expect(this.subject()).toEqual(`)});
import foo from './foo';

foo
            `.trim();
          });
        });

        describe('when the current file is not in the same lookup_path', () => {
          this.path_to_current_file = '/foo/bar/current.js';

          it('does not use a relative import path', () => {
            expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
            `.trim();
          });
        });
      });

      describe('with local configuration defined in the main config file', () => {
        this.pattern = 'foo/**';
        this.existing_files = ['bar/foo.jsx'];
        this.path_to_current_file = 'foo/bar.js';
        let(:configuration) do
          [
            super(),
            {
              'applies_to' => pattern,
              'declaration_keyword' => 'var',
            },
          ]
        });

        this.text = 'foo';
        this.word = 'foo';

        describe('when the pattern matches the file being edited', () => {
          it('uses local config', () => {
            expect(this.subject()).toEqual(`)});
var foo = require('bar/foo');

foo
            `.trim();
          });
        });

        describe('when the pattern does not match the file being edited', () => {
          this.pattern = 'car/**';

          it('falls back to default config', () => {
            expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
            `.trim();
          });
        });

        describe('with an applies_from pattern', () => {
          this.from_pattern = `${File.basename(tmp_dir)}/bar/**`;
          this.path_to_current_file = `${File.basename(tmp_dir)}/foo/bar.js`;
          let(:configuration) do
            super() << {
              'applies_from' => from_pattern,
              'declaration_keyword' => 'var',
              'import_function' => 'quack',
              'use_relative_paths' => true,
              'strip_file_extensions' => [],
            }
          });

          describe('that matches the path of the file being imported', () => {
            it('uses local config', () => {
              expect(this.subject()).toEqual(`)});
var foo = quack('../bar/foo.jsx');

foo
              `.trim();
            });

            describe('when using `.` as lookup_path', () => {
              let(:configuration) do
                [{
                  'lookup_paths' => ['.'],
                }].concat(super())
              });

              it('uses local config', () => {
                expect(this.subject()).toEqual(`)});
var foo = quack('../bar/foo.jsx');

foo
                `.trim();
              });
            });
          });

          describe('that does not match the file being imported', () => {
            this.from_pattern = 'foo/**';

            it('falls back to default config', () => {
              expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
              `.trim();
            });
          });
        });
      });
    });
  });

  describe '#fix_imports' do
    this.eslint_result = '';
    let(:eslint_error)  { '' }
    before do
      allow(Open3).to receive(:capture3).and_call_original
      allow(Open3).to receive(:capture3).with(/eslint/, anything)
        .and_return([eslint_result, eslint_error])
    });

    subject do
      described_class.new(editor).fix_imports
      editor.current_file_content
    });

    it('calls out to global eslint', () => {
      expect(Open3).to receive(:capture3).with(/\Aeslint /, any_args)
      subject
    });

    describe('with eslint_executable configuration', () => {
      this.eslint_executable = 'node_modules/.bin/eslint';
      let(:configuration) do
        super().merge('eslint_executable' => 'node_modules/.bin/eslint')
      });

      it('calls out to the configured eslint executable', () => {
        command = Regexp.escape(eslint_executable)
        expect(Open3).to receive(:capture3).with(/\A#{command} /, any_args)
        subject
      });
    });

    describe('with an eslint_executable that can not be found', () => {
      let(:eslint_error) do
        'node_modules/.bin/eslink: No such file or directory'
      });

      it('throws an error', () => {
        expect { subject }.to raise_error(ImportJS::ParseError)
      });
    });

    describe('when no undefined variables exist', () => {
      it('leaves the buffer unchanged', () => {
        expect(this.subject()).toEqual(text)});
      });
    });

    describe('when eslint can not parse', () => {
      let(:eslint_result) do
        'stdin: line 1, col 1, Error - Parsing error: Unexpected token ILLEGAL'
      });

      it('throws an error', () => {
        expect { subject }.to raise_error(ImportJS::ParseError)
      });
    });

    describe('when one undefined variable exists', () => {
      this.existing_files = ['bar/foo.jsx'];
      let(:eslint_result) do
        'stdin:3:11: "foo" is not defined. [Error/no-undef]'
      });

      it('imports that variable', () => {
        expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
        `.trim();
      });

      describe('when the variable name is wrapped in single quotes', () => {
        # Undefined jsx variables are wrapped in single quotes

        let(:eslint_result) do
          "stdin:3:11: 'foo' is not defined. [Error/no-undef]"
        });

        it('imports that import', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
          `.trim();
        });
      });

      describe('when eslint returns other issues', () => {
        let(:eslint_result) do
          'stdin:1:1: Use the function form of "use strict". ' \
          "[Error/strict]\n" \
          'stdin:3:11: "foo" is not defined. [Error/no-undef]'
        });

        it('still imports the import', () => {
          expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
          `.trim();
        });
      });
    });

    describe('when multiple undefined variables exist', () => {
      this.existing_files = ['bar/foo.jsx', 'bar.js'];
      this.text = 'var a = foo + bar;';

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" \
        'stdin:3:11: "bar" is not defined. [Error/no-undef]'
      });

      it('imports all variables', () => {
        expect(this.subject()).toEqual(`)});
import bar from 'bar';
import foo from 'bar/foo';

var a = foo + bar;
        `.trim();
      });
    });

    describe('when the list of undefined variables has duplicates', () => {
      this.existing_files = ['bar/foo.jsx', 'bar.js'];
      this.text = 'var a = foo + bar;';

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" \
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" \
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" \
        'stdin:3:11: "bar" is not defined. [Error/no-undef]'
      });

      it('imports all variables', () => {
        expect(this.subject()).toEqual(`)});
import bar from 'bar';
import foo from 'bar/foo';

var a = foo + bar;
        `.trim();
      });
    });

    describe('when an implicit React import is missing', () => {
      this.text = 'var a = <span/>;';

      let(:eslint_result) do
        "stdin:3:11: 'React' must be in scope when using JSX\n"
      });

      describe('when react is not available', () => {
        it('leaves the buffer unchanged', () => {
          expect(this.subject()).toEqual(`)});
var a = <span/>;
          `.trim();
        });
      });

      describe('when react is available', () => {
        this.package_dependencies = ['react'];

        it('imports React', () => {
          expect(this.subject()).toEqual(`)});
import React from 'react';

var a = <span/>;
          `.trim();
        });
      });
    });

    describe('when no unused variables exist', () => {
      it('leaves the buffer unchanged', () => {
        expect(this.subject()).toEqual(text)});
      });
    });

    describe('when one unused import exists', () => {
      this.text = `;
import foo from 'bar/foo';
import zar from 'foo/zar';

bar
      `.trim();
      let(:eslint_result) do
        'stdin:1:7: "foo" is defined but never used [Error/no-unused-vars]'
      });

      it('removes that import', () => {
        expect(this.subject()).toEqual(`)});
import zar from 'foo/zar';

bar
        `.trim();
      });

      describe('when that import is the last one', () => {
        this.text = `;
import foo from 'bar/foo';

bar
        `.trim();

        it('removes that import and leaves no whitespace', () => {
          expect(this.subject()).toEqual(`)});
bar
          `.trim();
        });

        describe('and there is a comment above', () => {
          this.text = `;
// I'm a comment
import foo from 'bar/foo';

bar
          `.trim();

          let(:eslint_result) do
            'stdin:2:7: "foo" is defined but never used [Error/no-unused-vars]'
          });

          it('removes that import and leaves no whitespace', () => {
            expect(this.subject()).toEqual(`)});
// I'm a comment
bar
            `.trim();
          });

          describe('with whitespace after the comment', () => {
            this.text = `;
// I'm a comment

import foo from 'bar/foo';

bar
            `.trim();

            let(:eslint_result) do
              'stdin:3:7: "foo" is defined but never used [Error/no-unused-vars]'
            });

            it('removes that import and leaves one newline', () => {
              expect(this.subject()).toEqual(`)});
// I'm a comment

bar
              `.trim();
            });
          });
        });

        describe('and there is no previous whitespace', () => {
          this.text = `;
import foo from 'bar/foo';
bar
          `.trim();

          it('removes that import and leaves no whitespace', () => {
            expect(this.subject()).toEqual(`)});
bar
            `.trim();
          });
        });
      });
    });

    describe('when one unused import exists and eslint uses single quotes', () => {
      this.text = `;
import bar from 'foo/bar';
import foo from 'bar/foo';

bar
      `.trim();
      let(:eslint_result) do
        "stdin:1:4: 'foo' is defined but never used [Error/no-unused-vars]"
      });

      it('removes that import', () => {
        expect(this.subject()).toEqual(`)});
import bar from 'foo/bar';

bar
        `.trim();
      });
    });

    describe('when multiple unused imports exist', () => {
      this.text = `;
import bar from 'foo/bar';
import baz from 'bar/baz';
import foo from 'bar/foo';

baz
      `.trim();

      let(:eslint_result) do
        'stdin:3:11: "foo" is defined but never used ' \
        "[Error/no-unused-vars]\n" \
        'stdin:3:11: "bar" is defined but never used [Error/no-unused-vars]'
      });

      it('removes all unused imports', () => {
        expect(this.subject()).toEqual(`)});
import baz from 'bar/baz';

baz
        `.trim();
      });
    });

    describe('when an unused import and an undefined import exists', () => {
      this.existing_files = ['bar/foo.jsx'];
      this.text = `;
import bar from 'foo/bar';

foo
      `.trim();

      let(:eslint_result) do
        'stdin:1:11: "bar" is defined but never used ' \
        "[Error/no-unused-vars]\n" \
        'stdin:3:11: "foo" is not defined. [Error/no-undef]'
      });

      it('removes the unused import and adds the missing one', () => {
        expect(this.subject()).toEqual(`)});
import foo from 'bar/foo';

foo
        `.trim();
      });
    });

    describe('when a named import has an unused variable', () => {
      this.text = `;
import { bar, foo } from 'baz';

bar
      `.trim();

      let(:eslint_result) do
        'stdin:1:11: "foo" is defined but never used ' \
        "[Error/no-unused-vars]\n" \
      });

      it('removes that variable from the named imports list', () => {
        expect(this.subject()).toEqual(`)});
import { bar } from 'baz';

bar
        `.trim();
      });
    });

    describe('when the last import is removed from a named import', () => {
      this.text = `;
import bar from 'bar';
import { foo } from 'baz';

bar
      `.trim();

      let(:eslint_result) do
        'stdin:2:11: "foo" is defined but never used ' \
        "[Error/no-unused-vars]\n" \
      });

      it('removes the whole import', () => {
        expect(this.subject()).toEqual(`)});
import bar from 'bar';

bar
        `.trim();
      });
    });

    describe('when an unused variable that shares its name with an import exists', () => {
      this.text = `;
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
      let(:eslint_result) do
        'stdin:13:11: "uuid" is defined but never used [Error/no-unused-vars]'
      });

      it('does not remove the import', () => {
        expect(this.subject()).toEqual(text)});
      });
    });
  });

  describe '#rewrite_imports' do
    this.existing_files = ['app/baz.jsx'];
    let(:configuration) do
      super().merge('named_exports' => { 'bar' => ['foo'] })
    });
    this.package_dependencies = ['bar'];
    this.path_to_current_file = `${tmp_dir}/app/bilbo/frodo.js`;

    subject do
      described_class.new(editor).rewrite_imports
      editor.current_file_content
    });

    describe('when imports exist', () => {
      this.text = `;
import baz from 'app/baz';
import bar, { foo } from 'bar';

bar
      `.trim();

      describe('and we are not changing anything in config', () => {
        it('only sorts and groups imports', () => {
          expect(this.subject()).toEqual(`)});
import bar, { foo } from 'bar';

import baz from 'app/baz';

bar
          `.trim();
        });
      });

      describe('and `group_imports` is false', () => {
        let(:configuration) do
          super().merge('group_imports' => false)
        });

        it('sorts imports', () => {
          expect(this.subject()).toEqual(`)});
import bar, { foo } from 'bar';
import baz from 'app/baz';

bar
          `.trim();
        });
      });

      describe('and we are switching declaration_keyword to `const`', () => {
        let(:configuration) do
          super().merge('declaration_keyword' => 'const')
        });

        it('groups, sorts, and changes imports to use `const`', () => {
          expect(this.subject()).toEqual(`)});
const bar = require('bar');
const { foo } = require('bar');

const baz = require('app/baz');

bar
          `.trim();
        });
      });
    });

    describe('when imports use a mix of relative and normal paths', () => {
      this.text = `;
import bar, { foo } from 'bar';
import baz from '../baz';

bar
      `.trim();

      describe('and we are turning relative paths off', () => {
        let(:configuration) do
          super().merge('use_relative_paths' => false)
        });

        it('sorts, groups, and changes to absolute paths', () => {
          expect(this.subject()).toEqual(`)});
import bar, { foo } from 'bar';

import baz from 'app/baz';

bar
          `.trim();
        });
      });
    });

    describe('when imports use normal paths', () => {
      this.text = `;
import bar, { foo } from 'bar';
import baz from 'app/baz';

bar
      `.trim();

      describe('and we are turning relative paths on', () => {
        let(:configuration) do
          super().merge('use_relative_paths' => true)
        });

        it('sorts, groups, and changes to relative paths', () => {
          expect(this.subject()).toEqual(`)});
import bar, { foo } from 'bar';

import baz from '../baz';

bar
          `.trim();
        });
      });
    });
  });

  describe '#goto' do
    subject do
      described_class.new(editor).goto
      editor.goto
    });

    describe('with a variable name that will resolve', () => {
      this.existing_files = ['bar/foo.jsx'];

      it('opens the file', () => {
        expect(this.subject()).toEqual(`${File.basename(tmp_dir)}/bar/foo.jsx`)});
      });
    });

    describe('with a variable name that will not resolve', () => {
      this.existing_files = ['bar/goo.jsx'];

      it('opens nothing', () => {
        expect(subject).to be(nil)
      });

      describe('when there is a current import for the variable', () => {
        this.text = `;
import foo from 'some-package';

foo
        `.trim();

        describe('not matching a package dependency', () => {
          it('opens the import path', () => {
            expect(this.subject()).toEqual('some-package')});
          });
        });

        describe('matching a package dependency', () => {
          this.package_dependencies = ['some-package'];

          it('opens the package main file', () => {
            expect(subject).to eq(
              'node_modules/some-package/some-package-main.jsx')
          });
        });
      });
    });

    describe('with a variable name that will resolve to a package dependency', () => {
      this.package_dependencies = ['foo'];

      it('opens the `main` file', () => {
        expect(this.subject()).toEqual('node_modules/foo/foo-main.jsx')});
      });
    });

    describe('with a variable name matching an alias', () => {
      this.word = 'styles';
      let(:configuration) do
        super().merge('aliases' => { 'styles' => aliaz })
      });

      describe('to a relative resource', () => {
        this.aliaz = './index.scss';

        it('opens the file relative to the file being edited', () => {
          expect(this.subject()).toEqual(`${tmp_dir}/index.scss`)});
        });
      });

      describe('to an absolute resource', () => {
        this.aliaz = 'stylez';
        this.package_dependencies = [aliaz];

        it('opens the alias main file', () => {
          expect(this.subject()).toEqual(`node_modules/${aliaz}/stylez-main.jsx`)});
        });
      });
    });

    describe('with a variable name that matches multiple files', () => {
      let(:existing_files) do
        %w[
          bar/foo.jsx
          car/foo.jsx
        ]
      });

      describe('when the variable has not been previously imported', () => {
        it('displays a message about selecting a module', () => {
          subject
          expect(editor.ask_for_selections).to include(
            word: 'foo',
            alternatives: [
              'bar/foo',
              'car/foo',
            ]
          )
        });

        it('does not open the file', () => {
          expect(subject).to be(nil)
        });

        describe('and the user selects', () => {
          this.selections = { 'foo' => 0 };

          it('opens the first one', () => {
            expect(this.subject()).toEqual(`${File.basename(tmp_dir)}/bar/foo.jsx`)});
          });
        });
      });

      describe('when the variable has been previously imported', () => {
        describe('as a default import', () => {
          this.text = `;
import foo from 'bar/foo';

foo
          `.trim();

          it('opens the file', () => {
            expect(this.subject()).toEqual(`${File.basename(tmp_dir)}/bar/foo.jsx`)});
          });

          describe('and there are other imports', () => {
            this.text = `;
import bar from 'foo/bar';
import foo from 'bar/foo';
import foobar from 'bar/foobar';

foo
            `.trim();
            it('opens the file', () => {
              expect(this.subject()).toEqual(`${File.basename(tmp_dir)}/bar/foo.jsx`)});
            });
          });
        });

        describe('as a named import', () => {
          this.text = `;
import { foo } from 'bar/foo';

foo
          `.trim();

          it('opens the file', () => {
            expect(this.subject()).toEqual(`${File.basename(tmp_dir)}/bar/foo.jsx`)});
          });
        });
      });
    });
  });
});
