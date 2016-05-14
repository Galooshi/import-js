// @flow
export default class CommandLineEditor {
  _lines: Array<string>;

  constructor(lines: Array<string>) {
    this._lines = lines;
  }

  currentFileContent(): string {
    return this._lines.join('\n');
  }

  get(index: number): string {
    return this._lines[index];
  }

  remove(index: number) {
    this._lines.splice(index, 1);
  }

  /**
   * Insert a line above the specified index
   */
  insertBefore(index: number, str: string) {
    this._lines.splice(index, 0, str);
  }
}
