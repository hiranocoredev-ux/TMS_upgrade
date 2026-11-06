/**
 * The week rule, with no dependencies so every layer can build on it.
 *
 * A week in this system runs Saturday → Friday, the same unit the finance
 * weeks are created with. Nothing anywhere should fall back to the calendar's
 * Monday-start week: that second definition is what put reports and finance a
 * few days out of step with each other.
 *
 * Where a FinancePeriod exists for a date, that record is the week (it carries
 * the name and any hand-adjusted range); this module gives the same answer
 * arithmetically for dates no period covers yet.
 */

/** 6 = Saturday, in JS weekday numbering (0 Sun … 6 Sat). */
export const WEEK_START_WEEKDAY = 6;

const pad2 = (n) => String(n).padStart(2, '0');

const parseDayKey = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const toUtc = ({ year, month, day }) => new Date(Date.UTC(year, month - 1, day));

const keyOf = (date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

export const addDaysToDateKey = (dateKey, days) => {
  const parsed = parseDayKey(dateKey);
  if (!parsed) return '';
  const date = toUtc(parsed);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return keyOf(date);
};

/** The Saturday that starts the week a date falls in. */
export const weekStartDateKey = (dateKey) => {
  const parsed = parseDayKey(dateKey);
  if (!parsed) return '';
  const date = toUtc(parsed);
  // Days since the most recent Saturday.
  const back = (date.getUTCDay() - WEEK_START_WEEKDAY + 7) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return keyOf(date);
};

/** The Friday that ends the week a date falls in. */
export const weekEndDateKey = (dateKey) => addDaysToDateKey(weekStartDateKey(dateKey), 6);

export const weekRangeKeys = (dateKey) => {
  const start = weekStartDateKey(dateKey);
  if (!start) return { start: '', end: '', endExclusive: '' };
  return {
    start,
    end: addDaysToDateKey(start, 6),
    endExclusive: addDaysToDateKey(start, 7),
  };
};

export const shiftWeekStartKey = (weekStartKey, deltaWeeks = 1) =>
  addDaysToDateKey(weekStartKey, Number(deltaWeeks || 0) * 7);

/** True when two dates sit in the same Saturday → Friday week. */
export const isSameWeek = (a, b) => !!weekStartDateKey(a) && weekStartDateKey(a) === weekStartDateKey(b);

/** "Sep 26 – Oct 2", the days a week covers. */
export const weekRangeLabel = (dateKey) => {
  const { start, end } = weekRangeKeys(dateKey);
  if (!start) return '';
  const fmt = (key) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return `${fmt(start)} – ${fmt(end)}`;
};
