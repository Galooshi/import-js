import path from 'path';
import Configuration from '../Configuration';
import findCurrentImports from '../findCurrentImports';
import parse from '../parse';

const local = (subPath) => path.resolve(__dirname, subPath);

it('finds require statements', () => {
  const currentFileContent = `
const React = require('react');

const AlignmentRibbonPage = withMixpanelTracking(React.createClass({
  render() {
    return null;
  }
}));

AlignmentRibbonPage.Controller = Controller({});

module.exports = AlignmentRibbonPage;
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('react');
    expect(imp.declarationKeyword).toEqual('const');
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(1);
});

it('finds import statements', () => {
  const currentFileContent = `
import React from 'react';

const AlignmentRibbonPage = withMixpanelTracking(React.createClass({
  render() {
    return null;
  }
}));

AlignmentRibbonPage.Controller = Controller({});

module.exports = AlignmentRibbonPage;
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('react');
    expect(imp.declarationKeyword).toEqual('import');
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(1);
});

it('finds deconstructed import statements', () => {
  const currentFileContent = `
import { type foo, bar, type baz } from 'far';
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.namedImports).toEqual([{ localName: 'foo', isType: true }, { localName: 'bar', isType: false }, { localName: 'baz', isType: true }]);
    expect(imp.areOnlyTypes).toEqual(false);
    expect(imp.danglingCommas).toEqual(false);
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(1);
});

it('preserves dangling commas', () => {
  const currentFileContent = `
import { foo, bar, } from 'far';
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.danglingCommas).toEqual(true);
    expect(imp.namedImports).toEqual([{ localName: 'foo', isType: false }, { localName: 'bar', isType: false }]);
    expect(imp.areOnlyTypes).toEqual(false);
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(1);
});

it('preserves dangling commas when multiline', () => {
  const currentFileContent = `
import {
  foo,
  bar,
} from 'far';
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.danglingCommas).toEqual(true);
    expect(imp.namedImports).toEqual([{ localName: 'foo', isType: false }, { localName: 'bar', isType: false }]);
    expect(imp.areOnlyTypes).toEqual(false);
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(4);
});

it('finds single type import statement', () => {
  const currentFileContent = `
import type { foo } from 'far';
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.namedImports).toEqual([{ localName: 'foo', isType: true }]);
    expect(imp.areOnlyTypes).toEqual(true);
  });
});

it('finds multiple type imports statement', () => {
  const currentFileContent = `
import type { foo, bar } from 'far';
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.namedImports).toEqual([{ localName: 'foo', isType: true }, { localName: 'bar', isType: true }]);
    expect(imp.areOnlyTypes).toEqual(true);
  });
});

it('finds mixed imports statement', () => {
  const currentFileContent = `
import far, { type foo, bar } from 'far';
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.defaultImport).toEqual('far');
    expect(imp.namedImports).toEqual([{ localName: 'foo', isType: true }, { localName: 'bar', isType: false }]);
    expect(imp.areOnlyTypes).toEqual(false);
  });
});

it('finds deconstructed require statements', () => {
  const currentFileContent = `
const { foo, bar } = require('far');
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('far');
    expect(imp.danglingCommas).toBe(false);
    expect(imp.declarationKeyword).toEqual('const');
    expect(imp.namedImports).toEqual([{ localName: 'foo' }, { localName: 'bar' }]);
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(1);
});

it('preserves dangling commas in require statements', () => {
  const currentFileContent = `
const { foo, bar, } = require('far');
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  imports.imports.forEach((imp) => {
    expect(imp.danglingCommas).toBe(true);
  });
});

it('finds namespace imports', () => {
  const currentFileContent = `
import * as api from './api'
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('./api');
    expect(imp.declarationKeyword).toEqual('import');
    expect(imp.defaultImport).toEqual('api');
  });
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(1);
});

it('stops when it finds a non-import', () => {
  const currentFileContent = `
const Foo = Bar;

const Tar = require('tar');
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(0);
  expect(imports.range.start).toEqual(0);
  expect(imports.range.end).toEqual(0);
});

it("continues when it finds a 'use strict'", () => {
  const currentFileContent = `
'use strict';
const Tar = require('tar');
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  expect(imports.range.start).toEqual(1);
  expect(imports.range.end).toEqual(2);
});

it("doesn't fail for assignment-less variable declarations", () => {
  const currentFileContent = 'let foo;';

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(0);
});

it('continues when it finds a comment', () => {
  const currentFileContent = `
// comment
const Tar = require('tar');
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent, local('foo.js')),
  );
  expect(imports.imports.size()).toEqual(1);
  expect(imports.range.start).toEqual(1);
  expect(imports.range.end).toEqual(2);
});
