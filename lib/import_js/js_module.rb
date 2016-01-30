require 'pathname'

module ImportJS
  # Class that represents a js module found in the file system
  class JSModule
    attr_accessor :import_path
    attr_accessor :lookup_path
    attr_accessor :file_path
    attr_accessor :main_file
    attr_accessor :has_named_exports

    # @param lookup_path [String] the lookup path in which this module was found
    # @param relative_file_path [String] a full path to the file, relative to
    #   the project root.
    # @param strip_file_extensions [Array] a list of file extensions to strip,
    #   e.g. ['.js', '.jsx']
    # @param make_relative_to [String|nil] a path to a different file which the
    #   resulting import path should be relative to.
    def self.construct(lookup_path: nil,
                       relative_file_path: nil,
                       strip_file_extensions: nil,
                       make_relative_to: nil,
                       strip_from_path: nil)
      js_module = new
      js_module.lookup_path = normalize_path(lookup_path)
      js_module.file_path = normalize_path(relative_file_path)

      import_path, main_file = resolve_import_path_and_main(
        js_module.file_path, strip_file_extensions)

      return unless import_path

      import_path = import_path.sub(
        %r{^#{Regexp.escape(js_module.lookup_path)}/}, '')

      js_module.import_path = import_path
      js_module.main_file = main_file
      js_module.make_relative_to(make_relative_to) if make_relative_to
      js_module.strip_from_path(strip_from_path) unless make_relative_to
      js_module
    end

    # @param path [String]
    # @return [String]
    def self.normalize_path(path)
      return unless path
      path.sub(%r{^\./?}, '')
    end

    # @param file_path [String]
    # @param strip_file_extensions [Array]
    # @return [String, String]
    def self.resolve_import_path_and_main(file_path, strip_file_extensions)
      if file_path.end_with? '/package.json'
        main_file = JSON.parse(File.read(file_path))['main']
        return [nil, nil] unless main_file
        match = file_path.match(%r{(.*)/package\.json})
        return match[1], main_file
      end

      match = file_path.match(%r{(.*)/(index\.js[^/]*)$})
      return match[1], match[2] if match

      extensions = strip_file_extensions.map { |str| Regexp.escape(str) }
      import_path = file_path.sub(/(?:#{extensions.join('|')})$/, '')
      [import_path, nil]
    end

    # @param import_path [String]
    def initialize(import_path: nil)
      self.import_path = import_path
    end

    # @param make_relative_to [String]
    def make_relative_to(make_relative_to)
      return unless lookup_path
      # First, strip out any absolute path up until the current directory
      make_relative_to = make_relative_to.sub("#{Dir.pwd}/", '')

      # Ignore if the file to relate to is part of a different lookup_path
      return unless make_relative_to.start_with? lookup_path

      # Strip out the lookup_path
      make_relative_to = make_relative_to.sub(
        %r{^#{Regexp.escape(lookup_path)}/}, '')

      path = Pathname.new(import_path).relative_path_from(
        Pathname.new(File.dirname(make_relative_to))
      ).to_s

      # `Pathname.relative_path_from` will not add "./" automatically
      path = './' + path unless path.start_with?('.')

      self.import_path = path
    end

    # @param prefix [String]
    def strip_from_path(prefix)
      return unless prefix
      self.import_path = import_path.sub(/^#{Regexp.escape(prefix)}/, '')
    end

    # @return [String] a readable description of the module
    def display_name
      parts = [import_path]
      parts << " (main: #{@main_file})" if @main_file
      parts.join('')
    end

    # @param path_to_current_file [String]
    # @return [String]
    def open_file_path(path_to_current_file)
      if file_path
        # There is a file_path. This happens for JSModules that are not aliases.
        return file_path unless file_path.end_with?('/package.json')

        # The file_path points to a package.json file, so we want to look in
        # that package.json file for a `main` configuration value and open that
        # file instead.
        return file_path.sub(/package\.json$/, main_file)
      end

      # There is no file_path. This likely means that we are working with an
      # alias, so we want to expand it to a full path if we can.

      if import_path.start_with?('.')
        # The import path in the alias starts with a ".", which means that it is
        # relative to the current file. In order to open this file, we need to
        # expand it to a full path.
        return File.expand_path(import_path, File.dirname(path_to_current_file))
      end

      import_path
    end

    # @param variable_name [String]
    # @param config [ImportJS::Configuration]
    # @return [ImportJS::ImportStatement]
    def to_import_statement(variable_name, config)
      ImportJS::ImportStatement.new.tap do |statement|
        if has_named_exports
          statement.inject_named_import(variable_name)
        else
          statement.default_import = variable_name
        end
        statement.path = import_path
        statement.declaration_keyword = config.get('declaration_keyword',
                                                   from_file: file_path)
        statement.import_function = config.get('import_function',
                                               from_file: file_path)
      end
    end
  end
end
