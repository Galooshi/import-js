const parse = require('../parse');

it('knows about object rest spread', () => {
  expect(() => parse(`
    const { a, b, ...c } = foo;
  `)).not.toThrowError();
});
