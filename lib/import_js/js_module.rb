module ImportJS
  # Class that represents a js module found in the file system
  class JSModule
    attr_reader :import_path
    attr_reader :lookup_path
    attr_reader :file_path
    attr_reader :main_file
    attr_reader :skip
    attr_accessor :is_destructured

    # @param lookup_path [String] the lookup path in which this module was found
    # @param relative_file_path [String] a full path to the file, relative to
    #   the project root.
    # @param strip_file_extensions [Array] a list of file extensions to strip,
    #   e.g. ['.js', '.jsx']
    def initialize(lookup_path, relative_file_path, strip_file_extensions)
      @lookup_path = lookup_path
      @file_path = relative_file_path
      if relative_file_path.end_with? '/package.json'
        @main_file = JSON.parse(File.read(relative_file_path))['main']
        match = relative_file_path.match(/(.*)\/package\.json/)
        @import_path = match[1]
        @skip = !@main_file
      elsif relative_file_path.match(/\/index\.js.*$/)
        match = relative_file_path.match(/(.*)\/(index\.js.*)/)
        @main_file = match[2]
        @import_path = match[1]
      else
        @import_path = relative_file_path
        strip_file_extensions.each do |ext|
          if @import_path.end_with?(ext)
            @import_path = @import_path[0...-ext.length]
            break
          end
        end
      end

      if lookup_path
        @import_path = @import_path.sub("#{@lookup_path}\/", '') # remove path prefix
      end
    end

    # @return [String] a readable description of the module
    def display_name
      parts = [import_path]
      parts << " (main: #{@main_file})" if @main_file
      parts.join('')
    end

    # @param variable_name [String]
    # @return [ImportJS::ImportStatement]
    def to_import_statement(variable_name)
      ImportJS::ImportStatement.new.tap do |statement|
        statement.is_destructured = is_destructured
        if is_destructured
          statement.destructured_variables = [variable_name]
        else
          statement.default_variable = variable_name
        end
        statement.path = import_path
      end
    end
  end
end
