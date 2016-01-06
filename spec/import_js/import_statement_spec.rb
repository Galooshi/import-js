require 'spec_helper'

describe 'ImportStatement' do
  let(:string) { "const foo = require('foo');" }

  subject { ImportJS::ImportStatement.parse(string) }

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
        expect(subject.is_destructured).to be_falsy
      end
    end

    context 'and it has a destructured assignment' do
      let(:string) { "const { foo } = require('foo');" }

      it 'returns a valid ImportStatement instance' do
        expect(subject.assignment).to eq('{ foo }')
        expect(subject.path).to eq('foo')
        expect(subject.is_destructured).to be_truthy
        expect(subject.variables).to eq(['foo'])
      end

      context 'injecting a new destructured variable' do
        let(:injected_variable) { 'bar' }
        let(:statement) do
          statement = subject
          statement.inject_destructured_variable(injected_variable)
          statement
        end

        it 'adds that variable and sorts the list' do
          expect(statement.variables).to eq(['bar', 'foo'])
        end

        it 'can reconstruct using `to_import_string`' do
          expect(statement.to_import_string('const', 80, ' '))
            .to eq("const { bar, foo } = require('foo');")
        end

        context 'injecting a variable that is already in the list' do
          let(:injected_variable) { 'foo' }

          it 'does not add a duplicate' do
            expect(statement.variables).to eq(['foo'])
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
        expect(subject.is_destructured).to be_truthy
        expect(subject.variables).to eq(['foo'])
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
