import findUsedIdentifiers from '../findUsedIdentifiers';
import parse from '../parse';

it('finds used variables', () => {
  expect(findUsedIdentifiers(parse(`
    const foo = 'foo';
    foo();
    bar();
  `))).toEqual(new Set(['foo', 'bar']));
});

it('knows about jsx', () => {
  expect(findUsedIdentifiers(parse(`
    <Foo bar={far.foo()}/>
  `))).toEqual(new Set(['far', 'React', 'Foo']));
});

it('knows about flow annotations', () => {
  expect(findUsedIdentifiers(parse(`
    class Foo {
      bar: Car;
    }
  `))).toEqual(new Set(['Car']));
});

it('treats items in arrays as used', () => {
  expect(findUsedIdentifiers(parse(`
    [Foo, Bar]
  `))).toEqual(new Set(['Foo', 'Bar']));
});

it('treats items used as arguments as used', () => {
  expect(findUsedIdentifiers(parse(`
    foo(Foo, Bar);
  `))).toEqual(new Set(['foo', 'Foo', 'Bar']));
});
