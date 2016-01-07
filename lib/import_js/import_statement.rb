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
      @original_import_string = nil # clear import string cache if there was one
    end

    # Injects a new variable into an already existing set of destructured
    #   variables.
    # @param variable_name [String]
    def inject_destructured_variable(variable_name)
      @destructured_variables ||= []
      destructured_variables << variable_name
      destructured_variables.sort!.uniq!

      @original_import_string = nil # clear import string cache if there was one
    end

    # Deletes a variable from an already existing default variable or set of
    #   destructured variables.
    # @param variable_name [String]
    def delete_variable(variable_name)
      @default_variable = nil if default_variable == variable_name
      @destructured_variables.delete(variable_name) unless destructured_variables.nil?

      @original_import_string = nil # clear import string cache if there was one
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
    # @return [Array] a generated import statement string
    def to_import_strings(declaration_keyword, max_line_length, tab)
      return [original_import_string] if original_import_string

      if declaration_keyword == 'import'
        # ES2015 Modules (ESM) syntax can support default values and
        # destructuring on the same line.
        declaration = declaration_keyword
        if destructured?
          declaration += " #{default_variable}," if default_variable
          declaration += " #{destructured_string}"
        else
          declaration += " #{default_variable}"
        end
        declaration += ' from'

        [wrap_import(declaration, "'#{path}';", max_line_length, tab)]
      else # const/let/var
        value = "require('#{path}');"

        if destructured? && !default_variable.nil?
          # We have both a default variable and a destructuring to do, so we
          # need to generate 2 lines for CommonJS style syntax.
          default_declaration = "#{declaration_keyword} #{default_variable} ="
          destructured_declaration = "#{declaration_keyword} #{destructured_string} ="

          return [
            wrap_import(default_declaration, value, max_line_length, tab),
            wrap_import(destructured_declaration, value, max_line_length, tab)
          ]
        end

        declaration_assignment =
          destructured? ? destructured_string : default_variable
        declaration = "#{declaration_keyword} #{declaration_assignment} ="
        [wrap_import(declaration, value, max_line_length, tab)]
      end
    end

    private

    # @return [String]
    def destructured_string
      "{ #{destructured_variables.join(', ')} }"
    end

    # @param declaration [String]
    # @param value [String]
    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return [String] import statement, wrapped at max line length if necessary
    def wrap_import(declaration, value, max_line_length, tab)
      if max_line_length &&
         "#{declaration} #{value}".length > max_line_length
        "#{declaration}\n#{tab}#{value}"
      else
        "#{declaration} #{value}"
      end
    end
  end
end
