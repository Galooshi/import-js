/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

import mkdirp from 'mkdirp';
import rimraf from 'rimraf';

import Importer from './Importer';
import WatchmanFileCache from './WatchmanFileCache';

const numberOfFiles = parseInt(process.argv[2], 10);
const numberOfFolders = numberOfFiles / 10;

const tmpFolder = './benchmark-files';
const cycles = 10;

rimraf.sync(tmpFolder);

console.log(`Setting up benchmark for ${numberOfFiles} files, ` +
            `in ${numberOfFolders} folders`);

for (let i = 0; i < numberOfFiles; i++) {
  const folderNumber = i % numberOfFolders;
  const fullPath = `${tmpFolder}/folder-${folderNumber}/file${i}.js`;
  mkdirp.sync(path.dirname(fullPath));
  fs.closeSync(fs.openSync(fullPath, 'w')); // create empty file
}

function runImportIter(counter, done) {
  const importer = new Importer(
    [
      'file1();',
      'file2();',
      'file3();',
      'file4();',
      'file5();',
      'file6();',
      'file7();',
    ],
    'dummy.js'
  );

  importer.fixImports().then((result) => {
    if (!/^import file1 from/.test(result.fileContent)) {
      // We expect something to be imported. If not, something is wrong
      throw result;
    }
    if (counter === cycles) {
      done();
    } else {
      runImportIter(counter + 1, done);
    }
  }).catch((error) => {
    console.error(error);
  });
}

function runTest(done) {
  const startTime = new Date().getTime();
  runImportIter(1, () => {
    const stopTime = new Date().getTime();
    const diff = stopTime - startTime;
    const timePerCycle = diff / cycles;
    console.log(`Total time ${diff}ms`);
    console.log(`Time per cycle ${timePerCycle}ms`);
    done();
  });
}

console.log('Testing (without watchman)...');
runTest(() => {
  console.log('Testing (with watchman)...');
  WatchmanFileCache.getForWorkingDirectory(process.cwd()).initialize()
    .then(() => {
      runTest(() => {
        console.log('All done.');
        process.exit();
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit();
    });
});
