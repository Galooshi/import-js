require 'spec_helper'

describe 'JSModule' do
  let(:lookup_path) { 'app' }
  let(:relative_file_path) { 'app/lib/foo.js' }

  subject do
    ImportJS::JSModule.new(
      lookup_path,
      relative_file_path,
      strip_file_extensions
    )
  end

  describe '.import_path' do
    context 'with an empty `strip_file_extensions` config' do
      let(:strip_file_extensions) { [] }

      it 'strips out the lookup path from relative_file_path' do
        expect(subject.import_path).to start_with('lib/')
      end

      it 'does not strip file extension' do
        expect(subject.import_path).to eq('lib/foo.js')
      end
    end

    context 'when the file extension is not in `strip_file_extensions`' do
      let(:strip_file_extensions) { ['.jsx'] }

      it 'does not strip file extension' do
        expect(subject.import_path).to eq('lib/foo.js')
      end
    end

    context 'when the file extension is in `strip_file_extensions`' do
      let(:strip_file_extensions) { ['.js', '.jsx'] }

      it 'strips the file extension' do
        expect(subject.import_path).to eq('lib/foo')
      end
    end

    context 'with a double extension in `strip_file_extensions`' do
      let(:strip_file_extensions) { ['.web.js'] }

      context 'and the module does not have that extension' do
        it 'does not strip the file extension' do
          expect(subject.import_path).to eq('lib/foo.js')
        end
      end

      context 'and the module has that extension' do
        let(:relative_file_path) { 'lib/foo.web.js' }

        it 'strips the file extension' do
          expect(subject.import_path).to eq('lib/foo')
        end
      end
    end
  end
end
