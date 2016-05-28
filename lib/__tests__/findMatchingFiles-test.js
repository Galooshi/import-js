import fs from 'fs';
import path from 'path';

import mkdirp from 'mkdirp';
import rimraf from 'rimraf';

import findMatchingFiles from '../findMatchingFiles';

['node', 'find'].forEach((finder) => {
  describe(`findMatchingFiles finder: ${finder}`, () => {
    const tmpDir = './tmp-findMatchingFiles';
    let subject;
    let word;
    let existingFiles;
    let lookupPath;
    let originalPlatform;

    if (finder === 'node') {
      beforeEach(() => {
        originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', {
          value: 'win32',
        });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
        });
      });
    }

    beforeEach(() => {
      fs.mkdirSync(tmpDir);
      word = 'foo';
      existingFiles = [];
      lookupPath = tmpDir;

      subject = () => {
        existingFiles.forEach((file) => {
          const fullPath = `${tmpDir}/${file}`;
          mkdirp.sync(path.dirname(fullPath));
          fs.closeSync(fs.openSync(fullPath, 'w')); // create empty file
        });

        return findMatchingFiles(lookupPath, word, finder);
      };
    });

    afterEach((done) => {
      rimraf(tmpDir, done);
    });

    describe('when there are no matching files', () => {
      beforeEach(() => {
        existingFiles = [
          'car/door.js',
        ];
      });

      it('returns an empty array', () => {
        expect(subject()).toEqual([]);
      });
    });

    describe('when the lookup path is empty', () => {
      beforeEach(() => {
        lookupPath = '';
      });

      it('throws an error', () => {
        expect(subject).toThrowError(/empty/);
      });
    });

    describe('when there are multiple files matching word', () => {
      beforeEach(() => {
        existingFiles = [
          'bar/foo.js',
          'car/Foo.jsx',
          'tzar/foo/index.js',
          'car/door.js',
          'har-har/foo/package.json',
          'car/door/index.js',
          'react/foo/index.jsx',
        ];
      });

      it('returns the matching files', () => {
        expect(subject().sort()).toEqual([
          `${tmpDir}/bar/foo.js`,
          `${tmpDir}/car/Foo.jsx`,
          `${tmpDir}/har-har/foo/package.json`,
          `${tmpDir}/react/foo/index.jsx`,
          `${tmpDir}/tzar/foo/index.js`,
        ]);
      });
    });

    describe('when the word has camelCase', () => {
      beforeEach(() => {
        word = 'FooBar';
      });

      it('matches snake_case names', () => {
        existingFiles = ['foo_bar.js'];
        expect(subject()).toEqual([`${tmpDir}/foo_bar.js`]);
      });

      it('matches camelCase names', () => {
        existingFiles = ['fooBar.js'];
        expect(subject()).toEqual([`${tmpDir}/fooBar.js`]);
      });

      it('matches folder + file name', () => {
        existingFiles = ['foo/Bar.js'];
        expect(subject()).toEqual([`${tmpDir}/foo/Bar.js`]);
      });

      it('matches plural folder name + file name', () => {
        existingFiles = ['foos/Bar.js'];
        expect(subject()).toEqual([`${tmpDir}/foos/Bar.js`]);
      });
    });
  });
});
