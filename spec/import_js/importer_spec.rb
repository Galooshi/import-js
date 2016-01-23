# encoding: utf-8
require 'spec_helper'
require 'tmpdir'
require 'pathname'

describe ImportJS::Importer do
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

      def self.command(command)
        @last_command = command
      end

      def self.last_command
        @last_command
      end

      def self.last_command_message
        @last_command.gsub(/^:call importjs#WideMsg\('(.*?)'\)/, '\1')
      end

      def self.last_inputlist
        @last_inputlist
      end

      def self.evaluate(expression)
        if expression =~ /<cword>/
          @current_word
        elsif expression =~ /inputlist/
          @last_inputlist = expression
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
  let(:existing_files) { [] } # start with a simple buffer
  let(:package_json_content) { nil }
  let(:lookup_paths) { [File.basename(@tmp_dir)] }

  before do
    VIM.current_word = word
    VIM::Buffer.current_buffer = text

    @tmp_dir = Dir.mktmpdir(nil, Dir.pwd)
    allow_any_instance_of(ImportJS::Configuration)
      .to receive(:get).and_call_original
    allow_any_instance_of(ImportJS::Configuration)
      .to receive(:get).with('lookup_paths').and_return(lookup_paths)
    allow_any_instance_of(ImportJS::VIMEditor)
      .to receive(:available_columns).and_return(100)
    allow_any_instance_of(ImportJS::VIMEditor)
      .to receive(:path_to_current_file).and_return(File.join(@tmp_dir, 'test.js'))

    existing_files.each do |file|
      full_path = File.join(@tmp_dir, file)
      FileUtils.mkdir_p(Pathname.new(full_path).dirname)
      FileUtils.touch(full_path)
    end

    if package_json_content
      File.open(File.join(@tmp_dir, 'Foo/package.json'), 'w') do |f|
        f.write(package_json_content.to_json)
      end
    end
  end

  after do
    FileUtils.remove_entry_secure @tmp_dir
  end

  describe '#import' do
    subject do
      described_class.new.import
      VIM::Buffer.current_buffer.to_s
    end

    context 'when lookup_paths is just an empty string' do
      let(:lookup_paths) { [''] }

      it 'throws an error' do
        expect { subject }.to raise_error(ImportJS::FindError)
      end
    end

    context 'with a variable name that will not resolve' do
      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end

      it 'displays a message' do
        subject
        expect(VIM.last_command_message).to start_with(
          "ImportJS: No JS module to import for variable `#{word}`")
      end
    end

    context 'with no word under the cursor' do
      let(:word) { '' }

      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end

      it 'displays a message' do
        subject
        expect(VIM.last_command_message).to eq(
          'ImportJS: No variable to import. Place your cursor on a variable, then try again.')
      end

      context 'when Vim is narrower than the message' do
        before do
          allow_any_instance_of(ImportJS::VIMEditor)
            .to receive(:available_columns).and_return(80)
        end

        it 'truncates the message' do
          subject
          expect(VIM.last_command_message).to eq(
            'ImportJS: No variable to import. Place your cursor on a variable, then try aga…')
        end
      end
    end

    context 'with a variable name that will resolve' do
      let(:existing_files) { ['bar/foo.jsx'] }

      it 'adds an import to the top of the buffer' do
        expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
        EOS
      end

      it 'displays a message about the imported module' do
        expect(VIM.last_command_message).to start_with(
          'ImportJS: Imported `bar/foo`')
      end

      context 'when that import is already imported' do
        let(:text) { <<-EOS.strip }
import foo from 'bar/foo';

foo
        EOS

        it 'leaves the buffer unchanged' do
          expect(subject).to eq(text)
        end

        context "when 'use strict' is at the top of the file" do
          let(:text) { <<-EOS.strip }
'use strict';

foo
          EOS

          it 'adds the import below' do
            expect(subject).to eq(<<-EOS.strip)
'use strict';

import foo from 'bar/foo';

foo
            EOS
          end
        end

        context "when 'use strict' is at the top of the file twice" do
          let(:text) { <<-EOS.strip }
'use strict';
'use strict';

foo
          EOS

          it 'adds the import below' do
            expect(subject).to eq(<<-EOS.strip)
'use strict';
'use strict';

import foo from 'bar/foo';

foo
            EOS
          end
        end

        context 'when a one-line comment is at the top of the file' do
          let(:text) { <<-EOS.strip }
// One-line comment

foo
          EOS

          it 'adds the import below' do
            expect(subject).to eq(<<-EOS.strip)
// One-line comment

import foo from 'bar/foo';

foo
            EOS
          end
        end

        context 'when multiple one-line comments are at the top of the file' do
          let(:text) { <<-EOS.strip }
// One-line comment
// Another one-line comment

foo
          EOS

          it 'adds the import below' do
            expect(subject).to eq(<<-EOS.strip)
// One-line comment
// Another one-line comment

import foo from 'bar/foo';

foo
            EOS
          end
        end

        context 'when multiple one-line comments and empty lines are at the top of the file' do
          let(:text) { <<-EOS.strip }
// One-line comment

// Another one-line comment

foo
          EOS

          it 'adds the import below' do
            expect(subject).to eq(<<-EOS.strip)
// One-line comment

// Another one-line comment

import foo from 'bar/foo';

foo
            EOS
          end
        end

        context 'when the variable name matches last folder+filename' do
          let(:existing_files) { ['sko/bar/foo.jsx'] }
          let(:word) { 'barFoo' }
          let(:text) { 'barFoo' }

          it 'resolves the import' do
            expect(subject).to eq(<<-EOS.strip)
import barFoo from 'sko/bar/foo';

barFoo
            EOS
          end

          context 'when the last folder ends with an "s"' do
            let(:existing_files) { ['sko/bars/foo.jsx'] }

            it 'resolves the import' do
              expect(subject).to eq(<<-EOS.strip)
import barFoo from 'sko/bars/foo';

barFoo
              EOS
            end

            context 'when the variable also has "s" at the end' do
              let(:word) { 'barsFoo' }
              let(:text) { 'barsFoo' }

              it 'resolves the import' do
                expect(subject).to eq(<<-EOS.strip)
import barsFoo from 'sko/bars/foo';

barsFoo
                EOS
              end
            end
          end

          context 'when the last folder ends with "es"' do
            let(:existing_files) { ['sko/statuses/foo.jsx'] }
            let(:word) { 'statusFoo' }
            let(:text) { 'statusFoo' }

            it 'resolves the import' do
              expect(subject).to eq(<<-EOS.strip)
import statusFoo from 'sko/statuses/foo';

statusFoo
              EOS
            end

            context 'when the variable also has "es" at the end' do
              let(:word) { 'statusesFoo' }
              let(:text) { 'statusesFoo' }

              it 'resolves the import' do
                expect(subject).to eq(<<-EOS.strip)
import statusesFoo from 'sko/statuses/foo';

statusesFoo
                EOS
              end
            end
          end
        end

        context 'when the variable name matches a few folders + filename' do
          let(:existing_files) { ['sko/bar/foo/ta.jsx'] }
          let(:word) { 'BarFooTa' }
          let(:text) { 'BarFooTa' }

          it 'resolves the import' do
            expect(subject).to eq(<<-EOS.strip)
import BarFooTa from 'sko/bar/foo/ta';

BarFooTa
            EOS
          end

          context 'when the folders end with "s"' do
            let(:existing_files) { ['sko/bars/foos/ta.jsx'] }

            it 'resolves the import' do
              expect(subject).to eq(<<-EOS.strip)
import BarFooTa from 'sko/bars/foos/ta';

BarFooTa
              EOS
            end

            context 'when the variable also has "s"' do
              let(:word) { 'BarsFoosTa' }
              let(:text) { 'BarsFoosTa' }

              it 'resolves the import' do
                expect(subject).to eq(<<-EOS.strip)
import BarsFoosTa from 'sko/bars/foos/ta';

BarsFoosTa
                EOS
              end
            end
          end

          context 'when the folders end with "es"' do
            let(:existing_files) { ['sko/statuses/buses/ta.jsx'] }
            let(:word) { 'statusBusTa' }
            let(:text) { 'statusBusTa' }

            it 'resolves the import' do
              expect(subject).to eq(<<-EOS.strip)
import statusBusTa from 'sko/statuses/buses/ta';

statusBusTa
              EOS
            end

            context 'when the variable also has "es"' do
              let(:word) { 'StatusesBusesTa' }
              let(:text) { 'StatusesBusesTa' }

              it 'resolves the import' do
                expect(subject).to eq(<<-EOS.strip)
import StatusesBusesTa from 'sko/statuses/buses/ta';

StatusesBusesTa
                EOS
              end
            end
          end
        end

        context "when there are other imports under 'use strict'" do
          let(:text) { <<-EOS.strip }
'use strict';
import bar from 'bar';

foo + bar
          EOS

          it 'adds the import at the right place' do
            expect(subject).to eq(<<-EOS.strip)
'use strict';
import bar from 'bar';
import foo from 'bar/foo';

foo + bar
            EOS
          end
        end

        context "when there is no newline under a lonely 'use strict'" do
          let(:text) { <<-EOS.strip }
'use strict';
foo + bar
          EOS

          it 'adds a newline as part of importing ' do
            expect(subject).to eq(<<-EOS.strip)
'use strict';
import foo from 'bar/foo';

foo + bar
            EOS
          end
        end

        context 'when "use strict" is within double quotes' do
          let(:text) { <<-EOS.strip }
"use strict";

foo
          EOS

          it 'adds the import below' do
            expect(subject).to eq(<<-EOS.strip)
"use strict";

import foo from 'bar/foo';

foo
            EOS
          end
        end
      end

      context 'when the variable resolves to a node.js conventional module' do
        let(:existing_files) { ['Foo/index.jsx'] }

        it 'adds an import to the top of the buffer' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'Foo';

foo
          EOS
        end

        it 'displays a message about the imported module' do
          expect(VIM.last_command_message).to start_with(
            'ImportJS: Imported `Foo (main: index.jsx)`')
        end

        context 'when that module has a dot in its name' do
          let(:existing_files) { ['Foo.io/index.jsx'] }
          let(:word) { 'FooIO' }
          let(:text) { 'FooIO' }

          it 'imports that module with the dot' do
            expect(subject).to eq(<<-EOS.strip)
import FooIO from 'Foo.io';

FooIO
            EOS
          end
        end
      end

      context 'when the import resolves to a dependency from package.json' do
        let(:existing_files) { [] }
        let(:package_dependencies) { ['foo-bar'] }
        let(:word) { 'fooBar' }
        let(:text) { 'fooBar' }

        before do
          allow_any_instance_of(ImportJS::Configuration)
            .to receive(:package_dependencies).and_return(package_dependencies)
          package_dependencies.each do |dep|
            allow(File).to receive(:read)
              .with("node_modules/#{dep}/package.json")
              .and_return('{ "main": "bar.jsx" }')
          end
        end

        it 'adds an import to the top of the buffer' do
          expect(subject).to eq(<<-EOS.strip)
import fooBar from 'foo-bar';

fooBar
          EOS
        end

        it 'displays a message about the imported module' do
          expect(VIM.last_command_message).to start_with(
            'ImportJS: Imported `foo-bar (main: bar.jsx)`')
        end

        context 'with an `ignore_package_prefixes` configuration' do
          let(:ignore_prefixes) { ['foo-'] }

          before do
            allow_any_instance_of(ImportJS::Configuration)
              .to receive(:get).with('ignore_package_prefixes')
              .and_return(ignore_prefixes)
          end

          context 'when the variable has the prefix' do
            it 'still imports the package' do
              expect(subject).to eq(<<-EOS.strip)
import fooBar from 'foo-bar';

fooBar
              EOS
            end
          end

          context 'when the variable does not have the prefix' do
            let(:word) { 'bar' }
            let(:text) { 'bar' }

            it 'imports the package' do
              expect(subject).to eq(<<-EOS.strip)
import bar from 'foo-bar';

bar
              EOS
            end
          end

          context 'when a package matches the prefix but not the word' do
            let(:word) { 'baz' }
            let(:text) { 'baz' }

            it 'leaves the buffer unchanged' do
              expect(subject).to eq(<<-EOS.strip)
baz
              EOS
            end
          end
        end
      end

      context 'when other imports exist' do
        let(:text) { <<-EOS.strip }
import zoo from 'foo/zoo';
import bar from 'foo/bar';

foo
        EOS

        it 'adds the import and sorts the entire list' do
          expect(subject).to eq(<<-EOS.strip)
import bar from 'foo/bar';
import foo from 'bar/foo';
import zoo from 'foo/zoo';

foo
          EOS
        end

        context 'when there are unconventional imports in the list' do
          # e.g. added through using the `import_function` configuration option
          let(:text) { <<-EOS.strip }
const sko = customImportFunction('sko');
import zoo from 'foo/zoo';
import bar from 'foo/bar';

foo
          EOS

          it 'adds the import and sorts the entire list' do
            expect(subject).to eq(<<-EOS.strip)
const sko = customImportFunction('sko');
import bar from 'foo/bar';
import foo from 'bar/foo';
import zoo from 'foo/zoo';

foo
            EOS
          end
        end
      end

      context 'when there is an unconventional import' do
        let(:text) { <<-EOS.strip }
import zoo from 'foo/zoo';
import tsar from 'foo/bar').tsa;

