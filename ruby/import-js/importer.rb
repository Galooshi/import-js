require 'yaml'
require 'open3'

module ImportJS
  class Importer
    def initialize
      @config = {
        'lookup_paths' => ['.'],
        'aliases' => {},
        'jshint_cmd' => 'jshint'
      }
      config_file = '.importjs'
      if File.exist? config_file
        @config = @config.merge(YAML.load_file(config_file))
      end
    end

    def import
      variable_name = VIM.evaluate("expand('<cword>')")
      if variable_name.empty?
        VIM.message(<<-EOS.strip)
          [import-js]: No variable to import. Place your cursor on a variable, then try again.
        EOS
        return
      end
      current_row, current_col = window.cursor

      return unless lines_changed = import_one_variable(variable_name)
      window.cursor = [current_row + lines_changed, current_col]
    end

    # Finds variables that haven't yet been imported
    def import_all
      content = "/* jshint undef: true, strict: true */\n" +
                VIM.evaluate('join(getline(1, "$"), "\n")')

      out, _ = Open3.capture3("#{@config['jshint_cmd']} -", stdin_data: content)
      imported_variables = []

      out.split("\n").each do |line|
        /.*'([^']+)' is not defined/.match(line) do |match_data|
          if import_one_variable(match_data[1])
            imported_variables << match_data[1]
          end
        end
      end

      if imported_variables.empty?
        VIM.message(<<-EOS.strip)
          [import-js]: No variables to import
        EOS
      else
        VIM.message(<<-EOS.strip)
          [import-js]: Imported these variables: #{imported_variables}
        EOS
      end
    end

    private

    # @return the number of lines changed, or nil if no file was found for the
    #   variable.
    def import_one_variable(variable_name)
      files = find_files(variable_name)
      if files.empty?
        VIM.message("[import-js]: No js file to import for variable `#{variable_name}`")
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

    # @return [number] the number of lines changed
    def write_imports(variable_name, path_to_file)
      current_imports = find_current_imports
      before_length = current_imports.length
      current_imports.length.times do
        buffer.delete(1)
      end

      current_imports << "var #{variable_name} = require('#{path_to_file}');"
      current_imports.sort!.uniq!

      current_imports.reverse.each do |import_line|
        buffer.append(0, import_line)
      end

      after_length = current_imports.length
      unless buffer[current_imports.length + 1].strip.empty?
        # Add a newline after imports
        buffer.append(current_imports.length, '')
        after_length += 1
      end
      after_length - before_length
    end

    def find_current_imports
      lines = []
      buffer.count.times do |n|
        line = buffer[n + 1]
        break unless line.match(/^var\s+.+=\s+require\(.*\).*;\s*$/)
        lines << line
      end
      lines
    end

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
