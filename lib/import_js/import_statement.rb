module ImportJS
  # Class that represents an import statement, e.g.
  # `const foo = require('foo');`
  # `var foo = myCustomRequire('foo');`
  # `import foo from 'foo';`
  class ImportStatement
    REGEX_CONST_LET_VAR = /
      \A
      (?<declaration_keyword>const|let|var)\s+ # <declaration_keyword>
      (?<assignment>.+?)   # <assignment> variable assignment
      \s*=\s*
      (?<import_function>\w+?)\( # <import_function> variable assignment
        (?<quote>'|")      # <quote> opening quote
        (?<path>[^\2\n]+)  # <path> module path
        \k<quote>          # closing quote
      \);?
      \s*
      \Z
    /xm

    REGEX_IMPORT = /
      \A
      (?<declaration_keyword>import)\s+ # <declaration_keyword>
      (?<assignment>.*?) # <assignment> variable assignment
      \s+from\s+
      (?<quote>'|")      # <quote> opening quote
      (?<path>[^\2\n]+)  # <path> module path
      \k<quote>          # closing quote
      ;?\s*
      \Z
    /xm

    REGEX_NAMED = /
      (?:                # non-capturing group
        (?<default>.*?)  # <default> default import
        ,\s*
      )?
      \{
        \s*
        (?<named>.*)      # <named> named imports
        \s*
      \}
    /xm

    attr_accessor :assignment
    attr_accessor :declaration_keyword
    attr_accessor :default_import
    attr_accessor :named_imports
    attr_accessor :import_function
    attr_accessor :original_import_string # a cache of the parsed import string
    attr_accessor :path

    # @param string [String] a possible import statement, e.g.
    #   `const foo = require('foo');`
    #   `var foo = myCustomRequire('foo');`
    #   `import foo from 'foo';`
    # @return [ImportJS::ImportStatement?] a parsed statement, or nil if the
    #   string can't be parsed
    def self.parse(string)
      match = REGEX_CONST_LET_VAR.match(string) ||
              REGEX_IMPORT.match(string)
      return unless match

      statement = new
      statement.original_import_string = match.string
      statement.declaration_keyword = match[:declaration_keyword]
      statement.path = match[:path]
      statement.assignment = match[:assignment]
      statement.import_function = if match.names.include? 'import_function'
                                    match[:import_function]
                                  else
                                    'require'
                                  end

      dest_match = statement.assignment.match(REGEX_NAMED)
      if dest_match
        statement.default_import = dest_match[:default]
        statement.named_imports =
          dest_match[:named].split(/,\s*/).map(&:strip)
      else
        statement.default_import = statement.assignment
      end

      statement
    end

    # Sets the default_import and clears the original import string cache.
    # @param value [String]
    def set_default_import(value)
      @default_import = value
      clear_import_string_cache
    end

    # Injects a new variable into an already existing set of named imports.
    # @param variable_name [String]
    def inject_named_import(variable_name)
      @named_imports ||= []
      named_imports << variable_name
      named_imports.sort!.uniq!

      clear_import_string_cache
    end

    # Deletes a variable from an already existing default import or set of
    # named imports.
    # @param variable_name [String]
    def delete_variable!(variable_name)
      @default_import = nil if default_import == variable_name
      @named_imports.delete(variable_name) if named_imports?

      clear_import_string_cache
    end

    # @return [Boolean] true if there are named imports
    def named_imports?
      !named_imports.nil? && !named_imports.empty?
    end

    # @return [Boolean] true if there is no default import and there are no
    #   named imports
    def empty?
      default_import.nil? && !named_imports?
    end

    # @return [Boolean] true if this instance was created through parsing an
    #   existing import and it hasn't been altered since it was created.
    def parsed_and_untouched?
      !original_import_string.nil?
    end

    # @return [Array] an array that can be used in `sort` and `uniq`
    def to_normalized
      [default_import || '', named_imports || '']
    end

    # @return [Array<String>] Array of all variables that this ImportStatement
    #   imports.
    def variables
      [@default_import, *@named_imports].compact
    end

    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return [Array<String>] generated import statement strings
    def to_import_strings(max_line_length, tab)
      return [original_import_string] if original_import_string

      if declaration_keyword == 'import'
        # ES2015 Modules (ESM) syntax can support default imports and
        # named imports on the same line.
        return [named_import_string(max_line_length, tab)] if named_imports?
        [default_import_string(max_line_length, tab)]
      else # const/var
        strings = []
        strings << default_import_string(max_line_length, tab) if default_import
        strings << named_import_string(max_line_length, tab) if named_imports?
        strings
      end
    end

    # Merge another ImportStatement into this one.
    # @param import_statement [ImportJS::ImportStatement]
    def merge(import_statement)
      if import_statement.default_import
        @default_import = import_statement.default_import
        clear_import_string_cache
      end

      if import_statement.named_imports?
        @named_imports ||= []
        @named_imports.concat(import_statement.named_imports)
        @named_imports.sort!.uniq!
        clear_import_string_cache
      end

      @declaration_keyword = import_statement.declaration_keyword
    end

    private

    # @param line [String]
    # @param max_line_length [Number] where to cap lines at
    # @return [Boolean]
    def line_too_long?(line, max_line_length)
      max_line_length && line.length > max_line_length
    end

    # @return [Array]
    def equals_and_value
      return ['from', "'#{path}';"] if declaration_keyword == 'import'
      ['=', "#{@import_function}('#{path}');"]
    end

    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return [String] import statement, wrapped at max line length if necessary
    def default_import_string(max_line_length, tab)
      equals, value = equals_and_value
      line = "#{@declaration_keyword} #{@default_import} #{equals} #{value}"
      return line unless line_too_long?(line, max_line_length)

      "#{@declaration_keyword} #{@default_import} #{equals}\n#{tab}#{value}"
    end

    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return [String] import statement, wrapped at max line length if necessary
    def named_import_string(max_line_length, tab)
      equals, value = equals_and_value
      if @declaration_keyword == 'import' && @default_import
        prefix = "#{@default_import}, "
      end

      named = "{ #{@named_imports.join(', ')} }"
      line = "#{@declaration_keyword} #{prefix}#{named} #{equals} " \
        "#{value}"
      return line unless line_too_long?(line, max_line_length)

      named = "{\n#{tab}#{@named_imports.join(",\n#{tab}")},\n}"
      "#{@declaration_keyword} #{prefix}#{named} #{equals} #{value}"
    end

    def clear_import_string_cache
      @original_import_string = nil
    end
  end
end
