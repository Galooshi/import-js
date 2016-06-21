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

      it('returns an empty array', (done) => {
        subject().then((files) => {
          expect(files).toEqual([]);
          done();
        });
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

      it('returns the matching files', (done) => {
        subject().then((files) => {
          expect(files.sort()).toEqual([
            `${tmpDir}/bar/foo.js`,
            `${tmpDir}/car/Foo.jsx`,
            `${tmpDir}/har-har/foo/package.json`,
            `${tmpDir}/react/foo/index.jsx`,
            `${tmpDir}/tzar/foo/index.js`,
          ]);
          done();
        });
      });
    });

    describe('when the word has camelCase', () => {
      beforeEach(() => {
        word = 'FooBar';
      });

      it('matches snake_case names', (done) => {
        existingFiles = ['foo_bar.js'];
        subject().then((files) => {
          expect(files).toEqual([`${tmpDir}/foo_bar.js`]);
          done();
        });
      });

      it('matches camelCase names', (done) => {
        existingFiles = ['fooBar.js'];
        subject().then((files) => {
          expect(files).toEqual([`${tmpDir}/fooBar.js`]);
          done();
        });
      });

      it('matches folder + file name', (done) => {
        existingFiles = ['foo/Bar.js'];
        subject().then((files) => {
          expect(files).toEqual([`${tmpDir}/foo/Bar.js`]);
          done();
        });
      });

      it('matches plural folder name + file name', (done) => {
        existingFiles = ['foos/Bar.js'];
        subject().then((files) => {
          expect(files).toEqual([`${tmpDir}/foos/Bar.js`]);
          done();
        });
      });
    });
  });
});
