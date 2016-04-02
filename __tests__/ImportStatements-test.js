'use strict';

jest.autoMockOff();
jest.mock('../lib/Configuration');

const Configuration = require('../lib/Configuration');
const ImportStatement = require('../lib/ImportStatement');
const ImportStatements = require('../lib/ImportStatements');

describe('ImportStatements', () => {
  let statements;

  beforeEach(() => {
    const configuration = new Configuration();
    statements = new ImportStatements(configuration);
  });

  it('gives an empty array without any import statements', () => {
    expect(statements.toArray()).toEqual([]);
  });

  it('returns the pushed import statement', () => {
    statements.push(ImportStatement.parse("import foo from 'foo';"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
    ]);
  });

  it('returns one statement when pushed two identical statements', () => {
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("import foo from 'foo';"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
    ]);
  });

  it('returns sorted in same group when pushed two of the same kind', () => {
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("import bar from 'bar';"));

    expect(statements.toArray()).toEqual([
      "import bar from 'bar';",
      "import foo from 'foo';",
    ]);
  });

  it('merges statements of different kinds with identical paths', () => {
    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("import { bar } from 'foo';"));

    expect(statements.toArray()).toEqual([
      "import foo, { bar } from 'foo';",
    ]);
  });

  xit('separates import and const', () => {
    // TODO make default configuration happen

    statements.push(ImportStatement.parse("import foo from 'foo';"));
    statements.push(ImportStatement.parse("const bar = require('bar');"));

    expect(statements.toArray()).toEqual([
      "import foo from 'foo';",
      '',
      "const bar = require('bar');",
    ]);
  });

  xdescribe('when group_imports is false', () => {
    // TODO configure group_imports to be false

    it('does not separate statements of different kinds', () => {
      statements.push(ImportStatement.parse("import foo from 'foo';"));
      statements.push(ImportStatement.parse("const bar = require('bar');"));

      expect(statements.toArray()).toEqual([
        "const bar = require('bar');",
        "import foo from 'foo';",
      ]);
    });
  });

  //context('when pushed two import statements of different kinds', () => {
    //context('when one statement is a package dependency', () => {
      //let(:second_import_statement) do
        //ImportStatement.parse("import bar from 'bar';")
      //});

      //beforeEach(() => {
        //allow_any_instance_of(ImportJS::Configuration)
          //.to receive(:package_dependencies)
          //.and_return(['bar'])
      //});

      //it('gives the two statements in different groups', () => {
        //expect(subject.to_a).to eq(
          //[
            //"import bar from 'bar';",
            //'',
            //"import foo from 'foo';",
          //]
        //)
      //});

      //context('when importing a package-local module', () => {
        //let(:second_import_statement) do
          //ImportStatement.parse("import bar from 'bar/too/far';")
        //});

        //it('gives the two statements in different groups', () => {
          //expect(subject.to_a).to eq(
            //[
              //"import bar from 'bar/too/far';",
              //'',
              //"import foo from 'foo';",
            //]
          //)
        //});
      //});
    //});

    //context('when one is a package dependency and the other is a core module', () => {
      //let(:first_import_statement) do
        //ImportStatement.parse("import readline from 'readline';")
      //});
      //let(:second_import_statement) do
        //ImportStatement.parse("import bar from 'bar';")
      //});

      //beforeEach(() => {
        //allow_any_instance_of(ImportJS::Configuration)
          //.to receive(:package_dependencies)
          //.and_return(['bar'])
        //allow_any_instance_of(ImportJS::Configuration)
          //.to receive(:environment_core_modules)
          //.and_return(['readline'])
      //});

      //it('gives the two statements in different groups, core module on top', () => {
        //expect(subject.to_a).to eq(
          //[
            //"import readline from 'readline';",
            //'',
            //"import bar from 'bar';",
          //]
        //)
      //});
    //});

    //context('when one is a core module and the other looks like one', () => {
      //let(:first_import_statement) do
        //ImportStatement.parse("import constants from 'constants';")
      //});
      //let(:second_import_statement) do
        //ImportStatement.parse("import AppConstants from 'constants/app_constants';")
      //});

      //beforeEach(() => {
        //allow_any_instance_of(ImportJS::Configuration)
          //.to receive(:environment_core_modules)
          //.and_return(['constants'])
      //});

      //it('gives the two statements in different groups, core module on top', () => {
        //expect(subject.to_a).to eq(
          //[
            //"import constants from 'constants';",
            //'',
            //"import AppConstants from 'constants/app_constants';",
          //]
        //)
      //});
    //});
  //});

  //context('when pushed import statements of all different kinds', () => {
    //let(:import_statements) do
      //[
        //ImportStatement.parse("const bar = require('bar');"),
        //ImportStatement.parse("const custom = custom('custom');"),
        //ImportStatement.parse("import foo from 'foo';"),
        //ImportStatement.parse("var baz = require('baz');"),
      //]
    //});

    //beforeEach(() => {
      //import_statements.each { |import_statement| subject << import_statement }
    //});

    //it('gives the statements in different groups', () => {
      //expect(subject.to_a).to eq(
        //[
          //"import foo from 'foo';",
          //'',
          //"const bar = require('bar');",
          //'',
          //"var baz = require('baz');",
          //'',
          //"const custom = custom('custom');",
        //]
      //)
    //});

    //context('when `group_imports` is false', () => {
      //let(:configuration) do
        //{
          //'group_imports' => false,
        //}
      //});

      //it('returns a single, ordered group', () => {
        //expect(subject.to_a).to eq(
          //[
            //"const bar = require('bar');",
            //"var baz = require('baz');",
            //"const custom = custom('custom');",
            //"import foo from 'foo';",
          //]
        //)
      //});
    //});
  //});

  //describe('#delete_variables!', () => {
    //context('when it deletes the default import from an import statement', () => {
      //let(:import_statement) do
        //ImportStatement.parse("import foo from 'foo';")
      //});

      //beforeEach(() => {
        //subject << import_statement
        //subject.delete_variables!(['foo'])
      //});

      //it('rejects the empty import statement', () => {
        //expect(subject.to_a).to eq([])
      //});
    //});

    //context('when it deletes the last named import from an import statement', () => {
      //let(:import_statement) do
        //ImportStatement.parse("import { foo } from 'foo';")
      //});

      //beforeEach(() => {
        //subject << import_statement
        //subject.delete_variables!(['foo'])
      //});

      //it('rejects the empty import statement', () => {
        //expect(subject.to_a).to eq([])
      //});
    //});

    //context('when it deletes the first named import from an import statement', () => {
      //let(:import_statement) do
        //ImportStatement.parse("import { foo, bar } from 'foo';")
      //});

      //beforeEach(() => {
        //subject << import_statement
        //subject.delete_variables!(['foo'])
      //});

      //it('does not reject the import statement', () => {
        //expect(subject.to_a).to eq(
          //[
            //"import { bar } from 'foo';",
          //]
        //)
      //});
    //});

    //context('when it deletes the default import from a complex statement', () => {
      //let(:import_statement) do
        //ImportStatement.parse("import foo, { bar } from 'foo';")
      //});

      //beforeEach(() => {
        //subject << import_statement
        //subject.delete_variables!(['foo'])
      //});

      //it('does not reject the import statement', () => {
        //expect(subject.to_a).to eq(
          //[
            //"import { bar } from 'foo';",
          //]
        //)
      //});
    //});

    //context('when it deletes all variables from a complex import statement', () => {
      //let(:import_statement) do
        //ImportStatement.parse("import foo, { bar, baz } from 'foo';")
      //});

      //beforeEach(() => {
        //subject << import_statement
        //subject.delete_variables!(%w[foo bar baz])
      //});

      //it('rejects the import statement', () => {
        //expect(subject.to_a).to eq([])
      //});
    //});
  //});
});
