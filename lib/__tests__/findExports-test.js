import findExports from '../findExports';
import parse from '../parse';

it('finds no exports from export-less modules', () => {
  expect(findExports(parse(`
    console.log('boo!');
  `))).toEqual({ named: [], hasDefault: false });
});

it('finds es6 exports', () => {
  expect(findExports(parse(`
    import { foo1, foo2 } from 'foo';
    export default function notRelevant() {};
    const bar = {};
    const car = 'volvo';
    export { bar, car as racecar };
    export let baz = 'baz';
    export { foo1 as bar1, foo2 as bar2 };
    export const { haa, faa } = tor();
    export const hooli = 'facebook';
    export function yo() {};
  `))).toEqual({
    named: [
      'bar',
      'racecar',
      'baz',
      'bar1',
      'bar2',
      'haa',
      'faa',
      'hooli',
      'yo',
    ],
    hasDefault: true,
  });
});

it('finds CommonJS exports', () => {
  expect(findExports(parse(`
    const bar = function() {};
    module.exports = {
      foo: 'abc',
      bar,
      123: '123',
    }
  `))).toEqual({
    named: ['foo', 'bar'],
    hasDefault: true,
  });
});

it('finds CommonJS exports defined earlier in the file', () => {
  expect(findExports(parse(`
    const haha = {
      foo: 'abc',
      bar: 'xyz',
    }
    module.exports = haha;
  `))).toEqual({
    named: ['foo', 'bar'],
    hasDefault: true,
  });
});

it('parses React correctly', () => {
  expect(findExports(parse(`
var React = {

  // Modern

  Children: {
    map: ReactChildren.map,
    forEach: ReactChildren.forEach,
    count: ReactChildren.count,
    toArray: ReactChildren.toArray,
    only: onlyChild
  },

  Component: ReactComponent,
  PureComponent: ReactPureComponent,

  createElement: createElement,
  cloneElement: cloneElement,
  isValidElement: ReactElement.isValidElement,

  // Classic

  PropTypes: ReactPropTypes,
  createClass: ReactClass.createClass,
  createFactory: createFactory,
  createMixin: function (mixin) {
    // Currently a noop. Will be used to validate and trace mixins.
    return mixin;
  },

  // This looks DOM specific but these are actually isomorphic helpers
  // since they are just generating DOM strings.
  DOM: ReactDOMFactories,

  version: ReactVersion,

  // Deprecated hook for JSX spread, don't use this for anything.
  __spread: __spread
};

module.exports = React;

  `))).toEqual({
    named: [
      'Children',
      'Component',
      'PureComponent',
      'createElement',
      'cloneElement',
      'isValidElement',
      'PropTypes',
      'createClass',
      'createFactory',
      'createMixin',
      'DOM',
      'version',
      '__spread',
    ],
    hasDefault: true,
  });
});
