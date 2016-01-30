require 'spec_helper'

describe ImportJS::JSModule do
  let(:lookup_path) { 'app' }
  let(:relative_file_path) { 'app/lib/foo.js' }
  let(:make_relative_to) { nil }
  let(:strip_file_extensions) { ['.js'] }
  let(:strip_from_path) { nil }

  subject do
    described_class.construct(
      lookup_path: lookup_path,
      relative_file_path: relative_file_path,
      strip_file_extensions: strip_file_extensions,
      make_relative_to: make_relative_to,
      strip_from_path: strip_from_path
    )
  end

  describe 'when lookup_path and relative_file_path are .' do
    let(:lookup_path) { '.' }
    let(:relative_file_path) { '.' }

    it 'does not modify lookup_path' do
      subject
      expect(lookup_path).to eq('.')
    end

    it 'does not modify relative_file_path' do
      subject
      expect(relative_file_path).to eq('.')
    end
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

    context 'when using `strip_from_path`' do
      let(:strip_from_path) { 'lib/' }

      context 'and the import path starts with that string' do
        it 'strips out the string' do
          expect(subject.import_path).to eq('foo')
        end

        context 'when not ending in a slash' do
          let(:strip_from_path) { 'lib' }

          it 'strips out the string' do
            expect(subject.import_path).to eq('/foo')
          end
        end

        context 'when used in combination with `make_relative_to`' do
          let(:make_relative_to) { 'app/assets/bar.js' }

          it 'does not strip out the string' do
            expect(subject.import_path).to eq('../lib/foo')
          end
        end
      end

      context 'and the import path does not start with that string' do
        let(:strip_from_path) { 'foo' }

        it 'leaves the import path untouched' do
          expect(subject.import_path).to eq('lib/foo')
        end
      end
    end

    context 'when "index.js" is part of the name' do
      let(:relative_file_path) { 'lib/index.js/foo.js' }

      it 'creates a valid import_path' do
        expect(subject.import_path).to eq('lib/index.js/foo')
      end

      it 'creates a valid display_name' do
        expect(subject.display_name).to eq('lib/index.js/foo')
      end
    end

    context 'when lookup_path is the current directory' do
      let(:lookup_path) { '.' }
      let(:relative_file_path) { './app/lib/foo.js' }

      it 'produces a correct relative path' do
        expect(subject.import_path).to eq('app/lib/foo')
      end
    end

    context 'when paths start with a dot' do
      let(:lookup_path) { './app' }
      let(:relative_file_path) { './app/lib/foo.js' }

      it 'produces a correct relative path' do
        expect(subject.import_path).to eq('lib/foo')
      end
    end

    context 'when asked to produce an import path relative to another file' do
      context 'and the other file is in the same folder' do
        let(:make_relative_to) { 'app/lib/bar.js' }

        it 'produces a correct relative path' do
          expect(subject.import_path).to eq('./foo')
        end

        context 'when the lookup_path starts with a dot' do
          let(:lookup_path) { './app' }

          it 'produces a correct relative path' do
            expect(subject.import_path).to eq('./foo')
          end
        end

        context 'when the lookup_path is the current directory' do
          let(:lookup_path) { '.' }

          it 'produces a correct relative path' do
            expect(subject.import_path).to eq('./foo')
          end
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

  describe '#open_file_path' do
    context 'when the file path is present' do
      let(:path_to_current_file) { '/path/to/file' }

      context 'when relative file path ends with /package.json ' do
        let(:relative_file_path) { 'node_modules/foo/package.json' }
        let(:main_file) { 'index.jsx' }
        before do
          allow(File).to receive(:read)
            .with(relative_file_path)
            .and_return("{ \"main\": \"#{main_file}\" }")
        end

        it 'replaces /package.json with the main file' do
          expect(subject.open_file_path(path_to_current_file))
            .to eq('node_modules/foo/index.jsx')
        end
      end

      context 'when relative file path has /package.json in the middle' do
        let(:relative_file_path) { 'node_modules/foo/package.json/bar' }

        it 'does not modify the path' do
          expect(subject.open_file_path(path_to_current_file))
            .to eq(relative_file_path)
        end
      end
    end

    context 'when the file path is empty' do
      # This can happen when resolving aliases
      let(:path_to_current_file) { '/path/to/file' }
      subject { described_class.new(import_path: import_path) }

      context 'when the import path starts with a ./' do
        let(:import_path) { './index.scss' }

        it 'makes the path relative to the path to the current file' do
          expect(subject.open_file_path(path_to_current_file))
            .to eq('/path/to/index.scss')
        end
      end

      context 'when the import path starts with a ../' do
        let(:import_path) { '../index.scss' }

        it 'makes the path relative to the path to the current file' do
          expect(subject.open_file_path(path_to_current_file))
            .to eq('/path/index.scss')
        end
      end

      context 'when the import path does not have any dots at the beginning' do
        let(:import_path) { 'my-package' }

        context 'when it is an alias of a package' do
          let(:main_file) { 'index.jsx' }
          before do
            allow(File).to receive(:read)
              .with("node_modules/#{import_path}/package.json")
              .and_return("{ \"main\": \"#{main_file}\" }")
          end

          it 'gives the main path found in the package.json' do
            expect(subject.open_file_path(path_to_current_file))
              .to eq("node_modules/#{import_path}/#{main_file}")
          end
        end

        context 'when it is not an alias of a package' do
          it 'does nothing to the path' do
            expect(subject.open_file_path(path_to_current_file))
              .to eq(import_path)
          end
        end
      end
    end
  end
end
