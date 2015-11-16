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
      import_one_variable variable_name
      return unless lines_changed = @editor.count_lines - old_buffer_lines
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
      unused_variables = find_unused_variables

      if unused_variables.empty?
        message('No variables to import')
        return
      end

      unused_variables.each do |variable|
        import_one_variable(variable)
      end
    end

    private

    def message(str)
      @editor.message("[import-js] #{str}")
    end

    # @return [Array]
    def find_unused_variables
      content = "/* jshint undef: true, strict: true */\n" +
                "/* eslint no-unused-vars: [2, { \"vars\": \"all\", \"args\": \"none\" }] */\n" +
                @editor.current_file_content

      out, _ = Open3.capture3("#{@config.get('jshint_cmd')} -", stdin_data: content)
      result = []
      out.split("\n").each do |line|
        /.*['"]([^'"]+)['"] is not defined/.match(line) do |match_data|
          result << match_data[1]
        end
      end
      result.uniq
    end

    # @param variable_name [String]
    def import_one_variable(variable_name)
      @timing = { start: Time.now }
      js_modules = find_js_modules(variable_name)
      @timing[:end] = Time.now
      if js_modules.empty?
        message(<<-EOS.split.join(' '))
          No js module to import for variable `#{variable_name}` #{timing}
        EOS
        return
      end

      resolved_js_module = resolve_one_js_module(js_modules, variable_name)
      return unless resolved_js_module

      write_imports(variable_name, resolved_js_module)
    end

    # @param variable_name [String]
    # @param js_module [ImportJS::JSModule]
    def write_imports(variable_name, js_module)
      old_imports = find_current_imports

      # Ensure that there is a blank line after the block of all imports
      unless @editor.read_line(old_imports[:newline_count] + 1).strip.empty?
        @editor.append_line(old_imports[:newline_count], '')
      end

      modified_imports = old_imports[:imports] # Array

      # Add new import to the block of imports, wrapping at the max line length
      unless js_module.is_destructured && inject_destructured_variable(
        variable_name, js_module, modified_imports)
        modified_imports << generate_import(variable_name, js_module)
      end

      # Sort the block of imports
      modified_imports.sort!.uniq! do |import|
        # Determine uniqueness by discarding the declaration keyword (`const`,
        # `let`, or `var`) and normalizing multiple whitespace chars to single
        # spaces.
        import.sub(/\A(const|let|var)\s+/, '').sub(/\s\s+/s, ' ')
      end

      # Delete old imports, then add the modified list back in.
      old_imports[:newline_count].times { @editor.delete_line(1) }
      modified_imports.reverse_each do |import|
        # We need to add each line individually because the Vim buffer will
        # convert newline characters to `~@`.
        import.split("\n").reverse_each { |line| @editor.append_line(0, line) }
      end
    end

    def inject_destructured_variable(variable_name, js_module, imports)
      imports.each do |import|
        match = import.match(%r{((const|let|var) \{ )(.*)( \} = require\('#{js_module.import_path}'\);)})
        next unless match

        variables = match[3].split(/,\s*/).concat([variable_name]).uniq.sort
        import.sub!(/.*/, "#{match[1]}#{variables.join(', ')}#{match[4]}")
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

      imports = []

      # Scan potential imports for everything ending in a semicolon, then
      # iterate through those and stop at anything that's not an import.
      potential_imports_blob.scan(/^.*?;/m).each do |potential_import|
        break unless potential_import.match(
          /(?:const|let|var)\s+.+=\s+require\(.*\).*;/)
        imports << potential_import
      end

      newline_count = imports.length + imports.reduce(0) do |sum, import|
        sum + import.scan(/\n/).length
      end
      {
        imports: imports,
        newline_count: newline_count
      }
    end

    # @param variable_name [String]
    # @param js_module [ImportJS::JSModule]
    # @return [String] the import string to be added to the imports block
    def generate_import(variable_name, js_module)
      declaration_keyword = @config.get('declaration_keyword')
      if js_module.is_destructured
        declaration = "#{declaration_keyword} { #{variable_name} } ="
      else
        declaration = "#{declaration_keyword} #{variable_name} ="
      end
      value = "require('#{js_module.import_path}');"

      if @editor.max_line_length && "#{declaration} #{value}".length > @editor.max_line_length
        "#{declaration}\n#{@editor.tab}#{value}"
      else
        "#{declaration} #{value}"
      end
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
            js_module = ImportJS::JSModule.new(lookup_path, f, @config)
            next if js_module.skip
            js_module
          end.compact
        )
      end

      # Find imports from package.json
      @config.package_dependencies.each do |dep|
        next unless dep =~ /^#{formatted_to_regex(variable_name)}$/
        js_module = ImportJS::JSModule.new(
          'node_modules', "node_modules/#{dep}/package.json", @config)
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
        "\"[import-js] Pick js module to import for '#{variable_name}': #{timing}\"",
        js_modules.map {|m| m.display_name}
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
