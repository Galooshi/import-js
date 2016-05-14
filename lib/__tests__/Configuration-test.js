jest.mock('../FileUtils');
jest.mock('../version');

import Configuration from '../Configuration';
import FileUtils from '../FileUtils';
import version from '../version';

describe('Configuration', () => {
  afterEach(() => {
    FileUtils.__reset();
    version.__reset();
  });

  describe('with camelCased configuration', () => {
    beforeEach(() => {
      FileUtils.__setJsonFile('.importjs.json', {
        declarationKeyword: 'const',
      });
    });

    it('does not have any messages', () => {
      const configuration = new Configuration();
      expect(configuration.messages).toEqual([]);
    });
  });

  describe('with deprecated snake_cased configuration', () => {
    beforeEach(() => {
      FileUtils.__setJsonFile('.importjs.json', {
        declaration_keyword: 'const',
      });
    });

    it('has a message about deprecated configuration', () => {
      const configuration = new Configuration();
      expect(configuration.messages).toEqual([
        'Deprecated configuration: `declaration_keyword` has changed to `declarationKeyword`',
      ]);
    });

    it('can be retrieved via #get("camelCased")', () => {
      const configuration = new Configuration();
      expect(configuration.get('declarationKeyword')).toEqual('const');
    });
  });

  describe('with unknown configuration', () => {
    beforeEach(() => {
      FileUtils.__setJsonFile('.importjs.json', {
        somethingStrange: true,
      });
    });

    it('has a message about unknown configuration', () => {
      const configuration = new Configuration();
      expect(configuration.messages).toEqual([
        'Unknown configuration: `somethingStrange`',
      ]);
    });
  });

  describe('#get()', () => {
    it('has default values', () => {
      const configuration = new Configuration();
      expect(configuration.get('aliases')).toEqual({});
      expect(configuration.get('declarationKeyword')).toEqual('import');
    });

    describe('with a configuration file', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('.importjs.json', {
          aliases: { foo: 'bar' },
          declarationKeyword: 'const',
        });
      });

      it('returns the configured value for the key', () => {
        expect(new Configuration().get('aliases')).toEqual({ foo: 'bar' });
      });
    });

    describe('with a minimumVersion', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('.importjs.json', {
          minimumVersion: '1.2.3',
        });
      });

      it('does not throw an error when current version is newer', () => {
        version.__setVersion('1.2.3');
        expect(() => new Configuration()).not.toThrow();
      });

      it('throws an error when current version is older', () => {
        version.__setVersion('1.2.2');
        expect(() => new Configuration()).toThrow(new Error(
          'The .importjs.json file for this project requires version ' +
          '1.2.3 or newer. You are using 1.2.2.'
        ));
      });
    });

    describe('with multiple configurations', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('.importjs.json', [
          {
            declarationKeyword: 'const',
            importFunction: 'foobar',
          },
          {
            appliesTo: 'goo/**',
            declarationKeyword: 'var',
          },
        ]);
      });

      describe('when the file being edited matches appliesTo', () => {
        let configuration;

        beforeEach(() => {
          configuration = new Configuration(`${process.cwd()}/goo/gar/gaz.js`);
        });

        it('uses local configuration', () => {
          expect(configuration.get('declarationKeyword')).toEqual('var');
        });

        it('falls back to global config if key missing from local config', () => {
          expect(configuration.get('importFunction')).toEqual('foobar');
        });

        it('falls back to default config if key is completely missing', () => {
          expect(configuration.get('maxLineLength')).toEqual(80);
        });
      });

      it('works when the path to local file is not a full path', () => {
        const configuration = new Configuration('goo/gar/gaz.js');
        expect(configuration.get('declarationKeyword')).toEqual('var');
      });

      it('uses global config when the file does not match appliesTo', () => {
        const configuration = new Configuration('foo/far/gaz.js');
        expect(configuration.get('declarationKeyword')).toEqual('const');
      });
    });

    describe('with appliesFrom', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('.importjs.json', [
          {
            declarationKeyword: 'const',
          },
          {
            appliesTo: 'goo/**',
            appliesFrom: 'from/**',
            declarationKeyword: 'var',
          },
        ]);
      });

      it('uses local config when fromFile matches appliesFrom', () => {
        const configuration = new Configuration('goo/gar/gaz.js');
        const opts = { fromFile: 'from/hello.js' };
        expect(configuration.get('declarationKeyword', opts)).toEqual('var');
      });

      it('uses global config when fromFile does not match appliesFrom', () => {
        const configuration = new Configuration('goo/gar/gaz.js');
        const opts = { fromFile: 'not_from/hello.js' };
        expect(configuration.get('declarationKeyword', opts)).toEqual('const');
      });

      it('uses global config when current file does not match appliesTo', () => {
        const configuration = new Configuration('foo/gar/gaz.js');
        const opts = { fromFile: 'from/hello.js' };
        expect(configuration.get('declarationKeyword', opts)).toEqual('const');
      });
    });
  });

  describe('#environmentCoreModules()', () => {
    it('returns an empty array', () => {
      expect(new Configuration().environmentCoreModules()).toEqual([]);
    });

    describe('in a node environment', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('.importjs.json', { environments: ['node'] });
      });

      it('returns node core modules', () => {
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

  describe('#packageDependencies()', () => {
    it('returns an empty array', () => {
      expect(new Configuration().packageDependencies()).toEqual([]);
    });

    describe('with dependencies', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('package.json', {
          dependencies: {
            foo: '1.0.0',
            bar: '2.0.0',
          },
        });
      });

      it('returns an array of dependencies', () => {
        expect(new Configuration().packageDependencies())
          .toEqual(['foo', 'bar']);
      });
    });

    describe('with dependencies and peerDependencies', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('package.json', {
          dependencies: {
            foo: '1.0.0',
          },
          peerDependencies: {
            bar: '2.0.0',
          },
        });
      });

      it('returns an array of dependencies and peerDependencies', () => {
        expect(new Configuration().packageDependencies())
          .toEqual(['foo', 'bar']);
      });
    });

    describe('with dependencies and devDependencies', () => {
      beforeEach(() => {
        FileUtils.__setJsonFile('package.json', {
          dependencies: {
            foo: '1.0.0',
          },
          devDependencies: {
            bar: '2.0.0',
          },
        });
      });

      it('leaves out devDependencies', () => {
        expect(new Configuration().packageDependencies())
          .toEqual(['foo']);
      });

      describe('when importDevDependencies is true', () => {
        beforeEach(() => {
          FileUtils.__setJsonFile('.importjs.json', {
            importDevDependencies: true,
          });
        });

        it('returns devDependencies as well', () => {
          expect(new Configuration().packageDependencies())
            .toEqual(['foo', 'bar']);
        });
      });
    });
  });
});
