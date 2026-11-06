import { getESTDateKey } from './timezoneHelpers';

/**
 * A month in this system is not a calendar month: it runs from the 6th to the
 * 5th of the next month. "2026-09" means 6 Sep 2026 → 5 Oct 2026 inclusive,
 * and is named after the month it starts in.
 *
 * Mirrors server/src/utils/businessMonth.js — keep the two in step.
 */

export const MONTH_START_DAY = 6;

const pad2 = (n) => String(n).padStart(2, '0');

const parseMonthKey = (monthKey) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
};

const parseDateKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const addMonths = ({ year, month }, delta) => {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (((zero % 12) + 12) % 12) + 1 };
};

const keyOf = ({ year, month }) => `${year}-${pad2(month)}`;

/** The month a date belongs to: the 5th still belongs to the month before. */
export const monthKeyOfDateKey = (dateKey) => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return '';
  const base = { year: parsed.year, month: parsed.month };
  return keyOf(parsed.day >= MONTH_START_DAY ? base : addMonths(base, -1));
};

/**
 * The month of a monthly document's date.
 *
 * Monthly plans and reports are anchored on the 1st of the month they are
 * named for — and the 1st is never a working date under this rule, since it
 * belongs to the month before. So a date on the 1st is read as that month's
 * anchor and left alone; any other date is resolved by the 6th → 5th rule.
 */
export const monthKeyOfDocumentDateKey = (dateKey) => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return '';
  if (parsed.day === 1) return keyOf({ year: parsed.year, month: parsed.month });
  return monthKeyOfDateKey(dateKey);
};

export const monthStartDateKey = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? `${keyOf(parsed)}-${pad2(MONTH_START_DAY)}` : '';
};

export const monthEndDateKey = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? `${keyOf(addMonths(parsed, 1))}-${pad2(MONTH_START_DAY - 1)}` : '';
};

export const shiftMonthKey = (monthKey, delta = 1) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? keyOf(addMonths(parsed, delta)) : monthKey;
};

/** The day after a month ends, for half-open ranges. */
export const monthEndExclusiveDateKey = (monthKey) => monthStartDateKey(shiftMonthKey(monthKey, 1));

export const monthRangeKeys = (monthKey) => ({
  start: monthStartDateKey(monthKey),
  end: monthEndDateKey(monthKey),
  endExclusive: monthEndExclusiveDateKey(monthKey),
});

/** The month we are in right now. */
export const currentMonthKey = () => monthKeyOfDateKey(getESTDateKey());

/** "September 2026" */
export const monthLabel = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return String(monthKey || '');
  return new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** "Sep 6 – Oct 5", the days the month actually covers. */
export const monthRangeLabel = (monthKey) => {
  const keys = monthRangeKeys(monthKey);
  if (!keys.start) return '';
  const fmt = (key) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(keys.start)} – ${fmt(keys.end)}`;
};

/* ----------------------------- quarters ----------------------------- */

/** Three months to a quarter, counted the same way: Q3 is Jul 6 - Oct 5. */
export const MONTHS_PER_QUARTER = 3;

export const quarterStartMonthKey = (year, quarter) => {
  const q = Math.min(4, Math.max(1, Number(quarter) || 1));
  return keyOf({ year: Number(year), month: (q - 1) * MONTHS_PER_QUARTER + 1 });
};

/** Inclusive first and last day of a quarter, plus the exclusive end. */
export const quarterRangeKeys = (year, quarter) => {
  const startMonth = quarterStartMonthKey(year, quarter);
  const lastMonth = shiftMonthKey(startMonth, MONTHS_PER_QUARTER - 1);
  return {
    start: monthStartDateKey(startMonth),
    end: monthEndDateKey(lastMonth),
    endExclusive: monthEndExclusiveDateKey(lastMonth),
  };
};

/** The quarter a date falls in, as { year, quarter }. */
export const quarterOfDateKey = (dateKey) => {
  const monthKey = monthKeyOfDateKey(dateKey);
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  return { year: parsed.year, quarter: Math.ceil(parsed.month / MONTHS_PER_QUARTER) };
};

/** The quarter we are in right now. */
export const currentQuarter = () => quarterOfDateKey(getESTDateKey());

/** "Jul 6 - Oct 5", the days a quarter covers. */
export const quarterRangeLabel = (year, quarter) => {
  const { start, end } = quarterRangeKeys(year, quarter);
  if (!start) return '';
  const fmt = (key) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} - ${fmt(end)}`;
};
