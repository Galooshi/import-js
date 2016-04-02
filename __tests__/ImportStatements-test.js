'use strict';

jest.unmock('../lib/ImportStatement');
jest.unmock('../lib/ImportStatements');
jest.unmock('lodash.flattendeep');
jest.unmock('lodash.partition');
jest.unmock('lodash.sortby');
jest.unmock('lodash.uniqby');

const Configuration = require('../lib/Configuration');
const ImportStatement = require('../lib/ImportStatement');
const ImportStatements = require('../lib/ImportStatements');

describe('ImportStatements', () => {
  //let(:configuration) do
    //{}
  //});

  //beforeEach(() => {
    //allow_any_instance_of(ImportJS::Configuration)
      //.to receive(:load_config).and_return(nil)
    //allow_any_instance_of(ImportJS::Configuration)
      //.to receive(:load_config).with('.importjs.json')
      //.and_return(configuration)
  //});

  //let(:config) { ImportJS::Configuration.new('') }

  //subject { described_class.new(config) }

  //it('gives an empty array', () => {
    //expect(subject.to_a).to eq([])
  //});

  //context('when pushed an import statement', () => {
    //let(:import_statement) do
      //ImportStatement.parse("import foo from 'foo';")
    //});

    //beforeEach(() => {
      //subject << import_statement
    //});

    //it('gives an array with an array with the statement', () => {
      //expect(subject.to_a).to eq(
        //[
          //"import foo from 'foo';",
        //]
      //)
    //});
  //});

  //context('when pushed two identical import statements', () => {
    //let(:first_import_statement) do
      //ImportStatement.parse("import foo from 'foo';")
    //});

    //let(:second_import_statement) do
      //ImportStatement.parse("import foo from 'foo';")
    //});

    //beforeEach(() => {
      //subject << first_import_statement
      //subject << second_import_statement
    //});

    //it('gives an array with a single statement', () => {
      //expect(subject.to_a).to eq(
        //[
          //"import foo from 'foo';",
        //]
      //)
    //});
  //});

  //context('when pushed two import statements of the same kind', () => {
    //let(:import_statements) do
      //[
        //ImportStatement.parse("import foo from 'foo';"),
        //ImportStatement.parse("import bar from 'bar';"),
      //]
    //});

    //beforeEach(() => {
      //import_statements.each { |import_statement| subject << import_statement }
    //});

    //it('gives an array with the two statements sorted in the same group', () => {
      //expect(subject.to_a).to eq(
        //[
          //"import bar from 'bar';",
          //"import foo from 'foo';",
        //]
      //)
    //});

    //it('is enumerable', () => {
      //enumerations = 0
      //subject.each_with_index do |import_statement, i|
        //expect(import_statement).to eq(import_statements[i])
        //enumerations += 1
      //});
      //expect(enumerations).to eq(2)
    //});
  //});

  //context('when pushed two statements of different kinds but the same path', () => {
    //let(:first_import_statement) do
      //ImportStatement.parse("import foo from 'foo';")
    //});

    //let(:second_import_statement) do
      //ImportStatement.parse("import { bar } from 'foo';")
    //});

    //beforeEach(() => {
      //subject << first_import_statement
      //subject << second_import_statement
    //});

    //it('merges the two statements', () => {
      //expect(subject.to_a).to eq(
        //[
          //"import foo, { bar } from 'foo';",
        //]
      //)
    //});
  //});

  //context('when pushed two import statements of different kinds', () => {
    //let(:first_import_statement) do
      //ImportStatement.parse("import foo from 'foo';")
    //});

    //let(:second_import_statement) do
      //ImportStatement.parse("const bar = require('bar');")
    //});

    //beforeEach(() => {
      //subject << first_import_statement
      //subject << second_import_statement
    //});

    //it('gives the two statements in different groups', () => {
      //expect(subject.to_a).to eq(
        //[
          //"import foo from 'foo';",
          //'',
          //"const bar = require('bar');",
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
            //"import foo from 'foo';",
          //]
        //)
      //});
    //});

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
