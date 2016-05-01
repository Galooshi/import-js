'use strict';

export default class CommandLineEditor {
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
   *
   * @param {Number} index
   * @return {String}
   */
  get(index) {
    return this._lines[index];
  }

  /**
   * Delete a line.
   *
   * @param {Number} index
   */
  remove(index) {
    this._lines.splice(index, 1);
  }

  /**
   * Insert a line above the specified index
   *
   * @param {Number} index
   * @param {String} str
   */
  insertBefore(index, str) {
    this._lines.splice(index, 0, str);
  }
}
