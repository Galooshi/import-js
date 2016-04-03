'use strict';

jest.autoMockOff();
jest.mock('../lib/FileUtils');

const ImportStatement = require('../lib/ImportStatement');
const ImportStatements = require('../lib/ImportStatements');

describe('ImportStatements', () => {
  function newStatements() {
    const Configuration = require('../lib/Configuration');
    return new ImportStatements(new Configuration());
  }

  it('gives an empty array without any import statements', () => {
    const statements = newStatements();
    expect(statements.toArray()).toEqual([]);
  });

  it('returns the pushed import statement', () => {
    const statements = newStatements();
    statements.push(ImportStatement.parse("import foo from 'foo';"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
    ]);
  });

  it('returns one statement when pushed two identical statements', () => {
    const statements = newStatements();
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("import foo from 'foo';"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
    ]);
  });

  it('returns sorted in same group when pushed two of the same kind', () => {
    const statements = newStatements();
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("import bar from 'bar';"));

    expect(statements.toArray()).toEqual([
      "import bar from 'bar';",
      "import foo from 'foo';",
    ]);
  });

  it('merges statements of different kinds with identical paths', () => {
    const statements = newStatements();
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("import { bar } from 'foo';"));

    expect(statements.toArray()).toEqual([
      "import foo, { bar } from 'foo';",
    ]);
  });

  it('separates import and const', () => {
    const statements = newStatements();
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("const bar = require('bar');"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
      '',
      "const bar = require('bar');",
    ]);
  });

  describe('with a package dependency', () => {
    beforeEach(() => {
      require('../lib/FileUtils').__setJsonFile('package.json', {
        dependencies: {
          bar: '1.0.0',
        },
      });
    });

    afterEach(() => {
      require('../lib/FileUtils').__setJsonFile('package.json', null);
    });

    it('separates package dependencies from non-package dependencies', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import foo from 'foo';"));
      statements.push(ImportStatement.parse("import bar from 'bar';"));

      expect(statements.toArray()).toEqual([
        "import bar from 'bar';",
        '',
        "import foo from 'foo';",
      ]);
    });

    it('separates package-local dependencies from non-package dependencies', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import foo from 'foo';"));
      statements.push(ImportStatement.parse("import bar from 'bar/too/far';"));

      expect(statements.toArray()).toEqual([
        "import bar from 'bar/too/far';",
        '',
        "import foo from 'foo';",
      ]);
    });

    describe('with a node environment', () => {
      beforeEach(() => {
        require('../lib/FileUtils').__setJsonFile('.importjs.json', {
          environments: ['node'],
        });
      });

      afterEach(() => {
        require('../lib/FileUtils').__setJsonFile('.importjs.json', null);
      });

      it('separates packages from core modules', () => {
        const statements = newStatements();
        statements.push(ImportStatement.parse("import readline from 'readline';"));
        statements.push(ImportStatement.parse("import bar from 'bar';"));

        expect(statements.toArray()).toEqual([
          "import readline from 'readline';",
          '',
          "import bar from 'bar';",
        ]);
      });

      it('separates core modules from things that look like core modules', () => {
        const statements = newStatements();
        statements.push(ImportStatement.parse("import constants from 'constants';"));
        statements.push(ImportStatement.parse(
          "import AppConstants from 'constants/app_constants';"
        ));

        expect(statements.toArray()).toEqual([
          "import constants from 'constants';",
          '',
          "import AppConstants from 'constants/app_constants';",
        ]);
      });
    });
  });

  it('separates import statements with different styles', () => {
    const statements = newStatements();
    statements.push(ImportStatement.parse("const bar = require('bar');"));
    statements.push(ImportStatement.parse("const custom = custom('custom');"));
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("var baz = require('baz');"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
      '',
      "const bar = require('bar');",
      '',
      "var baz = require('baz');",
      '',
      "const custom = custom('custom');",
    ]);
  });

  describe('when group_imports is false', () => {
    beforeEach(() => {
      require('../lib/FileUtils').__setJsonFile('.importjs.json', {
        group_imports: false,
      });
    });

    afterEach(() => {
      require('../lib/FileUtils').__setJsonFile('.importjs.json', null);
    });

    it('does not separate statements of different kinds', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("const bar = require('bar');"));
      statements.push(ImportStatement.parse("const custom = custom('custom');"));
      statements.push(ImportStatement.parse("import foo from 'foo';"));
      statements.push(ImportStatement.parse("var baz = require('baz');"));

      expect(statements.toArray()).toEqual([
        "const bar = require('bar');",
        "var baz = require('baz');",
        "const custom = custom('custom');",
        "import foo from 'foo';",
      ]);
    });
  });

  describe('.deleteVariables()', () => {
    it('removes empty import statements when deleting default imports', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import foo from './lib/foo'"));
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([]);
    });

    it('removes empty import statements when deleting named imports', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import { foo } from './lib/foo'"));
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([]);
    });

    it('does not remove non-empty statements when deleting named imports', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import { foo, bar } from './lib/foo'"));
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([
        "import { bar } from './lib/foo';",
      ]);
    });

    it('does not remove non-empty statements when deleting default imports', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import foo, { bar } from './lib/foo'"));
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([
        "import { bar } from './lib/foo';",
      ]);
    });

    it('removes empty statements when deleting default and named imports', () => {
      const statements = newStatements();
      statements.push(ImportStatement.parse("import foo, { bar } from './lib/foo'"));
      statements.deleteVariables(['foo', 'bar']);

      expect(statements.toArray()).toEqual([]);
    });
  });
});
