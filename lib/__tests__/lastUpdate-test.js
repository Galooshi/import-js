import lastUpdate from '../lastUpdate';

it('works for existing files', () => lastUpdate('./lib/__tests__/lastUpdate-test.js', process.cwd()).then((result) => {
  expect(result.path).toEqual('./lib/__tests__/lastUpdate-test.js');
  expect(result.mtime).toBeGreaterThan(0);
}));

it('rejects for non-existing files', () => lastUpdate('./bogus').then(() => { throw new Error('err'); }).catch((e) => {
  expect(e).toBeDefined();
}));

it('does not reject when using failSafe', () => lastUpdate.failSafe('./bogus', process.cwd()).then((result) => {
  expect(result.path).toEqual('./bogus');
  expect(result.mtime).toBe(0);
}));
