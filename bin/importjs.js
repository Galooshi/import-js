#!/usr/bin/env node

'use strict';

// require 'import_js'
// require 'slop'
// require 'json'
//
// opts = Slop.parse do |o|
//   o.banner = 'Usage: import-js [<path-to-file>] [options] ...'
//   o.string '-w', '--word', 'A word/variable to import'
//   o.bool '--goto', 'Instead of importing, just print the path to a module'
//   o.array '--selections', 'A list of resolved selections, e.g. Foo:0,Bar:1'
//   o.string '--stdin-file-path',
//            'A path to the file whose content is being passed in as stdin. ' \
//            'This is used as a way to make sure that the right configuration ' \
//            'is applied.'
//   o.bool '--overwrite',
//          'Overwrite the file with the result after importing (the default ' \
//          'behavior is to print to stdout). This only applies if you are ' \
//          'passing in a file (<path-to-file>) as the first positional argument.'
//   o.string '--filename', '(deprecated) Alias for --stdin-file-path'
//   o.bool '--rewrite',
//          'Rewrite all current imports to match Import-JS configuration. ' \
//          'This does not add missing imports or remove unused imports.'
//
//   o.on '-v', '--version', 'Prints the current version' do
//     puts ImportJS::VERSION
//     exit
//   end
//   o.on '-h', '--help', 'Prints help' do
//     puts o
//     exit
//   end
// end
//
// path_to_file = opts.arguments[0] || opts['stdin-file-path'] || opts[:filename]
//
// file_contents = if STDIN.tty?
//                   unless path_to_file
//                     puts 'Error: missing <path-to-file>'
//                     puts opts
//                     exit 1
//                   end
//                   File.read(path_to_file).split("\n")
//                 else
//                   STDIN.read.split("\n")
//                 end
//
// if opts[:selections]
//   # Convert array of string tuples to hash, `word` => `selectedIndex`
//   opts[:selections] = Hash[opts[:selections].map do |str|
//     tuple = str.split(':')
//     [tuple.first, tuple[1].to_i]
//   end]
// end
//
// editor = ImportJS::CommandLineEditor.new(
//   file_contents, opts.to_hash.merge(path_to_file: path_to_file))
// importer = ImportJS::Importer.new(editor)
// if opts.goto?
//   importer.goto
// elsif opts[:word]
//   importer.import
// elsif opts[:rewrite]
//   importer.rewrite_imports
// else
//   importer.fix_imports
// end
//
// if opts.goto?
//   # Print the path to the module to go to
//   puts editor.goto
// elsif opts[:overwrite]
//   File.open(path_to_file, 'w') do |f|
//     f.write editor.current_file_content + "\n"
//   end
// else
//   # Print resulting file to stdout
//   puts editor.current_file_content
// end
//
// # Print messages to stderr
// meta = {
//   messages: editor.messages,
// }
// ask = editor.ask_for_selections
// meta[:ask_for_selections] = ask unless ask.empty?
// STDERR.puts meta.to_json
