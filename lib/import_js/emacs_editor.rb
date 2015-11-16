# encoding: utf-8
module ImportJS
end

class ImportJS::EmacsEditor
  attr_accessor :current_word

  def initialize
    loop do
      input = gets.chomp
      command, value, path = input.split(':')

      begin
        @path = path
        @file = File.readlines(path).map(&:chomp)

        case command
        when 'import'
          @current_word = value
          ImportJS::Importer.new(self).import
          write_file
          puts 'import:success'
        when 'goto'
          ImportJS::Importer.new(self).goto
        end
      rescue Exception => e
        puts e.inspect
      end
    end
  end

  def write_file
    new_file = File.open(@path, 'w')
    @file.each {|line| new_file.puts(line) }
    new_file.close
  end

  # Open a file specified by a path.
  #
  # @param file_path [String]
  def open_file(file_path)
    puts file_path
  end

  # Display a message to the user.
  #
  # @param str [String]
  def message(str)
    puts str
  end

  # Read the entire file into a string.
  #
  # @return [String]
  def current_file_content
    @file.join('\n')
  end

  # Reads a line from the file.
  #
  # Lines are one-indexed, so 1 means the first line in the file.
  # @return [String]
  def read_line(line_number)
    @file[line_number - 1]
  end

  # Get the cursor position.
  #
  # @return [Array(Number, Number)]
  def cursor
    return 0, 0
  end

  # Place the cursor at a specified position.
  #
  # @param position_tuple [Array(Number, Number)] the row and column to place
  #   the cursor at.
  def cursor=(position_tuple)
  end

  # Delete a line.
  #
  # @param line_number [Number] One-indexed line number.
  #   1 is the first line in the file.
  def delete_line(line_number)
    @file.delete_at(line_number - 1)
  end

  # Append a line right after the specified line.
  #
  # Lines are one-indexed, but you need to support appending to line 0 (add
  # content at top of file).
  # @param line_number [Number]
  def append_line(line_number, str)
    @file.insert(line_number, str)
  end

  # Count the number of lines in the file.
  #
  # @return [Number] the number of lines in the file
  def count_lines
    @file.size
  end

  # Ask the user to select something from a list of alternatives.
  #
  # @param heading [String] A heading text
  # @param alternatives [Array<String>] A list of alternatives
  # @return [Number, nil] the index of the selected alternative, or nil if
  #   nothing was selected.
  def ask_for_selection(heading, alternatives)
    puts "asking for selection"
    puts heading
    puts JSON.pretty_generate(alternatives)
    return

    # need to implement this
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
    80
  end

  # @return [String] shiftwidth number of spaces if expandtab is not set,
  #   otherwise `\t`
  def tab
    return ' ' * shift_width || 2
  end

  # @return [Number?]
  def shift_width
    2
  end
end
