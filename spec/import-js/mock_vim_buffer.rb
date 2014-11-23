class MockVimBuffer
  def initialize(buffer_text)
    @buffer_lines = buffer_text.split("\n")
  end

  def delete(one_indexed_n)
    @buffer_lines.delete_at(one_indexed_n - 1)
  end

  def append(index, string)
    @buffer_lines.insert(index, string)
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
