import {
  WEEK_START_WEEKDAY,
  weekStartDateKey,
  weekEndDateKey,
  weekRangeKeys,
  shiftWeekStartKey,
  isSameWeek,
  weekRangeLabel,
} from '../utils/weekRule.js';

/**
 * One week unit for the whole system: Saturday → Friday, the same one the
 * finance weeks are created with.
 */

describe('week boundaries', () => {
  it('starts on Saturday', () => {
    expect(WEEK_START_WEEKDAY).toBe(6);
    // 2026-10-03 is a Saturday.
    expect(new Date('2026-10-03T00:00:00Z').getUTCDay()).toBe(6);
    expect(weekStartDateKey('2026-10-03')).toBe('2026-10-03');
    expect(weekEndDateKey('2026-10-03')).toBe('2026-10-09');
  });

  it('keeps every day of a week on the same start', () => {
    const week = ['2026-10-03', '2026-10-04', '2026-10-06', '2026-10-09'];
    for (const day of week) {
      expect(weekStartDateKey(day)).toBe('2026-10-03');
    }
  });

  it('rolls to the next week on the following Saturday', () => {
    expect(weekStartDateKey('2026-10-10')).toBe('2026-10-10');
    expect(weekStartDateKey('2026-10-09')).toBe('2026-10-03');
  });

  it('does not use the calendar Monday week', () => {
    // Monday 2026-10-05 belongs to the week that began Saturday the 3rd.
    expect(new Date('2026-10-05T00:00:00Z').getUTCDay()).toBe(1);
    expect(weekStartDateKey('2026-10-05')).toBe('2026-10-03');
  });

  it('spans a month end without trouble', () => {
    expect(weekRangeKeys('2026-10-01')).toEqual({
      start: '2026-09-26',
      end: '2026-10-02',
      endExclusive: '2026-10-03',
    });
  });
});

describe('stepping and comparing', () => {
  it('steps a week at a time', () => {
    expect(shiftWeekStartKey('2026-10-03', 1)).toBe('2026-10-10');
    expect(shiftWeekStartKey('2026-10-03', -1)).toBe('2026-09-26');
  });

  it('tells whether two days share a week', () => {
    expect(isSameWeek('2026-10-03', '2026-10-09')).toBe(true);
    expect(isSameWeek('2026-10-09', '2026-10-10')).toBe(false);
  });
});

describe('labels', () => {
  it('reads as the days it covers', () => {
    expect(weekRangeLabel('2026-09-28')).toBe('Sep 26 – Oct 2');
  });
});
