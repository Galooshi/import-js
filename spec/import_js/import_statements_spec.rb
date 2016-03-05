require 'spec_helper'

describe ImportJS::ImportStatements do
  let(:configuration) do
    {}
  end

  before do
    allow_any_instance_of(ImportJS::Configuration)
      .to receive(:load_config).and_return(nil)
    allow_any_instance_of(ImportJS::Configuration)
      .to receive(:load_config).with('.importjs.json')
      .and_return(configuration)
  end

  let(:config) { ImportJS::Configuration.new('') }

  subject { described_class.new(config) }

  it 'gives an empty array' do
    expect(subject.to_a).to eq([])
  end

  context 'when pushed an import statement' do
    let(:import_statement) do
      ImportJS::ImportStatement.parse("import foo from 'foo';")
    end

    before do
      subject << import_statement
    end

    it 'gives an array with an array with the statement' do
      expect(subject.to_a).to eq(
        [
          "import foo from 'foo';",
        ]
      )
    end
  end

  context 'when pushed two identical import statements' do
    let(:first_import_statement) do
      ImportJS::ImportStatement.parse("import foo from 'foo';")
    end

    let(:second_import_statement) do
      ImportJS::ImportStatement.parse("import foo from 'foo';")
    end

    before do
      subject << first_import_statement
      subject << second_import_statement
    end

    it 'gives an array with a single statement' do
      expect(subject.to_a).to eq(
        [
          "import foo from 'foo';",
        ]
      )
    end
  end

  context 'when pushed two import statements of the same kind' do
    let(:import_statements) do
      [
        ImportJS::ImportStatement.parse("import foo from 'foo';"),
        ImportJS::ImportStatement.parse("import bar from 'bar';"),
      ]
    end

    before do
      import_statements.each { |import_statement| subject << import_statement }
    end

    it 'gives an array with the two statements sorted in the same group' do
      expect(subject.to_a).to eq(
        [
          "import bar from 'bar';",
          "import foo from 'foo';",
        ]
      )
    end

    it 'is enumerable' do
      enumerations = 0
      subject.each_with_index do |import_statement, i|
        expect(import_statement).to eq(import_statements[i])
        enumerations += 1
      end
      expect(enumerations).to eq(2)
    end
  end

  context 'when pushed two statements of different kinds but the same path' do
    let(:first_import_statement) do
      ImportJS::ImportStatement.parse("import foo from 'foo';")
    end

    let(:second_import_statement) do
      ImportJS::ImportStatement.parse("import { bar } from 'foo';")
    end

    before do
      subject << first_import_statement
      subject << second_import_statement
    end

    it 'merges the two statements' do
      expect(subject.to_a).to eq(
        [
          "import foo, { bar } from 'foo';",
        ]
      )
    end
  end

  context 'when pushed two import statements of different kinds' do
    let(:first_import_statement) do
      ImportJS::ImportStatement.parse("import foo from 'foo';")
    end

    let(:second_import_statement) do
      ImportJS::ImportStatement.parse("const bar = require('bar');")
    end

    before do
      subject << first_import_statement
      subject << second_import_statement
    end

    it 'gives the two statements in different groups' do
      expect(subject.to_a).to eq(
        [
          "import foo from 'foo';",
          '',
          "const bar = require('bar');",
        ]
      )
    end

    context 'when `group_imports` is false' do
      let(:configuration) do
        {
          'group_imports' => false,
        }
      end

      it 'returns a single, ordered group' do
        expect(subject.to_a).to eq(
          [
            "const bar = require('bar');",
            "import foo from 'foo';",
          ]
        )
      end
    end

    context 'when one statement is a package dependency' do
      let(:second_import_statement) do
        ImportJS::ImportStatement.parse("import bar from 'bar';")
      end

      before do
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:package_dependencies)
          .and_return(['bar'])
      end

      it 'gives the two statements in different groups' do
        expect(subject.to_a).to eq(
          [
            "import bar from 'bar';",
            '',
            "import foo from 'foo';",
          ]
        )
      end

      context 'when importing a package-local module' do
        let(:second_import_statement) do
          ImportJS::ImportStatement.parse("import bar from 'bar/too/far';")
        end

        it 'gives the two statements in different groups' do
          expect(subject.to_a).to eq(
            [
              "import bar from 'bar/too/far';",
              '',
              "import foo from 'foo';",
            ]
          )
        end
      end
    end

    context 'when one is a package dependency and the other is a core module' do
      let(:first_import_statement) do
        ImportJS::ImportStatement.parse("import readline from 'readline';")
      end
      let(:second_import_statement) do
        ImportJS::ImportStatement.parse("import bar from 'bar';")
      end

      before do
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:package_dependencies)
          .and_return(['bar'])
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:environment_core_modules)
          .and_return(['readline'])
      end

      it 'gives the two statements in different groups, core module on top' do
        expect(subject.to_a).to eq(
          [
            "import readline from 'readline';",
            '',
            "import bar from 'bar';",
          ]
        )
      end
    end

    context 'when one is a core module and the other looks like one' do
      let(:first_import_statement) do
        ImportJS::ImportStatement.parse("import constants from 'constants';")
      end
      let(:second_import_statement) do
        ImportJS::ImportStatement.parse("import AppConstants from 'constants/app_constants';")
      end

      before do
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:environment_core_modules)
          .and_return(['constants'])
      end

      it 'gives the two statements in different groups, core module on top' do
        expect(subject.to_a).to eq(
          [
            "import constants from 'constants';",
            '',
            "import AppConstants from 'constants/app_constants';",
          ]
        )
      end
    end
  end

  context 'when pushed import statements of all different kinds' do
    let(:import_statements) do
      [
        ImportJS::ImportStatement.parse("const bar = require('bar');"),
        ImportJS::ImportStatement.parse("const custom = custom('custom');"),
        ImportJS::ImportStatement.parse("import foo from 'foo';"),
        ImportJS::ImportStatement.parse("var baz = require('baz');"),
      ]
    end

    before do
      import_statements.each { |import_statement| subject << import_statement }
    end

    it 'gives the statements in different groups' do
      expect(subject.to_a).to eq(
        [
          "import foo from 'foo';",
          '',
          "const bar = require('bar');",
          '',
          "var baz = require('baz');",
          '',
          "const custom = custom('custom');",
        ]
      )
    end

    context 'when `group_imports` is false' do
      let(:configuration) do
        {
          'group_imports' => false,
        }
      end

      it 'returns a single, ordered group' do
        expect(subject.to_a).to eq(
          [
            "const bar = require('bar');",
            "var baz = require('baz');",
            "const custom = custom('custom');",
            "import foo from 'foo';",
          ]
        )
      end
    end
  end

  describe '#delete_variables!' do
    context 'when it deletes the default import from an import statement' do
      let(:import_statement) do
        ImportJS::ImportStatement.parse("import foo from 'foo';")
      end

      before do
        subject << import_statement
        subject.delete_variables!(['foo'])
      end

      it 'rejects the empty import statement' do
        expect(subject.to_a).to eq([])
      end
    end

    context 'when it deletes the last named import from an import statement' do
      let(:import_statement) do
        ImportJS::ImportStatement.parse("import { foo } from 'foo';")
      end

      before do
        subject << import_statement
        subject.delete_variables!(['foo'])
      end

      it 'rejects the empty import statement' do
        expect(subject.to_a).to eq([])
      end
    end

    context 'when it deletes the first named import from an import statement' do
      let(:import_statement) do
        ImportJS::ImportStatement.parse("import { foo, bar } from 'foo';")
      end

      before do
        subject << import_statement
        subject.delete_variables!(['foo'])
      end

      it 'does not reject the import statement' do
        expect(subject.to_a).to eq(
          [
            "import { bar } from 'foo';",
          ]
        )
      end
    end

    context 'when it deletes the default import from a complex statement' do
      let(:import_statement) do
        ImportJS::ImportStatement.parse("import foo, { bar } from 'foo';")
      end

      before do
        subject << import_statement
        subject.delete_variables!(['foo'])
      end

      it 'does not reject the import statement' do
        expect(subject.to_a).to eq(
          [
            "import { bar } from 'foo';",
          ]
        )
      end
    end

    context 'when it deletes all variables from a complex import statement' do
      let(:import_statement) do
        ImportJS::ImportStatement.parse("import foo, { bar, baz } from 'foo';")
      end

      before do
        subject << import_statement
        subject.delete_variables!(%w[foo bar baz])
      end

      it 'rejects the import statement' do
        expect(subject.to_a).to eq([])
      end
    end
  end
end
