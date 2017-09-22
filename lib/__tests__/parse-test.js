import parse from '../parse';

it('knows about object rest spread', () => {
  expect(() => parse(
    `
    const { a, b, ...c } = foo;
    `,
  )).not.toThrowError();
});

it('knows about decorators', () => {
  expect(() => parse(
    `
    @Awesome
    class Foo {};
    `,
  )).not.toThrowError();
});

it('knows about class properties', () => {
  expect(() => parse(
    `
    class Foo {
      foo = 'bar';
    }
    `,
  )).not.toThrowError();
});

it('knows about dynamic imports', () => {
  expect(() => parse(
    `
    import('./foo').then(module => module());
    `,
  )).not.toThrowError();
});

it('knows about flow-type declare class exports', () => {
  expect(() => parse(
    `
    declare export class Request {
      constructor(test: string): this
    }
    `,
  )).not.toThrowError();
});
