import {
  MONTH_START_DAY,
  monthKeyOfDateKey,
  monthKeyOfDocumentDateKey,
  monthStartDateKey,
  monthEndDateKey,
  monthEndExclusiveDateKey,
  monthRangeKeys,
  monthRangeDates,
  shiftMonthKey,
  monthLabel,
  monthRangeLabel,
} from '../utils/businessMonth.js';

/**
 * A month runs from the 6th to the 5th of the next month, and is named after
 * the month it starts in.
 */

describe('month boundaries', () => {
  it('starts on the 6th and ends on the 5th of the next month', () => {
    expect(MONTH_START_DAY).toBe(6);
    expect(monthStartDateKey('2026-09')).toBe('2026-09-06');
    expect(monthEndDateKey('2026-09')).toBe('2026-10-05');
    expect(monthEndExclusiveDateKey('2026-09')).toBe('2026-10-06');
  });

  it('rolls the year over in December', () => {
    expect(monthEndDateKey('2026-12')).toBe('2027-01-05');
    expect(monthStartDateKey('2027-01')).toBe('2027-01-06');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2027-01', -1)).toBe('2026-12');
  });

  it('keeps February honest — the length comes from the rule, not the calendar', () => {
    expect(monthRangeKeys('2026-02')).toEqual({
      start: '2026-02-06',
      end: '2026-03-05',
      endExclusive: '2026-03-06',
    });
  });
});

describe('which month a day belongs to', () => {
  it('counts the 6th as the first day of its own month', () => {
    expect(monthKeyOfDateKey('2026-09-06')).toBe('2026-09');
  });

  it('counts the 5th as the last day of the month before', () => {
    expect(monthKeyOfDateKey('2026-10-05')).toBe('2026-09');
    expect(monthKeyOfDateKey('2026-10-06')).toBe('2026-10');
  });

  it('puts the first days of a calendar month in the previous one', () => {
    expect(monthKeyOfDateKey('2026-10-01')).toBe('2026-09');
    expect(monthKeyOfDateKey('2026-01-03')).toBe('2025-12');
  });

  it('ignores a malformed date', () => {
    expect(monthKeyOfDateKey('')).toBe('');
    expect(monthKeyOfDateKey('2026-13-01')).toBe('2026-12'); // month arithmetic still normalizes
  });
});

describe('a monthly document\'s own date', () => {
  it('leaves a saved anchor where it is', () => {
    // September's plan is anchored 2026-09-01 and must stay September, however
    // often it is opened and re-saved.
    expect(monthKeyOfDocumentDateKey('2026-09-01')).toBe('2026-09');
    expect(monthKeyOfDocumentDateKey('2026-10-01')).toBe('2026-10');
    expect(monthKeyOfDocumentDateKey('2026-01-01')).toBe('2026-01');
  });

  it('still resolves a real working date by the rule', () => {
    expect(monthKeyOfDocumentDateKey('2026-10-02')).toBe('2026-09');
    expect(monthKeyOfDocumentDateKey('2026-10-05')).toBe('2026-09');
    expect(monthKeyOfDocumentDateKey('2026-10-06')).toBe('2026-10');
    expect(monthKeyOfDocumentDateKey('2026-09-20')).toBe('2026-09');
  });

  it('is idempotent: normalizing twice does not walk the month back', () => {
    const once = monthKeyOfDocumentDateKey('2026-10-02');
    const anchor = `${once}-01`;
    expect(monthKeyOfDocumentDateKey(anchor)).toBe(once);
  });
});

describe('ranges as instants', () => {
  it('spans from the 6th to just before the next 6th', () => {
    const { start, endExclusive, end } = monthRangeDates('2026-09');
    expect(start.toISOString()).toBe('2026-09-06T00:00:00.000Z');
    expect(endExclusive.toISOString()).toBe('2026-10-06T00:00:00.000Z');
    expect(end.getTime()).toBe(endExclusive.getTime() - 1);
  });

  it('counts a record stored on the first day of the month', () => {
    // Day values are stored at UTC midnight; the window must not start later,
    // or the whole of the 6th drops out of the month.
    const { start, endExclusive } = monthRangeDates('2026-09');
    const onTheSixth = new Date('2026-09-06');
    expect(onTheSixth >= start && onTheSixth < endExclusive).toBe(true);

    const nextMonthsSixth = new Date('2026-10-06');
    expect(nextMonthsSixth >= start && nextMonthsSixth < endExclusive).toBe(false);
  });

  it('leaves a transaction on the 5th in the earlier month', () => {
    const september = monthRangeDates('2026-09');
    const october = monthRangeDates('2026-10');
    const onTheFifth = new Date('2026-10-05T12:00:00.000Z');

    expect(onTheFifth >= september.start && onTheFifth < september.endExclusive).toBe(true);
    expect(onTheFifth >= october.start).toBe(false);
  });
});

describe('labels', () => {
  it('names a month after the month it starts in', () => {
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(monthRangeLabel('2026-09')).toBe('Sep 6 – Oct 5');
    expect(monthRangeLabel('2026-12')).toBe('Dec 6 – Jan 5');
  });
});
