module ImportJS
  class CommandLineEditor
    def initialize(word, lines)
      @word = word
      @lines = lines
    end

    # @return [String]
    def current_word
      @word
    end

    # @param file_path [String]
    def open_file(_file_path)
      fail 'not supported'
    end

    # @param str [String]
    def message(str)
      puts str
    end

    # @return [String]
    def current_file_content
      @lines.join("\n")
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
    # @param heading [String] A heading text
    # @param alternatives [Array<String>] A list of alternatives
    # @return [Number, nil] the index of the selected alternative, or nil if
    #   nothing was selected.
    def ask_for_selection(heading, alternatives)
      puts heading
      alternatives.each_with_index do |alt, i|
        puts "#{i + 1}. #{alt}"
      end
      print 'Select number: '
      selected = gets.strip
      selected_index = selected.to_i - 1
      return nil if selected_index < 0
      return nil if selected_index >= alternatives.length
      selected_index
    end

    # Get the preferred max length of a line
    # @return [Number?]
    def max_line_length
      80
    end

    # @return [String] shiftwidth number of spaces if expandtab is not set,
    #   otherwise `\t`
    def tab
      '  '
    end
  end
end
