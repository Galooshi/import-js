jest.autoMockOff();
jest.mock('fs');

describe('FileUtils', () => {
  function mockFile(file, contents) {
    beforeEach(() => {
      require('fs').__setFile(file, contents);
    });

    afterEach(() => {
      require('fs').__setFile(file, null);
    });
  }

  describe('.readJsonFile()', () => {
    it('returns null for files that do not exist', () => {
      const FileUtils = require('../lib/FileUtils');
      expect(FileUtils.readJsonFile('foo.json')).toEqual(null);
    });

    describe('for empty files', () => {
      mockFile('foo.json', '');

      it('returns null', () => {
        const FileUtils = require('../lib/FileUtils');
        expect(FileUtils.readJsonFile('foo.json')).toEqual(null);
      });
    });

    describe('for files with valid JSON', () => {
      mockFile('foo.json', '{"hi":"mom"}');

      it('returns parsed JSON', () => {
        const FileUtils = require('../lib/FileUtils');
        expect(FileUtils.readJsonFile('foo.json')).toEqual({ hi: 'mom' });
      });
    });
  });
});
