import path from 'path';
import parse from '../parse';

const local = (subPath) => path.resolve(__dirname, subPath);

it('knows about object rest spread', () => {
  expect(() => parse(`
    const { a, b, ...c } = foo;
    `, local('foo,js'))).not.toThrowError();
});

it('knows about decorators', () => {
  expect(() => parse(`
    @Awesome
    class Foo {};
    `, local('foo,js'))).not.toThrowError();
});

it('knows about class properties', () => {
  expect(() => parse(`
    class Foo {
      foo = 'bar';
    }
    `, local('foo,js'))).not.toThrowError();
});

it('knows about dynamic imports', () => {
  expect(() => parse(`
    import('./foo').then(module => module());
    `, local('foo,js'))).not.toThrowError();
});
