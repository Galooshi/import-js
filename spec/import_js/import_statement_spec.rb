require 'spec_helper'

describe ImportJS::ImportStatement do
  describe '.parse' do
    let(:string) { "const foo = require('foo');" }
    subject { described_class.parse(string) }

    context 'when the string is a valid es6 import' do
      let(:string) { "import foo from 'foo';" }

      it 'returns a valid ImportStatement instance' do
        expect(subject.assignment).to eq('foo')
        expect(subject.path).to eq('foo')
      end

      context 'and it has line breaks' do
        let(:string) { "import foo\n  from 'foo';" }

        it 'returns a valid ImportStatement instance' do
          expect(subject.assignment).to eq('foo')
          expect(subject.path).to eq('foo')
        end
      end

      context 'and it has a destructured assignment' do
        let(:string) { "import { foo } from 'foo';" }

        it 'returns a valid ImportStatement instance' do
          expect(subject.assignment).to eq('{ foo }')
          expect(subject.path).to eq('foo')
          expect(subject.destructured?).to be_truthy
          expect(subject.default_variable).to eq(nil)
          expect(subject.destructured_variables).to eq(['foo'])
        end

        context 'and it has line breaks' do
          let(:string) { "import {\n  foo,\n  bar,\n} from 'foo';" }

          it 'returns a valid ImportStatement instance' do
            expect(subject.assignment).to eq("{\n  foo,\n  bar,\n}")
            expect(subject.path).to eq('foo')
            expect(subject.destructured?).to be_truthy
            expect(subject.default_variable).to eq(nil)
            expect(subject.destructured_variables).to eq(['foo', 'bar'])
          end
        end
      end

      context 'and it has default and a destructured assignment' do
        let(:string) { "import foo, { bar } from 'foo';" }

        it 'returns a valid ImportStatement instance' do
          expect(subject.assignment).to eq('foo, { bar }')
          expect(subject.path).to eq('foo')
          expect(subject.destructured?).to be_truthy
          expect(subject.default_variable).to eq('foo')
          expect(subject.destructured_variables).to eq(['bar'])
        end

        context 'and it has line breaks' do
          let(:string) { "import foo, {\n  bar,\n  baz,\n} from 'foo';" }

          it 'returns a valid ImportStatement instance' do
            expect(subject.assignment).to eq("foo, {\n  bar,\n  baz,\n}")
            expect(subject.path).to eq('foo')
            expect(subject.destructured?).to be_truthy
            expect(subject.default_variable).to eq('foo')
            expect(subject.destructured_variables).to eq(['bar', 'baz'])
          end
        end
      end
    end

    context 'when the string is a valid import using const' do
      it 'returns a valid ImportStatement instance' do
        expect(subject.assignment).to eq('foo')
        expect(subject.path).to eq('foo')
      end

      context 'and it has line breaks' do
        let(:string) { "const foo = \n  require('foo');" }

        it 'returns a valid ImportStatement instance' do
          expect(subject.assignment).to eq('foo')
          expect(subject.path).to eq('foo')
        end

        it 'is not destructured' do
          expect(subject.destructured?).to be_falsy
        end
      end

      context 'and it has a destructured assignment' do
        let(:string) { "const { foo } = require('foo');" }

        it 'returns a valid ImportStatement instance' do
          expect(subject.assignment).to eq('{ foo }')
          expect(subject.path).to eq('foo')
          expect(subject.destructured?).to be_truthy
          expect(subject.default_variable).to eq(nil)
          expect(subject.destructured_variables).to eq(['foo'])
        end

        context 'and it has line breaks' do
          let(:string) { "const {\n  foo,\n  bar,\n} = require('foo');" }

          it 'returns a valid ImportStatement instance' do
            expect(subject.assignment).to eq("{\n  foo,\n  bar,\n}")
            expect(subject.path).to eq('foo')
            expect(subject.destructured?).to be_truthy
            expect(subject.default_variable).to eq(nil)
            expect(subject.destructured_variables).to eq(['foo', 'bar'])
          end
        end

        context 'injecting a new destructured variable' do
          let(:injected_variable) { 'bar' }
          let(:statement) do
            statement = subject
            statement.inject_destructured_variable(injected_variable)
            statement
          end

          it 'does not add a default_variable' do
            expect(statement.default_variable).to eq(nil)
          end

          it 'adds that variable and sorts the list' do
            expect(statement.destructured_variables).to eq(['bar', 'foo'])
          end

          it 'can reconstruct using `to_import_strings`' do
            expect(statement.to_import_strings('const', 80, ' '))
              .to eq(["const { bar, foo } = require('foo');"])
          end

          context 'injecting a variable that is already in the list' do
            let(:injected_variable) { 'foo' }

            it 'does not add a default variable' do
              expect(statement.default_variable).to eq(nil)
            end

            it 'does not add a duplicate' do
              expect(statement.destructured_variables).to eq(['foo'])
            end
          end
        end
      end
    end

    context 'when the string is not a valid import' do
      let(:string) { 'var foo = bar.hello;' }

      it 'returns nil' do
        expect(subject).to be_nil
      end
    end
  end

  describe '#destructured?' do
    let(:import_statement) { described_class.new }
    let(:default_variable) { nil }
    let(:destructured_variables) { nil }

    before do
      unless default_variable.nil?
        import_statement.default_variable = default_variable
      end

      unless destructured_variables.nil?
        import_statement.destructured_variables = destructured_variables
      end
    end

    subject { import_statement.destructured? }

    context 'without a default variable or destructured variables' do
      it { should eq(false) }
    end

    context 'with a default variable' do
      let(:default_variable) { 'foo' }
      it { should eq(false) }

      context 'when default variable is removed' do
        before { import_statement.delete_variable('foo') }
        it { should eq(false) }
      end
    end

    context 'with destructured variables' do
      let(:destructured_variables) { ['foo'] }
      it { should eq(true) }

      context 'when destructured variables are removed' do
        before { import_statement.delete_variable('foo') }
        it { should eq(false) }
      end
    end

    context 'with an empty array of destructured variables' do
      let(:destructured_variables) { [] }
      it { should eq(false) }
    end
  end

  describe '#empty?' do
    let(:import_statement) { described_class.new }
    let(:default_variable) { nil }
    let(:destructured_variables) { nil }

    before do
      unless default_variable.nil?
        import_statement.default_variable = default_variable
      end

      unless destructured_variables.nil?
        import_statement.destructured_variables = destructured_variables
      end
    end

    subject { import_statement.empty? }

    context 'without a default variable or destructured variables' do
      it { should eq(true) }
    end

    context 'with a default variable' do
      let(:default_variable) { 'foo' }
      it { should eq(false) }

      context 'when default variable is removed' do
        before { import_statement.delete_variable('foo') }
        it { should eq(true) }
      end
    end

    context 'with destructured variables' do
      let(:destructured_variables) { ['foo'] }
      it { should eq(false) }

      context 'when destructured variables are removed' do
        before { import_statement.delete_variable('foo') }
        it { should eq(true) }
      end
    end

    context 'with an empty array of destructured variables' do
      let(:destructured_variables) { [] }
      it { should eq(true) }
    end
  end

  describe '#merge' do
    let(:existing_import_statement) { described_class.new }
    let(:new_import_statement) { described_class.new }
    let(:existing_default_variable) { nil }
    let(:existing_destructured_variables) { nil }
    let(:new_default_variable) { nil }
    let(:new_destructured_variables) { nil }

    before do
      unless existing_default_variable.nil?
        existing_import_statement.default_variable = existing_default_variable
      end

      unless existing_destructured_variables.nil?
        existing_import_statement.destructured_variables =
          existing_destructured_variables
      end

      unless new_default_variable.nil?
        new_import_statement.default_variable = new_default_variable
      end

      unless new_destructured_variables.nil?
        new_import_statement.destructured_variables =
          new_destructured_variables
      end
    end

    subject do
      existing_import_statement.merge(new_import_statement)
      existing_import_statement
    end

    context 'without a new default variable' do
      let(:existing_default_variable) { 'foo' }

      it 'uses the existing default variable' do
        expect(subject.default_variable).to eq('foo')
      end
    end

    context 'without an existing default variable' do
      let(:new_default_variable) { 'foo' }

      it 'uses the new default variable' do
        expect(subject.default_variable).to eq('foo')
      end
    end

    context 'with both default variables' do
      let(:existing_default_variable) { 'foo' }
      let(:new_default_variable) { 'bar' }

      it 'uses the new default variable' do
        expect(subject.default_variable).to eq('bar')
      end
    end

    context 'without new destructured variables' do
      let(:existing_destructured_variables) { ['foo'] }

      it 'uses the existing destructured variables' do
        expect(subject.destructured_variables).to eq(['foo'])
      end
    end

    context 'without existing destructured variables' do
      let(:new_destructured_variables) { ['foo'] }

      it 'uses the new destructured variables' do
        expect(subject.destructured_variables).to eq(['foo'])
      end
    end

    context 'with both destructured variables' do
      let(:existing_destructured_variables) { ['foo'] }
      let(:new_destructured_variables) { ['bar'] }

      it 'uses the new destructured variables' do
        expect(subject.destructured_variables).to eq(['bar', 'foo'])
      end
    end

    context 'when the new destructured variable is the same as the existing' do
      let(:existing_destructured_variables) { ['foo'] }
      let(:new_destructured_variables) { ['foo'] }

      it 'does not duplicate' do
        expect(subject.destructured_variables).to eq(['foo'])
      end
    end
  end

  describe '#to_import_strings' do
    let(:import_statement) { described_class.new }
    let(:path) { 'path' }
    let(:default_variable) { nil }
    let(:destructured_variables) { nil }
    let(:max_line_length) { 80 }
    let(:tab) { '  ' }

    before do
      import_statement.path = path

      unless default_variable.nil?
        import_statement.default_variable = default_variable
      end

      unless destructured_variables.nil?
        import_statement.destructured_variables = destructured_variables
      end
    end

    subject do
      import_statement.to_import_strings(
        declaration_keyword, max_line_length, tab)
    end

    context 'with import declaration keyword' do
      let(:declaration_keyword) { 'import' }

      context 'with a default variable' do
        let(:default_variable) { 'foo' }
        it { should eq(["import foo from 'path';"]) }

        context 'when longer than max line length' do
          let(:default_variable) { 'ReallyReallyReallyReallyLong' }
          let(:path) { 'also_very_long_for_some_reason' }
          let(:max_line_length) { 50 }
          it { should eq(["import #{default_variable} from\n  '#{path}';"]) }

          context 'with different tab' do
            let(:tab) { "\t" }
            it { should eq(["import #{default_variable} from\n\t'#{path}';"]) }
          end
        end
      end

      context 'with destructured variables' do
        let(:destructured_variables) { ['foo', 'bar'] }
        it { should eq(["import { foo, bar } from 'path';"]) }

        context 'when longer than max line length' do
          let(:destructured_variables) { ['foo', 'bar', 'baz', 'fizz', 'buzz'] }
          let(:path) { 'also_very_long_for_some_reason' }
          let(:max_line_length) { 50 }
          it { should eq(["import {\n  foo,\n  bar,\n  baz,\n  fizz,\n  buzz,\n} from '#{path}';"]) }
        end
      end

      context 'with default and destructured variables' do
        let(:default_variable) { 'foo' }
        let(:destructured_variables) { ['bar', 'baz'] }
        it { should eq(["import foo, { bar, baz } from 'path';"]) }

        context 'when longer than max line length' do
          let(:destructured_variables) { ['bar', 'baz', 'fizz', 'buzz'] }
          let(:path) { 'also_very_long_for_some_reason' }
          let(:max_line_length) { 50 }
          it { should eq(["import foo, {\n  bar,\n  baz,\n  fizz,\n  buzz,\n} from '#{path}';"]) }
        end
      end
    end

    context 'with const declaration keyword' do
      let(:declaration_keyword) { 'const' }

      context 'with a default variable' do
        let(:default_variable) { 'foo' }
        it { should eq(["const foo = require('path');"]) }

        context 'when longer than max line length' do
          let(:default_variable) { 'ReallyReallyReallyReallyLong' }
          let(:path) { 'also_very_long_for_some_reason' }
          let(:max_line_length) { 50 }
          it { should eq(["const #{default_variable} =\n  require('#{path}');"]) }

          context 'with different tab' do
            let(:tab) { "\t" }
            it { should eq(["const #{default_variable} =\n\trequire('#{path}');"]) }
          end
        end
      end

      context 'with destructured variables' do
        let(:destructured_variables) { ['foo', 'bar'] }
        it { should eq(["const { foo, bar } = require('path');"]) }

        context 'when longer than max line length' do
          let(:destructured_variables) { ['foo', 'bar', 'baz', 'fizz', 'buzz'] }
          let(:path) { 'also_very_long_for_some_reason' }
          let(:max_line_length) { 50 }
          it { should eq(["const {\n  foo,\n  bar,\n  baz,\n  fizz,\n  buzz,\n} = require('#{path}');"]) }
        end
      end

      context 'with default and destructured variables' do
        let(:default_variable) { 'foo' }
        let(:destructured_variables) { ['bar', 'baz'] }
        it do
          should eq([
            "const foo = require('path');",
            "const { bar, baz } = require('path');",
          ])
        end

        context 'when longer than max line length' do
          let(:destructured_variables) { ['bar', 'baz', 'fizz', 'buzz'] }
          let(:path) { 'also_very_long_for_some_reason' }
          let(:max_line_length) { 50 }
          it do
            should eq([
              "const foo =\n  require('#{path}');",
              "const {\n  bar,\n  baz,\n  fizz,\n  buzz,\n} = require('#{path}');",
            ])
          end
        end
      end
    end
  end
end
