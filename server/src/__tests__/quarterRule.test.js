import {
  MONTHS_PER_QUARTER,
  quarterStartMonthKey,
  quarterRangeKeys,
  quarterRangeLabel,
  quarterOfDateKey,
  quarterOfMonthKey,
  yearRangeKeys,
} from '../utils/monthRule.js';

/**
 * A quarter is three of this system's months, so it shifts with them:
 * Q3 runs 6 July → 5 October.
 */

describe('quarter boundaries', () => {
  it('is three months long', () => {
    expect(MONTHS_PER_QUARTER).toBe(3);
  });

  it('runs from the 6th to the 5th, a quarter apart', () => {
    expect(quarterRangeKeys(2026, 1)).toEqual({
      start: '2026-01-06',
      end: '2026-04-05',
      endExclusive: '2026-04-06',
    });
    expect(quarterRangeKeys(2026, 2)).toEqual({
      start: '2026-04-06',
      end: '2026-07-05',
      endExclusive: '2026-07-06',
    });
    expect(quarterRangeKeys(2026, 3)).toEqual({
      start: '2026-07-06',
      end: '2026-10-05',
      endExclusive: '2026-10-06',
    });
  });

  it('carries the fourth quarter into the next year', () => {
    expect(quarterRangeKeys(2026, 4)).toEqual({
      start: '2026-10-06',
      end: '2027-01-05',
      endExclusive: '2027-01-06',
    });
  });

  it('names the month each quarter starts in', () => {
    expect(quarterStartMonthKey(2026, 1)).toBe('2026-01');
    expect(quarterStartMonthKey(2026, 3)).toBe('2026-07');
    expect(quarterOfMonthKey('2026-07')).toBe(3);
    expect(quarterOfMonthKey('2026-10')).toBe(4);
  });
});

describe('which quarter a day falls in', () => {
  it('keeps the first days of October in the third quarter', () => {
    expect(quarterOfDateKey('2026-10-01')).toEqual({ year: 2026, quarter: 3 });
    expect(quarterOfDateKey('2026-10-05')).toEqual({ year: 2026, quarter: 3 });
  });

  it('starts the fourth quarter on 6 October', () => {
    expect(quarterOfDateKey('2026-10-06')).toEqual({ year: 2026, quarter: 4 });
  });

  it('counts early January as the year before', () => {
    expect(quarterOfDateKey('2027-01-03')).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOfDateKey('2027-01-06')).toEqual({ year: 2027, quarter: 1 });
  });
});

describe('the year', () => {
  it('runs 6 January to 5 January', () => {
    expect(yearRangeKeys(2026)).toEqual({
      start: '2026-01-06',
      end: '2027-01-05',
      endExclusive: '2027-01-06',
    });
  });
});

describe('labels', () => {
  it('reads as the days it covers', () => {
    expect(quarterRangeLabel(2026, 3)).toBe('Jul 6 – Oct 5');
    expect(quarterRangeLabel(2026, 4)).toBe('Oct 6 – Jan 5');
  });
});
