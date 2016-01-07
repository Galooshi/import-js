require 'spec_helper'

describe ImportJS::ImportStatement do
  describe '.parse' do
    let(:string) { "const foo = require('foo');" }
    subject { described_class.parse(string) }

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
end
