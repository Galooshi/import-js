# encoding: utf-8
module ImportJS
  # This is the implementation of the VIM integration in Import-JS. It can be
  # used as a template for other editor integrations.
  class VIMEditor
    # Get the word currently under the cursor.
    #
    # @return [String]
    def current_word
      VIM.evaluate("expand('<cword>')")
    end

    # Get the path to the file currently being edited. May return `nil` if an
    # anonymous file is being edited.
    #
    # @return [String?]
    def path_to_current_file
      VIM.evaluate("expand('%')")
    end

    # Open a file specified by a path.
    #
    # @param file_path [String]
    def open_file(file_path)
      VIM.command("e #{file_path}")
    end

    # Display a message to the user.
    #
    # @param str [String]
    def message(str)
      # To prevent having to press enter to dismiss, we ellipsize the message
      if str.length > available_columns - 1
        str = str[0...(available_columns - 2)] + '…'
      end

      VIM.command(":call importjs#WideMsg('#{str}')")
    end

    # Read the entire file into a string.
    #
    # @return [String]
    def current_file_content
      VIM.evaluate('join(getline(1, "$"), "\n")')
    end

    # Reads a line from the file.
    #
    # Lines are one-indexed, so 1 means the first line in the file.
    # @return [String]
    def read_line(line_number)
      VIM::Buffer.current[line_number]
    end

    # Get the cursor position.
    #
    # @return [Array(Number, Number)]
    def cursor
      VIM::Window.current.cursor
    end

    # Place the cursor at a specified position.
    #
    # @param position_tuple [Array(Number, Number)] the row and column to place
    #   the cursor at.
    def cursor=(position_tuple)
      VIM::Window.current.cursor = position_tuple
    end

    # Delete a line.
    #
    # @param line_number [Number] One-indexed line number.
    #   1 is the first line in the file.
    def delete_line(line_number)
      VIM::Buffer.current.delete(line_number)
    end

    # Append a line right after the specified line.
    #
    # Lines are one-indexed, but you need to support appending to line 0 (add
    # content at top of file).
    # @param line_number [Number]
    def append_line(line_number, str)
      VIM::Buffer.current.append(line_number, str)
    end

    # Count the number of lines in the file.
    #
    # @return [Number] the number of lines in the file
    def count_lines
      VIM::Buffer.current.count
    end

    # Ask the user to select something from a list of alternatives.
    #
    # @param heading [String] A heading text
    # @param alternatives [Array<String>] A list of alternatives
    # @return [Number, nil] the index of the selected alternative, or nil if
    #   nothing was selected.
    def ask_for_selection(heading, alternatives)
      escaped_list = [heading]
      escaped_list << alternatives.each_with_index.map do |alternative, i|
        "\"#{i + 1}: #{alternative}\""
      end
      escaped_list_string = '[' + escaped_list.join(',') + ']'

      selected_index = VIM.evaluate("inputlist(#{escaped_list_string})")
      return if selected_index < 1
      selected_index - 1
    end

    # Get the preferred max length of a line
    # @return [Number?]
    def max_line_length
      get_number('&textwidth')
    end

    # @return [String] shiftwidth number of spaces if expandtab is not set,
    #   otherwise `\t`
    def tab
      return "\t" unless expand_tab?
      ' ' * (shift_width || 2)
    end

    private

    # Check for the presence of a setting such as:
    #
    #   - g:CommandTSmartCase (plug-in setting)
    #   - &wildignore         (Vim setting)
    #   - +cursorcolumn       (Vim setting, that works)
    #
    # @param str [String]
    # @return [Boolean]
    def exists?(str)
      VIM.evaluate(%{exists("#{str}")}).to_i != 0
    end

    # @return [Number?]
    def available_columns
      get_number('&columns')
    end

    # @param name [String]
    # @return [Number?]
    def get_number(name)
      exists?(name) ? VIM.evaluate("#{name}").to_i : nil
    end

    # @param name [String]
    # @return [Boolean?]
    def get_bool(name)
      exists?(name) ? VIM.evaluate("#{name}").to_i != 0 : nil
    end

    # @return [Boolean?]
    def expand_tab?
      get_bool('&expandtab')
    end

    # @return [Number?]
    def shift_width
      get_number('&shiftwidth')
    end
  end
end