foo
        EOS

        it 'adds the import and sorts the entire list' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';
import tsar from 'foo/bar').tsa;
import zoo from 'foo/zoo';

foo
        EOS
        end
      end

      context 'when there is a non-import inline with the imports' do
        let(:text) { <<-EOS.strip }
import bar from 'bar';
import star from
  'star';
var { STRAWBERRY, CHOCOLATE } = bar.scoops;
import zoo from 'foo/zoo';

foo
        EOS

        it 'breaks imports at that line' do
          # A better solution would perhaps be to find the `var zoo` import and
          # move it up there with the rest. But there's a lot of complexity
          # involved in that, so cutting off at the non-import is a simpler
          # solution.
          expect(subject).to eq(<<-EOS.strip)
import bar from 'bar';
import foo from 'bar/foo';
import star from
  'star';

var { STRAWBERRY, CHOCOLATE } = bar.scoops;
import zoo from 'foo/zoo';

foo
        EOS
        end
      end

      context 'when there is an import with line-breaks' do
        let(:text) { <<-EOS.strip }
import zoo from
  'foo/zoo';
import tsar from 'foo/bar';

var import_foo = { from: b }
        EOS

        it 'adds the import, sorts the entire list and keeps the line-break' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';
import tsar from 'foo/bar';
import zoo from
  'foo/zoo';

