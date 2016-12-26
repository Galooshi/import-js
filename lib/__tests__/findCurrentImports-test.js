import Configuration from '../Configuration';
import findCurrentImports from '../findCurrentImports';
import parse from '../parse';

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
    parse(currentFileContent),
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
    parse(currentFileContent),
  );
  expect(imports.imports.size()).toEqual(1);
  imports.imports.forEach((imp) => {
    expect(imp.path).toEqual('react');
    expect(imp.declarationKeyword).toEqual('import');
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
    parse(currentFileContent),
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
    parse(currentFileContent),
  );
  expect(imports.imports.size()).toEqual(1);
  expect(imports.range.start).toEqual(1);
  expect(imports.range.end).toEqual(2);
});

it('continues when it finds a comment', () => {
  const currentFileContent = `
// comment
const Tar = require('tar');
  `.trim();

  const imports = findCurrentImports(
    new Configuration('./foo.js'),
    currentFileContent,
    parse(currentFileContent),
  );
  expect(imports.imports.size()).toEqual(1);
  expect(imports.range.start).toEqual(1);
  expect(imports.range.end).toEqual(2);
});
