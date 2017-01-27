import fs from 'fs';

import findExports from '../findExports';
import requireResolve from '../requireResolve';

jest.mock('fs');
jest.mock('../requireResolve');

beforeEach(() => {
  fs.__reset();
  requireResolve.__reset();
});

it('finds no exports from export-less modules', () => {
  expect(findExports(`
    console.log('boo!');
  `)).toEqual({ named: [], hasDefault: false });
});

it('finds exports from json', () => {
  expect(findExports(`
    {
      "foo": {
        "foobar": 1
      },
      "bar": "Brown's bar"
    }
  `, '/path/to/file.json')).toEqual({
    named: ['foo', 'bar'],
    hasDefault: true,
  });
});

it('finds es6 exports', () => {
  expect(findExports(`
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
    export class Foo {}
  `)).toEqual({
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
      'Foo',
    ],
    hasDefault: true,
  });
});

it('finds CommonJS exports', () => {
  expect(findExports(`
    const bar = function() {};
    module.exports = {
      foo: 'abc',
      bar,
      123: '123',
    }
    module.exports.car = 'volvo';
  `)).toEqual({
    named: ['foo', 'bar', 'car'],
    hasDefault: true,
  });
});

it('finds CommonJS exports not using the "module" prefix', () => {
  expect(findExports(`
    const bar = function() {};
    exports = {
      foo: 'abc',
      bar,
      123: '123',
    }
    exports.car = 'volvo';
  `)).toEqual({
    named: ['foo', 'bar', 'car'],
    hasDefault: true,
  });
});

it('finds CommonJS exports using `exports.use`', () => {
  // This is from chai
  // https://github.com/chaijs/chai/blob/dcd5baa34a/lib/chai.js#L85
  expect(findExports(`
    var should = function() {};
    exports.use(should);
    var nothing = function() {};
    exports.somethingElse(nothing);
  `)).toEqual({
    named: ['should'],
    hasDefault: false,
  });
});

it('does not fail on empty variable declarations', () => {
  expect(findExports(`
    let bar;
    bar = 'keyzar';
  `)).toEqual({
    named: [],
    hasDefault: false,
  });
});

it('finds CommonJS exports defined earlier in the file', () => {
  expect(findExports(`
    const haha = {
      foo: 'abc',
      bar: 'xyz',
    }
    module.exports = haha;
  `)).toEqual({
    named: ['foo', 'bar'],
    hasDefault: true,
  });
});

it('does not fail on CommonJS exports defined earlier as functions', () => {
  expect(findExports(`
    function haha() {};
    module.exports = haha;
  `)).toEqual({
    named: [],
    hasDefault: true,
  });
});

it('finds CommonJS exports defined later in the file', () => {
  expect(findExports(`
    const haha = {};
    module.exports = haha;
    haha.foo = 'abc';
    haha.bar = 'xyz';
  `)).toEqual({
    named: ['foo', 'bar'],
    hasDefault: true,
  });
});

it('finds CommonJS exports in a root, self-executing, function', () => {
  expect(findExports(`
    (function () {
      module.exports = { foo: 'foo' };
    }.call(this));

  `)).toEqual({
    named: ['foo'],
    hasDefault: true,
  });

  expect(findExports(`
    (function () {
      module.exports = { foo: 'foo' };
    }());

  `)).toEqual({
    named: ['foo'],
    hasDefault: true,
  });
});

it('follows exported requires', () => {
  fs.__setFile('/path/to/foo.js',
    'const Result = { bar: 123 }; module.exports = Result;',
    { isDirectory: () => false }
  );
  requireResolve.__addResolvedPath('/path/to/foo', '/path/to/foo.js');
  expect(findExports(`
    module.exports = require('./foo');
  `, '/path/to/file.js')).toEqual({
    named: ['bar'],
    hasDefault: true,
  });
});

it('finds inner CommonJS exports', () => {
  // this is from logpath
  expect(findExports(`
    (function (root, definition) {
        "use strict";
        if (typeof module === 'object' && module.exports) {
            module.exports = definition();
        }
    }(this, function() {}));
  `, '/path/to/file.js')).toEqual({
    named: [],
    hasDefault: true,
  });
});

it('finds exports when exports is reassigned', () => {
  // this is from winston
  expect(findExports(`
    var winston = exports;
    winston.foo = 'bar';
    exports.bar = 'foo';
  `, '/path/to/file.js')).toEqual({
    named: ['foo', 'bar'],
    hasDefault: true,
  });
});

it('parses React correctly', () => {
  expect(findExports(`
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

  `)).toEqual({
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

it('finds underscore exports', () => {
  expect(findExports(`
    (function() {
      var _ = function() {};

      if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
          exports = module.exports = _;
        }
        exports._ = _;
      } else {
        root._ = _;
      }

      _.debounce = function() {};
      _.pluck = function() {};
    })();
  `)).toEqual({
    named: [
      'debounce',
      'pluck',
    ],
    hasDefault: true,
  });
});

it('does not fail for inner exports that are not objects', () => {
  expect(findExports(`
    (function() {
      var snowden = '';

      if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
          exports = module.exports = snowden;
        }
      }
    })();
  `)).toEqual({
    named: [],
    hasDefault: true,
  });
});
