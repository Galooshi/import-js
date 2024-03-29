import path from 'path';
import findUsedIdentifiers from '../findUsedIdentifiers';
import parse from '../parse';

const local = (subPath) => path.resolve(__dirname, subPath);

it('finds used variables', () => {
  expect(
    findUsedIdentifiers(
      parse(
        `
    api.something();
    const foo = 'foo';
    foo();
    bar();
  `,
        local('foo.js'),
      ),
    ),
  ).toEqual(new Set(['api', 'foo', 'bar']));
});

it('knows about jsx', () => {
  expect(
    findUsedIdentifiers(
      parse(
        `
    <Foo bar={far.foo()}/>
  `,
        local('foo.jsx'),
      ),
    ),
  ).toEqual(new Set(['far', 'Foo']));
});

it('knows about flow annotations', () => {
  expect(
    findUsedIdentifiers(
      parse(
        `
    class Foo {
      bar: Car;
    }
  `,
        local('foo.js'),
      ),
    ),
  ).toEqual(new Set(['Car']));
});

it('knows about export declarations', () => {
  expect(
    findUsedIdentifiers(
      parse(
        `
    const foo = 'foo';
    const baz = 'baz';
    export { foo as bar }
    export { baz }
  `,
        local('foo.js'),
      ),
    ),
  ).toEqual(new Set(['foo', 'baz']));
});

it('treats items in arrays as used', () => {
  expect(
    findUsedIdentifiers(
      parse(
        `
    [Foo, Bar]
  `,
        local('foo.js'),
      ),
    ),
  ).toEqual(new Set(['Foo', 'Bar']));
});

it('treats items used as arguments as used', () => {
  expect(
    findUsedIdentifiers(
      parse(
        `
    foo(Foo, Bar);
  `,
        local('foo.js'),
      ),
    ),
  ).toEqual(new Set(['foo', 'Foo', 'Bar']));
});
