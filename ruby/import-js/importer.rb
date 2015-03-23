require 'yaml'
require 'open3'

module ImportJS
  class Importer
    def initialize
      @config = {
        'aliases' => {},
        'declaration_keyword' => 'var',
        'jshint_cmd' => 'jshint',
        'lookup_paths' => ['.'],
      }
      config_file = '.importjs'
      if File.exist? config_file
        @config = @config.merge(YAML.load_file(config_file))
      end
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

      return unless lines_changed = import_one_variable(variable_name)
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
                VIM.evaluate('join(getline(1, "$"), "\n")')

      out, _ = Open3.capture3("#{@config['jshint_cmd']} -", stdin_data: content)
      result = []
      out.split("\n").each do |line|
        /.*'([^']+)' is not defined/.match(line) do |match_data|
          result << match_data[1]
        end
      end
      result.uniq
    end

    # @param variable_name [String]
    # @return the number of lines changed, or nil if no file was found for the
    #   variable.
    def import_one_variable(variable_name)
      files = find_files(variable_name)
      if files.empty?
        VIM.message(<<-EOS.split.join(' '))
          [import-js]: No js file to import for variable `#{variable_name}`
        EOS
        return
      end

      resolved_file = resolve_one_file(files, variable_name)
      return unless resolved_file

      write_imports(variable_name, resolved_file.gsub(/\..*$/, ''))
    end

    def buffer
      VIM::Buffer.current
    end

    def window
      VIM::Window.current
    end

    # @param variable_name [String]
    # @param path_to_file [String]
    # @return [number] the number of lines changed
    def write_imports(variable_name, path_to_file)
      old_imports = find_current_imports

      # Ensure that there is a blank line after the block of all imports
      unless buffer[old_imports[:newline_count] + 1].strip.empty?
        buffer.append(old_imports[:newline_count], '')
      end

      modified_imports = old_imports[:imports] # Array
      previous_length = modified_imports.length

      # Add new import to the block of imports
      declaration_keyword = @config['declaration_keyword']
      modified_imports << "#{declaration_keyword} #{variable_name} = require('#{path_to_file}');"

      # Sort the block of imports
      modified_imports.sort!.uniq! do |import|
        # Determine uniqueness by discarding the declaration keyword (`const`,
        # `let`, or `var`) and normalizing multiple whitespace chars to single
        # spaces.
        import.sub(/\A(const|let|var)\s+/, '').sub(/\s\s+/s, ' ')
      end

      # Delete old imports, then add the modified list back in.
      old_imports[:newline_count].times { buffer.delete(1) }
      modified_imports.each_with_index do |import, line_number|
        buffer.append(line_number, import)
      end

      # Consumers of this method rely on knowing how many lines of code
      # changed, so we return that.
      modified_imports.length - previous_length
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
    # @return [Array]
    def find_files(variable_name)
      if alias_path = @config['aliases'][variable_name]
        return [alias_path]
      end
      snake_case_variable = camelcase_to_snakecase(variable_name)
      matched_files = []
      @config['lookup_paths'].each do |lookup_path|
        Dir.chdir(lookup_path) do
          matched_files.concat(Dir.glob("**/#{snake_case_variable}.js*"))
        end
      end

      matched_files
    end

    # @param files [Array]
    # @param variable_name [String]
    # @return [String]
    def resolve_one_file(files, variable_name)
      if files.length == 1
        VIM.message("[import-js] Imported `#{files.first}`")
        return files.first
      end

      escaped_list = ["\"[import-js] Pick file to import for '#{variable_name}':\""]
      escaped_list << files.each_with_index.map do |file, i|
        "\"#{i + 1}: #{file}\""
      end
      escaped_list_string = '[' + escaped_list.join(',') + ']'

      selected_index = VIM.evaluate("inputlist(#{escaped_list_string})")
      return if selected_index < 1
      files[selected_index - 1]
    end

    # @param string [String]
    # @return [String]
    def camelcase_to_snakecase(string)
      # Grabbed from
      # http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby
      string.
        gsub(/::/, '/').
        gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2').
        gsub(/([a-z\d])([A-Z])/, '\1_\2').
        tr('-', '_').
        downcase
    end
  end
end
