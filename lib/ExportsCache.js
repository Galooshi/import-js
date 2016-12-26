export default class ExportsCache {
  constructor() {
    this.exports = {};
  }

  add(name, pathToFile, isDefault) {
    let existing = this.exports[name];
    if (!existing) {
      existing = {};
      this.exports[name] = existing;
    }
    existing[pathToFile] = isDefault ? 'default' : name;
  }

  remove(pathToFile) {
    // TODO: implement
  }

  get(variableName) {
    return this.exports[variableName] || {};
  }
}
