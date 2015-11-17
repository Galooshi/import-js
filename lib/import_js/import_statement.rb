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

    attr_accessor :assignment
    attr_accessor :original_import_string # a cache of the parsed import string
    attr_accessor :variables
    attr_accessor :is_destructured # can't use `destructured?` because of 1.9.3
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
      if dest_match = statement.assignment.match(/\{\s*(.*)\s*\}/)
        statement.variables = dest_match[1].split(/,\s*/).map(&:strip)
        statement.is_destructured = true
      else
        statement.variables = [statement.assignment]
      end
      statement
    end

    # Injects a new variable into an already existing set of destructured
    #   variables.
    # @param variable_name [String]
    def inject_variable(variable_name)
      variables << variable_name
      variables.sort!.uniq!

      @original_import_string = nil # clear import string cache if there was one
    end

    # Deletes a variable from an already existing set of destructured
    #   variables.
    # @param variable_name [String]
    def delete_variable(variable_name)
      variables.delete(variable_name)

      @original_import_string = nil # clear import string cache if there was one
    end

    # @return [Array] an array that can be used in `uniq!` to dedupe equal
    #   statements, e.g.
    #   `const foo = require('foo');`
    #   `import foo from 'foo';`
    def normalize
      [variables, path]
    end

    # @param declaration_keyword [String] const, let, var, or import
    # @param max_line_length [Number] where to cap lines at
    # @param tab [String] e.g. '  ' (two spaces)
    # @return a generated import statement string
    def to_import_string(declaration_keyword, max_line_length, tab)
      return original_import_string if original_import_string

      equals = declaration_keyword == 'import' ? 'from' : '='
      if is_destructured
        declaration =
          "#{declaration_keyword} { #{variables.join(', ')} } #{equals}"
      else
        declaration =
          "#{declaration_keyword} #{variables.first} #{equals}"
      end

      value = if declaration_keyword == 'import'
                "'#{path}';"
              else
                "require('#{path}');"
              end

      if max_line_length && "#{declaration} #{value}".length > max_line_length
        "#{declaration}\n#{tab}#{value}"
      else
        "#{declaration} #{value}"
      end
    end
  end
end
