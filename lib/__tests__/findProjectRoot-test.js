import fs from 'fs';
import path from 'path';

import findProjectRoot from '../findProjectRoot';

jest.mock('fs');

afterEach(() => fs.__reset());

const normalPackageJsonContents = `{
  "name": "some-package",
  "dependencies": {

  }
}`;

it('finds the right folders', () => {
  // FileUtils.__setFile(path.join(process.cwd(), '.importjs.js'), {
  fs.__setFile(path.join(path.resolve('/'), 'foo', 'package.json'), normalPackageJsonContents);
  fs.__setFile(path.join(path.resolve('/'), 'foo', 'bar', 'package.json'), normalPackageJsonContents);
  expect(findProjectRoot(path.join(path.resolve('/'), 'foo', 'bar', 'baz.js')))
    .toEqual(path.join(path.resolve('/'), 'foo', 'bar'));
});

it('treats package folders as roots', () => {
  fs.__setFile(path.join(path.resolve('/'), 'foo', 'package.json'), normalPackageJsonContents);
  fs.__setFile(path.join(path.resolve('/'), 'foo', 'node_modules', 'bar', 'package.json'), normalPackageJsonContents);
  // expect(findProjectRoot('/foo/node_modules/bar/baz/gaz.js')).toEqual(
  expect(findProjectRoot(path.join(path.resolve('/'), 'foo', 'node_modules', 'bar', 'baz', 'gaz.js')))
    .toEqual(path.join(path.resolve('/'), 'foo', 'node_modules', 'bar'));
});

it('throws if it can not find a folder', () => {
  expect(() => findProjectRoot(path.join('foo', 'bar', 'baz.js'))).toThrowError('No project root found, looking for a directory with a package.json file.');
});

it('works for relative paths as well', () => {
  fs.__setFile(path.join(process.cwd(), path.join('foo', 'package.json')), normalPackageJsonContents);
  expect(findProjectRoot(path.join('foo', 'bar', 'baz.js'))).toEqual(path.join(process.cwd(), 'foo'));
  expect(findProjectRoot(path.join('.', 'foo', 'bar', 'baz.js'))).toEqual(path.join(process.cwd(), 'foo'));
});

it('ignores directories in which the package.json specifies "isRoot": false', () => {
  fs.__setFile(path.join(path.resolve('/'), 'foo', 'package.json'), normalPackageJsonContents);
  fs.__setFile(path.join(path.resolve('/'), 'foo', 'bar', 'package.json'), `{
    "name": "not-root",
    "dependencies": {

    },
    "isRoot": false
  }`);
  expect(findProjectRoot(path.join('/', 'foo', 'bar', 'baz.js'))).toEqual(path.join(path.resolve('/'), 'foo'));
});
