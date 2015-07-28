require 'spec_helper'
require 'json'

describe 'Configuration' do
  let(:key) { 'aliases' }
  subject   { ImportJS::Configuration.new }

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
        expect(subject.get(key)).to eq('foo' => 'bar')
      end
    end

    describe 'without a configuration file' do
      before do
        allow(File).to receive(:exist?).with('.importjs.json').and_return(false)
      end

      it 'returns the default value for the key' do
        expect(subject.get(key)).to eq({})
      end
    end
  end
end
