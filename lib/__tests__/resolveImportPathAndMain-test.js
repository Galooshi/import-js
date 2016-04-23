jest.mock('../FileUtils');
jest.mock('fs');

describe('resolveImportPathAndMain()', () => {
  function mockFile(file, contents, stats) {
    beforeEach(() => {
      require('fs').__setFile(file, contents, stats);
    });

    afterEach(() => {
      require('fs').__setFile(file, null);
    });
  }

  function mockJsonFile(file, json) {
    beforeEach(() => {
      require('../FileUtils').__setJsonFile(file, json);
    });

    afterEach(() => {
      require('../FileUtils').__setJsonFile(file, null);
    });
  }

  it('returns nulls when path ends with /package.json but does not exist', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
      .toEqual([null, null]);
  });

  describe('when the package.json does not have main', () => {
    mockJsonFile('node_modules/foo/package.json', {});

    it('returns nulls', () => {
      const resolveImportPathAndMain = require('../resolveImportPathAndMain');
      expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
        .toEqual([null, null]);
    });

    describe('when there is an index.js', () => {
      mockFile('node_modules/foo/index.js', '', { isDirectory: () => false });

      it('resolves to index.js', () => {
        const resolveImportPathAndMain = require('../resolveImportPathAndMain');
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'index.js']);
      });
    });

    describe('when there is an index.jsx', () => {
      mockFile('node_modules/foo/index.jsx', '', { isDirectory: () => false });

      it('resolves to index.js', () => {
        const resolveImportPathAndMain = require('../resolveImportPathAndMain');
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'index.jsx']);
      });
    });
  });

  describe('when the package.json has a main file', () => {
    mockJsonFile('node_modules/foo/package.json', { main: 'main-file.js' });

    it('returns the package path and the main file', () => {
      const resolveImportPathAndMain = require('../resolveImportPathAndMain');
      expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
        .toEqual(['node_modules/foo', 'main-file.js']);
    });
  });

  describe('when the package.json has a relative main file', () => {
    mockJsonFile('node_modules/foo/package.json', { main: './lib/main-file.js' });

    it('returns the package path and the normalized main file', () => {
      const resolveImportPathAndMain = require('../resolveImportPathAndMain');
      expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
        .toEqual(['node_modules/foo', 'lib/main-file.js']);
    });
  });

  describe('when the package.json has a main directory', () => {
    mockJsonFile('node_modules/foo/package.json', { main: 'main-dir' });
    mockFile('node_modules/foo/main-dir', '', { isDirectory: () => true });

    describe('and the main directory has an index.js', () => {
      mockFile(
        'node_modules/foo/main-dir/index.js', '', { isDirectory: () => false });

      it('returns the package path and the main directory index.js', () => {
        const resolveImportPathAndMain = require('../resolveImportPathAndMain');
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'main-dir/index.js']);
      });
    });

    describe('and the main directory has an index.jsx', () => {
      mockFile(
        'node_modules/foo/main-dir/index.jsx', '', { isDirectory: () => false });

      it('returns the package path and the main directory index.jsx', () => {
        const resolveImportPathAndMain = require('../resolveImportPathAndMain');
        expect(resolveImportPathAndMain('node_modules/foo/package.json', []))
          .toEqual(['node_modules/foo', 'main-dir/index.jsx']);
      });
    });
  });

  it('returns directory path and index.js for paths ending in index.js', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('path/to/foo/index.js', []))
      .toEqual(['path/to/foo', 'index.js']);
  });

  it('returns directory path and index.jsx for paths ending in index.jsx', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('path/to/foo/index.jsx', []))
      .toEqual(['path/to/foo', 'index.jsx']);
  });

  it('returns file path for non-index js paths', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('path/to/foo.js', []))
      .toEqual(['path/to/foo.js', null]);
  });

  it('returns file path for non-index jsx paths', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('path/to/foo.jsx', []))
      .toEqual(['path/to/foo.jsx', null]);
  });

  it('can strip .js extensions', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('path/to/foo.js', ['.js', '.jsx']))
      .toEqual(['path/to/foo', null]);
  });

  it('can strip .jsx extensions', () => {
    const resolveImportPathAndMain = require('../resolveImportPathAndMain');
    expect(resolveImportPathAndMain('path/to/foo.jsx', ['.js', '.jsx']))
      .toEqual(['path/to/foo', null]);
  });
});
