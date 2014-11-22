module ImportJS
  class Importer
    def import
      variable_name = VIM.evaluate("expand('<cword>')")
      path_to_file = find_path_to_file(variable_name)
      if path_to_file
        require_statement = "var #{variable_name} = require('#{path_to_file}');"
        VIM::Buffer.current.append(0, require_statement)
      else
        VIM.message("No file found for #{variable_name}")
      end
    end

    private

    def camelcase_to_snakecase(string)
      # Grabbed from
      # http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby
      string.gsub(/::/, '/')
            .gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2')
            .gsub(/([a-z\d])([A-Z])/, '\1_\2')
            .tr('-', '_')
            .downcase
    end

    def find_path_to_file(variable_name)
      snake_case_variable = camelcase_to_snakecase(variable_name)
      matched_file_paths = Dir.glob("**/#{snake_case_variable}*.js*")

      # TODO: do something about arrays larger than one
      return if matched_file_paths.empty?
      matched_file = matched_file_paths.first
      matched_file.gsub(/\..*$/, '')
    end
  end
end
