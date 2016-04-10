jest.mock('../lib/FileUtils');

describe('JsModule', () => {
  function mockJsonFile(file, json) {
    beforeEach(() => {
      require('../lib/FileUtils').__setJsonFile(file, json);
    });

    afterEach(() => {
      require('../lib/FileUtils').__setJsonFile(file, null);
    });
  }

  it('does not modify lookupPath when it is .', () => {
    const JsModule = require('../lib/JsModule');
    const lookupPath = '.';
    JsModule.construct({ lookupPath });
    expect(lookupPath).toEqual('.');
  });

  it('does not modify relativeFilePath when it is .', () => {
    const JsModule = require('../lib/JsModule');
    const relativeFilePath = '.';
    JsModule.construct({ relativeFilePath });
    expect(relativeFilePath).toEqual('.');
  });

  it('strips out the lookup path from relativeFilePath', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('strips file extensions that are configured to be stripped', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.js',
      stripFileExtensions: ['.js', '.jsx'],
    });

    expect(jsModule.importPath).toEqual('lib/foo');
  });

  it('strips double extensions', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.web.js',
      stripFileExtensions: ['.web.js'],
    });

    expect(jsModule.importPath).toEqual('lib/foo');
  });

  it('does not strip parts of double extensions', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      relativeFilePath: 'app/lib/foo.js',
      stripFileExtensions: ['.web.js'],
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('strips stripFromPath from the beginning of the path', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      stripFromPath: 'lib',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('/foo.js');
  });

  it('does not strip anything when stripFromPath is not at the beginning', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      stripFromPath: 'foo',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('prefers makeRelativeTo over stripFromPath', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      stripFromPath: 'lib',
      relativeFilePath: 'app/lib/foo.js',
      makeRelativeTo: 'app/assets/bar.js',
    });

    expect(jsModule.importPath).toEqual('../lib/foo.js');
  });

  it('creates a valid JsModule when index.js is part of the name', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      relativeFilePath: 'lib/index.js/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/index.js/foo.js');
    expect(jsModule.displayName()).toEqual('lib/index.js/foo.js');
  });

  it('produces a correct path when lookupPath is the current directory', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: '.',
      relativeFilePath: './app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('app/lib/foo.js');
  });

  it('produces a correct path when lookupPath starts with a dot', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: './app',
      relativeFilePath: './app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  it('produces a correct path with a relative file in the same directory', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  it('produces a correct same-directory relative path when lookupPath starts with a dot', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: './app',
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  it('produces a correct same-directory relative path when lookupPath is current directory', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: '.',
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  it('produces a correct relative path when other file is in a parent directory', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./lib/foo.js');
  });

  it('produces a correct relative path when other file is in a sibling directory', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/foo/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('../lib/foo.js');
  });

  it('has correct path when other file is in a child of a sibling directory', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'app/foo/gas/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('../../lib/foo.js');
  });

  it('does not create a relative path when other file is in a different lookupPath', () => {
    const JsModule = require('../lib/JsModule');
    const jsModule = JsModule.construct({
      lookupPath: 'app',
      makeRelativeTo: 'spec/foo/gas/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/foo.js');
  });

  describe('.openFilePath()', () => {
    describe('when relative file path has /package.json', () => {
      mockJsonFile('node_modules/foo/package.json', { main: 'main-file.js' });

      it('replaces /package.json at the end with the main file', () => {
        const JsModule = require('../lib/JsModule');
        const jsModule = JsModule.construct({
          relativeFilePath: 'node_modules/foo/package.json',
        });

        expect(jsModule.openFilePath('/path/to/file'))
          .toEqual('node_modules/foo/main-file.js');
      });

      it('does not replace /package.json in the middle', () => {
        const JsModule = require('../lib/JsModule');
        const jsModule = JsModule.construct({
          relativeFilePath: 'node_modules/foo/package.json/bar',
        });

        expect(jsModule.openFilePath('/path/to/file'))
          .toEqual('node_modules/foo/package.json/bar');
      });
    });

    it('makes ./ paths relative to the current file', () => {
      const JsModule = require('../lib/JsModule');
      const jsModule = new JsModule({
        importPath: './index.scss',
      });

      expect(jsModule.openFilePath('/path/to/file'))
        .toEqual('/path/to/index.scss');
    });

    it('makes ../ paths relative to the current file', () => {
      const JsModule = require('../lib/JsModule');
      const jsModule = new JsModule({
        importPath: '../index.scss',
      });

      expect(jsModule.openFilePath('/path/to/file'))
        .toEqual('/path/index.scss');
    });

    describe('when the import path is a package', () => {
      mockJsonFile(
        'node_modules/my-package/package.json',
        { main: 'main-file.js' }
      );

      it('uses the main file', () => {
        const JsModule = require('../lib/JsModule');
        const jsModule = new JsModule({
          importPath: 'my-package',
        });

        expect(jsModule.openFilePath('/path/to/file'))
          .toEqual('node_modules/my-package/main-file.js');
      });
    });

    it('does nothing to the path when it is not a package', () => {
      const JsModule = require('../lib/JsModule');
      const jsModule = new JsModule({
        importPath: 'my-package',
      });

      expect(jsModule.openFilePath('/path/to/file'))
        .toEqual('my-package');
    });
  });
});
