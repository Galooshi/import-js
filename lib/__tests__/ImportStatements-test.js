import path from 'path';

import Configuration from '../Configuration';
import FileUtils from '../FileUtils';
import ImportStatements from '../ImportStatements';
import findCurrentImports from '../findCurrentImports';
import parse from '../parse';

jest.mock('../FileUtils');

function prepare(importString) {
  return findCurrentImports(
    new Configuration(),
    importString,
    parse(importString),
  ).imports;
}

describe('ImportStatements', () => {
  afterEach(() => {
    FileUtils.__reset();
  });

  it('gives an empty array without any import statements', () => {
    const statements = new ImportStatements(new Configuration());
    expect(statements.toArray()).toEqual([]);
  });

  it('returns the pushed import statement', () => {
    const statements = prepare("import foo from 'foo';");

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
    ]);
  });

  it('returns all of the pushed import statements', () => {
    const statements = prepare(`
      import foo from 'foo';
      import bar from 'bar';
    `);

    expect(statements.toArray()).toEqual([
      "import bar from 'bar';",
      "import foo from 'foo';",
    ]);
  });

  it('returns one statement when pushed two identical statements', () => {
    const statements = prepare(`
      import foo from 'foo';
      import foo from 'foo';
    `);

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
    ]);
  });

  it('returns sorted in same group when pushed two of the same kind', () => {
    const statements = prepare(`
      import foo from 'foo';
      import bar from 'bar';
    `);

    expect(statements.toArray()).toEqual([
      "import bar from 'bar';",
      "import foo from 'foo';",
    ]);
  });

  it('merges statements of different kinds with identical paths', () => {
    const statements = prepare(`
      import foo from 'foo';
      import { bar } from 'foo';
    `);

    expect(statements.toArray()).toEqual([
      "import foo, { bar } from 'foo';",
    ]);
  });

  it('separates import and const', () => {
    const statements = prepare(`
      import foo from 'foo';
      const bar = require('bar');
    `);

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
      '',
      "const bar = require('bar');",
    ]);
  });

  describe('with a package dependency', () => {
    beforeEach(() => {
      FileUtils.__setFile(path.join(process.cwd(), 'package.json'), {
        dependencies: {
          bar: '1.0.0',
        },
      });
    });

    it('separates package dependencies from non-package dependencies', () => {
      const statements = prepare(`
        import foo from 'foo';
        import bar from 'bar';
      `);

      expect(statements.toArray()).toEqual([
        "import bar from 'bar';",
        '',
        "import foo from 'foo';",
      ]);
    });

    it('separates package-local dependencies from non-package dependencies', () => {
      const statements = prepare(`
        import foo from 'foo';
        import bar from 'bar/too/far';
      `);

      expect(statements.toArray()).toEqual([
        "import bar from 'bar/too/far';",
        '',
        "import foo from 'foo';",
      ]);
    });

    describe('with a meteor environment', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
          environments: ['meteor'],
          packageDependencies: new Set(['meteor/bar']),
        });
      });

      it('separates packages from core modules', () => {
        const statements = prepare(`
          import { Meteor } from 'meteor/meteor';
          import bar from 'bar';
        `);

        expect(statements.toArray()).toEqual([
          "import { Meteor } from 'meteor/meteor';",
          '',
          "import bar from 'bar';",
        ]);
      });

      it('separates core modules from things that look like core modules', () => {
        const statements = prepare(`
          import { Meteor } from 'meteor/meteor';
          import { SimpleSchema } from 'meteor/aldeed:simple-schema';
        `);

        expect(statements.toArray()).toEqual([
          "import { Meteor } from 'meteor/meteor';",
          '',
          "import { SimpleSchema } from 'meteor/aldeed:simple-schema';",
        ]);
      });

      it('separates package dependencies from non-package dependencies', () => {
        const statements = prepare(`
          import foo from 'foo';
          import bar from 'meteor/bar';
        `);

        expect(statements.toArray()).toEqual([
          "import bar from 'meteor/bar';",
          '',
          "import foo from 'foo';",
        ]);
      });

      it('separates package module dependencies from non-package dependencies', () => {
        const statements = prepare(`
          import foo from 'foo';
          import bar from 'meteor/bar/too/far';
        `);

        expect(statements.toArray()).toEqual([
          "import bar from 'meteor/bar/too/far';",
          '',
          "import foo from 'foo';",
        ]);
      });
    });

    describe('with a node environment', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
          environments: ['node'],
        });
      });

      it('separates packages from core modules', () => {
        const statements = prepare(`
          import readline from 'readline';
          import bar from 'bar';
        `);

        expect(statements.toArray()).toEqual([
          "import readline from 'readline';",
          '',
          "import bar from 'bar';",
        ]);
      });

      it('separates core modules from things that look like core modules', () => {
        const statements = prepare(`
          import constants from 'constants';
          import AppConstants from 'constants/app_constants';
        `);

        expect(statements.toArray()).toEqual([
          "import constants from 'constants';",
          '',
          "import AppConstants from 'constants/app_constants';",
        ]);
      });
    });
  });

  it('separates import statements with different styles', () => {
    const statements = prepare(`
      const bar = require('bar');
      const custom = custom('custom');
      import foo from 'foo';
      var baz = require('baz');
    `);

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

  describe('when groupImports is false', () => {
    beforeEach(() => {
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
        groupImports: false,
      });
    });

    it('does not separate statements of different kinds', () => {
      const statements = prepare(`
        const bar = require('bar');
        const custom = custom('custom');
        import foo from 'foo';
        var baz = require('baz');
      `);

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
      const statements = prepare(`
        import foo from './lib/foo'
      `);
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([]);
    });

    it('removes empty import statements when deleting named imports', () => {
      const statements = prepare(`
        import { foo } from './lib/foo'
      `);
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([]);
    });

    it('does not remove non-empty statements when deleting named imports', () => {
      const statements = prepare(`
        import { foo, bar } from './lib/foo'
      `);
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([
        "import { bar } from './lib/foo';",
      ]);
    });

    it('does not remove non-empty statements when deleting default imports', () => {
      const statements = prepare(`
        import foo, { bar } from './lib/foo'
      `);
      statements.deleteVariables(['foo']);

      expect(statements.toArray()).toEqual([
        "import { bar } from './lib/foo';",
      ]);
    });

    it('removes empty statements when deleting default and named imports', () => {
      const statements = prepare(`
        import foo, { bar } from './lib/foo'
      `);
      statements.deleteVariables(['foo', 'bar']);

      expect(statements.toArray()).toEqual([]);
    });
  });
});
