/**
 * The month rule, with no dependencies so every layer can build on it.
 *
 * A month runs from the 6th to the 5th of the next month: "2026-09" means
 * 6 Sep 2026 → 5 Oct 2026, and is named after the month it starts in.
 */

/** The day a month starts on. */
export const MONTH_START_DAY = 6;

const pad2 = (n) => String(n).padStart(2, '0');

export const parseMonthKey = (monthKey) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
};

export const parseDayKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

export const addMonths = ({ year, month }, delta) => {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (((zero % 12) + 12) % 12) + 1 };
};

export const monthKeyFrom = ({ year, month }) => `${year}-${pad2(month)}`;

/** The month a date belongs to: the 5th still belongs to the month before. */
export const monthKeyOfDateKey = (dateKey) => {
  const parsed = parseDayKey(dateKey);
  if (!parsed) return '';
  const base = { year: parsed.year, month: parsed.month };
  return monthKeyFrom(parsed.day >= MONTH_START_DAY ? base : addMonths(base, -1));
};

/**
 * The month of a monthly document's date.
 *
 * Monthly plans and reports are anchored on the 1st of the month they are
 * named for — and the 1st is never a working date under this rule, since it
 * belongs to the month before. So a date on the 1st is read as that month's
 * anchor and left alone; any other date is resolved by the 6th → 5th rule.
 * Without this, re-normalizing a saved document would walk it back a month
 * every time it was opened.
 */
export const monthKeyOfDocumentDateKey = (dateKey) => {
  const parsed = parseDayKey(dateKey);
  if (!parsed) return '';
  if (parsed.day === 1) return monthKeyFrom({ year: parsed.year, month: parsed.month });
  return monthKeyOfDateKey(dateKey);
};

/** First day of a month, as YYYY-MM-DD. */
export const monthStartDateKey = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? `${monthKeyFrom(parsed)}-${pad2(MONTH_START_DAY)}` : '';
};

/** Last day of a month (the 5th of the next one), as YYYY-MM-DD. */
export const monthEndDateKey = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? `${monthKeyFrom(addMonths(parsed, 1))}-${pad2(MONTH_START_DAY - 1)}` : '';
};

export const shiftMonthKey = (monthKey, delta = 1) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? monthKeyFrom(addMonths(parsed, delta)) : monthKey;
};

/** The day after a month ends, for half-open ranges. */
export const monthEndExclusiveDateKey = (monthKey) => monthStartDateKey(shiftMonthKey(monthKey, 1));

export const monthRangeKeys = (monthKey) => ({
  start: monthStartDateKey(monthKey),
  end: monthEndDateKey(monthKey),
  endExclusive: monthEndExclusiveDateKey(monthKey),
});

/** "September 2026" — a month is named after the month it starts in. */
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

export const isValidMonthKey = (monthKey) => parseMonthKey(monthKey) !== null;

/* ----------------------------- quarters ----------------------------- */

/** Three months to a quarter, counted the same way: Q3 is Jul 6 → Oct 5. */
export const MONTHS_PER_QUARTER = 3;

/** 1–4 for a month key, by the month the quarter starts in. */
export const quarterOfMonthKey = (monthKey) => {
  const parsed = parseMonthKey(monthKey);
  return parsed ? Math.ceil(parsed.month / MONTHS_PER_QUARTER) : 0;
};

/** The month a quarter starts in, e.g. Q3 → '2026-07'. */
export const quarterStartMonthKey = (year, quarter) => {
  const q = Math.min(4, Math.max(1, Number(quarter) || 1));
  return monthKeyFrom({ year: Number(year), month: (q - 1) * MONTHS_PER_QUARTER + 1 });
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

/** The year as the system counts it: Jan 6 through Jan 5 of the next year. */
export const yearRangeKeys = (year) => ({
  start: monthStartDateKey(monthKeyFrom({ year: Number(year), month: 1 })),
  end: monthEndDateKey(monthKeyFrom({ year: Number(year), month: 12 })),
  endExclusive: monthEndExclusiveDateKey(monthKeyFrom({ year: Number(year), month: 12 })),
});

/** The quarter a date falls in, as { year, quarter }. */
export const quarterOfDateKey = (dateKey) => {
  const monthKey = monthKeyOfDateKey(dateKey);
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  return { year: parsed.year, quarter: Math.ceil(parsed.month / MONTHS_PER_QUARTER) };
};

/** "Jul 6 – Oct 5", the days a quarter covers. */
export const quarterRangeLabel = (year, quarter) => {
  const { start, end } = quarterRangeKeys(year, quarter);
  if (!start) return '';
  const fmt = (key) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} – ${fmt(end)}`;
};