var import_foo = { from: b }
        EOS
        end
      end

      context 'when there is a blank line amongst current imports' do
        let(:text) { <<-EOS.strip }
import zoo from 'foo/zoo';

import bar from 'foo/bar';
foo
        EOS

        it 'adds the import and sorts the entire list' do
          # TODO: We currently search for current imports until we encounter
          # something that's not an import (like a blank line). We might want to
          # do better here and ignore that whitespace. But for now, this is the
          # behavior:
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';
import zoo from 'foo/zoo';

import bar from 'foo/bar';
foo
        EOS
        end
      end

      context 'when multiple files resolve the variable' do
        let(:existing_files) do
          [
            'bar/foo.jsx',
            'zoo/foo.js',
            'zoo/goo/Foo/index.js'
          ]
        end

        it 'displays a message about selecting a module' do
          subject
          expect(VIM.last_inputlist).to include(
            "ImportJS: Pick JS module to import for 'foo'")
        end

        it 'list all possible imports' do
          subject
          expect(VIM.last_inputlist).to include(
            '1: bar/foo')
          expect(VIM.last_inputlist).to include(
            '2: zoo/foo')
          expect(VIM.last_inputlist).to include(
            '3: zoo/goo/Foo (main: index.js)')
        end

        context 'and the user selects' do
          before do
            VIM.current_selection = selection
          end

          context 'the first file' do
            let(:selection) { 1 }

            it 'picks the first one' do
              expect(subject).to eq(<<-eos.strip)
