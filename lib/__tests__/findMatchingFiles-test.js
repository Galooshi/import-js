/* global spyOn */
import fs from 'fs';
import os from 'os';
import path from 'path';

import mkdirp from 'mkdirp';
import rimraf from 'rimraf';

import WatchmanFileCache from '../WatchmanFileCache';
import findMatchingFiles from '../findMatchingFiles';

['node', 'find', 'watchman'].forEach((finder) => {
  describe(`findMatchingFiles finder: ${finder}`, () => {
    const tmpDir = path.join(os.tmpdir(), 'tmp-findMatchingFiles');
    let subject;
    let word;
    let existingFiles;
    let originalPlatform;
    let workingDirectory;

    beforeEach(() => {
      workingDirectory = tmpDir;
    });

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

    if (finder === 'watchman') {
      beforeEach(() => {
        word = 'foo';

        subject = () => {
          const watchmanFileCache = WatchmanFileCache.getForWorkingDirectory(
            tmpDir);
          spyOn(watchmanFileCache, 'getFiles').and.returnValue(
            new Set(existingFiles.map((file) => `./${file}`)));
          spyOn(watchmanFileCache, 'isEnabled').and.returnValue(true);
          return findMatchingFiles(word, workingDirectory);
        };
      });
    } else {
      beforeEach(() => {
        fs.mkdirSync(tmpDir);
        word = 'foo';
        existingFiles = [];

        subject = () => {
          existingFiles.forEach((file) => {
            const fullPath = path.join(tmpDir, file);
            mkdirp.sync(path.dirname(fullPath));
            fs.closeSync(fs.openSync(fullPath, 'w')); // create empty file
          });

          return findMatchingFiles(word, workingDirectory);
        };
      });
    }

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
            './bar/foo.js',
            './car/Foo.jsx',
            './har-har/foo/package.json',
            './react/foo/index.jsx',
            './tzar/foo/index.js',
          ]);
          done();
        });
      });

      describe('when in a different working directory', () => {
        beforeEach(() => {
          workingDirectory = '/foo';
        });

        it('returns no matching files', (done) => {
          subject().then((files) => {
            expect(files).toEqual([]);
            done();
          });
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
          expect(files).toEqual(['./foo_bar.js']);
          done();
        });
      });

      it('matches camelCase names', (done) => {
        existingFiles = ['fooBar.js'];
        subject().then((files) => {
          expect(files).toEqual(['./fooBar.js']);
          done();
        });
      });

      it('matches folder + file name', (done) => {
        existingFiles = ['foo/Bar.js'];
        subject().then((files) => {
          expect(files).toEqual(['./foo/Bar.js']);
          done();
        });
      });

      it('matches plural folder name + file name', (done) => {
        existingFiles = ['foos/Bar.js'];
        subject().then((files) => {
          expect(files).toEqual(['./foos/Bar.js']);
          done();
        });
      });
    });
  });
});
