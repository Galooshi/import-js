module ImportJS
  # Class that sorts ImportStatements as they are pushed in
  class ImportStatements
    include Enumerable

    STYLE_IMPORT = :import
    STYLE_CONST = :const
    STYLE_VAR = :var
    STYLE_CUSTOM = :custom

    # Order is significant here
    STYLES = [STYLE_IMPORT, STYLE_CONST, STYLE_VAR, STYLE_CUSTOM].freeze

    PATH_TYPE_PACKAGE = :package
    PATH_TYPE_NON_RELATIVE = :non_relative
    PATH_TYPE_RELATIVE = :relative

    # Order is significant here
    PATH_TYPES = [
      PATH_TYPE_PACKAGE,
      PATH_TYPE_NON_RELATIVE,
      PATH_TYPE_RELATIVE,
    ].freeze

    GROUPINGS_ARRAY = STYLES.map do |style|
      PATH_TYPES.map do |location|
        "#{style} #{location}"
      end
    end.flatten.freeze

    GROUPINGS = Hash[
      GROUPINGS_ARRAY.each_with_index.map { |group, index| [group, index] }
    ].freeze

    # @param config [ImportJS::Configuration]
    # @param imports [Hash]
    def initialize(config, imports = {})
      @config = config
      @imports = imports
    end

    def each
      return enum_for(:each) unless block_given?

      @imports.each do |_, import_statement|
        yield import_statement
      end
    end

    def clone
      ImportStatements.new(@config, @imports.clone)
    end

    # @param import_statement [ImportJS::ImportStatement]
    # @return [ImportJS::ImportStatements]
    def push(import_statement)
      if @imports[import_statement.path]
        # Import already exists, so this line is likely one of a named imports
        # pair. Combine it into the same ImportStatement.
        @imports[import_statement.path].merge(import_statement)
      else
        # This is a new import, so we just add it to the hash.
        @imports[import_statement.path] = import_statement
      end

      self # for chaining
    end
    alias << push

    # @param variable_names [Array<String>]
    # @return [ImportJS::ImportStatements]
    def delete_variables!(variable_names)
      @imports.reject! do |_, import_statement|
        variable_names.each do |variable_name|
          import_statement.delete_variable!(variable_name)
        end
        import_statement.empty?
      end

      self # for chaining
    end

    # Convert the import statements into an array of strings, with an empty
    # string between each group.
    # @return [Array<String>]
    def to_a
      max_line_length = @config.get('max_line_length')
      tab = @config.get('tab')

      strings = []
      to_groups.each do |group|
        group.each do |import_statement|
          strings.concat(
            import_statement.to_import_strings(max_line_length, tab))
        end
        strings << '' # Add a blank line between groups.
      end

      # We don't want to include a trailing newline at the end of all the
      # groups here.
      strings.pop if strings.last == ''

      strings
    end

    private

    # Sort the import statements by path and group them based on our heuristic
    # of style and path type.
    # @return [Array<Array<ImportJS::ImportStatement>>]
    def to_groups
      groups = []

      imports_array = @imports.values

      # There's a chance we have duplicate imports (can happen when switching
      # declaration_keyword for instance). By first sorting imports so that new
      # ones are first, then removing duplicates, we guarantee that we delete
      # the old ones that are now redundant.
      partitioned = imports_array.partition do |import_statement|
        !import_statement.parsed_and_untouched?
      end.flatten.uniq(&:to_normalized).sort_by(&:to_normalized)

      return [partitioned] unless @config.get('group_imports')

      package_dependencies = @config.package_dependencies
      partitioned.each do |import_statement|
        # Figure out what group to put this import statement in
        group_index = import_statement_group_index(
          import_statement, package_dependencies)

        # Add the import statement to the group
        groups[group_index] ||= []
        groups[group_index] << import_statement
      end

      groups.compact! unless groups.empty?
      groups
    end

    # @param import_statement [ImportJS::ImportStatement]
    # @param package_dependencies [Array<String>]
    # @return [Number]
    def import_statement_group_index(import_statement, package_dependencies)
      style = import_statement_style(import_statement)
      path_type = import_statement_path_type(
        import_statement, package_dependencies)

      GROUPINGS["#{style} #{path_type}"]
    end

    # Determine import statement style
    # @param import_statement [ImportJS::ImportStatement]
    # @return [String] 'import', 'const', 'var', or 'custom'
    def import_statement_style(import_statement)
      return STYLE_IMPORT if import_statement.declaration_keyword == 'import'

      if import_statement.import_function == 'require'
        return STYLE_CONST if import_statement.declaration_keyword == 'const'
        return STYLE_VAR if import_statement.declaration_keyword == 'var'
      end

      STYLE_CUSTOM
    end

    # Determine import path type
    # @param import_statement [ImportJS::ImportStatement]
    # @param package_dependencies [Array<String>]
    # @return [String] 'package, 'non-relative', 'relative'
    def import_statement_path_type(import_statement, package_dependencies)
      # If there is a slash in the path, remove that and everything after it.
      # This is so that imports for modules inside package dependencies end up
      # in the right group (PATH_TYPE_PACKAGE).
      path = import_statement.path.sub(%r{\A(.*?)/.*\Z}, '\1')

      return PATH_TYPE_RELATIVE if path.start_with?('.')
      return PATH_TYPE_PACKAGE if package_dependencies.include?(path)
      PATH_TYPE_NON_RELATIVE
    end
  end
end