import foo from 'bar/foo';

foo
              eos
            end
          end

          context 'the second file' do
            let(:selection) { 2 }

            it 'picks the second one' do
              expect(subject).to eq(<<-EOS.strip)
import foo from 'zoo/foo';

foo
              EOS
            end
          end

          context 'index 0 (which is the heading)' do
            let(:selection) { 0 }

            it 'picks nothing' do
              expect(subject).to eq(<<-EOS.strip)
foo
              EOS
            end
          end

          context 'an index larger than the list' do
            # Apparently, this can happen when you use `inputlist`
            let(:selection) { 5 }

            it 'picks nothing' do
              expect(subject).to eq(<<-EOS.strip)
foo
              EOS
            end
          end

          context 'an index < 0' do
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

      context 'when the same logical file is matched twice' do
        let(:existing_files) do
          [
            'Foo/lib/foo.jsx',
            'Foo/package.json',
            'zoo/foo.js'
          ]
        end

        let(:package_json_content) do
          {
            main: 'lib/foo.jsx'
          }
        end

        it 'lists the version of the file resolved through package.json' do
          subject
          expect(VIM.last_inputlist).to include(
            '1: Foo (main: lib/foo.jsx)')
        end

        it 'does not list the file also resolved through package.json' do
          subject
          expect(VIM.last_inputlist).to_not include(
            'Foo/lib/foo.jsx')
        end
      end
    end

    context 'importing a module with a package.json file' do
      let(:existing_files) { ['Foo/package.json', 'Foo/build/main.js'] }

      context 'when `main` points to a JS file' do
        let(:package_json_content) do
          {
            main: 'build/main.js'
          }
        end

        it 'adds an import to the top of the buffer' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'Foo';

foo
          EOS
        end
      end

      context 'when `main` points to index.js in the same folder' do
        let(:existing_files) { ['Foo/package.json', 'Foo/index.js'] }

        let(:package_json_content) do
          {
            main: 'index.js'
          }
        end

        it 'adds an import to the top of the buffer' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'Foo';

foo
          EOS
        end
      end

      context 'when the module is named something.js' do
        let(:existing_files) { ['Foo.js/package.json', 'Foo.js/main.js'] }
        let(:text) { 'FooJS' }
        let(:word) { 'FooJS' }

        before do
          File.open(File.join(@tmp_dir, 'Foo.js/package.json'), 'w') do |f|
            f.write({ main: 'main.js' }.to_json)
          end
        end

        it 'keeps the .js in the import' do
          expect(subject).to eq(<<-EOS.strip)
import FooJS from 'Foo.js';

FooJS
          EOS
        end
      end

      context 'when `main` is missing' do
        let(:package_json_content) { {} }

        it 'does not add an import' do
          expect(subject).to eq(<<-EOS.strip)
foo
          EOS
        end
      end
    end

    describe 'line wrapping' do
      let(:importer) { described_class.new }

      subject do
        importer.import
        VIM::Buffer.current_buffer.to_s
      end

      context "when lines exceed Vim's textwidth" do
        before(:each) do
          allow_any_instance_of(ImportJS::VIMEditor)
            .to receive(:max_line_length)
            .and_return(40)
        end

        let(:existing_files) { ['fiz/bar/biz/baz/fiz/buz/boz/foo.jsx'] }

        context 'when expandtab is not set' do
          before(:each) do
            allow_any_instance_of(ImportJS::VIMEditor)
              .to receive(:expand_tab?)
              .and_return(false)
          end

          it 'wraps them and indents with a tab' do
            expect(subject).to eq(<<-EOS.strip)
import foo from
	'fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
            EOS
          end
        end

        context 'when expandtab is set' do
          before(:each) do
            allow_any_instance_of(ImportJS::VIMEditor)
              .to receive(:expand_tab?)
              .and_return(true)
          end

          context 'when shiftwidth is set' do
            before(:each) do
              allow_any_instance_of(ImportJS::VIMEditor)
                .to receive(:shift_width)
                .and_return(3)
            end

            it 'wraps them and indents with shiftwidth spaces' do
              expect(subject).to eq(<<-EOS.strip)
