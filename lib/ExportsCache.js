function normalizedExportName(string) {
  return string.toLowerCase().replace(/[-_]/g, '');
}

export default class ExportsCache {
  constructor() {
    this.exports = {};
  }

  add(name, pathToFile, isDefault) {
    const normalizedName = normalizedExportName(name);
    let existing = this.exports[normalizedName];
    if (!existing) {
      existing = {};
      this.exports[normalizedName] = existing;
    }
    existing[pathToFile] = isDefault ? 'default' : name;
  }

  remove(pathToFile) {
    // TODO: implement
  }

  get(variableName) {
    return this.exports[normalizedExportName(variableName)] || {};
  }
}
