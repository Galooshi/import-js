module ImportJS
  class CommandLineEditor
    def initialize(lines, opts)
      @lines = lines
      @messages = []
      @ask_for_selections = []
      @selections = opts[:selections] unless opts[:selections].empty?
      @word = opts[:word]
      @filename = opts[:filename]
    end

    # @return [String]
    def current_word
      @word
    end

    # @return [String?]
    def path_to_current_file
      @filename
    end

    # @param file_path [String]
    def open_file(file_path)
      @goto = file_path
    end

    # @return [String]
    def goto
      @goto
    end

    # @param str [String]
    def message(str)
      @messages << str
    end

    # @return [Array]
    def ask_for_selections
      @ask_for_selections
    end

    # @return [String]
    def current_file_content
      @lines.join("\n")
    end

    # @return [String]
    def messages
      @messages.join("\n")
    end

    # Reads a line from the file.
    #
    # Lines are one-indexed, so 1 means the first line in the file.
    # @return [String]
    def read_line(line_number)
      @lines[line_number - 1]
    end

    # Get the cursor position.
    #
    # @return [Array(Number, Number)]
    def cursor
      # not relevant for this editor
      [0, 0]
    end

    # Place the cursor at a specified position.
    #
    # @param _position_tuple [Array(Number, Number)] the row and column to place
    #   the cursor at.
    def cursor=(_position_tuple)
      # no-op
    end

    # Delete a line.
    #
    # @param line_number [Number] One-indexed line number.
    #   1 is the first line in the file.
    def delete_line(line_number)
      @lines.delete_at(line_number - 1)
    end

    # Append a line right after the specified line.
    #
    # Lines are one-indexed, but you need to support appending to line 0 (add
    # content at top of file).
    # @param line_number [Number]
    def append_line(line_number, str)
      @lines.insert(line_number, str)
    end

    # Count the number of lines in the file.
    #
    # @return [Number] the number of lines in the file
    def count_lines
      @lines.length
    end

    # Ask the user to select something from a list of alternatives.
    #
    # @param word [String] The word/variable to import
    # @param alternatives [Array<String>] A list of alternatives
    # @return [Number, nil] the index of the selected alternative, or nil if
    #   nothing was selected.
    def ask_for_selection(word, alternatives)
      if @selections
        # this is a re-run, where selections have already been made
        @selections[word]
      else
        @ask_for_selections << {
          word: word,
          alternatives: alternatives
        }
        nil
      end
    end

    # Get the preferred max length of a line.
    # @return [Number?]
    def max_line_length
      80
    end

    # @return [String] shiftwidth number of spaces if expandtab is not set,
    #   otherwise `\t`.
    def tab
      '  '
    end
  end
end
