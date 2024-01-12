/* eslint-disable max-len */
import fs from 'fs';

import requireRelative from 'require-relative';

import findExports from '../findExports';

jest.mock('fs');
jest.mock('require-relative');

beforeEach(() => {
  fs.__reset();
});

it('finds no exports from export-less modules', () => {
  expect(findExports(`
    console.log('boo!');
  `)).toEqual({ named: [], typed: [], hasDefault: false });
});

it('finds exports from json', () => {
  expect(findExports(
    `
    {
      "foo": {
        "foobar": 1
      },
      "bar": "Brown's bar"
    }
  `,
    '/path/to/file.json',
  )).toEqual({
    named: ['foo', 'bar'],
    typed: [],
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
    export * as ns from './foo';
    export const { haa, faa } = tor();
    export const { har, faa: far } = tor();
    export const { has, fas = {a:1,b:2} } = tor();
    export const { hat, faa: fat = {a:1,b:2} } = tor();
    export const { hax, ...fax } = tor();
    export const [ hay, fay ] = tor();
    export const [ haz, ...faz ] = tor();
    export const hooli = 'facebook';
    export function yo() {};
    export class Foo {}
    export type Yak = string;
    export type Yik<A, B, C> = {
      property: A,
      method(val: B): C,
    };
  `)).toEqual({
    named: [
      'bar',
      'racecar',
      'baz',
      'bar1',
      'bar2',
      'ns',
      'haa',
      'faa',
      'har',
      'far',
      'has',
      'fas',
      'hat',
      'fat',
      'hax',
      'fax',
      'hay',
      'fay',
      'haz',
      'faz',
      'hooli',
      'yo',
      'Foo',
    ],
    typed: [
      'Yak',
      'Yik',
    ],
    hasDefault: true,
  });
});

it('finds renamed es6 default export', () => {
  expect(findExports(`
    import { foo1, foo2 } from 'foo';
    export { foo1 as default, foo2 };
  `)).toEqual({
    named: [
      'default',
      'foo2',
    ],
    typed: [],
    hasDefault: true,
  });
});

it('does not blow up on object spreads', () => {
  expect(findExports(`
    const foo = { ...bar, baz: true };
  `)).toEqual({
    named: [],
    typed: [],
    hasDefault: false,
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
    typed: [],
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
    typed: [],
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
    typed: [],
    hasDefault: false,
  });
});

it('does not fail on empty variable declarations', () => {
  expect(findExports(`
    let bar;
    bar = 'keyzar';
  `)).toEqual({
    named: [],
    typed: [],
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
    typed: [],
    hasDefault: true,
  });
});

it('does not fail on CommonJS exports defined earlier as functions', () => {
  expect(findExports(`
    function haha() {};
    module.exports = haha;
  `)).toEqual({
    named: [],
    typed: [],
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
    typed: [],
    hasDefault: true,
  });
});

it('finds exports defined through Object.defineProperty', () => {
  expect(findExports(`
    Object.defineProperty(exports, 'foo', {
      enumerable: true,
      get: function get() {
        return 'foo';
      }
    });
    const shadow = exports;
    Object.defineProperty(shadow, 'bar', {
      enumerable: true,
      get: function get() {
        return 'bar';
      }
    });
  `)).toEqual({
    named: ['foo', 'bar'],
    typed: [],
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
    typed: [],
    hasDefault: true,
  });

  expect(findExports(`
    (function () {
      module.exports = { foo: 'foo' };
    }());

  `)).toEqual({
    named: ['foo'],
    typed: [],
    hasDefault: true,
  });
});

it('finds inner CommonJS exports', () => {
  // this is from logpath
  expect(findExports(
    `
    (function (root, definition) {
        "use strict";
        if (typeof module === 'object' && module.exports) {
            module.exports = definition();
        }
    }(this, function() {}));
  `,
    '/path/to/file.js',
  )).toEqual({
    named: [],
    typed: [],
    hasDefault: true,
  });
});

it('finds exports when exports is reassigned', () => {
  // this is from winston
  expect(findExports(
    `
    var winston = exports;
    winston.foo = 'bar';
    exports.bar = 'foo';
  `,
    '/path/to/file.js',
  )).toEqual({
    named: ['foo', 'bar'],
    typed: [],
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
    typed: [],
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
    named: ['debounce', 'pluck'],
    typed: [],
    hasDefault: true,
  });
});

it('finds exports from a webpack bundle', () => {
  // This is a downsized minimal webpack bundle
  expect(findExports(`
 module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ })
/******/ ({
/***/ 521:
/***/ (function(module, exports, __webpack_require__) {
"use strict";
exports.Foo = bar;
exports.default = something;
exports.createPath = exports.parsePath = exports.getQueryStringValueFromPath = exports.stripQueryStringValueFromPath = exports.addQueryStringValueToPath = undefined;
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Foo = Foo.default;
/***/ })
/******/ });
    `)).toEqual({
    named: ['Foo'],
    typed: [],
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
    typed: [],
    hasDefault: true,
  });
});

it('finds typescript exports', () => {
  expect(findExports('export type FooType = {}; export interface FooInterface {}; export enum FooEnum {};', '/path/to/file.ts')).toEqual({
    named: ['FooType', 'FooInterface', 'FooEnum'],
    typed: [],
    hasDefault: false,
  });
});

describe('recursive exports', () => {
  beforeEach(() => {
    fs.__setFile(
      '/path/to/foo.js',
      'const Result = { bar: 123 }; module.exports = Result;',
      { isDirectory: () => false },
    );
    requireRelative.resolve.mockImplementation(() => '/path/to/foo.js');
  });

  it('follows exported requires', () => {
    expect(findExports("module.exports = require('./foo');", '/path/to/file.js')).toEqual({
      named: ['bar'],
      typed: [],
      hasDefault: true,
    });
  });

  it('picks the first require if inside a ternary', () => {
    expect(findExports(
      `
        module.exports = process.env.NODE_ENV === 'test' ?
          require('./foo') : require('./ignored');
      `,
      '/path/to/file.js',
    )).toEqual({
      named: ['bar'],
      typed: [],
      hasDefault: true,
    });
  });
});

describe('recursive ES6 exports', () => {
  beforeEach(() => {
    fs.__setFile(
      '/path/to/foo.js',
      'const foo = "42"; export const bar = 123; export { foo };',
      { isDirectory: () => false },
    );
    requireRelative.resolve.mockImplementation(() => '/path/to/foo.js');
  });

  it('follows exported * from', () => {
    expect(findExports("export * from './foo';", '/path/to/file.js')).toEqual({
      named: ['bar', 'foo'],
      typed: [],
      hasDefault: false,
    });
  });
});
