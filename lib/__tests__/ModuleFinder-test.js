import path from 'path';

import requireRelative from 'require-relative';

import ModuleFinder from '../ModuleFinder';
import findPackageDependencies from '../findPackageDependencies';
import lastUpdate from '../lastUpdate';
import normalizePath from '../normalizePath';
import readFile from '../readFile';

jest.mock('../readFile');
jest.mock('../findPackageDependencies');
jest.mock('../lastUpdate');

let moduleFinder;

function addFiles(files) {
  return moduleFinder.handleFilesAdded(
    files.map(file => ({
      path: normalizePath(file, process.cwd()),
      mtime: Date.now(),
    })),
  );
}

beforeEach(() => {
  readFile.mockImplementation(() => Promise.resolve('export default {}'));

  findPackageDependencies.mockImplementation(
    () => new Set(['pacman', 'react-packer', 'hoisted']),
  );

  requireRelative.resolve = jest.fn();
  requireRelative.resolve.mockImplementation((moduleName) => {
    switch (moduleName) {
      case 'pacman' :
        return path.join(process.cwd(), '/node_modules/pacman/index.js');
      case 'react-packer' :
        return path.join(process.cwd(), '/node_modules/react-packer/index.js');
      case 'hoisted' :
        return path.resolve(process.cwd(), '../../node_modules/hoisted/index.js');
      default:
        throw new Error(`Unknown dependency ${moduleName}`);
    }
  });

  lastUpdate.mockImplementation(pathToFile => Promise.resolve({
    path: pathToFile,
    mtime: 1,
  }));

  moduleFinder = ModuleFinder.getForWorkingDirectory(process.cwd(), {
    excludes: [],
    ignorePackagePrefixes: ['react-'],
  });
  return moduleFinder.initializeStorage(':memory:');
});

afterEach(() => moduleFinder.storage.close());

it('finds files', () => addFiles(['./foo/bar.js']).then(() =>
  moduleFinder.find('bar').then((result) => {
    expect(result).toEqual([
      {
        path: './foo/bar.js',
        name: 'bar',
        isDefault: true,
      },
    ]);
  })));

it('finds package dependencies', () => addFiles([
  './package.json',
]).then(() => moduleFinder.find('pacman').then((result) => {
  expect(result).toEqual([
    {
      path: './node_modules/pacman/index.js',
      name: 'pacman',
      isDefault: true,
    },
  ]);
})));

it('finds package dependencies not located in the local node_modules folder', () => addFiles([
  './package.json',
]).then(() => moduleFinder.find('hoisted').then((result) => {
  expect(result).toEqual([
    {
      path: '../../node_modules/hoisted/index.js',
      name: 'hoisted',
      isDefault: true,
    },
  ]);
})));

it('can ignore package prefixes', () => addFiles([
  './package.json',
]).then(() => moduleFinder.find('packer').then((result) => {
  expect(result).toEqual([
    {
      path: './node_modules/react-packer/index.js',
      name: 'packer',
      isDefault: true,
    },
  ]);
})));

it('matches over the last folder name', () => addFiles([
  './Foo/bar.js',
]).then(() => moduleFinder.find('foobar').then((result) => {
  expect(result).toEqual([
    {
      path: './Foo/bar.js',
      name: 'foobar',
      isDefault: true,
    },
  ]);
})));

it('knows about plural when matching over folder name', () => addFiles([
  './Foos/bar.js',
]).then(() => moduleFinder.find('foobar').then((result) => {
  expect(result).toEqual([
    {
      path: './Foos/bar.js',
      name: 'foobar',
      isDefault: true,
    },
  ]);
})));
