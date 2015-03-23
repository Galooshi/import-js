class MockVimBuffer
  def initialize(buffer_text)
    @buffer_lines = buffer_text.split("\n")
  end

  def delete(one_indexed_n)
    @buffer_lines.delete_at(one_indexed_n - 1)
  end

  def append(index, string)
    # We replace newlines with "^@" because that's what a real vim buffer will
    # output if you append such a string.
    @buffer_lines.insert(index, string.gsub("\n", '^@'))
  end

  def count
    @buffer_lines.length
  end

  def [](one_indexed_n)
    @buffer_lines[one_indexed_n - 1]
  end

  def to_s
    @buffer_lines.join("\n")
  end
end
