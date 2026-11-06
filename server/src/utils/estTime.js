import { weekStartDateKey } from './weekRule.js';
import {
  monthKeyOfDateKey,
  monthKeyOfDocumentDateKey,
  monthStartDateKey,
  shiftMonthKey,
} from './monthRule.js';

export const EST_TIMEZONE = 'America/New_York';

const EST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: EST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const EST_OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: EST_TIMEZONE,
  timeZoneName: 'shortOffset'
});

const parseOffsetMinutes = (offsetLabel) => {
  const match = String(offsetLabel || '').match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
};

const getOffsetMinutesAt = (date) => {
  const parts = EST_OFFSET_FORMATTER.formatToParts(date);
  const zonePart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-0';
  return parseOffsetMinutes(zonePart);
};

const getESTDatePartsFromDate = (value = new Date()) => {
  const parts = EST_DATE_FORMATTER.formatToParts(new Date(value));
  const year = Number(parts.find((p) => p.type === 'year')?.value || 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value || 0);
  const day = Number(parts.find((p) => p.type === 'day')?.value || 0);
  return { year, month, day };
};

const pad2 = (n) => String(n).padStart(2, '0');

const toDateKey = ({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`;

const parseDateKey = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
};

export const getESTDateKey = (value = new Date()) => toDateKey(getESTDatePartsFromDate(value));

export const shiftESTDateKey = (dateKey, deltaDays) => {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + Number(deltaDays || 0));
  return toDateKey({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
};

export const getESTMonthStartKey = (value = new Date()) => {
  // A month runs from the 6th to the 5th of the next month.
  return monthStartDateKey(monthKeyOfDateKey(getESTDateKey(value)));
};

export const shiftESTMonthStartKey = (monthStartKey, deltaMonths) => {
  const parts = parseDateKey(monthStartKey);
  if (!parts) return monthStartKey;
  // Months are counted from the 6th, so stepping one along lands on the next 6th.
  const monthKey = monthKeyOfDateKey(monthStartKey);
  return monthStartDateKey(shiftMonthKey(monthKey, Number(deltaMonths || 0)));
};

export const estDateKeyToUtcDate = (dateKey) => {
  const parts = parseDateKey(dateKey);
  if (!parts) return new Date(dateKey);

  let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = getOffsetMinutesAt(new Date(utcMs));
    const nextUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - (offsetMinutes * 60 * 1000);
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }
  return new Date(utcMs);
};

const toESTDateKeyFromInput = (value) => {
  const raw = String(value || '');
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  return getESTDateKey(new Date(value));
};

/** Plans may be submitted for any past period; only validate normalizable anchor. */
export const isAllowedPlanSubmitAnchorEST = (targetDateKey, period) => {
  try {
    const anchor = normalizeReportDateByPeriodEST(targetDateKey, period).toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(anchor);
  } catch {
    return false;
  }
};

export const normalizeReportDateByPeriodEST = (date, period) => {
  let dateKey = toESTDateKeyFromInput(date);

  if (period === 'weekly') {
    // Weeks run Saturday → Friday, the same unit the finance weeks use.
    dateKey = weekStartDateKey(dateKey);
  }

  if (period === 'monthly') {
    // Anchored on the 1st of the month it is named for. A real date before the
    // 6th belongs to the month before (a month runs 6th → 5th), while a date
    // already on the 1st is an anchor and stays where it is.
    dateKey = `${monthKeyOfDocumentDateKey(dateKey)}-01`;
  }

  return estDateKeyToUtcDate(dateKey);
};
