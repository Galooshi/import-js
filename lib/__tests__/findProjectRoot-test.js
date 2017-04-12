import fs from 'fs';
import path from 'path';

import findProjectRoot from '../findProjectRoot';

jest.mock('fs');

afterEach(() => fs.__reset());

it('finds the right folders', () => {
  fs.__setFile('/foo/node_modules');
  fs.__setFile('/foo/package.json');
  fs.__setFile('/foo/bar/package.json');
  expect(findProjectRoot('/foo/bar/baz.js')).toEqual('/foo');
});

it('treats package folders as roots', () => {
  // ...even if they don't have a nested node_modules folder
  fs.__setFile('/foo/node_modules');
  fs.__setFile('/foo/node_modules/bar/package.json');
  expect(findProjectRoot('/foo/node_modules/bar/baz/gaz.js')).toEqual(
    '/foo/node_modules/bar',
  );
});

it('throws if it can not find a folder', () => {
  expect(() => findProjectRoot('/foo/bar/baz.js')).toThrowError(
    'No project root found, looking for a directory with either a package.json file or a node_modules directory.',
  );
});

it('works for relative paths as well', () => {
  fs.__setFile(path.join(process.cwd(), 'foo/node_modules'));
  fs.__setFile(path.join(process.cwd(), 'foo/package.json'));
  expect(findProjectRoot('foo/bar/baz.js')).toEqual(
    path.join(process.cwd(), 'foo'),
  );
  expect(findProjectRoot('./foo/bar/baz.js')).toEqual(
    path.join(process.cwd(), 'foo'),
  );
});
