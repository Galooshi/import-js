/* global spyOn */
import path from 'path';

import Configuration from '../Configuration';
import FileUtils from '../FileUtils';
import version from '../version';

jest.mock('../FileUtils');
jest.mock('../version');

describe('Configuration', () => {
  afterEach(() => {
    FileUtils.__reset();
    version.__reset();
  });

  describe('with camelCased configuration', () => {
    beforeEach(() => {
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), {
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
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), {
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
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), {
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

    describe('with a JSON configuration file', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), {
          aliases: { foo: 'bar' },
          declarationKeyword: 'const',
        });
      });

      it('returns the configured value for the key', () => {
        expect(new Configuration().get('aliases')).toEqual({ foo: 'bar' });
      });

      describe('and a javascript configuration file', () => {
        beforeEach(() => {
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
            aliases: { bar: 'foo' },
          });
        });

        it('prefers the javascript file', () => {
          expect(new Configuration().get('aliases')).toEqual({ bar: 'foo' });
        });
      });
    });

    describe('with a javascript configuration file', () => {
      describe('that will not parse', () => {
        beforeEach(() => {
          spyOn(FileUtils, 'readJsFile').and.throwError('Syntax error');
        });

        it('has a message about the failure', () => {
          const configuration = new Configuration();
          expect(configuration.messages[0]).toMatch(
            /Unable to parse configuration file/);
        });
      });

      describe('that does not export anything', () => {
        beforeEach(() => {
          // This is what the built-in `require` method will do if a javascript
          // file doesn't export anything.
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {});
        });

        it('has a message about the failure', () => {
          const configuration = new Configuration();
          expect(configuration.messages[0]).toMatch(
            /Nothing exported from \.importjs\.js/);
        });
      });
    });

    describe('with a minimumVersion', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), {
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

    describe('with a configuration option that is a function', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
          declarationKeyword: ({ pathToImportedModule, pathToCurrentFile }) => {
            if (/test\.js/.test(pathToImportedModule)) {
              return 'var';
            }
            if (/test\.js/.test(pathToCurrentFile)) {
              return 'const';
            }
            return 'import';
          },
        });
      });

      describe('when using `pathToImportedModule`', () => {
        it('invokes the method and returns the right value', () => {
          const configuration = new Configuration('/foo/component.js');
          expect(configuration.get('declarationKeyword', {
            fromFile: '/foo/test.js',
          })).toEqual('var');
        });
      });

      describe('when using `pathToCurrentFile`', () => {
        it('invokes the method and returns the right value', () => {
          const configuration = new Configuration('/foo/test.js');
          expect(configuration.get('declarationKeyword', {
            fromFile: '/component.js',
          })).toEqual('const');
        });
      });

      describe('when using none of the paths', () => {
        it('invokes the method and returns the right value', () => {
          const configuration = new Configuration('/foo/bar.js');
          expect(configuration.get('declarationKeyword', {
            fromFile: '/bar/foo.js',
          })).toEqual('import');
        });
      });
    });

    describe('with multiple configurations', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), [
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

      it('has a deprecation message', () => {
        const configuration = new Configuration();
        expect(configuration.messages).toEqual([
          'Deprecated configuration: Array style configuration detected. ' +
          'Local configuration using `appliesTo`/`appliesFrom` will be ' +
          'removed in a future version. Use a JavaScript configuration file ' +
          'and specify the configuration through functions (where needed) ' +
          'instead.',
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
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), [
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

  describe('#get coreModules', () => {
    it('returns an empty array', () => {
      expect(new Configuration().get('coreModules')).toEqual([]);
    });

    describe('in a meteor environment', () => {
      beforeEach(() => {
        FileUtils.__setFile(
          path.join(process.cwd(), '.importjs.json'),
          { environments: ['meteor'] });
      });

      it('returns meteor core modules', () => {
        expect(new Configuration().get('coreModules')).toEqual([
          'meteor/accounts-base',
          'meteor/blaze',
          'meteor/check',
          'meteor/ddp-client',
          'meteor/ddp-rate-limiter',
          'meteor/ejson',
          'meteor/email',
          'meteor/http',
          'meteor/check',
          'meteor/meteor',
          'meteor/mongo',
          'meteor/random',
          'meteor/reactive-var',
          'meteor/session',
          'meteor/templating',
          'meteor/tracker',
        ]);
      });
    });

    describe('in a node environment', () => {
      beforeEach(() => {
        FileUtils.__setFile(
          path.join(process.cwd(), '.importjs.json'),
          { environments: ['node'] });
      });

      it('returns node core modules', () => {
        expect(new Configuration().get('coreModules')).toEqual([
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

    describe('in multiple environments', () => {
      beforeEach(() => {
        FileUtils.__setFile(
          path.join(process.cwd(), '.importjs.json'),
          { environments: ['node', 'meteor'] });
      });

      it('returns core modules from all environments', () => {
        const coreModules = new Configuration().get('coreModules');
        expect(coreModules).toContain('child_process');
        expect(coreModules).toContain('meteor/check');
      });
    });
  });

  describe('#get aliases', () => {
    beforeEach(() => {
      // TODO: replace the array-style configuration here when we have an
      // environment that specify aliases.
      FileUtils.__setFile(
        path.join(process.cwd(), '.importjs.json'),
        [
          {
            aliases: {
              foo: 'foosball',
            },
          },
          {
            aliases: {
              bar: 'barsketball',
            },
          },
          {
            aliases: () => ({
              baz: 'bazeball',
            }),
          },
        ]);
    });

    it('merges all aliases into a single object', () => {
      expect(new Configuration().get('aliases')).toEqual({
        foo: 'foosball',
        bar: 'barsketball',
        baz: 'bazeball',
      });
    });
  });

  describe('#get namedExports', () => {
    beforeEach(() => {
      // TODO: replace the array-style configuration here when we have an
      // environment that specify namedExports.
      FileUtils.__setFile(
        path.join(process.cwd(), '.importjs.json'),
        [
          {
            namedExports: {
              foo: ['foosball'],
            },
          },
          {
            namedExports: () => ({
              bar: ['barsketball'],
            }),
          },
        ]);
    });

    it('merges all namedExports into a single object', () => {
      expect(new Configuration().get('namedExports')).toEqual({
        foo: ['foosball'],
        bar: ['barsketball'],
      });
    });
  });

  describe('#get lookupPaths', () => {
    beforeEach(() => {
      FileUtils.__setFile(
        path.join(process.cwd(), '.importjs.json'),
        [
          {
            lookupPaths: ['foo'],
          },
          {
            lookupPaths: ['bar'],
          },
        ]);
    });

    it('uses only one lookupPaths config (no merge)', () => {
      expect(new Configuration().get('lookupPaths')).toEqual([
        'bar',
      ]);
    });
  });

  describe('#packageDependencies()', () => {
    it('returns an empty array', () => {
      expect(new Configuration().packageDependencies()).toEqual([]);
    });

    describe('with dependencies', () => {
      beforeEach(() => {
        FileUtils.__setFile(path.join(process.cwd(), 'package.json'), {
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
        FileUtils.__setFile(path.join(process.cwd(), 'package.json'), {
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
        FileUtils.__setFile(path.join(process.cwd(), 'package.json'), {
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
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.json'), {
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
