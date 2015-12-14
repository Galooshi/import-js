require 'json'
require 'open3'

module ImportJS
  class Importer
    def initialize(editor = ImportJS::VIMEditor.new)
      @config = ImportJS::Configuration.new
      @editor = editor
    end

    # Finds variable under the cursor to import. By default, this is bound to
    # `<Leader>j`.
    def import
      @config.refresh
      variable_name = @editor.current_word
      if variable_name.empty?
        message(<<-EOS.split.join(' '))
          No variable to import. Place your cursor on a variable, then try
          again.
        EOS
        return
      end
      current_row, current_col = @editor.cursor

      old_buffer_lines = @editor.count_lines
      js_module = find_one_js_module(variable_name)
      return unless js_module

      old_imports = find_current_imports
      inject_js_module(variable_name, js_module, old_imports[:imports])
      replace_imports(old_imports[:newline_count], old_imports[:imports])
      lines_changed = @editor.count_lines - old_buffer_lines
      return unless lines_changed
      @editor.cursor = [current_row + lines_changed, current_col]
    end

    def goto
      @config.refresh
      @timing = { start: Time.now }
      variable_name = @editor.current_word
      js_modules = find_js_modules(variable_name)
      @timing[:end] = Time.now
      return if js_modules.empty?
      js_module = resolve_one_js_module(js_modules, variable_name)
      @editor.open_file(js_module.file_path)
    end

    # Finds all variables that haven't yet been imported.
    def import_all
      @config.refresh
      undefined_variables = run_eslint_command.map do |line|
        /.*['"]([^'"]+)['"] is not defined/.match(line) do |match_data|
          match_data[1]
        end
      end.compact.uniq

      return message('No variables to import') if undefined_variables.empty?

      old_imports = find_current_imports
      undefined_variables.each do |variable|
        if js_module = find_one_js_module(variable)
          inject_js_module(variable, js_module, old_imports[:imports])
        end
      end
      replace_imports(old_imports[:newline_count], old_imports[:imports])
    end

    def remove_unused_imports
      @config.refresh
      unused_variables = run_eslint_command.map do |line|
        /.*['"]([^'"]+)['"] is defined but never used/.match(line) do |match_data|
          match_data[1]
        end
      end.compact.uniq

      old_imports = find_current_imports
      new_imports = old_imports[:imports].reject do |import_statement|
        unused_variables.each do |unused_variable|
          import_statement.delete_variable(unused_variable)
        end
        import_statement.variables.empty?
      end
      replace_imports(old_imports[:newline_count], new_imports)
    end

    private

    def message(str)
      @editor.message("ImportJS: #{str}")
    end

    # @return [Array<String>] the output from eslint, line by line
    def run_eslint_command
      content = "/* eslint no-unused-vars: [2, { \"vars\": \"all\", \"args\": \"none\" }] */\n" +
                @editor.current_file_content

      out, _ = Open3.capture3("eslint --stdin --format compact -",
                              stdin_data: content)

      if out =~ /Error - Parsing error: Unexpected token ILLEGAL/ ||
         out =~ /Unrecoverable syntax error/
        fail ImportJS::ParseError.new, out
      end

      out.split("\n")
    end

    # @param variable_name [String]
    # @return [ImportJS::JSModule?]
    def find_one_js_module(variable_name)
      @timing = { start: Time.now }
      js_modules = find_js_modules(variable_name)
      @timing[:end] = Time.now
      if js_modules.empty?
        message(
          "No JS module to import for variable `#{variable_name}` #{timing}")
        return
      end

      resolve_one_js_module(js_modules, variable_name)
    end

    # @param variable_name [String]
    # @param js_module [ImportJS::JSModule]
    # @param imports [Array<ImportJS::ImportStatement>]
    def inject_js_module(variable_name, js_module, imports)
      # Add new import to the block of imports, wrapping at the max line length
      unless js_module.is_destructured && inject_destructured_variable(
        variable_name, js_module, imports)
        imports.unshift(js_module.to_import_statement(variable_name))
      end

      # Remove duplicate import statements
      imports.uniq!(&:normalize)
    end

    # @param old_imports_lines [Number]
    # @param new_imports [Array<ImportJS::ImportStatement>]
    def replace_imports(old_imports_lines, new_imports)
      # Ensure that there is a blank line after the block of all imports
      if old_imports_lines + new_imports.length > 0 &&
         !@editor.read_line(old_imports_lines + 1).strip.empty?
        @editor.append_line(old_imports_lines, '')
      end

      # Generate import strings
      import_strings = new_imports.map do |import|
        import.to_import_string(
          @config.get('declaration_keyword'),
          @editor.max_line_length,
          @editor.tab)
      end.sort

      # Delete old imports, then add the modified list back in.
      old_imports_lines.times { @editor.delete_line(1) }
      import_strings.reverse_each do |import_string|
        # We need to add each line individually because the Vim buffer will
        # convert newline characters to `~@`.
        import_string.split("\n").reverse_each do |line|
          @editor.append_line(0, line)
        end
      end
    end

    def inject_destructured_variable(variable_name, js_module, imports)
      imports.each do |import|
        next unless import.path == js_module.import_path
        next unless import.is_destructured

        import.inject_variable(variable_name)
        return true
      end
      false
    end

    # @return [Hash]
    def find_current_imports
      potential_import_lines = []
      @editor.count_lines.times do |n|
        line = @editor.read_line(n + 1)
        break if line.strip.empty?
        potential_import_lines << line
      end

      # We need to put the potential imports back into a blob in order to scan
      # for multiline imports
      potential_imports_blob = potential_import_lines.join("\n")

      result = {
        imports: [],
        newline_count: 0
      }

      # Scan potential imports for everything ending in a semicolon, then
      # iterate through those and stop at anything that's not an import.
      potential_imports_blob.scan(/^.*?;/m).each do |potential_import|
        import_statement = ImportJS::ImportStatement.parse(potential_import)
        break unless import_statement

        result[:imports] << import_statement
        result[:newline_count] += potential_import.scan(/\n/).length + 1
      end
      result
    end

    # @param variable_name [String]
    # @return [Array]
    def find_js_modules(variable_name)
      if alias_module = @config.resolve_alias(variable_name)
        return [alias_module]
      end

      egrep_command =
        "egrep -i \"(/|^)#{formatted_to_regex(variable_name)}(/index)?(/package)?\.js.*\""
      matched_modules = []
      @config.get('lookup_paths').each do |lookup_path|
        find_command = "find #{lookup_path} -name \"**.js*\""
        out, _ = Open3.capture3("#{find_command} | #{egrep_command}")
        matched_modules.concat(
          out.split("\n").map do |f|
            next if @config.get('excludes').any? do |glob_pattern|
              File.fnmatch(glob_pattern, f)
            end
            js_module = ImportJS::JSModule.new(
              lookup_path, f, @config.get('strip_file_extensions'))
            next if js_module.skip
            js_module
          end.compact
        )
      end

      # Find imports from package.json
      @config.package_dependencies.each do |dep|
        next unless dep =~ /^#{formatted_to_regex(variable_name)}$/
        js_module = ImportJS::JSModule.new(
          'node_modules', "node_modules/#{dep}/package.json", [])
        next if js_module.skip
        matched_modules << js_module
      end

      # If you have overlapping lookup paths, you might end up seeing the same
      # module to import twice. In order to dedupe these, we remove the module
      # with the longest path
      matched_modules.sort do |a, b|
        a.import_path.length <=> b.import_path.length
      end.uniq do |m|
        m.lookup_path + '/' + m.import_path
      end.sort do |a, b|
        a.display_name <=> b.display_name
      end
    end

    # @param js_modules [Array]
    # @param variable_name [String]
    # @return [String]
    def resolve_one_js_module(js_modules, variable_name)
      if js_modules.length == 1
        message("Imported `#{js_modules.first.display_name}` #{timing}")
        return js_modules.first
      end

      selected_index = @editor.ask_for_selection(
        "\"ImportJS: Pick JS module to import for '#{variable_name}': #{timing}\"",
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
      string.
        gsub(/([a-z\d])([A-Z])/, '\1.?\2'). # separates camelCase words with '.?'
        tr('-_', '.'). # replaces underscores or dashes with '.'
        downcase # converts all upper to lower case
    end

    # @return [String]
    def timing
      "(#{(@timing[:end] - @timing[:start]).round(2)}s)"
    end
  end
end
