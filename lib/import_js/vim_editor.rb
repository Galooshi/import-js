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
  end
end
