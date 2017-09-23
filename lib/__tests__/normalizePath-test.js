import normalizePath from '../normalizePath';

describe('normalizePath', () => {
  it('returns ./ if there is no path', () => {
    expect(normalizePath('', '/path/to/project')).toEqual('./');
  });

  it('relativizes paths to the working directory', () => {
    expect(normalizePath('/path/to/project/foo/bar.js', '/path/to/project')).toEqual('./foo/bar.js');
  });

  it('leaves . alone', () => {
    expect(normalizePath('.', '/path/to/project')).toEqual('.');
  });

  it('leaves paths starting with ./ alone', () => {
    expect(normalizePath('./hi/there.js', '/path/to/project')).toEqual('./hi/there.js');
  });

  it('relativizes paths not starting with a /', () => {
    expect(normalizePath('foo/bar.js', '/path/to/project')).toEqual('./foo/bar.js');
  });

  it('relativizes paths starting with a / to the working directory', () => {
    expect(normalizePath('/foo/bar.js', '/path/to/project')).toEqual('./foo/bar.js');
  });

  it('relativizes dot-files', () => {
    expect(normalizePath('.importjs.js', '/path/to/project')).toEqual('./.importjs.js');
  });
});
