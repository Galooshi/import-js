const parse = require('../parse');

it('knows about object rest spread', () => {
  expect(() => parse(`
    const { a, b, ...c } = foo;
  `)).not.toThrowError();
});

it('knows about decorators', () => {
  expect(() => parse(`
    @Awesome
    class Foo {};
  `)).not.toThrowError();
});

it('knows about class properties', () => {
  expect(() => parse(`
    class Foo {
      foo = 'bar';
    }
  `)).not.toThrowError();
});
