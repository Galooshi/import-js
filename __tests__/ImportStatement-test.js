'use strict';

jest.autoMockOff();

const ImportStatement = require('../lib/ImportStatement');

describe('ImportStatement', () => {
  describe('.parse()', () => {
    let string;
    let subject;

    beforeEach(() => {
      subject = () => ImportStatement.parse(string);
    });

    describe('when the string is a valid es6 default import', () => {
      beforeEach(() => {
        string = "import foo from './lib/foo';";
      });

      it('returns a valid ImportStatement instance', () => {
        expect(subject().assignment).toEqual('foo');
        expect(subject().path).toEqual('./lib/foo');
      });

      describe('and it has a non-alphanumeric variable name', () => {
        beforeEach(() => {
          string = "import $ from 'jquery';";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('$');
          expect(subject().path).toEqual('jquery');
        });
      });

      describe('and it has line breaks', () => {
        beforeEach(() => {
          string = "import foo from\n  './lib/foo';";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('foo');
          expect(subject().path).toEqual('./lib/foo');
        });
      });
    });

    describe('when the string is a valid es6 named import', () => {
      beforeEach(() => {
        string = "import { foo } from './lib/foo';";
      });

      it('returns a valid ImportStatement instance', () => {
        expect(subject().assignment).toEqual('{ foo }');
        expect(subject().path).toEqual('./lib/foo');
        expect(subject().defaultImport).toEqual(undefined);
        expect(subject().hasNamedImports()).toBe(true);
        expect(subject().namedImports).toEqual(['foo']);
      });

      describe('and it has line breaks', () => {
        beforeEach(() => {
          string = "import {\n  foo,\n  bar,\n} from './lib/foo';";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('{\n  foo,\n  bar,\n}');
          expect(subject().path).toEqual('./lib/foo');
          expect(subject().defaultImport).toEqual(undefined);
          expect(subject().hasNamedImports()).toBe(true);
          expect(subject().namedImports).toEqual(['foo', 'bar']);
        });
      });
    });

    describe('when the string is a valid es6 default and named import', () => {
      beforeEach(() => {
        string = "import foo, { bar } from './lib/foo';";
      });

      it('returns a valid ImportStatement instance', () => {
        expect(subject().assignment).toEqual('foo, { bar }');
        expect(subject().path).toEqual('./lib/foo');
        expect(subject().defaultImport).toEqual('foo');
        expect(subject().hasNamedImports()).toBe(true);
        expect(subject().namedImports).toEqual(['bar']);
      });

      describe('and it has line breaks', () => {
        beforeEach(() => {
          string = "import foo, {\n  bar,\n  baz,\n} from './lib/foo';";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('foo, {\n  bar,\n  baz,\n}');
          expect(subject().path).toEqual('./lib/foo');
          expect(subject().defaultImport).toEqual('foo');
          expect(subject().hasNamedImports()).toBe(true);
          expect(subject().namedImports).toEqual(['bar', 'baz']);
        });
      });
    });

    describe('when the string is a valid import using const', () => {
      beforeEach(() => {
        string = "const foo = require('./lib/foo');";
      });

      it('returns a valid ImportStatement instance', () => {
        expect(subject().assignment).toEqual('foo');
        expect(subject().path).toEqual('./lib/foo');
        expect(subject().importFunction).toEqual('require');
      });

      describe('and it has line breaks', () => {
        beforeEach(() => {
          string = "const foo = \n  require('./lib/foo');";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('foo');
          expect(subject().path).toEqual('./lib/foo');
          expect(subject().importFunction).toEqual('require');
        });

        it('does not have named imports', () => {
          expect(subject().hasNamedImports()).toBe(false);
        });
      });

      describe('and it is using a custom `import_function`', () => {
        beforeEach(() => {
          string = "const foo = customRequire('./lib/foo');";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('foo');
          expect(subject().path).toEqual('./lib/foo');
          expect(subject().importFunction).toEqual('customRequire');
        });
      });
    });

    describe('when a string is a valid import using const and destructuring ', () => {
      beforeEach(() => {
        string = "const { foo } = require('./lib/foo');";
      });

      it('returns a valid ImportStatement instance', () => {
        expect(subject().assignment).toEqual('{ foo }');
        expect(subject().path).toEqual('./lib/foo');
        expect(subject().hasNamedImports()).toBe(true);
        expect(subject().defaultImport).toEqual(undefined);
        expect(subject().namedImports).toEqual(['foo']);
      });

      describe('and it has line breaks', () => {
        beforeEach(() => {
          string = "const {\n  foo,\n  bar,\n} = require('./lib/foo');";
        });

        it('returns a valid ImportStatement instance', () => {
          expect(subject().assignment).toEqual('{\n  foo,\n  bar,\n}');
          expect(subject().path).toEqual('./lib/foo');
          expect(subject().hasNamedImports()).toBe(true);
          expect(subject().defaultImport).toEqual(undefined);
          expect(subject().namedImports).toEqual(['foo', 'bar']);
        });
      });
    });

    describe('when the string is not a valid import', () => {
      beforeEach(() => {
        string = 'var foo = bar.hello;';
      });

      it('returns null', () => {
        expect(subject()).toBe(null);
      });

      describe('with const and newlines before semicolon', () => {
        beforeEach(() => {
          string = "const foo = require('./lib/foo')\n'bar';";
        });

        it('returns null', () => {
          expect(subject()).toBe(null);
        });
      });

      describe('with import and newlines before semicolon', () => {
        beforeEach(() => {
          string = "import foo from './lib/foo'\n'bar';";
        });

        it('returns null', () => {
          expect(subject()).toBe(null);
        });
      });

      describe('with spaces where the require function is', () => {
        beforeEach(() => {
          string = "const foo = my custom require('./lib/foo');";
        });

        it('returns null', () => {
          expect(subject()).toBe(null);
        });
      });

      describe('with const and a require inside an object', () => {
        beforeEach(() => {
          string = `
const foo = {
  doIt() {
    const goo = require('foo');
          `;
        });

        it('returns null', () => {
          expect(subject()).toBe(null);
        });
      });

      describe('with a comment containing curlies', () => {
        beforeEach(() => {
          string = `
const foo = {
  *
    Significant comment: {baz} bar
  bar() {
    const doo = require('doo');
          `;
        });

        it('returns null', () => {
          expect(subject()).toBe(null);
        });
      });

      describe('with import and a from inside an object', () => {
        beforeEach(() => {
          string = `
import foo {
  import goo from 'foo';
          `;
        });

        it('returns null', () => {
          expect(subject()).toBe(null);
        });
      });
    });
  });

  describe('.hasNamedImports()', () => {
    let importStatement;
    let defaultImport;
    let namedImports;
    let subject;

    beforeEach(() => {
      subject = () => {
        importStatement = new ImportStatement();
        if (defaultImport) {
          importStatement.defaultImport = defaultImport;
        }
        if (namedImports) {
          importStatement.namedImports = namedImports;
        }

        return importStatement.hasNamedImports();
      };
    });

    it('is false without a default import or named imports', () => {
      expect(subject()).toBe(false);
    });

    it('is false with a default import', () => {
      defaultImport = 'foo';
      expect(subject()).toBe(false);
    });

    it('is false when a default import is removed', () => {
      defaultImport = 'foo';
      subject();
      importStatement.deleteVariable('foo');
      expect(subject()).toBe(false);
    });

    it('is true with named imports', () => {
      namedImports = ['foo'];
      expect(subject()).toBe(true);
    });

    it('is false when named imports are all removed', () => {
      namedImports = ['foo'];
      subject();
      importStatement.deleteVariable('foo');
      expect(subject()).toBe(false);
    });
  });

  describe('.isParsedAndUntouched()', () => {
    let importStatement;
    let subject;

    beforeEach(() => {
      subject = () => importStatement.isParsedAndUntouched();
    });

    describe('for parsed statements', () => {
      beforeEach(() => {
        importStatement = ImportStatement.parse(
          "import foo, { bar } from './lib/foo';");
      });

      it('is true', () => {
        expect(subject()).toBe(true);
      });

      it('is false when a default import is deleted', () => {
        importStatement.deleteVariable('foo');
        expect(subject()).toBe(false);
      });

      it('s false when a named import is deleted', () => {
        importStatement.deleteVariable('bar');
        expect(subject()).toBe(false);
      });

      it('is true when nothing is deleted', () => {
        importStatement.deleteVariable('somethingElse');
        expect(subject()).toBe(true);
      });
    });

    describe('for statements created through the constructor', () => {
      beforeEach(() => {
        importStatement = new ImportStatement();
      });

      it('is false', () => {
        expect(subject()).toBe(false);
      });
    });
  });
});

