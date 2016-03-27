'use strict';

class CommandLineEditor {
  constructor(lines, opts) {
    this._lines = lines;
    this._messages = [];
    this._askForSelections = [];
    if (opts.selections && opts.selections.length) {
      this._selections = opts.selections;
    }
    this._word = opts.word;
    this._pathToFile = opts.pathToFile;
  }

  currentWord() {
    return this._word;
  }

  pathToCurrentFile() {
    return this._pathToFile;
  }

  openFile(filePath) {
    this.goto = filePath;
  }

  message(str) {
    this._messages.push(str);
  }

  currentFileContent() {
    return this._lines.join('\n');
  }

  messages() {
    return this._messages.join('\n');
  }

  // Reads a line from the file.
  // Lines are one-indexed, so 1 means the first line in the file.
  // this.return [String]
  readLine(lineNumber) {
    return this._lines[lineNumber - 1];
  }

  // Delete a line.
  // @param lineNumber [Number] One-indexed line number.
  //   1 is the first line in the file.
  deleteLine(lineNumber) {
    this._lines.splice(lineNumber - 1, 1);
  }

  // Append a line right after the specified line.
  // Lines are one-indexed, but you need to support appending to line 0 (add
  // content at top of file).
  // @param lineNumber [Number]
  appendLine(lineNumber, str) {
    return this._lines.insert(lineNumber, str);
  }

  // Count the number of lines in the file.
  // this.return [Number] the number of lines in the file
  countLines() {
    return this._lines.length;
  }

  // Ask the user to select something from a list of alternatives.
  //
  // this.param word [String] The word/variable to import
  // this.param alternatives [Array<String>] A list of alternatives
  // this.return [Number, nil] the index of the selected alternative, or nil if
  //   nothing was selected.
  askForSelection(word, alternatives) {
    if (this._selections) {
      // this is a re-run, where selections have already been made
      return this._selections[word];
    }
    this._askForSelections.push({ word, alternatives });
    return null;
  }
}

module.exports = CommandLineEditor;
