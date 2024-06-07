//
export default class CommandLineEditor {
  _lines;

  constructor(lines) {
    this._lines = lines;
  }

  currentFileContent() {
    return this._lines.join('\n');
  }

  get(index) {
    return this._lines[index];
  }

  remove(index) {
    this._lines.splice(index, 1);
  }

  /**
   * Insert a line above the specified index
   */
  insertBefore(index, str) {
    this._lines.splice(index, 0, str);
  }
}
