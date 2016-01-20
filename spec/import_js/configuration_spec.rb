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
          'declaration_keyword' => 'const'
        }
      end

      before do
        allow_any_instance_of(ImportJS::Configuration).to receive(:load_config).with(
          './.importjs.json').and_return(configuration)
      end

      it 'returns the configured value for the key' do
        expect(subject.get('aliases')).to eq('foo' => 'bar')
      end

      context 'with a local configuration file' do
        let(:path_to_current_file) { File.join(Dir.pwd, 'goo', 'gar', 'gaz.js') }
        let(:local_configuration) do
          {
            'declaration_keyword' => 'let'
          }
        end

        before do
          allow_any_instance_of(ImportJS::Configuration)
            .to receive(:load_config).with('./goo/gar/.importjs.json')
            .and_return({})
          allow_any_instance_of(ImportJS::Configuration)
            .to receive(:load_config).with('./goo/.importjs.json')
            .and_return(local_configuration)
        end

        it 'merges the two configurations plus the default one' do
          expect(subject.get('declaration_keyword')).to eq('let')
          expect(subject.get('aliases')).to eq('foo' => 'bar')
          expect(subject.get('import_function')).to eq('require')
        end

        context 'when the path to the local file does not have the full path' do
          let(:path_to_current_file) { 'goo/gar/gaz.js' }

          it 'merges the two configurations plus the default one' do
            expect(subject.get('declaration_keyword')).to eq('let')
            expect(subject.get('aliases')).to eq('foo' => 'bar')
            expect(subject.get('import_function')).to eq('require')
          end
        end
      end
    end

    describe 'without a configuration file' do
      before do
        allow(File).to receive(:exist?).with('./.importjs.json').and_return(false)
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
        .with('./.importjs.json').and_return(false)
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
              'bar' => '2.0.0'
            }
          }
        end

        it 'returns those dependencies' do
          expect(subject.package_dependencies).to eq(['foo', 'bar'])
        end
      end

      context 'with `dependencies` and `peerDependencies`' do
        let(:package_json) do
          {
            'dependencies' => {
              'foo' => '1.0.0',
            },
            'peerDependencies' => {
              'bar' => '2.0.0'
            }
          }
        end

        it 'returns combined dependencies' do
          expect(subject.package_dependencies).to eq(['foo', 'bar'])
        end
      end

      context 'with `devDependencies`' do
        let(:package_json) do
          {
            'dependencies' => {
              'foo' => '1.0.0',
            },
            'devDependencies' => {
              'bar' => '2.0.0'
            }
          }
        end

        it 'leaves out the devDependencies' do
          expect(subject.package_dependencies).to eq(['foo'])
        end
      end
    end

    describe 'without a configuration file' do
      before do
        allow(File).to receive(:exist?).with('./.importjs.json').and_return(false)
      end

      it 'returns the default value for the key' do
        expect(subject.get('aliases')).to eq({})
      end
    end
  end
end
