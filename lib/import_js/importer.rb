require 'json'
require 'open3'

module ImportJS
  class Importer
    REGEX_USE_STRICT = /(['"])use strict\1;?/
    REGEX_SINGLE_LINE_COMMENT = %r{\A\s*//}
    REGEX_MULTI_LINE_COMMENT_START = %r{\A\s*/\*}
    REGEX_MULTI_LINE_COMMENT_END = %r{\*/}
    REGEX_WHITESPACE_ONLY = /\A\s*\Z/

    def initialize(editor = ImportJS::VIMEditor.new)
      @editor = editor
    end

    # Finds variable under the cursor to import. By default, this is bound to
    # `<Leader>j`.
    def import
      @config = ImportJS::Configuration.new(@editor.path_to_current_file)
      variable_name = @editor.current_word
      if variable_name.empty?
        message(<<-EOS.split.join(' '))
          No variable to import. Place your cursor on a variable, then try
          again.
        EOS
        return
      end

      js_module = find_one_js_module(variable_name)
      return unless js_module

      maintain_cursor_position do
        old_imports = find_current_imports
        inject_js_module(variable_name, js_module, old_imports[:imports])
        replace_imports(old_imports[:newline_count],
                        old_imports[:imports],
                        old_imports[:imports_start_at])
      end
    end

    def goto
      @config = ImportJS::Configuration.new(@editor.path_to_current_file)
      js_modules = []
      time do
        variable_name = @editor.current_word
        js_modules = find_js_modules(variable_name)
      end
      return if js_modules.empty?
      js_module = resolve_one_js_module(js_modules, variable_name)
      @editor.open_file(js_module.file_path) if js_module
    end

    # Removes unused imports and adds imports for undefined variables
    def fix_imports
      @config = ImportJS::Configuration.new(@editor.path_to_current_file)
      eslint_result = run_eslint_command
      undefined_variables = eslint_result.map do |line|
        next 'React' if line =~ /'React' must be in scope when using JSX/
        /(["'])([^"']+)\1 is not defined/.match(line) do |match_data|
          match_data[2]
        end
      end.compact.uniq

      unused_variables = eslint_result.map do |line|
        /"([^"]+)" is defined but never used/.match(line) do |match_data|
          match_data[1]
        end
      end.compact.uniq

      old_imports = find_current_imports
      new_imports = old_imports[:imports].reject do |import_statement|
        unused_variables.each do |unused_variable|
          import_statement.delete_variable(unused_variable)
        end
        import_statement.empty?
      end

      undefined_variables.each do |variable|
        js_module = find_one_js_module(variable)
        inject_js_module(variable, js_module, new_imports) if js_module
      end

      replace_imports(old_imports[:newline_count],
                      new_imports,
                      old_imports[:imports_start_at])
    end

    private

    def message(str)
      @editor.message("ImportJS: #{str}")
    end

    # @return [Array<String>] the output from eslint, line by line
    def run_eslint_command
      command = %W[
        #{@config.get('eslint_executable')}
        --stdin
        --stdin-filename #{@editor.path_to_current_file}
        --format unix
        --rule 'no-undef: 2'
        --rule 'no-unused-vars: [2, { "vars": "all", "args": "none" }]'
      ].join(' ')
      out, err = Open3.capture3(command,
                                stdin_data: @editor.current_file_content)

      if out =~ /Parsing error: / ||
         out =~ /Unrecoverable syntax error/ ||
         out =~ /<text>:0:0: Cannot find module '.*'/
        fail ImportJS::ParseError.new, out
      end

      if err =~ /SyntaxError: / ||
         err =~ /eslint: command not found/ ||
         err =~ /Cannot read config package: / ||
         err =~ /Cannot find module '.*'/ ||
         err =~ /No such file or directory/
        fail ImportJS::ParseError.new, err
      end

      out.split("\n")
    end

    # @param variable_name [String]
    # @return [ImportJS::JSModule?]
    def find_one_js_module(variable_name)
      js_modules = []
      time do
        js_modules = find_js_modules(variable_name)
      end
      if js_modules.empty?
        message(
          "No JS module to import for variable `#{variable_name}` #{timing}")
        return
      end

      resolve_one_js_module(js_modules, variable_name)
    end

    # Add new import to the block of imports, wrapping at the max line length
    # @param variable_name [String]
    # @param js_module [ImportJS::JSModule]
    # @param imports [Array<ImportJS::ImportStatement>]
    def inject_js_module(variable_name, js_module, imports)
      import = imports.find do |an_import|
        an_import.path == js_module.import_path
      end

      if import
        import.declaration_keyword = @config.get(
          'declaration_keyword', from_file: js_module.file_path)
        import.import_function = @config.get(
          'import_function', from_file: js_module.file_path)
        if js_module.is_destructured
          import.inject_destructured_variable(variable_name)
        else
          import.set_default_variable(variable_name)
        end
      else
        imports.unshift(js_module.to_import_statement(variable_name, @config))
      end

      # Remove duplicate import statements
      imports.uniq!(&:to_normalized)
    end

    # @param old_imports_lines [Number]
    # @param new_imports [Array<ImportJS::ImportStatement>]
    # @param imports_start_at [Number]
    def replace_imports(old_imports_lines, new_imports, imports_start_at)
      # Ensure that there is a blank line after the block of all imports
      imports_end_at = old_imports_lines + imports_start_at
      if old_imports_lines + new_imports.length > 0 &&
         !@editor.read_line(imports_end_at + 1).strip.empty?
        @editor.append_line(imports_end_at, '')
      end

      # Generate import strings
      import_strings = new_imports.map do |import|
        import.to_import_strings(@editor.max_line_length, @editor.tab)
      end.flatten.sort

      # Find old import strings so we can compare with the new import strings
      # and see if anything has changed.
      old_import_strings = []
      old_imports_lines.times do |line|
        old_import_strings << @editor.read_line(1 + line + imports_start_at)
      end

      # If nothing has changed, bail to prevent unnecessarily dirtying the
      # buffer.
      return if import_strings == old_import_strings

      # Delete old imports, then add the modified list back in.
      old_imports_lines.times { @editor.delete_line(1 + imports_start_at) }
      import_strings.reverse_each do |import_string|
        # We need to add each line individually because the Vim buffer will
        # convert newline characters to `~@`.
        import_string.split("\n").reverse_each do |line|
          @editor.append_line(0 + imports_start_at, line)
        end
      end
    end

    # @return [Hash]
    def find_current_imports
      total_lines = @editor.count_lines
      result = {
        imports: [],
        newline_count: 0,
        imports_start_at: 0,
      }

      # Skip over things at the top, like "use strict" and comments.
      inside_multi_line_comment = false
      (0...total_lines).each do |line_index|
        line = @editor.read_line(line_index + 1)

        if inside_multi_line_comment || line =~ REGEX_MULTI_LINE_COMMENT_START
          result[:imports_start_at] = line_index + 1
          inside_multi_line_comment = if line =~ REGEX_MULTI_LINE_COMMENT_END
                                        false
                                      else
                                        true
                                      end
          next
        end

        if line =~ REGEX_USE_STRICT ||
           line =~ REGEX_SINGLE_LINE_COMMENT ||
           line =~ REGEX_WHITESPACE_ONLY
          result[:imports_start_at] = line_index + 1
          next
        end

        break
      end

      # Find block of lines that might be imports.
      potential_import_lines = []
      (result[:imports_start_at]...total_lines).each do |line_index|
        line = @editor.read_line(line_index + 1)
        break if line.strip.empty?
        potential_import_lines << line
      end

      # We need to put the potential imports back into a blob in order to scan
      # for multiline imports
      potential_imports_blob = potential_import_lines.join("\n")

      # Scan potential imports for everything ending in a semicolon, then
      # iterate through those and stop at anything that's not an import.
      imports = {}
      potential_imports_blob.scan(/^.*?;/m).each do |potential_import|
        import_statement = ImportJS::ImportStatement.parse(potential_import)
        break unless import_statement

        if imports[import_statement.path]
          # Import already exists, so this line is likely one of a destructuring
          # pair. Combine it into the same ImportStatement.
          imports[import_statement.path].merge(import_statement)
        else
          # This is a new import, so we just add it to the hash.
          imports[import_statement.path] = import_statement
        end

        result[:newline_count] += potential_import.scan(/\n/).length + 1
      end
      result[:imports] = imports.values
      result
    end

    # @param variable_name [String]
    # @return [Array]
    def find_js_modules(variable_name)
      path_to_current_file = @editor.path_to_current_file

      alias_module = @config.resolve_alias(variable_name, path_to_current_file)
      return [alias_module] if alias_module

      formatted_var_name = formatted_to_regex(variable_name)
      egrep_command =
        "egrep -i \"(/|^)#{formatted_var_name}(/index)?(/package)?\.js.*\""
      matched_modules = []
      @config.get('lookup_paths').each do |lookup_path|
        if lookup_path == ''
          # If lookup_path is an empty string, the `find` command will not work
          # as desired so we bail early.
          fail ImportJS::FindError.new,
               "lookup path cannot be empty (#{lookup_path.inspect})"
        end

        find_command = %W[
          find #{lookup_path}
          -name "**.js*"
          -not -path "./node_modules/*"
        ].join(' ')
        command = "#{find_command} | #{egrep_command}"
        out, err = Open3.capture3(command)

        fail ImportJS::FindError.new, err unless err == ''

        matched_modules.concat(
          out.split("\n").map do |f|
            next if @config.get('excludes').any? do |glob_pattern|
              File.fnmatch(glob_pattern, f)
            end
            ImportJS::JSModule.construct(
              lookup_path: lookup_path,
              relative_file_path: f,
              strip_file_extensions:
                @config.get('strip_file_extensions', from_file: f),
              make_relative_to:
                @config.get('use_relative_paths', from_file: f) &&
                path_to_current_file,
              strip_from_path:
                @config.get('strip_from_path', from_file: f)
            )
          end.compact
        )
      end

      # Find imports from package.json
      ignore_prefixes = @config.get('ignore_package_prefixes').map do |prefix|
        Regexp.escape(prefix)
      end
      dep_regex = /^(?:#{ignore_prefixes.join('|')})?#{formatted_var_name}$/

      @config.package_dependencies.each do |dep|
        next unless dep =~ dep_regex

        js_module = ImportJS::JSModule.construct(
          lookup_path: 'node_modules',
          relative_file_path: "node_modules/#{dep}/package.json",
          strip_file_extensions: [])
        matched_modules << js_module if js_module
      end

      # If you have overlapping lookup paths, you might end up seeing the same
      # module to import twice. In order to dedupe these, we remove the module
      # with the longest path
      matched_modules.sort! do |a, b|
        a.import_path.length <=> b.import_path.length
      end
      matched_modules.uniq! do |m|
        m.lookup_path + '/' + m.import_path
      end
      matched_modules.sort! do |a, b|
        a.display_name <=> b.display_name
      end
    end

    # @param js_modules [Array]
    # @param variable_name [String]
    # @return [String]
    def resolve_one_js_module(js_modules, variable_name)
      if js_modules.length == 1
        js_module = js_modules.first
        js_module_name = js_module.display_name
        imported = if js_module.is_destructured
                     "`#{variable_name}` from `#{js_module_name}`"
                   else
                     "`#{js_module_name}`"
                   end
        message("Imported #{imported} #{timing}")
        return js_module
      end

      selected_index = @editor.ask_for_selection(
        variable_name,
        js_modules.map(&:display_name)
      )
      return unless selected_index
      js_modules[selected_index]
    end

    # Takes a string in any of the following four formats:
    #   dash-separated
    #   snake_case
    #   camelCase
    #   PascalCase
    # and turns it into a star-separated lower case format, like so:
    #   star*separated
    #
    # @param string [String]
    # @return [String]
    def formatted_to_regex(string)
      # Based on
      # http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby

      # The pattern to match in between words. The "es" and "s" match is there
      # to catch pluralized folder names. There is a risk that this is overly
      # aggressive and will lead to trouble down the line. In that case, we can
      # consider adding a configuration option to control mapping a singular
      # variable name to a plural folder name (suggested by @lencioni in #127).
      # E.g.
      #
      # {
      #   "^mock": "./mocks/"
      # }
      split_pattern = '(es|s)?.?'

      # Split up the string, allow pluralizing and a single (any) character
      # in between. This will make e.g. 'fooBar' match 'foos/bar', 'foo_bar',
      # and 'foobar'.
      string
        .gsub(/([a-z\d])([A-Z])/, '\1' + split_pattern + '\2') # camelCase
        .tr('-_', split_pattern)
        .downcase
    end

    def time
      timing = { start: Time.now }
      yield
      timing[:end] = Time.now
      @timing = timing
    end

    # @return [String]
    def timing
      "(#{(@timing[:end] - @timing[:start]).round(2)}s)"
    end

    def maintain_cursor_position
      # Save editor information before modifying the buffer so we can put the
      # cursor in the correct spot after modifying the buffer.
      current_row, current_col = @editor.cursor
      old_buffer_lines = @editor.count_lines

      # Yield to a block that will potentially modify the buffer.
      yield

      # Check to see if lines were added or removed.
      lines_changed = @editor.count_lines - old_buffer_lines
      return unless lines_changed

      # Lines were added or removed, so we want to adjust the cursor position to
      # match.
      @editor.cursor = [current_row + lines_changed, current_col]
    end
  end
end
