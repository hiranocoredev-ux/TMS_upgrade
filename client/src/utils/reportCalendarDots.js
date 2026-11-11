import { REPORT_PERIODS, normalizeDateForPeriod } from './reportPeriod';

export function todayDateKey() {
  return new Date().toLocaleDateString('en-CA');
}

/** Meaningful body text (HTML stripped) in any section */
export function reportHasContent(item) {
  if (!item?.sections?.length) return false;
  const strip = (html) =>
    String(html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return item.sections.some((s) => strip(s?.notes || '').length > 0);
}

export function dateKeyFromReportItem(item) {
  if (!item?.date) return '';
  if (typeof item.date === 'string') return item.date.split('T')[0];
  try {
    return new Date(item.date).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/**
 * Member history: green dot on calendar days (≤ today) that have a report with content.
 */
export function buildMemberDots(stats, period, todayKey = todayDateKey()) {
  const dots = {};
  for (const item of stats || []) {
    let dk = dateKeyFromReportItem(item);
    if (!dk || dk > todayKey) continue;
    if (period !== REPORT_PERIODS.DAILY) {
      dk = normalizeDateForPeriod(dk, period);
      if (dk > todayKey) continue;
    }
    if (reportHasContent(item)) {
      dots[dk] = 'green';
    }
  }
  return dots;
}

/**
 * Team coverage: compare reporters with content vs roster size.
 * Green = all reported, yellow = some, red = none (when roster known).
 */
export function buildGroupCoverageDots(stats, period, memberUserIds, todayKey = todayDateKey()) {
  const roster = new Set((memberUserIds || []).map(String).filter(Boolean));
  const n = roster.size;
  const bucket = new Map();

  for (const item of stats || []) {
    let dk = dateKeyFromReportItem(item);
    if (!dk || dk > todayKey) continue;
    dk = normalizeDateForPeriod(dk, period);
    if (dk > todayKey) continue;
    const uid = String(item.userId ?? '');
    if (!uid || !reportHasContent(item)) continue;
    if (n > 0 && !roster.has(uid)) continue;
    if (!bucket.has(dk)) bucket.set(dk, new Set());
    bucket.get(dk).add(uid);
  }

  const dots = {};
  for (const [key, set] of bucket) {
    const c = set.size;
    if (n === 0) {
      dots[key] = c > 0 ? 'green' : '';
    } else if (c === 0) {
      dots[key] = 'red';
    } else if (c >= n) {
      dots[key] = 'green';
    } else {
      dots[key] = 'yellow';
    }
  }
  return { dots, rosterSize: n };
}

/** For calendar cells on/before today with no bucket entry: group shows red if roster > 0 */
export function resolveGroupCellDot(dots, periodKey, rosterSize, todayKey) {
  if (!periodKey || periodKey > todayKey) return '';
  const v = dots[periodKey];
  if (v === 'green' || v === 'yellow') return v;
  if (v === 'red') return 'red';
  return rosterSize > 0 ? 'red' : '';
}

function rosterUsersFromFetchPayload(res, { includeBoss = true } = {}) {
  const raw = res?.data?.users ?? res?.users ?? [];
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const u of list) {
    if (!u || u.status === 'disabled') continue;
    const role = u.role || '';
    if (role === 'SUPER_ADMIN' || role === 'SYSTEM_ADMIN' || role === 'FINANCE_MANAGER') continue;
    if (!includeBoss && role === 'GROUP_BOSS') continue;
    out.push(u);
  }
  return out;
}

/** Full user docs for team roster UIs (same rules as extractMemberIdsFromUsersResponse). */
export function extractTeamRosterUsersFromResponse(res, opts = {}) {
  return rosterUsersFromFetchPayload(res, opts);
}

/** Directory users often use `name`; reports use `username`  combine for sidebar labels. */
export function rosterMemberDisplayName(user, report = null) {
  const u = user || {};
  const parts = [u.name, u.username, u.email, report?.username];
  for (const p of parts) {
    if (p != null && String(p).trim() !== '') return String(p).trim();
  }
  return '-';
}

/** Extract active member user ids from fetchUsers-style payload */
export function extractMemberIdsFromUsersResponse(res, { includeBoss = true } = {}) {
  return rosterUsersFromFetchPayload(res, { includeBoss }).map((u) => String(u.id ?? u._id)).filter(Boolean);
}
