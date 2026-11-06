import { getESTDateKey } from './estTime.js';
import { monthKeyOfDateKey, monthRangeKeys } from './monthRule.js';

/**
 * The month rule applied to the system's clock: a month runs from the 6th to
 * the 5th of the next month, measured on the EST calendar.
 *
 * The rule itself lives in utils/monthRule.js, which has no dependencies so
 * estTime can build on it too. Everything a caller needs is re-exported here.
 */

export {
  MONTH_START_DAY,
  monthKeyOfDateKey,
  monthKeyOfDocumentDateKey,
  monthStartDateKey,
  monthEndDateKey,
  monthEndExclusiveDateKey,
  monthRangeKeys,
  shiftMonthKey,
  monthLabel,
  monthRangeLabel,
  isValidMonthKey,
  // Quarters and years are counted the same way: Q3 is Jul 6 → Oct 5, and a
  // year runs Jan 6 → Jan 5.
  MONTHS_PER_QUARTER,
  quarterOfMonthKey,
  quarterStartMonthKey,
  quarterRangeKeys,
  quarterRangeLabel,
  quarterOfDateKey,
  yearRangeKeys,
} from './monthRule.js';

/** The month we are in right now (EST, the system's calendar). */
export const currentMonthKey = () => monthKeyOfDateKey(getESTDateKey());

/**
 * The month as instants, for querying date fields.
 *
 * Dates on records are day values stored at UTC midnight (`new Date('2026-09-06')`),
 * so the window runs from 00:00 UTC on the 6th to just before 00:00 UTC on the
 * next 6th. Converting through EST instead would shift both ends by the offset
 * and quietly drop the month's first day.
 */
export const monthRangeDates = (monthKey) => {
  const keys = monthRangeKeys(monthKey);
  if (!keys.start) return null;
  const start = new Date(`${keys.start}T00:00:00.000Z`);
  const endExclusive = new Date(`${keys.endExclusive}T00:00:00.000Z`);
  return { start, endExclusive, end: new Date(endExclusive.getTime() - 1) };
};