import foo from
   'fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
              EOS
            end
          end

          context 'when shiftwidth is not set' do
            before(:each) do
              allow_any_instance_of(ImportJS::VIMEditor)
                .to receive(:shift_width)
                .and_return(nil)
            end

            it 'wraps them and indents with 2 spaces' do
              expect(subject).to eq(<<-EOS.strip)
import foo from
  'fiz/bar/biz/baz/fiz/buz/boz/foo';

foo
              EOS
            end
          end
        end
      end

      context "when lines do not exceed Vim's textwidth" do
        before(:each) do
          allow_any_instance_of(ImportJS::VIMEditor)
            .to receive(:max_line_length).and_return(80)
        end

        let(:existing_files) { ['bar/foo.jsx'] }

        it 'does not wrap them' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
          EOS
        end
      end
    end

    context 'configuration' do
      before do
        allow_any_instance_of(ImportJS::Configuration)
          .to(receive(:load_config))
          .and_return(configuration)
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
import $ from 'jquery';

$
        EOS
        end

        context 'and an alias has a dynamic {filename}' do
          before do
            allow_any_instance_of(ImportJS::VIMEditor)
              .to receive(:path_to_current_file)
              .and_return(path_to_current_file)
          end

          let(:configuration) do
            {
              'aliases' => { 'styles' => './{filename}.scss' }
            }
          end
          let(:text) { 'styles' }
          let(:word) { 'styles' }
          let(:path_to_current_file) { 'bar/foo.jsx' }

          it 'uses the filename of the current file' do
            expect(subject).to eq(<<-EOS.strip)
import styles from './foo.scss';

styles
            EOS
          end

          context 'when editing an anonymous file' do
            context 'that is nil' do
              let(:path_to_current_file) { nil }

              it 'does not replace the dynamic part' do
                expect(subject).to eq(<<-EOS.strip)
import styles from './{filename}.scss';

styles
                EOS
              end
            end

            context 'that is an empty string' do
              let(:path_to_current_file) { '' }

              it 'does not replace the dynamic part' do
                expect(subject).to eq(<<-EOS.strip)
import styles from './{filename}.scss';

styles
                EOS
              end
            end
          end
        end

        context 'and an alias contains a slash' do
          # https://github.com/trotzig/import-js/issues/39
          let(:configuration) do
            {
              'aliases' => { '$' => 'jquery/jquery' }
            }
          end

          it 'keeps the slash in the alias path' do
            expect(subject).to eq(<<-EOS.strip)
import $ from 'jquery/jquery';

$
          EOS
          end
        end
      end

      context 'alias with `var` and a destructure object' do
        let(:configuration) do
          {
            'declaration_keyword' => 'var',
            'aliases' => {
              '_' => {
                'path' => 'underscore',
                'destructure' => %w(
                  memoize
                  debounce
                )
              }
            }
          }
        end
        let(:text) { '_' }
        let(:word) { '_' }

        it 'resolves the main alias without destructuring' do
          expect(subject).to eq(<<-EOS.strip)
var _ = require('underscore');

_
        EOS
        end

        context 'when a destructured import exists for the same module' do
          let(:text) { <<-EOS.strip }
var { memoize } = require('underscore');

_
          EOS

          it 'adds the default import' do
            expect(subject).to eq(<<-EOS.strip)
var _ = require('underscore');
var { memoize } = require('underscore');

_
            EOS
          end
        end

        context 'when importing a destructured object' do
          let(:text) { 'memoize' }
          let(:word) { 'memoize' }

          it 'resolves that import in a destructured way' do
            expect(subject).to eq(<<-EOS.strip)
var { memoize } = require('underscore');

memoize
            EOS
          end

          context 'when the default import exists for the same module' do
            let(:text) { <<-EOS.strip }
var _ = require('underscore');

memoize
            EOS

            it 'adds the destructuring on a new line' do
              expect(subject).to eq(<<-EOS.strip)
var _ = require('underscore');
var { memoize } = require('underscore');

memoize
              EOS
            end
          end

          context 'when the default import exists for the same module with other modules' do
            let(:text) { <<-EOS.strip }
var _ = require('underscore');
var foo = require('foo');

memoize
            EOS

            it 'adds the destructuring on a new line' do
              expect(subject).to eq(<<-EOS.strip)
var _ = require('underscore');
var foo = require('foo');
var { memoize } = require('underscore');

memoize
              EOS
            end
          end

          context 'with other imports' do
            let(:text) { <<-EOS.strip }
let bar = require('foo/bar');
var { xyz } = require('alphabet');

memoize
            EOS

            it 'places the import at the right place' do
              expect(subject).to eq(<<-EOS.strip)
let bar = require('foo/bar');
var { memoize } = require('underscore');
var { xyz } = require('alphabet');

memoize
              EOS
            end
          end

          context 'when other destructured imports exist for the same module' do
            let(:text) { <<-EOS.strip }
var { xyz, debounce } = require('underscore');

memoize
            EOS

            it 'combines the destructured import and sorts items' do
              expect(subject).to eq(<<-EOS.strip)
var { debounce, memoize, xyz } = require('underscore');

memoize
              EOS
            end

            context 'when the module is already in the destructured object' do
              let(:text) { <<-EOS.strip }
