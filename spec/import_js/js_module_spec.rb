require 'spec_helper'

describe ImportJS::JSModule do
  let(:lookup_path) { 'app' }
  let(:relative_file_path) { 'app/lib/foo.js' }
  let(:make_relative_to) { nil }
  let(:strip_file_extensions) { ['.js'] }

  subject do
    described_class.new(
      lookup_path: lookup_path,
      relative_file_path: relative_file_path,
      strip_file_extensions: strip_file_extensions,
      make_relative_to: make_relative_to
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

    context 'when asked to produce an import path relative to another file' do
      context 'and the other file is in the same folder' do
        let(:make_relative_to) { 'app/lib/bar.js' }

        it 'produces a correct relative path' do
          expect(subject.import_path).to eq('./foo')
        end
      end

      context 'and the other file is in a parent folder' do
        let(:make_relative_to) { 'app/bar.js' }

        it 'produces a correct relative path' do
          expect(subject.import_path).to eq('./lib/foo')
        end
      end

      context 'and the other file is in a sibling folder' do
        let(:make_relative_to) { 'app/foo/bar.js' }

        it 'produces a correct relative path' do
          expect(subject.import_path).to eq('../lib/foo')
        end
      end

      context 'and the other file is in a child of a sibling folder' do
        let(:make_relative_to) { 'app/foo/gas/bar.js' }

        it 'produces a correct relative path' do
          expect(subject.import_path).to eq('../../lib/foo')
        end
      end

      context 'and the other file is in a different lookup_path' do
        let(:make_relative_to) { 'spec/foo/gas/bar.js' }

        it 'does not create a relative path' do
          expect(subject.import_path).to eq('lib/foo')
        end
      end
    end
  end
end
