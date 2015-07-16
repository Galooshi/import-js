module ImportJS
  class Importer
    def initialize
      @config = ImportJS::Configuration.new
     end

    # Finds variable under the cursor to import. By default, this is bound to
    # `<Leader>j`.
    def import
      variable_name = VIM.evaluate("expand('<cword>')")
      if variable_name.empty?
        VIM.message(<<-EOS.split.join(' '))
          [import-js]: No variable to import. Place your cursor on a variable,
          then try again.
        EOS
        return
      end
      current_row, current_col = window.cursor

      old_buffer_lines = buffer.count
      import_one_variable variable_name
      return unless lines_changed = buffer.count - old_buffer_lines
      window.cursor = [current_row + lines_changed, current_col]
    end

    # Finds all variables that haven't yet been imported.
    def import_all
      unused_variables = find_unused_variables
      imported_variables = []

      unused_variables.each do |variable|
        if import_one_variable(variable)
          imported_variables << variable
        end
      end

      if imported_variables.empty?
        VIM.message(<<-EOS.split.join(' '))
          [import-js]: No variables to import
        EOS
      else
        VIM.message(<<-EOS.split.join(' '))
          [import-js]: Imported these variables: #{imported_variables}
        EOS
      end
    end

    private

    # @return [Array]
    def find_unused_variables
      content = "/* jshint undef: true, strict: true */\n" +
                "/* eslint no-unused-vars: [2, { \"vars\": \"all\", \"args\": \"none\" }]\n" +
                VIM.evaluate('join(getline(1, "$"), "\n")')

      out, _ = Open3.capture3("#{@config.get('jshint_cmd')} -", stdin_data: content)
      result = []
      out.split("\n").each do |line|
        /.*'([^']+)' is not defined/.match(line) do |match_data|
          result << match_data[1]
        end
      end
      result.uniq
    end

    # @param variable_name [String]
    # @return [Boolean] true if a variable was imported, false if not
    def import_one_variable(variable_name)
      @timing = { start: Time.now }
      files = find_files(variable_name)
      @timing[:end] = Time.now
      if files.empty?
        VIM.message(<<-EOS.split.join(' '))
          [import-js]: No js file to import for variable `#{variable_name}` #{timing}
        EOS
        return
      end

      resolved_file = resolve_one_file(files, variable_name)
      return unless resolved_file

      write_imports(variable_name, resolved_file.gsub(/\/index\.js.*$/, '')
                                                .gsub(/\/package.json$/, '')
                                                .gsub(/\..*$/, ''))
    end

    def buffer
      VIM::Buffer.current
    end

    def window
      VIM::Window.current
    end

    # @param variable_name [String]
    # @param path_to_file [String]
    # @return [Boolean] true if a variable was imported, false if not
    def write_imports(variable_name, path_to_file)
      old_imports = find_current_imports

      # Ensure that there is a blank line after the block of all imports
      unless buffer[old_imports[:newline_count] + 1].strip.empty?
        buffer.append(old_imports[:newline_count], '')
      end

      modified_imports = old_imports[:imports] # Array
      previous_length = modified_imports.length

      # Add new import to the block of imports, wrapping at text_width
      modified_imports << generate_import(variable_name, path_to_file)

      # Sort the block of imports
      modified_imports.sort!.uniq! do |import|
        # Determine uniqueness by discarding the declaration keyword (`const`,
        # `let`, or `var`) and normalizing multiple whitespace chars to single
        # spaces.
        import.sub(/\A(const|let|var)\s+/, '').sub(/\s\s+/s, ' ')
      end

      # Delete old imports, then add the modified list back in.
      old_imports[:newline_count].times { buffer.delete(1) }
      modified_imports.reverse_each do |import|
        # We need to add each line individually because the Vim buffer will
        # convert newline characters to `~@`.
        import.split("\n").reverse_each { |line| buffer.append(0, line) }
      end

      previous_length < modified_imports.length
    end

    # @return [Hash]
    def find_current_imports
      imports_blob = ''
      buffer.count.times do |n|
        line = buffer[n + 1]
        break if line.strip.empty?
        imports_blob << "\n#{line}"
      end

      imports = imports_blob.scan(/(?:const|let|var)\s+.+=\s+require\(.*\).*;/)
      newline_count = imports.length + imports.reduce(0) do |sum, import|
        sum + import.scan(/\n/).length
      end
      {
        imports: imports,
        newline_count: newline_count
      }
    end

    # @param variable_name [String]
    # @param path_to_file [String]
    # @return [String] the import string to be added to the imports block
    def generate_import(variable_name, path_to_file)
      declaration_keyword = @config.get('declaration_keyword')
      declaration = "#{declaration_keyword} #{variable_name} ="
      value = "require('#{path_to_file}');"

      if @config.text_width && "#{declaration} #{value}".length > @config.text_width
        "#{declaration}\n#{@config.tab}#{value}"
      else
        "#{declaration} #{value}"
      end
    end

    # @param variable_name [String]
    # @return [Array]
    def find_files(variable_name)
      if alias_path = @config.get('aliases')[variable_name]
        return [alias_path]
      end

      egrep_command =
        "egrep -i \"(/|^)#{formatted_to_regex(variable_name)}(/index)?(/package)?\.js.*\""
      matched_files = []
      @config.get('lookup_paths').each do |lookup_path|
        find_command = "find #{lookup_path} -name \"**.js*\""
        out, _ = Open3.capture3("#{find_command} | #{egrep_command}")
        matched_files.concat(
          out.split("\n").map do |f|
            if f.end_with? 'package.json'
              next unless JSON.parse(File.read(f))['main']
            end
            f.sub("#{lookup_path}\/", '') # remove path prefix
          end.compact
        )
      end
      matched_files.sort
    end

    # @param files [Array]
    # @param variable_name [String]
    # @return [String]
    def resolve_one_file(files, variable_name)
      if files.length == 1
        VIM.message("[import-js] Imported `#{files.first}` #{timing}")
        return files.first
      end

      escaped_list = ["\"[import-js] Pick file to import for '#{variable_name}': #{timing}\""]
      escaped_list << files.each_with_index.map do |file, i|
        "\"#{i + 1}: #{file}\""
      end
      escaped_list_string = '[' + escaped_list.join(',') + ']'

      selected_index = VIM.evaluate("inputlist(#{escaped_list_string})")
      return if selected_index < 1
      files[selected_index - 1]
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