var { debounce, memoize } = require('underscore');

memoize
              EOS

              it 'does not add a duplicate' do
                expect(subject).to eq(<<-EOS.strip)
var { debounce, memoize } = require('underscore');

memoize
                EOS
              end
            end
          end
        end
      end

      context 'alias with `import` and a destructure object' do
        let(:configuration) do
          {
            'declaration_keyword' => 'import',
            'aliases' => {
              '_' => {
                'path' => 'underscore',
                'destructure' => %w(
                  memoize
                  debounce
                )
              }
            }
          }
        end
        let(:text) { '_' }
        let(:word) { '_' }

        it 'resolves the main alias without destructuring' do
          expect(subject).to eq(<<-EOS.strip)
import _ from 'underscore';

_
        EOS
        end

        context 'when a destructured import exists for the same module' do
          let(:text) { <<-EOS.strip }
import { memoize } from 'underscore';

_
          EOS

          it 'adds the default import' do
            expect(subject).to eq(<<-EOS.strip)
import _, { memoize } from 'underscore';

_
            EOS
          end
        end

        context 'when importing a destructured object' do
          let(:text) { 'memoize' }
          let(:word) { 'memoize' }

          it 'resolves that import in a destructured way' do
            expect(subject).to eq(<<-EOS.strip)
import { memoize } from 'underscore';

memoize
            EOS
          end

          context 'with other imports' do
            let(:text) { <<-EOS.strip }
import bar from 'foo/bar';
import { xyz } from 'alphabet';

memoize
            EOS

            it 'places the import at the right place' do
              expect(subject).to eq(<<-EOS.strip)
import bar from 'foo/bar';
import { memoize } from 'underscore';
import { xyz } from 'alphabet';

memoize
              EOS
            end
          end

          context 'when other destructured imports exist for the same module' do
            let(:text) { <<-EOS.strip }
import { xyz, debounce } from 'underscore';

memoize
            EOS

            it 'combines the destructured import and sorts items' do
              expect(subject).to eq(<<-EOS.strip)
import { debounce, memoize, xyz } from 'underscore';

memoize
              EOS
            end

            context 'when the module is already in the destructured object' do
              let(:text) { <<-EOS.strip }
import { debounce, memoize, xyz } from 'underscore';

memoize
              EOS

              it 'does not add a duplicate' do
                expect(subject).to eq(<<-EOS.strip)
import { debounce, memoize, xyz } from 'underscore';

memoize
                EOS
              end
            end
          end

          context 'when a default import exists for the same module' do
            let(:text) { <<-EOS.strip }
import _ from 'underscore';

memoize
            EOS

            it 'adds the destructured import' do
              expect(subject).to eq(<<-EOS.strip)
import _, { memoize } from 'underscore';

memoize
              EOS
            end

            context 'when the module is already in the destructured object' do
              let(:text) { <<-EOS.strip }
import _, { memoize } from 'underscore';

memoize
              EOS

              it 'does not add a duplicate' do
                expect(subject).to eq(<<-EOS.strip)
import _, { memoize } from 'underscore';

memoize
                EOS
              end
            end
          end
        end
      end

      context 'with a custom `import_function`' do
        let(:existing_files) { ['bar/foo.js'] }

        context 'and `declaration_keyword=import`' do
          let(:configuration) do
            {
              'import_function' => 'myRequire',
              'declaration_keyword' => 'import'
            }
          end

          it 'does nothing special' do
            expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
            EOS
          end
        end

        context 'and `declaration_keyword=const`' do
          let(:configuration) do
            {
              'import_function' => 'myRequire',
              'declaration_keyword' => 'const'
            }
          end
          it 'uses the custom import function instead of "require"' do
            expect(subject).to eq(<<-EOS.strip)
const foo = myRequire('bar/foo');

foo
            EOS
          end
        end
      end

      context 'when strip_file_extensions is empty' do
        let(:existing_files) { ['bar/foo.js'] }
        let(:configuration) do
          {
            'strip_file_extensions' => []
          }
        end

        it 'keeps the file ending in the import' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo.js';

foo
          EOS
        end
      end

      context 'with excludes' do
        let(:existing_files) { ['bar/foo/foo.js'] }
        let(:configuration) do
          {
            'excludes' => ['**/foo/**']
          }
        end

        it 'does not add an import' do
          expect(subject).to eq(<<-EOS.strip)
foo
          EOS
        end

        it 'displays a message' do
          subject
          expect(VIM.last_command_message).to start_with(
            "ImportJS: No JS module to import for variable `#{word}`")
        end
      end

      context 'with declaration_keyword=const' do
        subject do
          described_class.new.import
          VIM::Buffer.current_buffer.to_s
        end

        let(:configuration) do
          {
            'declaration_keyword' => 'const'
          }
        end

        context 'with a variable name that will resolve' do
          let(:existing_files) { ['bar/foo.jsx'] }

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

      context 'with declaration_keyword=import' do
        subject do
          described_class.new.import
          VIM::Buffer.current_buffer.to_s
        end

        let(:configuration) do
          {
            'declaration_keyword' => 'import'
          }
        end

        context 'with a variable name that will resolve' do
          let(:existing_files) { ['bar/foo.jsx', 'bar/fromfoo.jsx'] }

          context 'when that variable is already imported using `var`' do
            let(:text) { <<-EOS.strip }
