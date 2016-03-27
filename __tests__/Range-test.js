'use strict';

jest.unmock('../lib/Range');

const Range = require('../lib/Range');

describe('Range', () => {
  let subject;
  let start;
  let end;

  beforeEach(() => {
    start = 2;
    end = 4;
    subject = () => new Range(start, end);
  });

  it('has a start', () => {
    expect(subject().start).toEqual(2);
  });

  it('has an end', () => {
    expect(subject().end).toEqual(4);
  });

  describe('.size()', () => {
    it('is inclusive of `end`', () => {
      expect(subject().size()).toEqual(3);
    });

    describe('when start and end are equal', () => {
      beforeEach(() => {
        start = 2;
        end = 2;
      });

      it('has a size of zero', () => {
        expect(subject().size()).toEqual(0);
      });
    });
  });

  describe('.includes()', () => {
    it('does not include numbers before the start', () => {
      expect(subject().includes(1)).toBe(false);
    });

    it('includes numbers at the start', () => {
      expect(subject().includes(2)).toBe(true);
    });

    it('includes numbers at the start', () => {
      expect(subject().includes(2)).toBe(true);
    });

    it('includes numbers in the middle', () => {
      expect(subject().includes(3)).toBe(true);
    });

    it('includes numbers at the end', () => {
      expect(subject().includes(4)).toBe(true);
    });

    it('does not include numbers after the end', () => {
      expect(subject().includes(5)).toBe(false);
    });
  });

  describe('.forEach()', () => {
    it('can be iterated over', () => {
      const numbers = [];
      subject().forEach((i) => numbers.push(i));
      expect(numbers).toEqual([2, 3, 4]);
    });

    describe('when start and end are equal', () => {
      beforeEach(() => {
        start = 2;
        end = 2;
      });

      it('does not iterate', () => {
        const numbers = [];
        subject().forEach((i) => numbers.push(i));
        expect(numbers).toEqual([]);
      });
    });
  });
});
