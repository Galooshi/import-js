/* global spyOn */
import fs from 'fs';
import os from 'os';
import path from 'path';

import Configuration from '../Configuration';
import FileUtils from '../FileUtils';
import version from '../version';

jest.mock('../FileUtils');
jest.mock('../version');
jest.mock('fs');

describe('Configuration', () => {
  afterEach(() => {
    fs.__reset();
    FileUtils.__reset();
    version.__reset();
  });

  describe('with camelCased configuration', () => {
    beforeEach(() => {
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
        declarationKeyword: 'const',
      });
    });

    it('does not have any messages', () => {
      const configuration = new Configuration();
      expect(configuration.messages).toEqual([]);
    });
  });

  describe('with unknown configuration', () => {
    beforeEach(() => {
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
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

      it('has a deprecation message', () => {
        const configuration = new Configuration();
        expect(configuration.messages).toEqual([
          'Using JSON to configure ImportJS is deprecated and will go away ' +
          'in a future version. Use an `.importjs.js` file instead.',
        ]);
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
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
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
          'The configuration file for this project requires version ' +
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
            pathToImportedModule: '/foo/test.js',
          })).toEqual('var');
        });
      });

      describe('when using `pathToCurrentFile`', () => {
        it('invokes the method and returns the right value', () => {
          const configuration = new Configuration('/foo/test.js');
          expect(configuration.get('declarationKeyword', {
            pathToImportedModule: '/component.js',
          })).toEqual('const');
        });
      });

      describe('when using none of the paths', () => {
        it('invokes the method and returns the right value', () => {
          const configuration = new Configuration('/foo/bar.js');
          expect(configuration.get('declarationKeyword', {
            pathToImportedModule: '/bar/foo.js',
          })).toEqual('import');
        });
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
          path.join(process.cwd(), '.importjs.js'),
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
          path.join(process.cwd(), '.importjs.js'),
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
          path.join(process.cwd(), '.importjs.js'),
          { environments: ['node', 'meteor'] });
      });

      it('returns core modules from all environments', () => {
        const coreModules = new Configuration().get('coreModules');
        expect(coreModules).toContain('child_process');
        expect(coreModules).toContain('meteor/check');
      });
    });
  });

  describe('#get moduleSideEffectImports', () => {
    describe('in meteor environment', () => {
      describe('with no side-effect imports for a component', () => {
        beforeEach(() => {
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
            useRelativePaths: true,
            environments: ['meteor'],
          });
        });

        it('finds no side-effect imports for components', () => {
          const configuration = new Configuration('./foo/component.js');
          expect(configuration.get('moduleSideEffectImports').sort()).toEqual([]);
        });
      });

      describe('with useRelativePaths true', () => {
        beforeEach(() => {
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
            useRelativePaths: true,
            environments: ['meteor'],
          });
          fs.__setFile(path.join(process.cwd(), 'foo', 'component.css'),
            '',
            { isDirectory: () => false }
          );
          fs.__setFile(path.join(process.cwd(), 'foo', 'component.html'),
            '',
            { isDirectory: () => false }
          );
        });

        it('finds side-effect imports for components and gives them relative paths', () => {
          const configuration = new Configuration('./foo/component.js');
          expect(configuration.get('moduleSideEffectImports').sort()).toEqual([
            './component.css',
            './component.html',
          ]);
        });
        it('finds side-effect imports for components related to jsx modules', () => {
          const configuration = new Configuration('./foo/component.jsx');
          expect(configuration.get('moduleSideEffectImports').sort()).toEqual([
            './component.css',
            './component.html',
          ]);
        });
        it('returns no side-effect imports for components related to unknown module types', () => {
          const configuration = new Configuration('./foo/component.unk');
          expect(configuration.get('moduleSideEffectImports').sort()).toEqual([]);
        });
      });

      describe('with useRelativePaths false', () => {
        beforeEach(() => {
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
            useRelativePaths: false,
            environments: ['meteor'],
          });
          fs.__setFile(path.join(process.cwd(), 'foo', 'component.css'),
            '',
            { isDirectory: () => false }
          );
          fs.__setFile(path.join(process.cwd(), 'foo', 'component.html'),
            '',
            { isDirectory: () => false }
          );
        });

        it('finds side-effect imports for components and gives them absolute paths', () => {
          const configuration = new Configuration('./foo/component.js');
          expect(configuration.get('moduleSideEffectImports').sort()).toEqual([
            '/foo/component.css',
            '/foo/component.html',
          ]);
        });
      });
    });
  });

  describe('#get namedExports from meteor environment', () => {
    beforeEach(() => {
      FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
        environments: ['meteor'],
      });
      fs.__setFile(path.join(process.cwd(), '.meteor', 'packages'), `
john:foo
jane:bar
        `.trim(),
        { isDirectory: () => false }
      );
      fs.__setFile(path.join(process.cwd(), '.meteor', 'versions'), `
john:foo@1.0.0
jane:bar@0.0.1
        `.trim(),
        { isDirectory: () => false }
      );
      FileUtils.__setFile(
        path.join(os.homedir(), '.meteor', 'packages', 'john_foo', '1.0.0', 'isopack.json'),
        {
          name: 'foo',
          summary: 'Metasyntactic package name #1',
          version: '1.0.0',
          isTest: false,
          'isopack-2': {
            builds: [
              {
                kind: 'main',
                arch: 'os',
                path: 'os.json',
              },
            ],
          },
        }
      );
      FileUtils.__setFile(
        path.join(os.homedir(), '.meteor', 'packages', 'john_foo', '1.0.0', 'os.json'),
        {
          format: 'isopack-2-unibuild',
          declaredExports: [
            {
              name: 'foosball',
              testOnly: false,
            },
          ],
        }
      );
      FileUtils.__setFile(
        path.join(process.cwd(), '.meteor', 'local', 'isopacks', 'jane_bar', 'isopack.json'),
        {
          name: 'bar',
          summary: 'Metasyntactic package name #2',
          version: '0.0.1',
          isTest: false,
          'isopack-2': {
            builds: [
              {
                kind: 'main',
                arch: 'os',
                path: 'os.json',
              },
            ],
          },
        }
      );
      FileUtils.__setFile(
        path.join(process.cwd(), '.meteor', 'local', 'isopacks', 'jane_bar', 'os.json'),
        {
          format: 'isopack-2-unibuild',
          declaredExports: [
            {
              name: 'barsketball',
              testOnly: false,
            },
          ],
        }
      );
    });

    it('extracts namedExports and merges them into a single object', () => {
      expect(new Configuration().get('namedExports')).toEqual({
        // These namedExports are the core ones that are always returned for Meteor
        'meteor/accounts-base': ['AccountsClient', 'Accounts', 'AccountsServer'],
        'meteor/blaze': ['Blaze'],
        'meteor/check': ['check', 'Match'],
        'meteor/ddp-client': ['DDP'],
        'meteor/ddp-rate-limiter': ['DDPRateLimiter'],
        'meteor/ejson': ['EJSON'],
        'meteor/email': ['Email'],
        'meteor/http': ['HTTP'],
        'meteor/meteor': ['Meteor'],
        'meteor/mongo': ['Mongo'],
        'meteor/random': ['Random'],
        'meteor/reactive-var': ['ReactiveVar'],
        'meteor/session': ['Session'],
        'meteor/templating': ['Template'],
        'meteor/tracker': ['Tracker'],
        // These namedExports should be extracted from the Meteor metadata
        'meteor/john:foo': ['foosball'],
        'meteor/jane:bar': ['barsketball'],
      });
    });
  });

  describe("#get('packageDependencies')", () => {
    it('returns an empty array', () => {
      expect(new Configuration().get('packageDependencies')).toEqual(new Set([]));
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
        expect(new Configuration().get('packageDependencies'))
          .toEqual(new Set(['foo', 'bar']));
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
        expect(new Configuration().get('packageDependencies'))
          .toEqual(new Set(['foo', 'bar']));
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
        expect(new Configuration().get('packageDependencies'))
          .toEqual(new Set(['foo']));
      });

      describe('when importDevDependencies is true', () => {
        beforeEach(() => {
          FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
            importDevDependencies: true,
          });
        });

        it('returns devDependencies as well', () => {
          expect(new Configuration().get('packageDependencies'))
            .toEqual(new Set(['foo', 'bar']));
        });
      });
    });

    describe('in Meteor environment with package dependencies', () => {
      beforeEach(() => {
        fs.__setFile(path.join(process.cwd(), '.meteor/packages'), `
# comment to be ignored
   john:foo-bar  # has leading white space
check # core package to be ignored
jane:bar-foo@1.0.0   # version to be stripped
          `.trim(),
          { isDirectory: () => false }
        );
        FileUtils.__setFile(path.join(process.cwd(), 'package.json'), {
          dependencies: {
            foo: '1.0.0',
            bar: '2.0.0',
          },
        });
        FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'),
          { environments: ['meteor'] });
      });

      it('returns an array of Meteor and npm dependencies', () => {
        expect(new Configuration().get('packageDependencies'))
          .toEqual(new Set(['meteor/john:foo-bar', 'meteor/jane:bar-foo', 'foo', 'bar']));
      });
    });
  });
});
