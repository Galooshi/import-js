require 'json'
require 'open3'
require 'set'
require 'strscan'

module ImportJS
  class Importer
    def initialize(editor = VIMEditor.new)
      @editor = editor
    end

    # Finds variable under the cursor to import. By default, this is bound to
    # `<Leader>j`.
    def import
      reload_config
      variable_name = @editor.current_word
      if variable_name.empty?
        message(<<-EOS.split.join(' '))
          No variable to import. Place your cursor on a variable, then try
          again.
        EOS
        return
      end

      js_module = find_one_js_module(variable_name)
      return unless js_module

      maintain_cursor_position do
        old_imports = find_current_imports
        import_statement = js_module.to_import_statement(variable_name, @config)
        old_imports[:imports] << import_statement
        replace_imports(old_imports[:range], old_imports[:imports])
      end
    end

    def goto
      reload_config
      js_modules = []
      variable_name = @editor.current_word
      time do
        js_modules = find_js_modules_for(variable_name)
      end

      js_module = resolve_module_using_current_imports(
        js_modules, variable_name)

      unless js_module
        # The current word is not mappable to one of the JS modules that we
        # found. This can happen if the user does not select one from the list.
        # We have nothing to go to, so we return early.
        return message("Could not resolve a module for `#{variable_name}`")
      end

      @editor.open_file(js_module.open_file_path(@editor.path_to_current_file))
    end

    REGEX_ESLINT_RESULT = /
      :
      (?<line>\d+)                # <line> line number
      :\d+:
      \s
      (?<quote>["'])              # <quote> opening quote
      (?<variable_name>[^\1]+)    # <variable_name>
      \k<quote>
      \s
      (?<type>                    # <type>
       is\sdefined\sbut\snever\sused         # is defined but never used
       |
       is\snot\sdefined                      # is not defined
       |
       must\sbe\sin\sscope\swhen\susing\sJSX # must be in scope when using JSX
      )
    /x

    # Removes unused imports and adds imports for undefined variables
    def fix_imports
      reload_config
      eslint_result = run_eslint_command

      return if eslint_result.empty?

      unused_variables = {}
      undefined_variables = Set.new

      eslint_result.each do |line|
        match = REGEX_ESLINT_RESULT.match(line)
        next unless match
        if match[:type] == 'is defined but never used'
          unused_variables[match[:variable_name]] ||= Set.new
          unused_variables[match[:variable_name]].add match[:line].to_i
        else
          undefined_variables.add match[:variable_name]
        end
      end

      return if unused_variables.empty? && undefined_variables.empty?

      old_imports = find_current_imports

      # Filter out unused variables that do not appear within the imports block.
      unused_variables.select! do |_, line_numbers|
        any_numbers_within_range?(line_numbers, old_imports[:range])
      end

      new_imports = old_imports[:imports].clone
      new_imports.delete_variables!(unused_variables.keys)

      undefined_variables.each do |variable|
        js_module = find_one_js_module(variable)
        next unless js_module
        new_imports << js_module.to_import_statement(variable, @config)
      end

      replace_imports(old_imports[:range], new_imports)
    end

    def rewrite_imports
      reload_config

      old_imports = find_current_imports
      new_imports = old_imports[:imports].clone

      old_imports[:imports].each do |import|
        import.variables.each do |variable|
          js_module = resolve_module_using_current_imports(
            find_js_modules_for(variable), variable)
          next unless js_module
          new_imports << js_module.to_import_statement(variable, @config)
        end
      end

      replace_imports(old_imports[:range], new_imports)
    end

    private

    # The configuration is relative to the current file, so we need to make sure
    # that we are operating with the appropriate configuration when we perform
    # certain actions.
    def reload_config
      @config = Configuration.new(@editor.path_to_current_file)
    end

    def message(str)
      @editor.message("ImportJS: #{str}")
    end

    # @param numbers [Set]
    # @param range [Range]
    # @return [Boolean]
    def any_numbers_within_range?(numbers, range)
      numbers.each do |number|
        return true if range.include?(number)
      end
      false
    end

    ESLINT_STDOUT_ERROR_REGEXES = [
      /Parsing error: /,
      /Unrecoverable syntax error/,
      /<text>:0:0: Cannot find module '.*'/,
    ].freeze

    ESLINT_STDERR_ERROR_REGEXES = [
      /SyntaxError: /,
      /eslint: command not found/,
      /Cannot read config package: /,
      /Cannot find module '.*'/,
      /No such file or directory/,
    ].freeze

    # @return [Array<String>] the output from eslint, line by line
    def run_eslint_command
      command = %W[
        #{@config.get('eslint_executable')}
        --stdin
        --stdin-filename #{@editor.path_to_current_file}
        --format unix
        --rule 'no-undef: 2'
        --rule 'no-unused-vars: [2, { "vars": "all", "args": "none" }]'
      ].join(' ')
      out, err = Open3.capture3(command,
                                stdin_data: @editor.current_file_content)

      if ESLINT_STDOUT_ERROR_REGEXES.any? { |regex| out =~ regex }
        raise ParseError.new, out
      end

      if ESLINT_STDERR_ERROR_REGEXES.any? { |regex| err =~ regex }
        raise ParseError.new, err
      end

      out.split("\n")
    end

    # @param variable_name [String]
    # @return [ImportJS::JSModule?]
    def find_one_js_module(variable_name)
      js_modules = []
      time do
        js_modules = find_js_modules_for(variable_name)
      end
      if js_modules.empty?
        message(
          "No JS module to import for variable `#{variable_name}` #{timing}")
        return
      end

      resolve_one_js_module(js_modules, variable_name)
    end

    # @param imports [Array<ImportJS::ImportStatement>]
    # @return [String]
    def generate_import_strings(import_statements)
      import_statements.map do |import|
        import.to_import_strings(@config.get('max_line_length'),
                                 @config.get('tab'))
      end.flatten.sort
    end

    # @param old_imports_range [Range]
    # @param new_imports [ImportJS::ImportStatements]
    def replace_imports(old_imports_range, new_imports)
      import_strings = new_imports.to_a

      # Ensure that there is a blank line after the block of all imports
      if old_imports_range.size + import_strings.length > 0 &&
         !@editor.read_line(old_imports_range.last).strip.empty?
        @editor.append_line(old_imports_range.last - 1, '')
      end

      # Find old import strings so we can compare with the new import strings
      # and see if anything has changed.
      old_import_strings = []
      old_imports_range.each do |line_number|
        old_import_strings << @editor.read_line(line_number)
      end

      # If nothing has changed, bail to prevent unnecessarily dirtying the
      # buffer.
      return if import_strings == old_import_strings

      # Delete old imports, then add the modified list back in.
      old_imports_range.each do
        @editor.delete_line(old_imports_range.first)
      end

      if import_strings.empty? &&
         @editor.read_line(old_imports_range.first).empty?
        # We have no newlines to write back to the file. Clearing out potential
        # whitespace where the imports used to be leaves the file in a better
        # state.
        @editor.delete_line(old_imports_range.first)
        return
      end

      import_strings.reverse_each do |import_string|
        # We need to add each line individually because the Vim buffer will
        # convert newline characters to `~@`.
        if import_string.include? "\n"
          import_string.split("\n").reverse_each do |line|
            @editor.append_line(old_imports_range.first - 1, line)
          end
        else
          @editor.append_line(old_imports_range.first - 1, import_string)
        end
      end
    end

    REGEX_SKIP_SECTION = %r{
      \s*                       # preceding whitespace
      (?:
        (['"])use\sstrict\1;?   # 'use strict';
        |
        //.*                    # single-line comment
        |
        /\*                     # open multi-line comment
        (?:\n|.)*?              # inside of multi-line comment
        \*/                     # close multi-line comment
      )?                        # ? b/c we want to match on only whitespace
      \n                        # end of line
    }x

    # @return [Hash]
    def find_current_imports
      imports_start_at_line_number = 1
      newline_count = 0

      scanner = StringScanner.new(@editor.current_file_content)
      skipped = ''
      while skip_section = scanner.scan(REGEX_SKIP_SECTION)
        skipped += skip_section
      end

      # We don't want to skip over blocks that are only whitespace
      if skipped =~ /\A(\s*\n)+\Z/m
        scanner = StringScanner.new(@editor.current_file_content)
      else
        imports_start_at_line_number += skipped.count("\n")
      end

      imports = ImportStatements.new(@config)
      while potential_import = scanner.scan(/(^\s*\n)*^.*?;\n/m)
        import_statement = ImportStatement.parse(potential_import.strip)
        break unless import_statement

        imports << import_statement
        newline_count += potential_import.scan(/\n/).length
      end

      imports_end_at_line_number = imports_start_at_line_number + newline_count
      {
        imports: imports,
        range: imports_start_at_line_number...imports_end_at_line_number,
      }
    end

    # @param variable_name [String]
    # @return [Array]
    def find_js_modules_for(variable_name)
      path_to_current_file = @editor.path_to_current_file

      alias_module = @config.resolve_alias(variable_name, path_to_current_file)
      return [alias_module] if alias_module

      named_imports_module = @config.resolve_named_exports(variable_name)
      return [named_imports_module] if named_imports_module

      formatted_var_name = formatted_to_regex(variable_name)
      egrep_command =
        "egrep -i \"(/|^)#{formatted_var_name}(/index)?(/package)?\.js.*\""
      matched_modules = []
      @config.get('lookup_paths').each do |lookup_path|
        if lookup_path == ''
          # If lookup_path is an empty string, the `find` command will not work
          # as desired so we bail early.
          raise FindError.new,
                "lookup path cannot be empty (#{lookup_path.inspect})"
        end

        find_command = %W[
          find #{lookup_path}
          -name "**.js*"
          -not -path "./node_modules/*"
        ].join(' ')
        command = "#{find_command} | #{egrep_command}"
        out, err = Open3.capture3(command)

        raise FindError.new, err unless err == ''

        matched_modules.concat(
          out.split("\n").map do |f|
            next if @config.get('excludes').any? do |glob_pattern|
              File.fnmatch(glob_pattern, f)
            end
            JSModule.construct(
              lookup_path: lookup_path,
              relative_file_path: f,
              strip_file_extensions:
                @config.get('strip_file_extensions', from_file: f),
              make_relative_to:
                @config.get('use_relative_paths', from_file: f) &&
                path_to_current_file,
              strip_from_path:
                @config.get('strip_from_path', from_file: f)
            )
          end.compact
        )
      end

      # Find imports from package.json
      ignore_prefixes = @config.get('ignore_package_prefixes').map do |prefix|
        Regexp.escape(prefix)
      end
      dep_regex = /^(?:#{ignore_prefixes.join('|')})?#{formatted_var_name}$/

      @config.package_dependencies.each do |dep|
        next unless dep =~ dep_regex

        js_module = JSModule.construct(
          lookup_path: 'node_modules',
          relative_file_path: "node_modules/#{dep}/package.json",
          strip_file_extensions: [])
        matched_modules << js_module if js_module
      end

      @config.environment_core_modules.each do |dep|
        next unless dep.casecmp(variable_name) == 0

        matched_modules << JSModule.new(import_path: dep)
      end

      # If you have overlapping lookup paths, you might end up seeing the same
      # module to import twice. In order to dedupe these, we remove the module
      # with the longest path
      matched_modules.sort! do |a, b|
        a.import_path.length <=> b.import_path.length
      end
      matched_modules.uniq! do |m|
        (m.lookup_path || '') + '/' + m.import_path
      end
      matched_modules.sort! do |a, b|
        a.display_name <=> b.display_name
      end
    end

    # @param js_modules [Array]
    # @param variable_name [String]
    # @return [ImportJS::JSModule]
    def resolve_one_js_module(js_modules, variable_name)
      if js_modules.length == 1
        js_module = js_modules.first
        js_module_name = js_module.display_name
        imported = if js_module.has_named_exports
                     "`#{variable_name}` from `#{js_module_name}`"
                   else
                     "`#{js_module_name}`"
                   end
        message("Imported #{imported} #{timing}")
        return js_module
      end

      selected_index = @editor.ask_for_selection(
        variable_name,
        js_modules.map(&:display_name)
      )
      return unless selected_index
      return unless (0...js_modules.length).cover?(selected_index)
      js_modules[selected_index]
    end

    # @param js_modules [Array]
    # @param variable_name [String]
    # @return [ImportJS::JSModule]
    def resolve_module_using_current_imports(js_modules, variable_name)
      return js_modules.first if js_modules.length == 1

      # Look at the current imports and grab what is already imported for the
      # variable.
      matching_import_statement = find_current_imports[:imports].find do |ist|
        next true if variable_name == ist.default_import
        next false unless ist.named_imports
        ist.named_imports.include?(variable_name)
      end

      if matching_import_statement
        if js_modules.empty?
          # We couldn't resolve any module for the variable. As a fallback, we
          # can use the matching import statement. If that maps to a package
          # dependency, we will still open the right file.
          matched_module = JSModule.new(
            import_path: matching_import_statement.path)
          if matching_import_statement.named_imports?
            matched_module.has_named_exports =
              matching_import_statement.named_imports.include?(variable_name)
          end
          return matched_module
        end

        # Look for a module matching what is already imported
        js_modules.each do |js_module|
          return js_module if matching_import_statement.path ==
                              js_module.import_path
        end
      end

      # Fall back to asking the user to resolve the ambiguity
      resolve_one_js_module(js_modules, variable_name)
    end

    # Takes a string in any of the following four formats:
    #   dash-separated
    #   snake_case
    #   camelCase
    #   PascalCase
    # and turns it into a star-separated lower case format, like so:
    #   star*separated
    #
    # @param string [String]
    # @return [String]
    def formatted_to_regex(string)
      # Based on
      # http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby

      # The pattern to match in between words. The "es" and "s" match is there
      # to catch pluralized folder names. There is a risk that this is overly
      # aggressive and will lead to trouble down the line. In that case, we can
      # consider adding a configuration option to control mapping a singular
      # variable name to a plural folder name (suggested by @lencioni in #127).
      # E.g.
      #
      # {
      #   "^mock": "./mocks/"
      # }
      split_pattern = '(es|s)?.?'

      # Split up the string, allow pluralizing and a single (any) character
      # in between. This will make e.g. 'fooBar' match 'foos/bar', 'foo_bar',
      # and 'foobar'.
      string
        .gsub(/([a-z\d])([A-Z])/, '\1' + split_pattern + '\2') # camelCase
        .tr('-_', split_pattern)
        .downcase
    end

    def time
      timing = { start: Time.now }
      yield
      timing[:end] = Time.now
      @timing = timing
    end

    # @return [String]
    def timing
      "(#{(@timing[:end] - @timing[:start]).round(2)}s)"
    end

    def maintain_cursor_position
      # Save editor information before modifying the buffer so we can put the
      # cursor in the correct spot after modifying the buffer.
      current_row, current_col = @editor.cursor
      old_buffer_lines = @editor.count_lines

      # Yield to a block that will potentially modify the buffer.
      yield

      # Check to see if lines were added or removed.
      lines_changed = @editor.count_lines - old_buffer_lines
      return unless lines_changed

      # Lines were added or removed, so we want to adjust the cursor position to
      # match.
      @editor.cursor = [current_row + lines_changed, current_col]
    end
  end
end
