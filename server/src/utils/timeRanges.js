/**
 * Time-of-day ranges for added time: "HH:MM" from 00:00 to 24:00 on one day.
 * The added time is the length of the range (end - start).
 */

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** Minutes since midnight for "HH:MM" (00:00 … 24:00), or null when invalid. */
export function parseTimeOfDay(value) {
  const m = TIME_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** "HH:MM" for minutes since midnight. */
export function formatTimeOfDay(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Checks one entry. Returns { ok: true, startMin, endMin, seconds, start, end }
 * or { ok: false, message }.
 */
export function validateTimeRange(start, end) {
  const startMin = parseTimeOfDay(start);
  const endMin = parseTimeOfDay(end);
  if (startMin === null || endMin === null) {
    return { ok: false, message: 'Start and end must be times between 00:00 and 24:00 (HH:MM)' };
  }
  if (startMin >= 24 * 60) {
    return { ok: false, message: 'Start must be before 24:00' };
  }
  if (endMin <= startMin) {
    return { ok: false, message: `End (${end}) must be after start (${start})` };
  }
  return {
    ok: true,
    startMin,
    endMin,
    seconds: (endMin - startMin) * 60,
    start: formatTimeOfDay(startMin),
    end: formatTimeOfDay(endMin),
  };
}

/** Whether two [startMin, endMin) ranges overlap (touching ends do not). */
export const rangesOverlap = (a, b) => a.startMin < b.endMin && b.startMin < a.endMin;

/**
 * The first overlapping pair in a list of validated ranges, or null.
 * Each item: { startMin, endMin, start, end }.
 */
export function findOverlap(ranges) {
  const sorted = [...ranges].sort((x, y) => x.startMin - y.startMin);
  for (let i = 1; i < sorted.length; i += 1) {
    if (rangesOverlap(sorted[i - 1], sorted[i])) return [sorted[i - 1], sorted[i]];
  }
  return null;
}
