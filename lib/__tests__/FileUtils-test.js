jest.mock('fs');

import fs from 'fs';

import FileUtils from '../FileUtils';

describe('FileUtils', () => {
  afterEach(() => {
    fs.__reset();
  });

  describe('.readJsonFile()', () => {
    it('returns null for files that do not exist', () => {
      expect(FileUtils.readJsonFile('foo.json')).toEqual(null);
    });

    describe('for empty files', () => {
      beforeEach(() => {
        fs.__setFile('foo.json', '');
      });

      it('returns null', () => {
        expect(FileUtils.readJsonFile('foo.json')).toEqual(null);
      });
    });

    describe('for files with valid JSON', () => {
      beforeEach(() => {
        fs.__setFile('foo.json', '{"hi":"mom"}');
      });

      it('returns parsed JSON', () => {
        expect(FileUtils.readJsonFile('foo.json')).toEqual({ hi: 'mom' });
      });
    });
  });
});
