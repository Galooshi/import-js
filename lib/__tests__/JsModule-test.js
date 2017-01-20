import path from 'path';

import FileUtils from '../FileUtils';
import JsModule from '../JsModule';
import requireResolve from '../requireResolve';

jest.mock('../FileUtils');
jest.mock('../requireResolve');

describe('JsModule', () => {
  afterEach(() => {
    FileUtils.__reset();
    requireResolve.__reset();
  });

  it('does not modify relativeFilePath when it is .', () => {
    const relativeFilePath = '.';
    JsModule.construct({ relativeFilePath });
    expect(relativeFilePath).toEqual('.');
  });

  it('strips file extensions that are configured to be stripped', () => {
    const jsModule = JsModule.construct({
      relativeFilePath: 'app/lib/foo.js',
      stripFileExtensions: ['.js', '.jsx'],
    });

    expect(jsModule.importPath).toEqual('app/lib/foo');
  });

  it('strips double extensions', () => {
    const jsModule = JsModule.construct({
      relativeFilePath: 'app/lib/foo.web.js',
      stripFileExtensions: ['.web.js'],
    });

    expect(jsModule.importPath).toEqual('app/lib/foo');
  });

  it('does not strip parts of double extensions', () => {
    const jsModule = JsModule.construct({
      relativeFilePath: 'app/lib/foo.js',
      stripFileExtensions: ['.web.js'],
    });

    expect(jsModule.importPath).toEqual('app/lib/foo.js');
  });

  it('creates a valid JsModule when index.js is part of the name', () => {
    const jsModule = JsModule.construct({
      relativeFilePath: 'lib/index.js/foo.js',
    });

    expect(jsModule.importPath).toEqual('lib/index.js/foo.js');
    expect(jsModule.displayName()).toEqual('lib/index.js/foo.js');
  });

  it('produces a correct path with a relative file in the same directory', () => {
    const jsModule = JsModule.construct({
      makeRelativeTo: 'app/lib/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./foo.js');
  });

  it('produces a correct relative path when other file is in a parent directory', () => {
    const jsModule = JsModule.construct({
      makeRelativeTo: 'app/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('./lib/foo.js');
  });

  it('produces a correct relative path when other file is in a sibling directory', () => {
    const jsModule = JsModule.construct({
      makeRelativeTo: 'app/foo/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('../lib/foo.js');
  });

  it('has correct path when other file is in a child of a sibling directory', () => {
    const jsModule = JsModule.construct({
      makeRelativeTo: 'app/foo/gas/bar.js',
      relativeFilePath: 'app/lib/foo.js',
    });

    expect(jsModule.importPath).toEqual('../../lib/foo.js');
  });

  describe('when relative file path has /package.json and a relative main', () => {
    beforeEach(() => {
      FileUtils.__setFile(
        path.join(process.cwd(), 'node_modules/foo/package.json'),
        { main: './lib/main-file.js' }
      );
    });

    it('normalizes filePath', () => {
      const jsModule = JsModule.construct({
        relativeFilePath: 'node_modules/foo/package.json',
      });

      expect(jsModule.filePath).toEqual('node_modules/foo/lib/main-file.js');
    });
  });


  describe('.resolvedFilePath()', () => {
    describe('when relative file path has /package.json', () => {
      beforeEach(() => {
        FileUtils.__setFile(
          path.join(process.cwd(), 'node_modules/foo/package.json'),
          { main: 'main-file.js' }
        );
      });

      it('replaces /package.json at the end with the main file', () => {
        const jsModule = JsModule.construct({
          relativeFilePath: 'node_modules/foo/package.json',
        });

        expect(jsModule.resolvedFilePath('/path/to/file'))
          .toEqual('node_modules/foo/main-file.js');
      });

      it('does not replace /package.json in the middle', () => {
        const jsModule = JsModule.construct({
          relativeFilePath: 'node_modules/foo/package.json/bar',
        });

        expect(jsModule.resolvedFilePath('/path/to/file'))
          .toEqual('node_modules/foo/package.json/bar');
      });
    });

    it('makes ./ paths relative to the current file', () => {
      const jsModule = new JsModule({
        importPath: './index.scss',
      });

      expect(jsModule.resolvedFilePath('/path/to/file'))
        .toEqual('/path/to/index.scss');
    });

    it('makes ../ paths relative to the current file', () => {
      const jsModule = new JsModule({
        importPath: '../index.scss',
      });

      expect(jsModule.resolvedFilePath('/path/to/file'))
        .toEqual('/path/index.scss');
    });

    describe('when the import path is a package', () => {
      beforeEach(() => {
        requireResolve.__addResolvedPath(path.join(process.cwd(), 'my-package'),
          path.join(process.cwd(), 'node_modules/my-package/main-file.js'));
      });

      it('uses the resolved file', () => {
        const jsModule = new JsModule({
          importPath: 'my-package',
        });

        expect(jsModule.resolvedFilePath('/path/to/file')).toEqual(
          path.join(process.cwd(), 'node_modules/my-package/main-file.js'));
      });
    });

    it('does nothing to the path when it is not a package', () => {
      const jsModule = new JsModule({
        importPath: 'my-package',
      });

      expect(jsModule.resolvedFilePath('/path/to/file'))
        .toEqual(path.join(process.cwd(), 'my-package'));
    });
  });
});
