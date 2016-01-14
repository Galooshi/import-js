require 'pathname'

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
    # @param make_relative_to [String|nil] a path to a different file which the
    #   resulting import path should be relative to.
    def initialize(lookup_path: nil,
                   relative_file_path: nil,
                   strip_file_extensions: nil,
                   make_relative_to: nil)
      @lookup_path = lookup_path
      @file_path = relative_file_path

      if @lookup_path && @lookup_path.start_with?('.')
        @lookup_path.sub!(/^\.\/?/, '')
        @file_path.sub!(/^\.\/?/, '')
      end
      if relative_file_path.end_with? '/package.json'
        @main_file = JSON.parse(File.read(relative_file_path))['main']
        match = relative_file_path.match(/(.*)\/package\.json/)
        @import_path = match[1]
        @skip = !@main_file
      elsif relative_file_path.match(%r{/index\.js[^/]*$})
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

      if @lookup_path
        @import_path.sub!(/^#{Regexp.escape(@lookup_path)}\//, '')
        if make_relative_to
          make_import_path_relative_to(make_relative_to)
        end
      end
    end

    # @param make_relative_to [String]
    def make_import_path_relative_to(make_relative_to)
      # First, strip out any absolute path up until the current directory
      make_relative_to = make_relative_to.sub(Dir.pwd + "\/", '')

      # Ignore if the file to relate to is part of a different lookup_path
      return unless make_relative_to.start_with? @lookup_path

      # Strip out the lookup_path
      make_relative_to.sub!(/^#{Regexp.escape(@lookup_path)}\//, '')

      path = Pathname.new(@import_path).relative_path_from(
        Pathname.new(File.dirname(make_relative_to))
      ).to_s

      unless path.start_with?('.')
        # `Pathname.relative_path_from` will not add "./" automatically
        path = './' + path
      end
      @import_path = path
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
        if is_destructured
          statement.inject_destructured_variable(variable_name)
        else
          statement.default_variable = variable_name
        end
        statement.path = import_path
      end
    end
  end
end