//describe ImportJS::ImportStatement do
  //describe '#empty?' do
    //importStatement = described_class.new;
    //defaultImport = null;
    //namedImports = null;

    //beforeEach(() => {
      //importStatement.defaultImport = defaultImport if defaultImport
      //importStatement.namedImports = namedImports if namedImports
    //});

    //subject { importStatement.empty? }

    //describe('without a default import or named imports', () => {
      //it { should eq(true) }
    //});

    //describe('with a default import', () => {
      //defaultImport = 'foo';
      //it { should eq(false) }

      //describe('when default import is removed', () => {
        //before { importStatement.delete_variable!('foo') }
        //it { should eq(true) }
      //});
    //});

    //describe('with named imports', () => {
      //namedImports = ['foo'];
      //it { should eq(false) }

      //describe('when named imports are removed', () => {
        //before { importStatement.delete_variable!('foo') }
        //it { should eq(true) }
      //});
    //});

    //describe('with an empty array of named imports', () => {
      //namedImports = [];
      //it { should eq(true) }
    //});
  //});

  //describe '#variables' do
    //importStatement = described_class.new;
    //defaultImport = null;
    //namedImports = null;

    //beforeEach(() => {
      //importStatement.defaultImport = defaultImport if defaultImport
      //importStatement.namedImports = namedImports if namedImports
    //});

    //subject { importStatement.variables }

    //describe('without a default import or named imports', () => {
      //it { should eq([]) }
    //});

    //describe('with a default import', () => {
      //defaultImport = 'foo';
      //it { should eq(['foo']) }
    //});

    //describe('with named imports', () => {
      //namedImports = %w[foo bar baz];
      //it { should eq(%w[foo bar baz]) }
    //});

    //describe('with a default import and named imports', () => {
      //defaultImport = 'foo';
      //namedImports = %w[bar baz];
      //it { should eq(%w[foo bar baz]) }
    //});
  //});

  //describe '#merge' do
    //existing_importStatement = described_class.new;
    //new_importStatement = described_class.new;
    //existing_defaultImport = null;
    //existing_namedImports = null;
    //new_defaultImport = null;
    //new_namedImports = null;

    //beforeEach(() => {
      //if existing_defaultImport
        //existing_importStatement.defaultImport = existing_defaultImport
      //});

      //if existing_namedImports
        //existing_importStatement.namedImports = existing_namedImports
      //});

      //if new_defaultImport
        //new_importStatement.defaultImport = new_defaultImport
      //});

      //if new_namedImports
        //new_importStatement.namedImports = new_namedImports
      //});
    //});

    //subject do
      //existing_importStatement.merge(new_importStatement)
      //existing_importStatement
    //});

    //describe('without a new default import', () => {
      //existing_defaultImport = 'foo';

      //it('uses the existing default import', () => {
        //expect(subject().defaultImport).toEqual('foo');
      //});
    //});

    //describe('without an existing default import', () => {
      //new_defaultImport = 'foo';

      //it('uses the new default import', () => {
        //expect(subject().defaultImport).toEqual('foo');
      //});
    //});

    //describe('with both default imports', () => {
      //existing_defaultImport = 'foo';
      //new_defaultImport = 'bar';

      //it('uses the new default import', () => {
        //expect(subject().defaultImport).toEqual('bar');
      //});
    //});

    //describe('without new named imports', () => {
      //existing_namedImports = ['foo'];

      //it('uses the existing named imports', () => {
        //expect(subject().namedImports).toEqual(['foo']);
      //});
    //});

    //describe('without existing named imports', () => {
      //new_namedImports = ['foo'];

      //it('uses the new named imports', () => {
        //expect(subject().namedImports).toEqual(['foo']);
      //});
    //});

    //describe('with both named imports', () => {
      //existing_namedImports = ['foo'];
      //new_namedImports = ['bar'];

      //it('uses the new named imports', () => {
        //expect(subject().namedImports).toEqual(%w[bar foo]);
      //});
    //});

    //describe('when the new named import is the same as the existing', () => {
      //existing_namedImports = ['foo'];
      //new_namedImports = ['foo'];

      //it('does not duplicate', () => {
        //expect(subject().namedImports).toEqual(['foo']);
      //});
    //});
  //});

  //describe '#to_import_strings' do
    //importStatement = described_class.new;
    //import_function = 'require';
    //path = 'path';
    //defaultImport = null;
    //namedImports = null;
    //max_line_length = 80;
    //tab = '  ';

    //beforeEach(() => {
      //importStatement.path = path

      //importStatement.defaultImport = defaultImport if defaultImport
      //importStatement.namedImports = namedImports if namedImports
    //});

    //subject do
      //importStatement.declaration_keyword = declaration_keyword
      //importStatement.import_function = import_function
      //importStatement.to_import_strings(max_line_length, tab)
    //});

    //describe('with import declaration keyword', () => {
      //declaration_keyword = 'import';

      //describe('with a default import', () => {
        //defaultImport = 'foo';
        //it { should eq(["import foo from 'path';"]) }

        //describe('with `import_function`', () => {
          //import_function = 'myCustomRequire';

          //# `import_function` only applies to const/var
          //it { should eq(["import foo from 'path';"]) }
        //});

        //describe('when longer than max line length', () => {
          //defaultImport = 'ReallyReallyReallyReallyLong';
          //path = 'also_very_long_for_some_reason';
          //max_line_length = 50;
          //it { should eq(["import #{defaultImport} from\n  '#{path}';"]) }

          //describe('with different tab', () => {
            //tab = "\t";
            //it { should eq(["import #{defaultImport} from\n\t'#{path}';"]) }
          //});
        //});
      //});

      //describe('with named imports', () => {
        //namedImports = %w[foo bar];
        //it { should eq(["import { foo, bar } from 'path';"]) }

        //describe('when longer than max line length', () => {
          //namedImports = %w[foo bar baz fizz buzz];
          //path = 'also_very_long_for_some_reason';
          //max_line_length = 50;
          //it do
            //should eq(
              //[
                //"import {\n  foo,\n  bar,\n  baz,\n  fizz,\n  buzz,\n} " \
                //"from '#{path}';",
              //]
            //)
          //});
        //});
      //});

      //describe('with default and named imports', () => {
        //defaultImport = 'foo';
        //namedImports = %w[bar baz];
        //it { should eq(["import foo, { bar, baz } from 'path';"]) }

        //describe('when longer than max line length', () => {
          //namedImports = %w[bar baz fizz buzz];
          //path = 'also_very_long_for_some_reason';
          //max_line_length = 50;
          //it do
            //should eq(
              //[
                //"import foo, {\n  bar,\n  baz,\n  fizz,\n  buzz,\n} " \
                //"from '#{path}';",
              //]
            //)
          //});
        //});
      //});
    //});

    //describe('with const declaration keyword', () => {
      //declaration_keyword = 'const';

      //describe('with a default import', () => {
        //defaultImport = 'foo';
        //it { should eq(["const foo = require('path');"]) }

        //describe('with `import_function`', () => {
          //import_function = 'myCustomRequire';
          //it { should eq(["const foo = myCustomRequire('path');"]) }
        //});

        //describe('when longer than max line length', () => {
          //defaultImport = 'ReallyReallyReallyReallyLong';
          //path = 'also_very_long_for_some_reason';
          //max_line_length = 50;
          //it do
            //should eq(["const #{defaultImport} =\n  require('#{path}');"])
          //});

          //describe('with different tab', () => {
            //tab = "\t";
            //it do
              //should eq(["const #{defaultImport} =\n\trequire('#{path}');"])
            //});
          //});
        //});
      //});

      //describe('with named imports', () => {
        //namedImports = %w[foo bar];
        //it { should eq(["const { foo, bar } = require('path');"]) }

        //describe('with `import_function`', () => {
          //import_function = 'myCustomRequire';
          //it { should eq(["const { foo, bar } = myCustomRequire('path');"]) }
        //});

        //describe('when longer than max line length', () => {
          //namedImports = %w[foo bar baz fizz buzz];
          //path = 'also_very_long_for_some_reason';
          //max_line_length = 50;
          //it do
            //should eq(
              //[
                //"const {\n  foo,\n  bar,\n  baz,\n  fizz,\n  buzz,\n} = " \
                //"require('#{path}');",
              //]
            //)
          //});
        //});
      //});

      //describe('with default and named imports', () => {
        //defaultImport = 'foo';
        //namedImports = %w[bar baz];
        //it do
          //should eq(
            //[
              //"const foo = require('path');",
              //"const { bar, baz } = require('path');",
            //]
          //)
        //});

        //describe('with `import_function`', () => {
          //import_function = 'myCustomRequire';
          //it do
            //should eq(
              //[
                //"const foo = myCustomRequire('path');",
                //"const { bar, baz } = myCustomRequire('path');",
              //]
            //)
          //});
        //});

        //describe('when longer than max line length', () => {
          //namedImports = %w[bar baz fizz buzz];
          //path = 'also_very_long_for_some_reason';
          //max_line_length = 50;
          //it do
            //should eq(
              //[
                //"const foo =\n  require('#{path}');",
                //"const {\n  bar,\n  baz,\n  fizz,\n  buzz,\n} = " \
                //"require('#{path}');",
              //]
            //)
          //});
        //});
      //});
    //});
  //});
//});
