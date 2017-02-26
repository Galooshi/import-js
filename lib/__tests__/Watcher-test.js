import ExportsStorage from '../ExportsStorage';
import Watcher from '../Watcher';
import findAllFiles from '../findAllFiles';

jest.mock('../findAllFiles');

const testFile = {
  path: './foo/bar.js',
  mtime: 12345,
};

describe('polling', () => {
  let watcher;
  let onFilesAdded;
  let onFilesRemoved;
  let storage;

  beforeEach(() => {
    findAllFiles.mockImplementation(() => Promise.resolve([testFile]));
    onFilesAdded = jest.fn(() => Promise.resolve());
    onFilesRemoved = jest.fn(() => Promise.resolve());

    storage = new ExportsStorage();
    return storage.init(':memory:').then(() => {
      watcher = new Watcher({
        storage,
        onFilesAdded,
        onFilesRemoved,
      });
    });
  });

  it('adds new files', () => watcher.poll().then(() => {
    expect(onFilesAdded).toHaveBeenCalledWith([testFile]);
    expect(onFilesRemoved).toHaveBeenCalledWith([]);
  }));

  it('removes files that are dead', () => storage
    .update({
      names: [],
      defaultNames: ['bazgraz'],
      pathToFile: './bazgraz.js',
      mtime: 1,
    })
    .then(() => watcher.poll())
    .then(() => {
      expect(onFilesRemoved).toHaveBeenCalledWith([{ path: './bazgraz.js' }]);
    }));

  it('does not remove files inside node_modules', () => storage
    .update({
      names: [],
      defaultNames: ['bazgraz'],
      pathToFile: './node_modules/bazgraz/index.js',
      mtime: 1,
    })
    .then(() => watcher.poll())
    .then(() => {
      expect(onFilesRemoved).toHaveBeenCalledWith([]);
    }));
});
