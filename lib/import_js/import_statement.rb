module ImportJS
  # Class that represents an import statement, e.g.
  # "const foo = require('foo');"
  class ImportStatement
    REGEX_CONST_LET_VAR = %r{
      \A
      (?:const|let|var)\s+ # declaration keyword
      (?<assignment>.+?)   # <assignment> variable assignment
      \s*=\s*
      require\(
        (?<quote>'|")      # <quote> opening quote
        (?<path>[^\2]+)    # <path> module path
        \k<quote>          # closing quote
      \);?
      \s*
    }xm

    REGEX_IMPORT = %r{
      \A
      import\s+
      (?<assignment>.*?) # <assignment> variable assignment
      \s+from\s+
      (?<quote>'|")      # <quote> opening quote
      (?<path>[^\2]+)    # <path> module path
      \k<quote>          # closing quote
      ;?\s*
    }xm

    REGEX_DESTRUCTURE = %r{
      (?:                    # non-capturing group
        (?<default>.*?)      # <default> variable
        ,\s*
      )?
      \{
        \s*
        (?<destructured>.*)  # <destructured> variables
        \s*
      \}
    }x

    attr_accessor :assignment
    attr_accessor :original_import_string # a cache of the parsed import string
    attr_accessor :default_variable
    attr_accessor :destructured_variables
    attr_accessor :path

    # @param string [String] a possible import statement, e.g.
    #   `const foo = require('foo');`
    # @return [ImportJS::ImportStatement?] a parsed statement, or nil if the
    #   string can't be parsed
    def self.parse(string)
      match = REGEX_CONST_LET_VAR.match(string) ||
              REGEX_IMPORT.match(string)
      return unless match

      statement = new
      statement.original_import_string = match.string
      statement.path = match[:path]
      statement.assignment = match[:assignment]
      if dest_match = statement.assignment.match(REGEX_DESTRUCTURE)
        statement.default_variable = dest_match[:default]
        statement.destructured_variables =
          dest_match[:destructured].split(/,\s*/).map(&:strip)
      else
        statement.default_variable = statement.assignment
      end
      statement
    end

    # Sets the default_variable and clears the original import string cache.
    # @param value [String]
    def set_default_variable(value)
      @default_variable = value
      clear_import_string_cache
    end

    # Injects a new variable into an already existing set of destructured
    #   variables.
    # @param variable_name [String]
    def inject_destructured_variable(variable_name)
      @destructured_variables ||= []
      destructured_variables << variable_name
      destructured_variables.sort!.uniq!

      clear_import_string_cache
    end

    # Deletes a variable from an already existing default variable or set of
    #   destructured variables.
    # @param variable_name [String]
    def delete_variable(variable_name)
      @default_variable = nil if default_variable == variable_name
      @destructured_variables.delete(variable_name) unless destructured_variables.nil?

      clear_import_string_cache
    end

    # @return [Boolean] true if there are destructured variables
    def destructured?
      !destructured_variables.nil? && !destructured_variables.empty?
    end

    # @return [Boolean] true if there is no default variable and there are no
    #   destructured variables
    def empty?
      default_variable.nil? && !destructured?
    end

    # @return [Array] an array that can be used in `uniq!` to dedupe equal
    #   statements, e.g.
    #   `const foo = require('foo');`
    #   `import foo from 'foo';`
    def to_normalized
      [default_variable, destructured_variables, path]
    end

    # @param declaration_keyword [String] const, let, var, or import
    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return [Array] generated import statement strings
    def to_import_strings(declaration_keyword, max_line_length, tab)
      return [original_import_string] if original_import_string

      if declaration_keyword == 'import'
        # ES2015 Modules (ESM) syntax can support default values and
        # destructuring on the same line.
        if destructured?
          [wrap_destructured_import(
            declaration_keyword,
            max_line_length,
            tab,
            include_default_variable: true
          )]
        else
          [wrap_default_import(declaration_keyword, max_line_length, tab)]
        end
      else # const/let/var
        if destructured?
          strings = []

          unless default_variable.nil?
            # We have both a default variable and a destructuring to do, so we
            # need to generate 2 lines for CommonJS style syntax.
            strings <<
              wrap_default_import(declaration_keyword, max_line_length, tab)
          end

          strings <<
            wrap_destructured_import(declaration_keyword, max_line_length, tab)
        else
          [wrap_default_import(declaration_keyword, max_line_length, tab)]
        end
      end
    end

    # Merge another ImportStatement into this one.
    # @param import_statement [ImportJS::ImportStatement]
    def merge(import_statement)
      unless import_statement.default_variable.nil?
        @default_variable = import_statement.default_variable
        clear_import_string_cache
      end

      if import_statement.destructured?
        @destructured_variables ||= []
        @destructured_variables.concat(import_statement.destructured_variables)
        @destructured_variables.sort!.uniq!
        clear_import_string_cache
      end
    end

    private

    # @param wrap [Boolean]
    # @param tab [?String]
    # @return [String]
    def destructured_string(wrap: false, tab: nil)
      if wrap
        "{\n#{tab}#{destructured_variables.join(",\n#{tab}")},\n}"
      else
        "{ #{destructured_variables.join(', ')} }"
      end
    end

    # @param line [String]
    # @param max_line_length [Number] where to cap lines at
    # @return [Boolean]
    def line_too_long?(line, max_line_length)
      max_line_length && line.length > max_line_length
    end

    # @param declaration_keyword [String] e.g. 'import'
    # @return [Array]
    def equals_and_value(declaration_keyword)
      return ['from', "'#{path}';"] if declaration_keyword == 'import'
      ['=', "require('#{path}');"]
    end

    # @param declaration_keyword [String]
    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return [String] import statement, wrapped at max line length if necessary
    def wrap_default_import(declaration_keyword, max_line_length, tab)
      equals, value = equals_and_value(declaration_keyword)
      line = "#{declaration_keyword} #{default_variable} #{equals} #{value}"
      return line unless line_too_long?(line, max_line_length)

      "#{declaration_keyword} #{default_variable} #{equals}\n#{tab}#{value}"
    end

    # @param declaration_keyword [String]
    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @param include_default_variable [Boolean]
    # @return [String] import statement, wrapped at max line length if necessary
    def wrap_destructured_import(declaration_keyword, max_line_length, tab, include_default_variable: false)
      equals, value = equals_and_value(declaration_keyword)
      if include_default_variable && default_variable
        prefix = "#{default_variable}, "
      end

      line = "#{declaration_keyword} #{prefix}#{destructured_string} #{equals} #{value}"
      return line unless line_too_long?(line, max_line_length)

      destructured = destructured_string(wrap: true, tab: tab)
      "#{declaration_keyword} #{prefix}#{destructured} #{equals} #{value}"
    end

    def clear_import_string_cache
      @original_import_string = nil
    end
  end
end
