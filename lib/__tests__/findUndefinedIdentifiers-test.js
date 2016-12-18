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

it('knows about scope', () => {
  expect(findUndefinedIdentifiers(parse(`
    () => {
      const foo = 'foo';
      foo();
      bar.flar.nie();
    };
    class Bar {
      constructor() {
        foo();
      }
    }
  `))).toEqual(new Set(['bar', 'foo']));
});

it('knows about jsx', () => {
  expect(findUndefinedIdentifiers(parse(`
    export default <FooBar foo={bar} />;
  `))).toEqual(new Set([
    'React', // Implicit dependency
    'FooBar',
    'bar',
  ]));
});

it('knows about javascript from the 90s', () => {
  expect(findUndefinedIdentifiers(parse(`
    var a = foo + bar;
  `))).toEqual(new Set([
    'foo',
    'bar',
  ]));
});

it('knows about objects', () => {
  expect(findUndefinedIdentifiers(parse(`
    foo({
      bar() {},
      baz: 12,
    });
  `))).toEqual(new Set([
    'foo',
  ]));
});

it('handles es6 imports + commonjs + react', () => {
  expect(findUndefinedIdentifiers(parse(`
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
  `))).toEqual(new Set(['themed', '$', 'CardHeader']));
});
