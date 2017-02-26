import fs from 'fs';
import path from 'path';

import FileUtils from '../FileUtils';
import resolveImportPathAndMain from '../resolveImportPathAndMain';

jest.mock('fs');
jest.mock('../FileUtils');

describe('resolveImportPathAndMain()', () => {
  afterEach(() => {
    fs.__reset();
    FileUtils.__reset();
  });

  it('returns nulls when path ends with /package.json but does not exist', () => {
    expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
      .toEqual([null, null]);
  });

  describe('when the package.json does not have main', () => {
    beforeEach(() => {
      FileUtils.__setFile(
        path.join(process.cwd(), 'node_modules/foo/package.json'), {});
    });

    it('returns nulls', () => {
      expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
        .toEqual([null, null]);
    });

    describe('when there is an index.js', () => {
      beforeEach(() => {
        fs.__setFile(
          path.join(process.cwd(), 'node_modules/foo/index.js'),
          '',
          { isDirectory: () => false },
        );
      });

      it('resolves to index.js', () => {
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'index.js']);
      });
    });

    describe('when there is an index.jsx', () => {
      beforeEach(() => {
        fs.__setFile(
          path.join(process.cwd(), 'node_modules/foo/index.jsx'),
          '',
          { isDirectory: () => false },
        );
      });

      it('resolves to index.js', () => {
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'index.jsx']);
      });
    });
  });

  describe('when the package.json has a main file', () => {
    beforeEach(() => {
      FileUtils.__setFile(
        path.join(process.cwd(), 'node_modules/foo/package.json'),
        { main: 'main-file.js' },
      );
    });

    it('returns the package path and the main file', () => {
      expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
        .toEqual(['node_modules/foo', 'main-file.js']);
    });
  });

  describe('when the package.json has a relative main file', () => {
    beforeEach(() => {
      FileUtils.__setFile(
        path.join(process.cwd(), 'node_modules/foo/package.json'),
        { main: './lib/main-file.js' },
      );
    });

    it('returns the package path and the normalized main file', () => {
      expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
        .toEqual(['node_modules/foo', 'lib/main-file.js']);
    });
  });

  describe('when the package.json has a main directory', () => {
    beforeEach(() => {
      FileUtils.__setFile(
        path.join(process.cwd(), 'node_modules/foo/package.json'),
        { main: 'main-dir' },
      );
      fs.__setFile(
        path.join(process.cwd(), 'node_modules/foo/main-dir'),
        '',
        { isDirectory: () => true },
      );
    });

    describe('and the main directory has an index.js', () => {
      beforeEach(() => {
        fs.__setFile(
          path.join(process.cwd(), 'node_modules/foo/main-dir/index.js'),
          '',
          { isDirectory: () => false },
        );
      });

      it('returns the package path and the main directory index.js', () => {
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'main-dir/index.js']);
      });
    });

    describe('and the main directory has an index.jsx', () => {
      beforeEach(() => {
        fs.__setFile(
          path.join(process.cwd(), 'node_modules/foo/main-dir/index.jsx'),
          '',
          { isDirectory: () => false },
        );
      });

      it('returns the package path and the main directory index.jsx', () => {
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'main-dir/index.jsx']);
      });
    });
  });

  it('returns directory path and index.js for paths ending in index.js', () => {
    expect(resolveImportPathAndMain('path/to/foo/index.js', []))
      .toEqual(['path/to/foo', 'index.js']);
  });

  it('returns directory path and index.jsx for paths ending in index.jsx', () => {
    expect(resolveImportPathAndMain('path/to/foo/index.jsx', []))
      .toEqual(['path/to/foo', 'index.jsx']);
  });

  it('returns file path for non-index js paths', () => {
    expect(resolveImportPathAndMain('path/to/foo.js', []))
      .toEqual(['path/to/foo.js', null]);
  });

  it('returns file path for non-index jsx paths', () => {
    expect(resolveImportPathAndMain('path/to/foo.jsx', []))
      .toEqual(['path/to/foo.jsx', null]);
  });

  it('can strip .js extensions', () => {
    expect(resolveImportPathAndMain('path/to/foo.js', ['.js', '.jsx']))
      .toEqual(['path/to/foo', null]);
  });

  it('can strip .jsx extensions', () => {
    expect(resolveImportPathAndMain('path/to/foo.jsx', ['.js', '.jsx']))
      .toEqual(['path/to/foo', null]);
  });
});
