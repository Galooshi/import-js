# Class that is used in tests to behave similarly to the VIM::Buffer object.
# @see http://vimdoc.sourceforge.net/htmldoc/if_ruby.html#ruby-buffer
class MockVimBuffer
  # @param buffer_text [String]
  def initialize(buffer_text)
    @buffer_lines = buffer_text.split("\n")
  end

  # @param one_indexed_n [Number]
  def delete(one_indexed_n)
    @buffer_lines.delete_at(one_indexed_n - 1)
  end

  # @param index [Number] line number to append after
  # @param string [String] line to append
  def append(index, string)
    # We replace newlines with "^@" because that's what a real vim buffer will
    # output if you append such a string.
    @buffer_lines.insert(index, string.gsub("\n", '^@'))
  end

  # @return [Number] the number of lines in the buffer
  def count
    @buffer_lines.length
  end
  alias length count

  # @param one_indexed_n [Number] line number
  # @return [String] a line from the buffer
  def [](one_indexed_n)
    @buffer_lines[one_indexed_n - 1]
  end

  # @return [String]
  def to_s
    @buffer_lines.join("\n")
  end
end
