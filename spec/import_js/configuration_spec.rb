require 'spec_helper'
require 'json'

describe ImportJS::Configuration do
  subject   { described_class.new }

  describe '.refresh' do
    let(:configuration) do
      {
        'aliases' => { 'foo' => 'bar' }
      }
    end

    let(:time) { Time.new }

    before do
      allow(File).to receive(:exist?).with('.importjs.json').and_return(true)
      allow(File).to receive(:read).and_return nil
      allow(File).to receive(:mtime).and_return time
      allow(JSON).to receive(:parse).and_return(configuration)
      subject
    end

    it 'does not read the file again if it has not changed' do
      expect(File).to receive(:read).exactly(0).times
      subject.refresh
    end

    it 'reads the file again if it has changed' do
      allow(File).to receive(:mtime).and_return time + 1
      expect(File).to receive(:read).once
      subject.refresh
    end
  end

  describe '.get' do
    describe 'with a configuration file' do
      let(:configuration) do
        {
          'aliases' => { 'foo' => 'bar' }
        }
      end

      before do
        allow(File).to receive(:exist?).with('.importjs.json').and_return(true)
        allow(File).to receive(:read).and_return nil
        allow(File).to receive(:mtime).and_return nil
        allow(JSON).to receive(:parse).and_return(configuration)
      end

      it 'returns the configured value for the key' do
        expect(subject.get('aliases')).to eq('foo' => 'bar')
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
        allow(File).to receive(:exist?).with('.importjs.json').and_return(false)
      end

      it 'returns the default value for the key' do
        expect(subject.get('aliases')).to eq({})
      end
    end
  end
end
