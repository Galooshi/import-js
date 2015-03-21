require 'spec_helper'
require 'import-js/importer'
require 'import-js/mock_vim_buffer'
require 'import-js/mock_vim_window'

describe 'Importer' do
  before do
    # Setup mocks
    module VIM
      class Window
        def self.current
          MockVimWindow.new
        end
      end
      class Buffer
        def self.current
          @buffer
        end

        def self.current_buffer=(text)
          @buffer = MockVimBuffer.new(text)
        end

        def self.current_buffer
          @buffer
        end
      end

      def self.message(message)
        @last_message = message
      end

      def self.last_message
        @last_message
      end

      def self.evaluate(expression)
        if expression =~ /<cword>/
          @current_word
        elsif expression =~ /inputlist/
          @current_selection || 0
        elsif expression =~ /getline/
          @buffer.to_s
        end
      end

      def self.current_word=(word)
        @current_word = word
      end

      def self.current_selection=(index)
        @current_selection = index
      end
    end
  end

  let(:word) { 'foo' }
  let(:text) { 'foo' } # start with a simple buffer
  let(:resolved_files) { [] } # start with a simple buffer

  before do
    VIM.current_word = word
    VIM::Buffer.current_buffer = text
    allow(Dir).to receive(:glob).and_return(resolved_files)
  end

  describe '#import' do
    subject do
      ImportJS::Importer.new.import
      VIM::Buffer.current_buffer.to_s
    end

    context 'with a variable name that will not resolve' do
      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end

      it 'displays a message' do
        subject
        expect(VIM.last_message).to eq(
          "[import-js]: No js file to import for variable `#{word}`")
      end
    end

    context 'with no word under the cursor' do
      let(:word) { '' }

      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end

      it 'displays a message' do
        subject
        expect(VIM.last_message).to eq(
          '[import-js]: No variable to import. Place your cursor on a variable, then try again.')
      end
    end

    context 'with a variable name that will resolve' do
      let(:resolved_files) { ['bar/foo.js.jsx'] }

      it 'adds an import to the top of the buffer' do
        expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');

foo
        EOS
      end

      context 'when that variable is already imported' do
        let(:text) { <<-EOS.strip }
var foo = require('bar/foo');

foo
        EOS

        it 'leaves the buffer unchanged' do
          expect(subject).to eq(text)
        end
      end

      context 'when other imports exist' do
        let(:text) { <<-EOS.strip }
var zoo = require('foo/zoo');
var bar = require('foo/bar');

foo
        EOS

        it 'adds the import and sorts the entire list' do
          expect(subject).to eq(<<-EOS.strip)
var bar = require('foo/bar');
var foo = require('bar/foo');
var zoo = require('foo/zoo');

foo
        EOS
        end
      end

      context 'when there is an unconventional import' do
        let(:text) { <<-EOS.strip }
var zoo = require('foo/zoo');
var tsar = require('foo/bar').tsar;

foo
        EOS

        it 'adds the import and sorts the entire list' do
          expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');
var tsar = require('foo/bar').tsar;
var zoo = require('foo/zoo');

foo
        EOS
        end
      end

      context 'when there is an import with line-breaks' do
        let(:text) { <<-EOS.strip }
var zoo =
  require('foo/zoo');
var tsar = require('foo/bar').tsar;

var foo = { require: b }
        EOS

        it 'adds the import, sorts the entire list and keeps the line-break' do
          expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');
var tsar = require('foo/bar').tsar;
var zoo =
  require('foo/zoo');

var foo = { require: b }
        EOS
        end
      end

      context 'when there is a blank line amongst current imports' do
        let(:text) { <<-EOS.strip }
var zoo = require('foo/zoo');

var bar = require('foo/bar');
foo
        EOS

        it 'adds the import and sorts the entire list' do
          # TODO: We currently search for current imports until we encounter
          # something that's not an import (like a blank line). We might want to
          # do better here and ignore that whitespace. But for now, this is the
          # behavior:
          expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');
var zoo = require('foo/zoo');

var bar = require('foo/bar');
foo
        EOS
        end
      end

      context 'when multiple files resolve the variable' do
        let(:resolved_files) do
          [
            'zoo/foo.js',
            'bar/foo.js.jsx'
          ]
        end

        before do
          VIM.current_selection = selection
        end

        context 'and the user selects the first file' do
          let(:selection) { 1 }

          it 'picks the first one' do
            expect(subject).to eq(<<-eos.strip)
var foo = require('zoo/foo');

foo
            eos
          end
        end

        context 'and the user selects the second file' do
          let(:selection) { 2 }

          it 'picks the second one' do
            expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');

foo
            EOS
          end
        end

        context 'and the user selects index 0 (which is the heading)' do
          let(:selection) { 0 }

          it 'picks nothing' do
            expect(subject).to eq(<<-EOS.strip)
foo
            EOS
          end
        end

        context 'and the user selects an index larger than the list' do
          # Apparently, this can happen when you use `inputlist`
          let(:selection) { 5 }

          it 'picks nothing' do
            expect(subject).to eq(<<-EOS.strip)
foo
            EOS
          end
        end

        context 'and the user selects an index < 0' do
          # Apparently, this can happen when you use `inputlist`
          let(:selection) { -1 }

          it 'picks nothing' do
            expect(subject).to eq(<<-EOS.strip)
