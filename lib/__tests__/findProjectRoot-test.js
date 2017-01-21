import fs from 'fs';
import path from 'path';

import findProjectRoot from '../findProjectRoot';

jest.mock('fs');

afterEach(() => fs.__reset());

it('finds the right folders', () => {
  fs.__setFile('/foo/node_modules');
  fs.__setFile('/foo/package.json');
  expect(findProjectRoot('/foo/bar/baz.js')).toEqual('/foo');
});

it('throws if it can not find a folder', () => {
  expect(() => findProjectRoot('/foo/bar/baz.js'))
    .toThrowError('No project root found');
});

it('works for relative paths as well', () => {
  fs.__setFile(path.join(process.cwd(), 'foo/node_modules'));
  fs.__setFile(path.join(process.cwd(), 'foo/package.json'));
  expect(findProjectRoot('foo/bar/baz.js'))
    .toEqual(path.join(process.cwd(), 'foo'));
  expect(findProjectRoot('./foo/bar/baz.js'))
    .toEqual(path.join(process.cwd(), 'foo'));
});