var foo = require('bar/foo');

foo
            EOS

            it 'changes the `var` to declaration_keyword' do
              expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
              EOS
            end
          end

          context 'when that variable is already imported using `var` and double quotes' do
            let(:text) { <<-EOS.strip }
var foo = require("bar/foo");

foo
            EOS

            it 'changes the `var` to declaration_keyword and doubles to singles' do
              expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
              EOS
            end
          end

          context 'when that variable is already imported and has "from" in it' do
            let(:text) { <<-EOS.strip }
var fromfoo = require('bar/fromfoo');

fromfoo
            EOS
            let(:word) { 'fromfoo' }

            it 'changes the `var` to declaration_keyword' do
              expect(subject).to eq(<<-EOS.strip)
import fromfoo from 'bar/fromfoo';

fromfoo
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
import foo from 'bar/foo';

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
import foo from 'bar/foo';
let bar = require('foo/bar');
var zoo = require('foo/zoo');

foo
            EOS
            end
          end
        end
      end

      context 'with `use_relative_paths=true`' do
        let(:existing_files) { ['bar/foo.jsx'] }
        let(:text) { <<-EOS.strip }
foo
        EOS

        before do
          allow_any_instance_of(ImportJS::VIMEditor)
            .to receive(:path_to_current_file)
            .and_return(path_to_current_file)
        end

        subject do
          described_class.new.import
          VIM::Buffer.current_buffer.to_s
        end

        let(:configuration) do
          {
            'use_relative_paths' => true
          }
        end

        context 'when the current file is in the same lookup_path' do
          let(:path_to_current_file) { File.join(@tmp_dir, 'bar/current.js') }

          it 'uses a relative import path' do
            expect(subject).to eq(<<-EOS.strip)
import foo from './foo';

foo
            EOS
          end
        end

        context 'when the current file is not in the same lookup_path' do
          let(:path_to_current_file) { '/foo/bar/current.js' }

          it 'does not use a relative import path' do
            expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
            EOS
          end
        end
      end

      context 'with local configuration defined in the main config file' do
        let(:pattern) { 'foo/**' }
        let(:existing_files) { ['bar/foo.jsx'] }
        let(:configuration) do
          [{
            'applies_to' => pattern,
            'declaration_keyword' => 'var'
          }]
        end
        before do
          allow_any_instance_of(ImportJS::VIMEditor)
            .to receive(:path_to_current_file)
            .and_return('foo/bar.js')
        end

        let(:text) { 'foo' }
        let(:word) { 'foo' }

        context 'when the pattern matches the file being edited' do
          it 'uses local config' do
            expect(subject).to eq(<<-EOS.strip)
var foo = require('bar/foo');

foo
            EOS
          end
        end

        context 'when the pattern does not match the file being edited' do
          let(:pattern) { 'car/**' }

          it 'falls back to default config' do
            expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
            EOS
          end
        end

        context 'with an applies_from pattern' do
          let(:from_pattern) { "#{File.basename(@tmp_dir)}/bar/**" }
          let(:path_to_current_file) { "#{File.basename(@tmp_dir)}/foo/bar.js" }
          let(:configuration) do
            [{
              'applies_from' => from_pattern,
              'declaration_keyword' => 'var',
              'import_function' => 'quack',
              'use_relative_paths' => true,
              'strip_file_extensions' => [],
            }]
          end

          before do
            allow_any_instance_of(ImportJS::VIMEditor)
              .to receive(:path_to_current_file)
              .and_return(path_to_current_file)
          end

          context 'that matches the path of the file being imported' do
            it 'uses local config' do
              expect(subject).to eq(<<-EOS.strip)
var foo = quack('../bar/foo.jsx');

foo
              EOS
            end

            context 'when using `.` as lookup_path' do
              let(:lookup_paths) { ['.'] }

              it 'uses local config' do
                expect(subject).to eq(<<-EOS.strip)
var foo = quack('../bar/foo.jsx');

