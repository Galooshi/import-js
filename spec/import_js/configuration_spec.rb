require 'spec_helper'
require 'yaml'

describe 'Configuration' do
  let(:key) { 'aliases' }
  subject   { ImportJS::Configuration.new.get(key) }

  describe 'with a configuration file' do
    let(:configuration) do
      {
        'aliases' => { 'foo' => 'bar' }
      }
    end

    before do
      allow(File).to receive(:exist?).with('.importjs').and_return(true)
      allow(YAML).to receive(:load_file).and_return(configuration)
    end

    it 'returns the configured value for the key' do
      expect(subject).to eq({ 'foo' => 'bar' })
    end
  end

  describe 'without a configuration file' do
    before do
      allow(File).to receive(:exist?).with('.importjs').and_return(false)
    end

    it 'returns the default value for the key' do
      expect(subject).to eq({})
    end
  end
end
