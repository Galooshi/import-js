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
});
