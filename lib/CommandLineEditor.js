'use strict';

class CommandLineEditor {
  constructor(lines, opts) {
    this.lines = lines;
    this.messages = [];
    this.askForSelections = [];
    if (opts.selections && opts.selections.length) {
      this.selections = opts.selections;
    }
    this.word = opts.word;
    this.pathToFile = opts.pathToFile;
  }

  currentWord() {
    return this.word;
  }

  pathToCurrentFile() {
    return this.pathToFile;
  }

  openFile(filePath) {
    this.goto = filePath;
  }

  message(str) {
    this.messages.push(str);
  }

  currentFileContent() {
    return this.lines.join('\n');
  }

  messages() {
    return this.messages.join('\n');
  }

  // Reads a line from the file.
  // Lines are one-indexed, so 1 means the first line in the file.
  // this.return [String]
  readLine(lineNumber) {
    return this.lines[lineNumber - 1];
  }

  // Delete a line.
  // @param lineNumber [Number] One-indexed line number.
  //   1 is the first line in the file.
  deleteLine(lineNumber) {
    this.lines.splice(lineNumber - 1, 1);
  }

  // Append a line right after the specified line.
  // Lines are one-indexed, but you need to support appending to line 0 (add
  // content at top of file).
  // @param lineNumber [Number]
  appendLine(lineNumber, str) {
    return this.lines.insert(lineNumber, str);
  }

  // Count the number of lines in the file.
  // this.return [Number] the number of lines in the file
  countLines() {
    return this.lines.length;
  }

  // Ask the user to select something from a list of alternatives.
  //
  // this.param word [String] The word/variable to import
  // this.param alternatives [Array<String>] A list of alternatives
  // this.return [Number, nil] the index of the selected alternative, or nil if
  //   nothing was selected.
  askForSelection(word, alternatives) {
    if (this.selections) {
      // this is a re-run, where selections have already been made
      return this.selections[word];
    }
    this.askForSelections.push({
      word: word,
      alternatives: alternatives,
    });
  }
}

module.exports = CommandLineEditor;