foo
            EOS
          end
        end
      end
    end

    context 'configuration' do
      before do
        allow(File).to receive(:exist?).with('.importjs').and_return(true)
        allow(YAML).to receive(:load_file).and_return(configuration)
      end

      context 'with aliases' do
        let(:configuration) do
          {
            'aliases' => { '$' => 'jquery' }
          }
        end
        let(:text) { '$' }
        let(:word) { '$' }

        it 'resolves aliased imports to the aliases' do
          expect(subject).to eq(<<-EOS.strip)
var $ = require('jquery');

$
        EOS
        end
      end

      context 'with declaration_keyword' do
        subject do
          ImportJS::Importer.new.import
          VIM::Buffer.current_buffer.to_s
        end

        let(:configuration) do
          {
            'declaration_keyword' => 'const'
          }
        end

        context 'with a variable name that will resolve' do
          let(:resolved_files) { ['bar/foo.js.jsx'] }

          it 'adds an import to the top of the buffer using the declaration_keyword' do
            expect(subject).to eq(<<-EOS.strip)
const foo = require('bar/foo');

foo
            EOS
          end

          context 'when that variable is already imported using `var`' do
            let(:text) { <<-EOS.strip }
var foo = require('bar/foo');

foo
            EOS

            it 'changes the `var` to declaration_keyword' do
              expect(subject).to eq(<<-EOS.strip)
const foo = require('bar/foo');

foo
              EOS
            end
          end

          context 'when the import contains a line-break' do
            let(:text) { <<-EOS.strip }
var foo =
  require('bar/foo');

foo
            EOS

            it 'changes the `var` to declaration_keyword and removes the whitespace' do
              expect(subject).to eq(<<-EOS.strip)
const foo = require('bar/foo');

foo
              EOS
            end
          end

          context 'when other imports exist' do
            let(:text) { <<-EOS.strip }
var zoo = require('foo/zoo');
let bar = require('foo/bar');

foo
            EOS

            it 'adds the import and sorts the entire list' do
              expect(subject).to eq(<<-EOS.strip)
const foo = require('bar/foo');
let bar = require('foo/bar');
var zoo = require('foo/zoo');

foo
            EOS
            end
          end
        end
      end
    end
  end

  describe '#import_all' do
    let(:jshint_result) { '' }
    before do
      allow(Open3).to receive(:capture3).and_return([jshint_result, nil])
    end

    subject do
      ImportJS::Importer.new.import_all
      VIM::Buffer.current_buffer.to_s
    end

    context 'when no undefined variables exist' do
      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end

      it 'displays a message' do
        subject
        expect(VIM.last_message).to eq(
          '[import-js]: No variables to import'
        )
      end
    end

    context 'when one undefined variable exists' do
      let(:resolved_files) { ['bar/foo.js.jsx'] }
      let(:jshint_result) do
        "stdin: line 3, col 11, 'foo' is not defined."
      end

      it 'imports that variable' do
        expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');

foo
        EOS
      end

      it 'displays a message' do
        subject
        expect(VIM.last_message).to eq(
          '[import-js]: Imported these variables: ["foo"]'
        )
      end

      context 'when jshint returns other issues' do
        let(:jshint_result) do
          "stdin: line 1, col 1, Use the function form of \"use strict\".\n"
          "stdin: line 3, col 11, 'foo' is not defined."
        end

        it 'still imports the variable' do
          expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');

foo
          EOS
        end
      end
    end

    context 'when multiple undefined variables exist' do
      # We're cheating a bit with always returning this thing
      let(:resolved_files) { ['bar/foo.js.jsx'] }
      let(:text) { 'var a = foo + bar;' }

      let(:jshint_result) do
        "stdin: line 3, col 11, 'foo' is not defined.\n" +
        "stdin: line 3, col 11, 'bar' is not defined."
      end

      it 'imports all variables' do
        expect(subject).to eq(<<-EOS.strip)
var bar = require('bar/foo');
var foo = require('bar/foo');

var a = foo + bar;
        EOS
      end

      it 'displays a message' do
        subject
        expect(VIM.last_message).to eq(
          '[import-js]: Imported these variables: ["foo", "bar"]'
        )
      end
    end

    context 'when the list of undefined variables has duplicates' do
      # We're cheating a bit with always returning this thing
      let(:resolved_files) { ['bar/foo.js.jsx'] }
      let(:text) { 'var a = foo + bar;' }

      let(:jshint_result) do
        "stdin: line 3, col 11, 'foo' is not defined.\n" +
        "stdin: line 3, col 11, 'foo' is not defined.\n" +
        "stdin: line 3, col 11, 'foo' is not defined.\n" +
        "stdin: line 3, col 11, 'bar' is not defined."
      end

      it 'imports all variables' do
        expect(subject).to eq(<<-EOS.strip)
var bar = require('bar/foo');
var foo = require('bar/foo');

var a = foo + bar;
        EOS
      end

      it 'displays a message' do
        subject
        expect(VIM.last_message).to eq(
          '[import-js]: Imported these variables: ["foo", "bar"]'
        )
      end
    end
  end
end
