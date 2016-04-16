'use strict';

class CommandLineEditor {
  /**
   * @param {Array<String>} lines
   * @param {object} opts
   * @param {array} opts.selections
   * @param {string} opts.pathtofile
   */
  constructor(lines, opts) {
    this._lines = lines;
    this._messages = [];
    this._askForSelections = [];
    if (opts.selections && Object.keys(opts.selections).length) {
      this._selections = opts.selections;
    }
    this._pathToFile = opts.pathToFile;
  }

  /**
   * @return {String}
   */
  pathToCurrentFile() {
    return this._pathToFile;
  }

  /**
   * @return {Object}
   */
  toJSON() {
    return {
      messages: this._messages,
      fileContent: this.currentFileContent(),
      askForSelections: this._askForSelections,
    };
  }

  /**
   * @param {String} str
   */
  message(str) {
    this._messages.push(str);
  }

  /**
   * @return {String}
   */
  currentFileContent() {
    return this._lines.join('\n');
  }

  /**
   * Reads a line from the file.
   * Lines are one-indexed, so 1 means the first line in the file.
   * @param {Number} lineNumber
   * @return {String}
   */
  readLine(lineNumber) {
    return this._lines[lineNumber - 1];
  }

  /**
   * Delete a line.
   * @param {Number} lineNumber One-indexed line number.
   *   1 is the first line in the file.
   */
  deleteLine(lineNumber) {
    this._lines.splice(lineNumber - 1, 1);
  }

  /**
   * Append a line right after the specified line.
   * Lines are one-indexed, but you need to support appending to line 0 (add
   * content at top of file).
   * @param {Number} lineNumber
   * @param {String} str
   */
  appendLine(lineNumber, str) {
    this._lines.splice(lineNumber, 0, str);
  }

  /**
   * Count the number of lines in the file.
   * @return {Number} the number of lines in the file
   */
  countLines() {
    return this._lines.length;
  }

  /**
   * Ask the user to select something from a list of alternatives.
   *
   * @param {String} word The word/variable to import
   * @param {Array<String>} alternatives A list of alternatives
   * @return {?Number} the index of the selected alternative, or null if
   *   nothing was selected.
   */
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
