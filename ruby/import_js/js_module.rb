module ImportJS
  # Class that represents a js module found in the file system
  class JSModule
    attr_reader :relative_file_path
    attr_reader :main_file
    attr_reader :skip

    # @param lookup_path [String] the lookup path in which this module was found
    # @param relative_file_path [String] a full path to the file, relative to
    #   the project root.
    def initialize(lookup_path, relative_file_path)
      @lookup_path = lookup_path
      if relative_file_path.end_with? '/package.json'
        @main_file = JSON.parse(File.read(relative_file_path))['main']
        match = relative_file_path.match(/(.*)\/package\.json/)
        @relative_file_path = match[1]
        @skip = !@main_file
      elsif relative_file_path.match(/\/index\.js.*$/)
        match = relative_file_path.match(/(.*)\/(index\.js.*)/)
        @main_file = match[2]
        @relative_file_path = match[1]
      else
        @relative_file_path = relative_file_path
      end
    end

    # @return [String] a readable description of the module
    def display_name
      parts = [import_path]
      parts << " (main: #{@main_file})" if @main_file
      parts.join('')
    end

    # @return [String] a string that can be added to a `require` statement.
    def import_path
      @relative_file_path.sub("#{@lookup_path}\/", '') # remove path prefix
                         .gsub(/\.js.*$/, '') # remove file ending
    end
  end
end
