/**
 * The Hubstaff organization ID changes every two weeks. Reminders are due on a
 * fixed two-week cycle starting Monday 2026-11-16 (EST): 11-16, 11-30, 12-14, …
 * From each due date the super admin / admins are asked to enter the new ID,
 * until someone updates it on or after that date.
 */
import { getESTDateKey } from '../utils/estTime.js';

export const ORG_ID_CYCLE_START = '2026-11-16';
export const ORG_ID_CYCLE_DAYS = 14;

const dayNumber = (dateKey) => Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
const dateKeyOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

/** The latest due date on or before `todayKey`, and the next one after it. */
export function orgIdDueDates(todayKey = getESTDateKey()) {
  const start = dayNumber(ORG_ID_CYCLE_START);
  const today = dayNumber(todayKey);
  if (today < start) {
    return { currentDue: null, nextDue: ORG_ID_CYCLE_START };
  }
  const cycles = Math.floor((today - start) / ORG_ID_CYCLE_DAYS);
  const current = start + cycles * ORG_ID_CYCLE_DAYS;
  return { currentDue: dateKeyOf(current), nextDue: dateKeyOf(current + ORG_ID_CYCLE_DAYS) };
}

/**
 * Whether the ID must be updated now: no ID yet, or it was last updated
 * before the current due date (dates compared in EST).
 */
export function orgIdNeedsUpdate(settings, todayKey = getESTDateKey()) {
  const id = String(settings?.organizationId || '').trim();
  const { currentDue } = orgIdDueDates(todayKey);
  if (!id) return true;
  if (!currentDue) return false;
  const updatedAt = settings?.organizationIdUpdatedAt;
  if (!updatedAt) return true;
  return getESTDateKey(new Date(updatedAt)) < currentDue;
}
