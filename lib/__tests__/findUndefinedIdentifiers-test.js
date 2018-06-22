import findUndefinedIdentifiers from '../findUndefinedIdentifiers';
import parse from '../parse';

it('finds all undefined identifiers', () => {
  expect(findUndefinedIdentifiers(parse(`
    const foo = 'foo';
    foo();
    bar();
  `))).toEqual(new Set(['bar']));
});

it('recognizes multi-assignment', () => {
  expect(findUndefinedIdentifiers(parse(`
    const foo = 'foo', bar = 'bar';
    foo();
    bar();
  `))).toEqual(new Set([]));
});

it('recognizes destructured assignment', () => {
  expect(findUndefinedIdentifiers(parse(`
    import Foo from 'foo';
    const { bar } = Foo;
    bar();
  `))).toEqual(new Set([]));
});

it('recognizes destructured assignment to a new name', () => {
  expect(findUndefinedIdentifiers(parse(`
    import Foo from 'foo';
    const { bar: scar } = Foo;
    scar();
  `))).toEqual(new Set([]));
});

it('knows about scope', () => {
  expect(findUndefinedIdentifiers(parse(`
    () => {
      const foo = 'foo';
      foo();
      bar.flar.nie();
      class Flan {}
    };
    class Bar {
      constructor() {
        foo();
      }
    }
    new Flan();
  `))).toEqual(new Set(['Flan', 'bar', 'foo']));
});

it('knows about dynamic keys', () => {
  expect(findUndefinedIdentifiers(parse(`
    const foo = {
      [bar]: 'yes',
    };
  `))).toEqual(new Set(['bar']));
});

it('knows about jsx', () => {
  expect(findUndefinedIdentifiers(parse(`
    export default <FooBar foo={bar} />;
  `))).toEqual(new Set([
    'bar',
    'React', // Implicit dependency
    'FooBar',
  ]));
});

it('ignores lowercase jsx element identifiers', () => {
  expect(findUndefinedIdentifiers(parse("export default <input value='foo' />;"))).toEqual(new Set([
    'React', // Implicit dependency
  ]));
});

it('knows about methods inside jsx', () => {
  expect(findUndefinedIdentifiers(parse(`
    <FooBar foo={(gar, car) => gar() + car()} />
  `))).toEqual(new Set([
    'React', // Implicit dependency
    'FooBar',
  ]));
});

it('knows about using an unconventional opening jsx tag', () => {
  expect(findUndefinedIdentifiers(parse(`
    <FooBar.Tar />
  `))).toEqual(new Set([
    'React', // Implicit dependency
    'FooBar',
  ]));
});

it('knows about fragment empty tag jsx syntax', () => {
  expect(findUndefinedIdentifiers(parse(`
    <FooBar><>{foo}</></FooBar>
  `))).toEqual(new Set([
    'React', // Implicit dependency
    'FooBar',
    'foo',
  ]));
});

it('knows about binary expression trees', () => {
  expect(findUndefinedIdentifiers(parse(`
    var a = foo + bar;
  `))).toEqual(new Set(['foo', 'bar']));
});

it('knows about nested binary expression trees', () => {
  expect(findUndefinedIdentifiers(parse(`
    var a = foo + bar + baz;
  `))).toEqual(new Set(['foo', 'bar', 'baz']));
});

it('knows about namespace imports', () => {
  expect(findUndefinedIdentifiers(parse(`
    import * as api from './api'

    api.get();
  `))).toEqual(new Set([]));
});

it('knows about objects', () => {
  expect(findUndefinedIdentifiers(parse(`
    foo({
      bar() {},
      baz: 12,
      uuid: uuid.v4(),
    });
  `))).toEqual(new Set(['foo', 'uuid']));
});

it('knows about default parameters', () => {
  expect(findUndefinedIdentifiers(parse(`
    foo({
      bar(a = 123) {},
    });

    function x(b = 456) {}
  `))).toEqual(new Set(['foo']));
});

it('knows about array destructuring', () => {
  expect(findUndefinedIdentifiers(parse(`
    const [a] = []

    function foo([b]) {}
  `))).toEqual(new Set([]));
});

it('finds variables in export declarations', () => {
  expect(findUndefinedIdentifiers(parse(`
    const test = {};
    export { test as react };
    export { foo as bar };
  `))).toEqual(new Set(['foo']));
});

it('knows about identifiers declared after usage', () => {
  expect(findUndefinedIdentifiers(parse(`
    function modifyAbc() {
      abc.def = 4;
    }

    export const abc = {};
  `))).toEqual(new Set([]));
});

it('knows about hoisting', () => {
  expect(findUndefinedIdentifiers(parse(`
    hoistedFunction();
    hoistedVariable.foo();
    new HoistedClass();
    hoistedImport.bar();

    function hoistedFunction() {}
    var hoistedVariable = { foo: () => null };
    class HoistedClass {}
    import hoistedImport from 'hoisterImport';
        `))).toEqual(new Set([]));
});

it('handles es6 imports + commonjs + react', () => {
  expect(findUndefinedIdentifiers(
    parse(`
    import React from 'react';
    import Button from '../button';
    import { Card } from 'card';

    const CardButton = themed(React.createClass({
      componentWillMount() {
        $.get('/api/users/1');
      },
      render() {
        const themed = true;
        return (
          <Card themed={themed}>
            <CardHeader>
              {this.props.header}
            </CardHeader>
            <Button disabled={this.props.disabled}>
              {this.props.buttonLabel}
            </Button>
          </Card>
        );
      }
    }));
    module.exports = CardButton;
  `),
    ['module'],
  )).toEqual(new Set(['themed', '$', 'CardHeader']));
});