foo
                EOS
              end
            end
          end

          context 'that does not match the file being imported' do
            let(:from_pattern) { 'foo/**' }

            it 'falls back to default config' do
              expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
              EOS
            end
          end
        end
      end
    end
  end

  describe '#fix_imports' do
    let(:eslint_result) { '' }
    let(:eslint_error)  { '' }
    before do
      allow(Open3).to receive(:capture3).and_call_original
      allow(Open3).to receive(:capture3).with(/eslint/, anything)
        .and_return([eslint_result, eslint_error])
    end

    subject do
      described_class.new.fix_imports
      VIM::Buffer.current_buffer.to_s
    end

    it 'calls out to global eslint' do
      expect(Open3).to receive(:capture3).with(/\Aeslint /, any_args)
      subject
    end

    context 'with eslint_executable configuration' do
      let(:eslint_executable) { 'node_modules/.bin/eslint' }

      before do
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:get).and_call_original
        allow_any_instance_of(ImportJS::Configuration)
          .to receive(:get).with('eslint_executable')
          .and_return(eslint_executable)
      end

      it 'calls out to the configured eslint executable' do
        command = Regexp.escape(eslint_executable)
        expect(Open3).to receive(:capture3).with(/\A#{command} /, any_args)
        subject
      end
    end

    context 'with an eslint_executable that can not be found' do
      let(:eslint_error) do
        'node_modules/.bin/eslink: No such file or directory'
      end

      it 'throws an error' do
        expect { subject }.to raise_error(ImportJS::ParseError)
      end
    end

    context 'when no undefined variables exist' do
      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end
    end

    context 'when eslint can not parse' do
      let(:eslint_result) do
        'stdin: line 1, col 1, Error - Parsing error: Unexpected token ILLEGAL'
      end

      it 'throws an error' do
        expect { subject }.to raise_error(ImportJS::ParseError)
      end
    end

    context 'when one undefined variable exists' do
      let(:existing_files) { ['bar/foo.jsx'] }
      let(:eslint_result) do
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]"
      end

      it 'imports that variable' do
        expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
        EOS
      end

      context 'when the variable name is wrapped in single quotes' do
        # Undefined jsx variables are wrapped in single quotes

        let(:eslint_result) do
          "stdin:3:11: 'foo' is not defined. [Error/no-undef]"
        end

        it 'imports that import' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
          EOS
        end
      end

      context 'when eslint returns other issues' do
        let(:eslint_result) do
          "stdin:1:1: Use the function form of \"use strict\". [Error/strict]\n" \
          "stdin:3:11: \"foo\" is not defined. [Error/no-undef]"
        end

        it 'still imports the import' do
          expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
          EOS
        end
      end
    end

    context 'when multiple undefined variables exist' do
      let(:existing_files) { ['bar/foo.jsx', 'bar.js'] }
      let(:text) { 'var a = foo + bar;' }

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" \
        "stdin:3:11: \"bar\" is not defined. [Error/no-undef]"
      end

      it 'imports all variables' do
        expect(subject).to eq(<<-EOS.strip)
import bar from 'bar';
import foo from 'bar/foo';

var a = foo + bar;
        EOS
      end
    end

    context 'when the list of undefined variables has duplicates' do
      let(:existing_files) { ['bar/foo.jsx', 'bar.js'] }
      let(:text) { 'var a = foo + bar;' }

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" +
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" +
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]\n" +
        "stdin:3:11: \"bar\" is not defined. [Error/no-undef]"
      end

      it 'imports all variables' do
        expect(subject).to eq(<<-EOS.strip)
import bar from 'bar';
import foo from 'bar/foo';

var a = foo + bar;
        EOS
      end
    end

    context 'when no unused variables exist' do
      it 'leaves the buffer unchanged' do
        expect(subject).to eq(text)
      end
    end

    context 'when one unused import exists' do
      let(:text) { <<-EOS.strip }
import bar from 'foo/bar';
import foo from 'bar/foo';

bar
      EOS
      let(:eslint_result) do
        "stdin:1:4: \"foo\" is defined but never used [Error/no-unused-vars]"
      end

      it 'removes that import' do
        expect(subject).to eq(<<-EOS.strip)
import bar from 'foo/bar';

bar
        EOS
      end
    end

    context 'when multiple unused imports exist' do
      let(:text) { <<-EOS.strip }
import bar from 'foo/bar';
import baz from 'bar/baz';
import foo from 'bar/foo';

baz
      EOS

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is defined but never used [Error/no-unused-vars]\n" \
        "stdin:3:11: \"bar\" is defined but never used [Error/no-unused-vars]"
      end

      it 'removes all unused imports' do
        expect(subject).to eq(<<-EOS.strip)
import baz from 'bar/baz';

baz
        EOS
      end
    end

    context 'when an unused import and an undefined import exists' do
      let(:existing_files) { ['bar/foo.jsx'] }
      let(:text) { <<-EOS.strip }
import bar from 'foo/bar';

foo
      EOS

      let(:eslint_result) do
        "stdin:3:11: \"bar\" is defined but never used [Error/no-unused-vars]\n" \
        "stdin:3:11: \"foo\" is not defined. [Error/no-undef]"
      end

      it 'removes the unused import and adds the missing one' do
        expect(subject).to eq(<<-EOS.strip)
import foo from 'bar/foo';

foo
        EOS
      end
    end

    context 'when a destructured import has an unused variable' do
      let(:text) { <<-EOS.strip }
import { bar, foo } from 'baz';

bar
      EOS

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is defined but never used [Error/no-unused-vars]\n" \
      end

      it 'removes that variable from the destructured list' do
        expect(subject).to eq(<<-EOS.strip)
import { bar } from 'baz';

bar
        EOS
      end
    end

    context 'when the last import is removed from a destructured import' do
      let(:text) { <<-EOS.strip }
import bar from 'bar';
import { foo } from 'baz';

bar
      EOS

      let(:eslint_result) do
        "stdin:3:11: \"foo\" is defined but never used [Error/no-unused-vars]\n" \
      end

      it 'removes the whole import' do
        expect(subject).to eq(<<-EOS.strip)
import bar from 'bar';

bar
        EOS
      end
    end
  end
end
