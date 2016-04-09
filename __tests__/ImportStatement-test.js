'use strict';

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

  describe('.merge()', () => {
    it('uses the existing default import without a new default import', () => {
      const existing = new ImportStatement({ defaultImport: 'foo' });
      const newStatement = new ImportStatement();
      existing.merge(newStatement);
      expect(existing.defaultImport).toEqual('foo');
    });

    it('uses the new default import without an existing default import', () => {
      const existing = new ImportStatement();
      const newStatement = new ImportStatement({ defaultImport: 'foo' });
      existing.merge(newStatement);
      expect(existing.defaultImport).toEqual('foo');
    });

    it('uses the new default import when an existing and new one exist', () => {
      const existing = new ImportStatement({ defaultImport: 'foo' });
      const newStatement = new ImportStatement({ defaultImport: 'bar' });
      existing.merge(newStatement);
      expect(existing.defaultImport).toEqual('bar');
    });

    it('uses the existing named imports without a new named imports', () => {
      const existing = new ImportStatement({ namedImports: ['foo'] });
      const newStatement = new ImportStatement();
      existing.merge(newStatement);
      expect(existing.namedImports).toEqual(['foo']);
    });

    it('uses the new named imports without existing named imports', () => {
      const existing = new ImportStatement();
      const newStatement = new ImportStatement({ namedImports: ['foo'] });
      existing.merge(newStatement);
      expect(existing.namedImports).toEqual(['foo']);
    });

    it('merges the named imports when both existing and new ones exist', () => {
      const existing = new ImportStatement({ namedImports: ['foo'] });
      const newStatement = new ImportStatement({ namedImports: ['bar'] });
      existing.merge(newStatement);
      expect(existing.namedImports).toEqual(['bar', 'foo']);
    });

    it('does not duplicate named imports', () => {
      const existing = new ImportStatement({ namedImports: ['foo'] });
      const newStatement = new ImportStatement({ namedImports: ['foo'] });
      existing.merge(newStatement);
      expect(existing.namedImports).toEqual(['foo']);
    });
  });

  describe('.toImportStrings()', () => {
    describe('with the "import" declaration keyword', () => {
      it('is ok with a default import', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          defaultImport: 'foo',
          path: './lib/foo',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["import foo from './lib/foo';"]);
      });

      it('is ok with a default import and an importFunction', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          defaultImport: 'foo',
          path: './lib/foo',
          importFunction: 'myCustomRequire',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["import foo from './lib/foo';"]);
      });

      it('wraps long imports', () => {
        const defaultImport = 'ReallyReallyReallyReallyLong';
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          defaultImport,
          path,
        });

        expect(statement.toImportStrings(50, '  '))
          .toEqual([`import ${defaultImport} from\n  '${path}';`]);
      });

      it('uses the provided tab when wrapping', () => {
        const defaultImport = 'ReallyReallyReallyReallyLong';
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          defaultImport,
          path,
        });

        expect(statement.toImportStrings(50, '\t'))
          .toEqual([`import ${defaultImport} from\n\t'${path}';`]);
      });

      it('is ok with named imports', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          namedImports: ['foo', 'bar'],
          path: './lib/foo',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["import { foo, bar } from './lib/foo';"]);
      });

      it('wraps long imports with named imports', () => {
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          namedImports: ['foo', 'bar', 'baz', 'fizz', 'buzz'],
          path,
        });

        expect(statement.toImportStrings(50, '  ')).toEqual([
          `import {\n  foo,\n  bar,\n  baz,\n  fizz,\n  buzz,\n} from '${path}';`,
        ]);
      });

      it('is ok with default import and named imports', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          defaultImport: 'foo',
          namedImports: ['bar', 'baz'],
          path: './lib/foo',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["import foo, { bar, baz } from './lib/foo';"]);
      });

      it('wraps long imports with default and named imports', () => {
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'import',
          defaultImport: 'foo',
          namedImports: ['bar', 'baz', 'fizz', 'buzz'],
          path,
        });

        expect(statement.toImportStrings(50, '  ')).toEqual([
          `import foo, {\n  bar,\n  baz,\n  fizz,\n  buzz,\n} from '${path}';`,
        ]);
      });
    });

    describe('with the "const" declaration keyword', () => {
      it('is ok with a default import', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport: 'foo',
          path: './lib/foo',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["const foo = require('./lib/foo');"]);
      });

      it('is ok with a default import and an importFunction', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport: 'foo',
          path: './lib/foo',
          importFunction: 'myCustomRequire',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["const foo = myCustomRequire('./lib/foo');"]);
      });

      it('wraps long imports', () => {
        const defaultImport = 'ReallyReallyReallyReallyLong';
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport,
          path,
        });

        expect(statement.toImportStrings(50, '  '))
          .toEqual([`const ${defaultImport} =\n  require('${path}');`]);
      });

      it('uses the provided tab when wrapping', () => {
        const defaultImport = 'ReallyReallyReallyReallyLong';
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport,
          path,
        });

        expect(statement.toImportStrings(50, '\t'))
          .toEqual([`const ${defaultImport} =\n\trequire('${path}');`]);
      });

      it('is ok with named imports', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          namedImports: ['foo', 'bar'],
          path: './lib/foo',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["const { foo, bar } = require('./lib/foo');"]);
      });

      it('is ok with named imports and an importFunction', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          namedImports: ['foo', 'bar'],
          path: './lib/foo',
          importFunction: 'myCustomRequire',
        });
        expect(statement.toImportStrings(80, '  '))
          .toEqual(["const { foo, bar } = myCustomRequire('./lib/foo');"]);
      });

      it('wraps long imports with named imports', () => {
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          namedImports: ['foo', 'bar', 'baz', 'fizz', 'buzz'],
          path,
        });

        expect(statement.toImportStrings(50, '  ')).toEqual([
          `const {\n  foo,\n  bar,\n  baz,\n  fizz,\n  buzz,\n} = require('${path}');`,
        ]);
      });

      it('is ok with default import and named imports', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport: 'foo',
          namedImports: ['bar', 'baz'],
          path: './lib/foo',
        });
        expect(statement.toImportStrings(80, '  ')).toEqual([
          "const foo = require('./lib/foo');",
          "const { bar, baz } = require('./lib/foo');",
        ]);
      });

      it('is ok with default import, named imports, and an importFunction', () => {
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport: 'foo',
          namedImports: ['bar', 'baz'],
          path: './lib/foo',
          importFunction: 'myCustomRequire',
        });
        expect(statement.toImportStrings(80, '  ')).toEqual([
          "const foo = myCustomRequire('./lib/foo');",
          "const { bar, baz } = myCustomRequire('./lib/foo');",
        ]);
      });

      it('wraps long imports with default and named imports', () => {
        const path = 'also_very_long_for_some_reason';
        const statement = new ImportStatement({
          declarationKeyword: 'const',
          defaultImport: 'foo',
          namedImports: ['bar', 'baz', 'fizz', 'buzz'],
          path,
        });

        expect(statement.toImportStrings(50, '  ')).toEqual([
          `const foo =\n  require('${path}');`,
          `const {\n  bar,\n  baz,\n  fizz,\n  buzz,\n} = require('${path}');`,
        ]);
      });
    });
  });
});
