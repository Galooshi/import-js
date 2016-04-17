'use strict';

class CommandLineEditor {
  /**
   * @param {Array<String>} lines
   */
  constructor(lines) {
    this._lines = lines;
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
}

module.exports = CommandLineEditor;
