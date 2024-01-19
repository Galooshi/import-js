import findAllFiles from '../findAllFiles';

it('uses relative paths', () =>
  findAllFiles(process.cwd(), []).then((files) => {
    expect(files[0].path).toMatch(/\.\//);
  }));

it('has mtimes', () =>
  findAllFiles(process.cwd(), []).then((files) => {
    expect(files[0].mtime).toBeGreaterThan(0);
  }));

it('excludes files', () =>
  findAllFiles(process.cwd(), ['./**/__test__/**']).then((files) => {
    expect(files.length).toBeGreaterThan(0);

    const testFiles = files
      .map(({ path }) => path)
      .filter((path) => /__test__/.test(path));
    expect(testFiles).toEqual([]);

    const libFiles = files
      .map(({ path }) => path)
      .filter((path) => /lib/.test(path));
    expect(libFiles.length).toBeGreaterThan(0);
  }));

it('excludes node_modules', () =>
  findAllFiles(process.cwd(), []).then((files) => {
    const nodeModules = files
      .map(({ path }) => path)
      .filter((path) => /node_modules/.test(path));
    expect(nodeModules).toEqual([]);
  }));
