'use strict';

jest.autoMockOff();

const ImportStatement = require('../lib/ImportStatement');

describe('ImportStatement', () => {
  describe('.parse()', () => {
    const subject = ImportStatement.parse;

    it('is valid with a valid ES6 default import', () => {
      const statement = subject("import foo from './lib/foo';");

      expect(statement.assignment).toEqual('foo');
      expect(statement.path).toEqual('./lib/foo');
    });

    it('is valid with a non-alphanumeric default import', () => {
      const statement = subject("import $ from 'jquery';");

      expect(statement.assignment).toEqual('$');
      expect(statement.path).toEqual('jquery');
    });

    it('it is valid with a default import with line breaks', () => {
      const statement = subject("import foo from\n  './lib/foo';");

      expect(statement.assignment).toEqual('foo');
      expect(statement.path).toEqual('./lib/foo');
    });

    it('is valid with a valid ES6 named import', () => {
      const statement = subject("import { foo } from './lib/foo';");

      expect(statement.assignment).toEqual('{ foo }');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.defaultImport).toEqual(undefined);
      expect(statement.hasNamedImports()).toBe(true);
      expect(statement.namedImports).toEqual(['foo']);
    });

    it('is valid with a named import with line breaks', () => {
      const statement = subject("import {\n  foo,\n  bar,\n} from './lib/foo';");

      expect(statement.assignment).toEqual('{\n  foo,\n  bar,\n}');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.defaultImport).toEqual(undefined);
      expect(statement.hasNamedImports()).toBe(true);
      expect(statement.namedImports).toEqual(['foo', 'bar']);
    });

    it('is valid with a valid ES6 default and named import', () => {
      const statement = subject("import foo, { bar } from './lib/foo';");

      expect(statement.assignment).toEqual('foo, { bar }');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.defaultImport).toEqual('foo');
      expect(statement.hasNamedImports()).toBe(true);
      expect(statement.namedImports).toEqual(['bar']);
    });

    it('is valid with a default and named import with line breaks', () => {
      const statement = subject(
        "import foo, {\n  bar,\n  baz,\n} from './lib/foo';");

      expect(statement.assignment).toEqual('foo, {\n  bar,\n  baz,\n}');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.defaultImport).toEqual('foo');
      expect(statement.hasNamedImports()).toBe(true);
      expect(statement.namedImports).toEqual(['bar', 'baz']);
    });

    it('is valid with a valid require using const', () => {
      const statement = subject("const foo = require('./lib/foo');");

      expect(statement.assignment).toEqual('foo');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.importFunction).toEqual('require');
    });

    describe('with a require using const and line breaks', () => {
      let statement;

      beforeEach(() => {
        statement = subject("const foo = \n  require('./lib/foo');");
      });

      it('returns a valid ImportStatement instance', () => {
        expect(statement.assignment).toEqual('foo');
        expect(statement.path).toEqual('./lib/foo');
        expect(statement.importFunction).toEqual('require');
      });

      it('does not have named imports', () => {
        expect(statement.hasNamedImports()).toBe(false);
      });
    });

    it('is valid with a custom `import_function`', () => {
      const statement = subject("const foo = customRequire('./lib/foo');");

      expect(statement.assignment).toEqual('foo');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.importFunction).toEqual('customRequire');
    });

    it('is valid with a require using const and destructuring', () => {
      const statement = subject("const { foo } = require('./lib/foo');");
      expect(statement.assignment).toEqual('{ foo }');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.hasNamedImports()).toBe(true);
      expect(statement.defaultImport).toEqual(undefined);
      expect(statement.namedImports).toEqual(['foo']);
    });

    it('is valid when using const, destructuring, and line breaks', () => {
      const statement = subject(
        "const {\n  foo,\n  bar,\n} = require('./lib/foo');");

      expect(statement.assignment).toEqual('{\n  foo,\n  bar,\n}');
      expect(statement.path).toEqual('./lib/foo');
      expect(statement.hasNamedImports()).toBe(true);
      expect(statement.defaultImport).toEqual(undefined);
      expect(statement.namedImports).toEqual(['foo', 'bar']);
    });

    it('is null with an invalid import', () => {
      const statement = subject('var foo = bar.hello;');
      expect(statement).toBe(null);
    });

    it('is null with const and newlines before the semicolon', () => {
      const statement = subject("const foo = require('./lib/foo')\n'bar';");
      expect(statement).toBe(null);
    });

    it('is null with import and newlines before the semicolon', () => {
      const statement = subject("import foo from './lib/foo'\n'bar';");
      expect(statement).toBe(null);
    });

    it('is null with spaces where the require function is', () => {
      const statement = subject("const foo = my custom require('./lib/foo');");
      expect(statement).toBe(null);
    });

    it('is null with const and require inside an object', () => {
      const statement = subject(`
const foo = {
  doIt() {
    const goo = require('foo');
  }
};
      `);
      expect(statement).toBe(null);
    });

    it('is null with a comment containing curlies', () => {
      const statement = subject(`
const foo = {
  /**
   * Significant comment: {baz} bar
   */
  doIt() {
    const doo = require('doo');
  }
};
      `);
      expect(statement).toBe(null);
    });

    it('is null with an import inside an object', () => {
      const statement = subject(`
import foo {
  import goo from 'foo';
}
      `);
      expect(statement).toBe(null);
    });
  });

  describe('.hasNamedImports()', () => {
    it('is false without a default import or named imports', () => {
      const statement = new ImportStatement();
      expect(statement.hasNamedImports()).toBe(false);
    });

    it('is false with a default import', () => {
      const statement = new ImportStatement({ defaultImport: 'foo' });
      expect(statement.hasNamedImports()).toBe(false);
    });

    it('is false when a default import is removed', () => {
      const statement = new ImportStatement({ defaultImport: 'foo' });
      statement.deleteVariable('foo');
      expect(statement.hasNamedImports()).toBe(false);
    });

    it('is true with named imports', () => {
      const statement = new ImportStatement({ namedImports: ['foo'] });
      expect(statement.hasNamedImports()).toBe(true);
    });

    it('is false when named imports are all removed', () => {
      const statement = new ImportStatement({ namedImports: ['foo'] });
      statement.deleteVariable('foo');
      expect(statement.hasNamedImports()).toBe(false);
    });
  });

  describe('.isParsedAndUntouched()', () => {
    it('is true for parsed statements', () => {
      const statement = ImportStatement.parse(
        "import foo, { bar } from './lib/foo';");
      expect(statement.isParsedAndUntouched()).toBe(true);
    });

    it('is false when a default import is deleted from a parsed statement', () => {
      const statement = ImportStatement.parse(
        "import foo, { bar } from './lib/foo';");
      statement.deleteVariable('foo');
      expect(statement.isParsedAndUntouched()).toBe(false);
    });

    it('is false when a named import is deleted from a parsed statement', () => {
      const statement = ImportStatement.parse(
        "import foo, { bar } from './lib/foo';");
      statement.deleteVariable('bar');
      expect(statement.isParsedAndUntouched()).toBe(false);
    });

    it('is true when nothing is deleted from a parsed statement', () => {
      const statement = ImportStatement.parse(
        "import foo, { bar } from './lib/foo';");
      statement.deleteVariable('somethingElse');
      expect(statement.isParsedAndUntouched()).toBe(true);
    });

    it('is false for statements created through the constructor', () => {
      const statement = new ImportStatement();
      expect(statement.isParsedAndUntouched()).toBe(false);
    });
  });

  describe('.isEmpty()', () => {
    it('is true without a default import or named imports', () => {
      const statement = new ImportStatement();
      expect(statement.isEmpty()).toBe(true);
    });

    it('is false with a default import', () => {
      const statement = new ImportStatement({ defaultImport: 'foo' });
      expect(statement.isEmpty()).toBe(false);
    });

    it('is true when default import is removed', () => {
      const statement = new ImportStatement({ defaultImport: 'foo' });
      statement.deleteVariable('foo');
      expect(statement.isEmpty()).toBe(true);
    });

    it('is false with named imports', () => {
      const statement = new ImportStatement({ namedImports: ['foo'] });
      expect(statement.isEmpty()).toBe(false);
    });

    it('is true when all named imports are removed', () => {
      const statement = new ImportStatement({ namedImports: ['foo'] });
      statement.deleteVariable('foo');
      expect(statement.isEmpty()).toBe(true);
    });

    it('is true with an empty array of named imports', () => {
      const statement = new ImportStatement({ namedImports: [] });
      expect(statement.isEmpty()).toBe(true);
    });
  });

  describe('.variables()', () => {
    it('is an empty array without a default or named imports', () => {
      const statement = new ImportStatement();
      expect(statement.variables()).toEqual([]);
    });

    it('has the default import', () => {
      const statement = new ImportStatement({ defaultImport: 'foo' });
      expect(statement.variables()).toEqual(['foo']);
    });

    it('has named imports', () => {
      const statement = new ImportStatement({
        namedImports: ['foo', 'bar', 'baz'],
      });

      expect(statement.variables()).toEqual(['foo', 'bar', 'baz']);
    });

    it('has default and named imports', () => {
      const statement = new ImportStatement({
        defaultImport: 'foo',
        namedImports: ['bar', 'baz'],
      });

      expect(statement.variables()).toEqual(['foo', 'bar', 'baz']);
    });
  });
});

//describe(ImportJS::ImportStatement, () => {
  //describe('.merge()', () => {
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

  //describe('.to_import_strings()', () => {
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
