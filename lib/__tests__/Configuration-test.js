'use strict';

jest.mock('../FileUtils');
jest.mock('../../package.json');

describe('Configuration', () => {
  function mockJsonFile(file, json) {
    beforeEach(() => {
      require('../FileUtils').__setJsonFile(file, json);
    });

    afterEach(() => {
      require('../FileUtils').__setJsonFile(file, null);
    });
  }

  function mockConfig(config) {
    mockJsonFile('.importjs.json', config);
  }

  function mockPackageJson(config) {
    mockJsonFile('package.json', config);
  }

  describe('.get()', () => {
    it('has default values', () => {
      const Configuration = require('../Configuration');
      const configuration = new Configuration();
      expect(configuration.get('aliases')).toEqual({});
      expect(configuration.get('declaration_keyword')).toEqual('import');
    });

    describe('with a configuration file', () => {
      mockConfig({
        aliases: { foo: 'bar' },
        declaration_keyword: 'const',
      });

      it('returns the configured value for the key', () => {
        const Configuration = require('../Configuration');
        expect(new Configuration().get('aliases')).toEqual({ foo: 'bar' });
      });
    });

    describe('with a minimum_version', () => {
      mockConfig({
        minimum_version: '1.2.3',
      });

      it('does not throw an error when current version is newer', () => {
        require('../../package.json').version = '1.2.3';
        const Configuration = require('../Configuration');
        expect(() => new Configuration()).not.toThrow();
      });

      it('throws an error when current version is older', () => {
        require('../../package.json').version = '1.2.2';
        const Configuration = require('../Configuration');
        expect(() => new Configuration()).toThrow(new Error(
          'The .importjs.json file for this project requires version ' +
          '1.2.3 or newer. You are using 1.2.2.'
        ));
      });
    });

    describe('with multiple configurations', () => {
      mockConfig([
        {
          declaration_keyword: 'const',
          import_function: 'foobar',
        },
        {
          applies_to: 'goo/**',
          declaration_keyword: 'var',
        },
      ]);

      describe('when the file being edited matches applies_to', () => {
        let configuration;

        beforeEach(() => {
          const Configuration = require('../Configuration');
          configuration = new Configuration(`${process.cwd()}/goo/gar/gaz.js`);
        });

        it('uses local configuration', () => {
          expect(configuration.get('declaration_keyword')).toEqual('var');
        });

        it('falls back to global config if key missing from local config', () => {
          expect(configuration.get('import_function')).toEqual('foobar');
        });

        it('falls back to default config if key is completely missing', () => {
          expect(configuration.get('max_line_length')).toEqual(80);
        });
      });

      it('works when the path to local file is not a full path', () => {
        const Configuration = require('../Configuration');
        const configuration = new Configuration('goo/gar/gaz.js');
        expect(configuration.get('declaration_keyword')).toEqual('var');
      });

      it('uses global config when the file does not match applies_to', () => {
        const Configuration = require('../Configuration');
        const configuration = new Configuration('foo/far/gaz.js');
        expect(configuration.get('declaration_keyword')).toEqual('const');
      });
    });

    describe('with applies_from', () => {
      mockConfig([
        {
          declaration_keyword: 'const',
        },
        {
          applies_to: 'goo/**',
          applies_from: 'from/**',
          declaration_keyword: 'var',
        },
      ]);

      it('uses local config when fromFile matches applies_from', () => {
        const Configuration = require('../Configuration');
        const configuration = new Configuration('goo/gar/gaz.js');
        const opts = { fromFile: 'from/hello.js' };
        expect(configuration.get('declaration_keyword', opts)).toEqual('var');
      });

      it('uses global config when fromFile does not match applies_from', () => {
        const Configuration = require('../Configuration');
        const configuration = new Configuration('goo/gar/gaz.js');
        const opts = { fromFile: 'not_from/hello.js' };
        expect(configuration.get('declaration_keyword', opts)).toEqual('const');
      });

      it('uses global config when current file does not match applies_to', () => {
        const Configuration = require('../Configuration');
        const configuration = new Configuration('foo/gar/gaz.js');
        const opts = { fromFile: 'from/hello.js' };
        expect(configuration.get('declaration_keyword', opts)).toEqual('const');
      });
    });
  });

  describe('.environmentCoreModules()', () => {
    it('returns an empty array', () => {
      const Configuration = require('../Configuration');
      expect(new Configuration().environmentCoreModules()).toEqual([]);
    });

    describe('in a node environment', () => {
      mockConfig({ environments: ['node'] });

      it('returns node core modules', () => {
        const Configuration = require('../Configuration');
        expect(new Configuration().environmentCoreModules()).toEqual([
          'assert',
          'buffer',
          'child_process',
          'cluster',
          'console',
          'constants',
          'crypto',
          'dgram',
          'dns',
          'domain',
          'events',
          'fs',
          'http',
          'https',
          'module',
          'net',
          'os',
          'path',
          'punycode',
          'querystring',
          'readline',
          'repl',
          'stream',
          'string_decoder',
          'sys',
          'timers',
          'tls',
          'tty',
          'url',
          'util',
          'v8',
          'vm',
          'zlib',
        ]);
      });
    });
  });

  describe('.packageDependencies()', () => {
    it('returns an empty array', () => {
      const Configuration = require('../Configuration');
      expect(new Configuration().packageDependencies()).toEqual([]);
    });

    describe('with dependencies', () => {
      mockPackageJson({
        dependencies: {
          foo: '1.0.0',
          bar: '2.0.0',
        },
      });

      it('returns an array of dependencies', () => {
        const Configuration = require('../Configuration');
        expect(new Configuration().packageDependencies())
          .toEqual(['foo', 'bar']);
      });
    });

    describe('with dependencies and peerDependencies', () => {
      mockPackageJson({
        dependencies: {
          foo: '1.0.0',
        },
        peerDependencies: {
          bar: '2.0.0',
        },
      });

      it('returns an array of dependencies and peerDependencies', () => {
        const Configuration = require('../Configuration');
        expect(new Configuration().packageDependencies())
          .toEqual(['foo', 'bar']);
      });
    });

    describe('with dependencies and devDependencies', () => {
      mockPackageJson({
        dependencies: {
          foo: '1.0.0',
        },
        devDependencies: {
          bar: '2.0.0',
        },
      });

      it('leaves out devDependencies', () => {
        const Configuration = require('../Configuration');
        expect(new Configuration().packageDependencies())
          .toEqual(['foo']);
      });

      describe('when import_dev_dependencies is true', () => {
        mockConfig({
          import_dev_dependencies: true,
        });

        it('returns devDependencies as well', () => {
          const Configuration = require('../Configuration');
          expect(new Configuration().packageDependencies())
            .toEqual(['foo', 'bar']);
        });
      });
    });
  });
});
