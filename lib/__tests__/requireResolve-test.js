import path from 'path';

import requireResolve from '../requireResolve';

it('throws for relative paths', () => {
  expect(() => requireResolve('eslint')).toThrowError(
    'Path must be absolute: eslint',
  );
});

it('resolves known packages', () => {
  expect(
    requireResolve(path.join(process.cwd(), 'node_modules/minimatch')),
  ).toEqual(path.join(process.cwd(), 'node_modules/minimatch/minimatch.js'));
});

it('does not fail for unknown packages', () => {
  expect(
    requireResolve(path.join(process.cwd(), 'node_modules/foobar')),
  ).toEqual(path.join(process.cwd(), 'node_modules/foobar'));
});
