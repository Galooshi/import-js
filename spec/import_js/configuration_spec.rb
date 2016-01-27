require 'spec_helper'
require 'json'

describe ImportJS::Configuration do
  let(:path_to_current_file) { '' }
  subject { described_class.new(path_to_current_file) }

  describe '.get' do
    describe 'with a configuration file' do
      let(:configuration) do
        {
          'aliases' => { 'foo' => 'bar' },
          'declaration_keyword' => 'const',
        }
      end

      before do
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:load_config).and_return(nil)
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:load_config).with('.importjs.json')
          .and_return(configuration)
      end

      it 'returns the configured value for the key' do
        expect(subject.get('aliases')).to eq('foo' => 'bar')
      end

      context 'when the configuration has a `minimum_version`' do
        let(:minimum_version) { '1.2.3' }
        let(:current_version) { '1.2.4' }
        let(:configuration) do
          {
            'minimum_version' => minimum_version,
          }
        end

        before do
          stub_const('ImportJS::VERSION', current_version)
        end

        context 'when the current version is newer than minimum version' do
          it 'does not raise an error' do
            expect { subject }.not_to raise_error
          end
        end

        context 'when the current version is smaller than minimum version' do
          let(:minimum_version) { '1.2.5' }

          it 'raises a helpful error message' do
            expect { subject }.to raise_error(
              ImportJS::ClientTooOldError,
              'The .importjs.json file you are using requires version ' \
              "#{minimum_version}. You are using #{current_version}.")
          end
        end
      end

      context 'when there are multiple configs in the .importjs.json file' do
        let(:path_to_current_file) do
          File.join(Dir.pwd, 'goo', 'gar', 'gaz.js')
        end

        let(:configuration) do
          [
            {
              'declaration_keyword' => 'let',
              'import_function' => 'foobar',
            },
            {
              'applies_to' => 'goo/**',
              'declaration_keyword' => 'var',
            },
          ]
        end

        context 'when the file being edited matches applies_to' do
          it 'uses the local configuration' do
            expect(subject.get('declaration_keyword')).to eq('var')
          end

          it 'falls back to global config if key missing from local config' do
            expect(subject.get('import_function')).to eq('foobar')
          end

          it 'falls back to default config if key is completely missing' do
            expect(subject.get('eslint_executable')).to eq('eslint')
          end
        end

        context 'when the file being edited does not match the pattern' do
          let(:path_to_current_file) { 'foo/far/gar.js' }

          it 'uses the global configuration' do
            expect(subject.get('declaration_keyword')).to eq('let')
          end
        end

        context 'when the path to the local file does not have the full path' do
          let(:path_to_current_file) { 'goo/gar/gaz.js' }

          it 'applies the local configuration' do
            expect(subject.get('declaration_keyword')).to eq('var')
          end
        end
      end

      context 'when a config has an applies_from pattern' do
        let(:path_to_current_file) { 'goo/gar/gaz.js' }
        let(:from_file) { 'from/hello.js' }
        let(:configuration) do
          [
            {
              'applies_to' => 'goo/**',
              'applies_from' => 'from/**',
              'declaration_keyword' => 'var',
            },
          ]
        end

        context 'when the from_file matches applies_from' do
          it 'uses the local configuration' do
            expect(subject.get('declaration_keyword',
                               from_file: from_file)).to eq('var')
          end

          context 'when the current file does not match' do
            let(:path_to_current_file) { 'too/bar.js' }

            it 'falls back to default config' do
              expect(subject.get('declaration_keyword',
                                 from_file: from_file)).to eq('import')
            end
          end
        end

        context 'when the from_file does not match applies_from' do
          let(:from_file) { 'goo/far.js' }

          it 'falls back to default config' do
            expect(subject.get('declaration_keyword',
                               from_file: from_file)).to eq('import')
          end
        end
      end
    end

    describe 'without a configuration file' do
      before do
        allow(File).to receive(:exist?).with('.importjs.json').and_return(false)
      end

      it 'returns the default value for the key' do
        expect(subject.get('aliases')).to eq({})
      end
    end
  end

  describe '.package_dependencies' do
    let(:package_json) { nil }

    before do
      allow(File).to receive(:exist?)
        .with('.importjs.json').and_return(false)
      allow(File).to receive(:exist?)
        .with('package.json').and_return(package_json)
      allow(File).to receive(:read).and_return nil
      allow(JSON).to receive(:parse).and_return(package_json)
    end

    describe 'without a package.json' do
      it 'returns an empty array' do
        expect(subject.package_dependencies).to eq([])
      end
    end

    describe 'with a package.json' do
      context 'with only `dependencies`' do
        let(:package_json) do
          {
            'dependencies' => {
              'foo' => '1.0.0',
              'bar' => '2.0.0',
            },
          }
        end

        it 'returns those dependencies' do
          expect(subject.package_dependencies).to eq(%w[foo bar])
        end
      end

      context 'with `dependencies` and `peerDependencies`' do
        let(:package_json) do
          {
            'dependencies' => {
              'foo' => '1.0.0',
            },
            'peerDependencies' => {
              'bar' => '2.0.0',
            },
          }
        end

        it 'returns combined dependencies' do
          expect(subject.package_dependencies).to eq(%w[foo bar])
        end
      end

      context 'with `devDependencies`' do
        let(:package_json) do
          {
            'dependencies' => {
              'foo' => '1.0.0',
            },
            'devDependencies' => {
              'bar' => '2.0.0',
            },
          }
        end

        it 'leaves out the devDependencies' do
          expect(subject.package_dependencies).to eq(['foo'])
        end

        context 'when `import_dev_dependencies` is true' do
          before do
            allow_any_instance_of(ImportJS::Configuration)
              .to receive(:get).with('minimum_version').and_return('0.0.1')
            allow_any_instance_of(ImportJS::Configuration)
              .to receive(:get).with('import_dev_dependencies').and_return(true)
          end

          it 'returns devDependencies as well' do
            expect(subject.package_dependencies).to eq(%w[foo bar])
          end
        end
      end
    end

    describe 'without a configuration file' do
      before do
        allow(File).to receive(:exist?).with('.importjs.json').and_return(false)
      end

      it 'returns the default value for the key' do
        expect(subject.get('aliases')).to eq({})
      end
    end
  end
end
