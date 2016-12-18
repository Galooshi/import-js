import findUsedIdentifiers from '../findUsedIdentifiers';
import parse from '../parse';

it('finds used variables', () => {
  expect(findUsedIdentifiers(parse(`
    const foo = 'foo';
    foo();
    bar();
  `))).toEqual(['foo', 'bar']);
});

it('knows about jsx', () => {
  expect(findUsedIdentifiers(parse(`
    <Foo bar={far.foo()}/>
  `))).toEqual(['React', 'Foo', 'far']);
});