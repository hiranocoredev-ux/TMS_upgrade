import { monthKeyOfDocumentDateKey, monthRangeLabel } from './businessMonth';
import { weekStartDateKey } from './weekRule';
import { buildPlanTicketsReadView } from './planTickets.js';
import { buildReportTicketsReadView } from './reportTickets.js';

export const REPORT_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

export function getReportPeriod(metaPeriod) {
  if (metaPeriod === REPORT_PERIODS.WEEKLY || metaPeriod === REPORT_PERIODS.MONTHLY) {
    return metaPeriod;
  }
  return REPORT_PERIODS.DAILY;
}

export function normalizeDateForPeriod(dateStr, period) {
  const d = new Date(`${dateStr}T00:00:00`);

  if (period === REPORT_PERIODS.WEEKLY) {
    // Weeks run Saturday → Friday, the same unit the finance weeks use.
    const [wy, wm, wd] = weekStartDateKey(dateStr).split('-').map(Number);
    d.setFullYear(wy, wm - 1, wd);
  } else if (period === REPORT_PERIODS.MONTHLY) {
    // A month runs from the 6th to the 5th, so a real date before the 6th
    // belongs to the month before. A date already on the 1st is a document
    // anchor and names its own month, so it stays put.
    const [y, m] = monthKeyOfDocumentDateKey(dateStr).split('-').map(Number);
    d.setFullYear(y, m - 1, 1);
  }

  return d.toLocaleDateString('en-CA');
}

export function shiftPeriodDate(dateStr, delta, period) {
  const d = new Date(`${dateStr}T00:00:00`);

  if (period === REPORT_PERIODS.WEEKLY) {
    d.setDate(d.getDate() + (delta * 7));
  } else if (period === REPORT_PERIODS.MONTHLY) {
    d.setMonth(d.getMonth() + delta);
  } else {
    d.setDate(d.getDate() + delta);
  }

  return d.toLocaleDateString('en-CA');
}

export function getPeriodTitle(period) {
  if (period === REPORT_PERIODS.WEEKLY) return 'Weekly';
  if (period === REPORT_PERIODS.MONTHLY) return 'Monthly';
  return 'Daily';
}

/**
 * Plan submit composer anchors (EST): next period first, then current.
 * Daily: tomorrow + today; weekly: next week + this week; monthly: next month + this month.
 */
export function getPlanComposerAnchorOptions(todayKey) {
  const today = String(todayKey || '').split('T')[0] || new Date().toLocaleDateString('en-CA');
  const weekCurrent = normalizeDateForPeriod(today, REPORT_PERIODS.WEEKLY);
  const monthCurrent = normalizeDateForPeriod(today, REPORT_PERIODS.MONTHLY);
  return {
    daily: {
      next: addCalendarDaysDateKey(today, 1),
      current: today
    },
    weekly: {
      next: shiftPeriodDate(weekCurrent, 1, REPORT_PERIODS.WEEKLY),
      current: weekCurrent
    },
    monthly: {
      next: shiftPeriodDate(monthCurrent, 1, REPORT_PERIODS.MONTHLY),
      current: monthCurrent
    }
  };
}

/** Report submit composer anchors (EST): current period + previous. */
export function getReportComposerAnchorOptions(todayKey) {
  const today = String(todayKey || '').split('T')[0] || new Date().toLocaleDateString('en-CA');
  const weekCurrent = normalizeDateForPeriod(today, REPORT_PERIODS.WEEKLY);
  const monthCurrent = normalizeDateForPeriod(today, REPORT_PERIODS.MONTHLY);
  return {
    daily: {
      current: today,
      previous: addCalendarDaysDateKey(today, -1)
    },
    weekly: {
      current: weekCurrent,
      previous: shiftPeriodDate(weekCurrent, -1, REPORT_PERIODS.WEEKLY)
    },
    monthly: {
      current: monthCurrent,
      previous: shiftPeriodDate(monthCurrent, -1, REPORT_PERIODS.MONTHLY)
    }
  };
}

/** How far ahead plan pickers may go (past dates are unrestricted). */
const PLAN_PICKER_MAX_DAILY_DAYS = 90;
const PLAN_PICKER_MAX_WEEKLY_OFFSET = 12;
const PLAN_PICKER_MAX_MONTHLY_OFFSET = 12;

/** Max en-CA keys for native plan pickers (no min — any past period is allowed). */
export function getPlanComposerPickerBounds(todayKey) {
  const opts = getPlanComposerAnchorOptions(todayKey);
  return {
    daily: {
      max: addCalendarDaysDateKey(opts.daily.current, PLAN_PICKER_MAX_DAILY_DAYS)
    },
    weekly: {
      max: shiftPeriodDate(opts.weekly.current, PLAN_PICKER_MAX_WEEKLY_OFFSET, REPORT_PERIODS.WEEKLY)
    },
    monthly: {
      max: shiftPeriodDate(opts.monthly.current, PLAN_PICKER_MAX_MONTHLY_OFFSET, REPORT_PERIODS.MONTHLY)
    }
  };
}

/** Plans may be submitted for any past (or future within picker max) anchor. */
export function isAllowedPlanComposerAnchor(anchorDateStr, period) {
  const anchor = normalizeDateForPeriod(anchorDateStr, period);
  return /^\d{4}-\d{2}-\d{2}$/.test(anchor);
}

/**
 * Max en-CA keys for native report pickers: any past period is allowed, only the
 * future is blocked, so max is the current period anchor (no min).
 */
export function getReportComposerPickerBounds(todayKey) {
  const opts = getReportComposerAnchorOptions(todayKey);
  return {
    daily: { max: opts.daily.current },
    weekly: { max: opts.weekly.current },
    monthly: { max: opts.monthly.current }
  };
}

/** Reports may be submitted for any past or current period; future periods are blocked. */
export function isAllowedReportComposerAnchor(anchorDateStr, period, todayKey) {
  const anchor = normalizeDateForPeriod(anchorDateStr, period);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return false;
  const opts = getReportComposerAnchorOptions(todayKey);
  if (period === REPORT_PERIODS.WEEKLY) {
    return anchor <= opts.weekly.current;
  }
  if (period === REPORT_PERIODS.MONTHLY) {
    return anchor <= opts.monthly.current;
  }
  return anchor <= opts.daily.current;
}

/**
 * English ordinal suffix for day-of-month (1st, 2nd, 3rd, 4th, …).
 * Kept for any UI that still needs ordinals; report titles use a unified long-date style.
 */
export function ordinalSuffix(day) {
  const n = Number(day);
  if (!Number.isFinite(n) || n < 1) return 'th';
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

const TITLE_SEP = ' \u2014 '; // em dash

const parseYmdUtc = (dateStr) => {
  const raw = String(dateStr || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const fmtMdY = (d) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(d);

const fmtMy = (d) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(d);

const fmtMonthLong = (d) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(d);

/** Week range for a Saturday-start week (inclusive Sat–Fri), e.g. "May 2–8, 2026". */
const fmtWeekRangeUtc = (weekStartUtc) => {
  const end = new Date(weekStartUtc);
  end.setUTCDate(end.getUTCDate() + 6);
  const y1 = weekStartUtc.getUTCFullYear();
  const y2 = end.getUTCFullYear();
  const m1 = weekStartUtc.getUTCMonth();
  const m2 = end.getUTCMonth();
  const d1 = weekStartUtc.getUTCDate();
  const d2 = end.getUTCDate();
  if (y1 === y2 && m1 === m2) {
    return `${fmtMonthLong(weekStartUtc)} ${d1}\u2013${d2}, ${y1}`;
  }
  return `${fmtMdY(weekStartUtc)} \u2013 ${fmtMdY(end)}`;
};

const weekOrdinalWord = (n) =>
  ({ 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth' }[n] || `${n}th`);

/** e.g. "May First Week" using Wednesday benchmark for month ownership. */
const fmtWeekNameUtc = (weekStartUtc) => {
  const benchmark = new Date(weekStartUtc);
  benchmark.setUTCDate(weekStartUtc.getUTCDate() + 2); // Wednesday
  const month = fmtMonthLong(benchmark);
  const ord = Math.floor((benchmark.getUTCDate() - 1) / 7) + 1;
  return `${month} ${weekOrdinalWord(ord)} Week`;
};

/**
 * Title for report header. Weekly includes a `range` string for a smaller "(…)" line.
 * @param {string} dateStr - YYYY-MM-DD (weekly: Monday of that week)
 * @param {string} period - 'daily' | 'weekly' | 'monthly'
 * @returns {{ primary: string, range?: string }}
 */
export function getReportDocumentTitleParts(dateStr, period) {
  const d = parseYmdUtc(dateStr);
  if (!d) return { primary: 'Report' };

  if (period === REPORT_PERIODS.MONTHLY) {
    // A month runs the 6th to the 5th, so the title says which days it covers.
    const monthKey = monthKeyOfDocumentDateKey(String(dateStr).slice(0, 10));
    return {
      primary: `Monthly Report${TITLE_SEP}${fmtMy(d)}`,
      range: monthRangeLabel(monthKey)
    };
  }
  if (period === REPORT_PERIODS.WEEKLY) {
    // Documents written before weeks ran Saturday to Friday sit on a Monday;
    // they still belong to — and read as — the week around them.
    const weekStart = parseYmdUtc(weekStartDateKey(String(dateStr).slice(0, 10))) || d;
    return {
      primary: `Weekly Report${TITLE_SEP}${fmtWeekNameUtc(weekStart)}`,
      range: fmtWeekRangeUtc(weekStart)
    };
  }
  return { primary: `Daily Report${TITLE_SEP}${fmtMdY(d)}` };
}

/**
 * Plain single-line title (e.g. tooltips / fallbacks). Weekly includes range in parentheses.
 * @param {string} dateStr - YYYY-MM-DD (weekly: the Saturday that starts the week)
 * @param {string} period - 'daily' | 'weekly' | 'monthly'
 */
export function formatReportDocumentTitle(dateStr, period) {
  const { primary, range } = getReportDocumentTitleParts(dateStr, period);
  if (range) return `${primary} (${range})`;
  return primary;
}

/**
 * `<input type="week">` value (`YYYY-Www`, ISO week-year / week) → Monday of that week (local), en-CA `YYYY-MM-DD`.
 */
export function mondayDateKeyFromHtmlWeekValue(htmlWeek) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(htmlWeek || '').trim());
  if (!m) return '';
  const weekYear = Number(m[1]);
  const weekNum = Number(m[2]);
  if (!Number.isFinite(weekYear) || !Number.isFinite(weekNum) || weekNum < 1 || weekNum > 53) return '';
  const fourthJan = new Date(weekYear, 0, 4, 12, 0, 0);
  const dow = fourthJan.getDay() || 7;
  const week1Monday = new Date(fourthJan);
  week1Monday.setDate(fourthJan.getDate() - (dow - 1));
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (weekNum - 1) * 7);
  return monday.toLocaleDateString('en-CA');
}

/**
 * Monday en-CA `YYYY-MM-DD` → `<input type="week">` value `YYYY-Www` (ISO week-year / week number).
 */
export function htmlWeekValueFromMondayDateKey(mondayEnCa) {
  const raw = String(mondayEnCa || '').split('T')[0];
  const pm = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!pm) return '';
  const monday = new Date(Number(pm[1]), Number(pm[2]) - 1, Number(pm[3]), 12, 0, 0);
  if (Number.isNaN(monday.getTime())) return '';
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4, 12, 0, 0);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = 1 + Math.round((monday - week1Monday) / 604800000);
  if (!Number.isFinite(weekNum) || weekNum < 1 || weekNum > 53) return '';
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

/** Calendar day shift for `YYYY-MM-DD` strings (en-CA), using local noon to reduce DST edge issues. */
export function addCalendarDaysDateKey(dateStr, deltaDays) {
  const raw = String(dateStr || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  d.setDate(d.getDate() + Number(deltaDays));
  return d.toLocaleDateString('en-CA');
}

/** e.g. "Sun, May 17, 2026" — compact subtitle for composer section headers. */
export function formatDateSubtitleFromKey(dateStr) {
  const raw = String(dateStr || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(d);
}

/** e.g. "Monday, May 4, 2026" */
export function formatDateLongEnUSFromKey(dateStr) {
  const raw = String(dateStr || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(d);
}

/** e.g. "May 5 2026 Tuesday" */
function formatDateWithWeekdayNoCommaFromKey(dateStr) {
  const raw = String(dateStr || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    weekday: 'long'
  }).formatToParts(d);
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  return `${month} ${day} ${year} ${weekday}`.trim();
}

/**
 * Fixed daily section heading (anchorDateKey is the calendar day that belongs in the label).
 * @param {'today_plan_recorded'|'today_work'|'tomorrow_plan'} variant
 */
export function formatDailySectionTitle(anchorDateKey, variant) {
  const pretty = formatDateWithWeekdayNoCommaFromKey(anchorDateKey);
  if (variant === 'today_plan_recorded') {
    return `Plan (${pretty})`;
  }
  if (variant === 'today_work') {
    return `Work Result (${pretty})`;
  }
  if (variant === 'tomorrow_plan') {
    return `Plan (${pretty})`;
  }
  return pretty;
}

/** Week range label (Sat–Fri) from a week-start `YYYY-MM-DD`, e.g. "May 2–8, 2026". */
export function formatWeekRangeLabelFromWeekStartKey(weekStartYmd) {
  const d = parseYmdUtc(weekStartYmd);
  if (!d) return String(weekStartYmd || '');
  return fmtWeekRangeUtc(d);
}

function formatWeekRangeShortFromWeekStartKey(weekStartYmd) {
  const d = parseYmdUtc(weekStartYmd);
  if (!d) return String(weekStartYmd || '');
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 6);
  const s = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const e = `${end.getUTCMonth() + 1}/${end.getUTCDate()}`;
  return `${s}-${e}`;
}

function weekOrdinalByWednesday(weekStartYmd) {
  const d = parseYmdUtc(weekStartYmd);
  if (!d) return 1;
  const wed = new Date(d);
  wed.setUTCDate(d.getUTCDate() + 2);
  return Math.floor((wed.getUTCDate() - 1) / 7) + 1;
}

function weekMonthNameByWednesday(weekStartYmd) {
  const d = parseYmdUtc(weekStartYmd);
  if (!d) return '';
  const wed = new Date(d);
  wed.setUTCDate(d.getUTCDate() + 2);
  return fmtMonthLong(wed);
}

function ordinalWord(n) {
  return ({ 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth' }[n] || `${n}th`);
}

function formatWeekNameAndRange(weekStartYmd) {
  const monthName = weekMonthNameByWednesday(weekStartYmd);
  const ord = ordinalWord(weekOrdinalByWednesday(weekStartYmd));
  const range = formatWeekRangeShortFromWeekStartKey(weekStartYmd);
  return `${monthName} ${ord} Week - ${range}`.trim();
}

/**
 * Fixed weekly section headings (three-block flow, same idea as daily).
 * @param {'carry_plan'|'week_work'|'next_plan'} variant
 * @param {{ lastWeekMonday: string, thisWeekMonday: string, nextWeekMonday: string }} ctx - en-CA `YYYY-MM-DD` week-start Mondays
 */
export function formatWeeklySectionTitle(variant, ctx) {
  const thisWeek = formatWeekNameAndRange(ctx.thisWeekMonday);
  const nextWeek = formatWeekNameAndRange(ctx.nextWeekMonday);
  if (variant === 'carry_plan') {
    return `Plan (${thisWeek})`;
  }
  if (variant === 'week_work') {
    return `Work Result (${thisWeek})`;
  }
  if (variant === 'next_plan') {
    return `Plan (${nextWeek})`;
  }
  return '';
}

/** Saved report still uses legacy [carry, work, plan, …] (work result at index 1). */
export function isLegacyThreeBlockReportSections(sections) {
  if (!Array.isArray(sections) || sections.length < 3) return false;
  return /work\s+result/i.test(String(sections[1]?.title || ''));
}

/**
 * "Tomorrow's plan" body from a saved daily report (carry-forward source for the next day).
 */
export function getCarryForwardPlanNotesFromDailyReport(dayReport) {
  if (!dayReport?.sections?.length) return '';
  const sections = dayReport.sections;
  const named = sections.find((s) =>
    /(?:tomorrow'?s?\s+plan|plan\s+for\s+[a-z]+,\s+[a-z]+\s+\d{1,2},\s+\d{4})/i.test(String(s.title || ''))
  );
  if (named && named.notes != null) return String(named.notes);
  if (isLegacyThreeBlockReportSections(sections)) {
    return String(sections[2]?.notes ?? '');
  }
  return String(sections[1]?.notes ?? sections[2]?.notes ?? '');
}

/**
 * Third weekly block ("Next week's plan") from a saved week - becomes the next week's first section body.
 */
export function getNextWeekPlanNotesFromWeeklyReport(weekReport) {
  if (!weekReport?.sections?.length) return '';
  const sections = weekReport.sections;
  const named = sections.find((s) =>
    /(?:next\s+week'?s?\s+plan|plan\s+for\s+week)/i.test(String(s.title || ''))
  );
  if (named && named.notes != null) return String(named.notes);
  if (isLegacyThreeBlockReportSections(sections)) {
    return String(sections[2]?.notes ?? '');
  }
  return String(sections[1]?.notes ?? sections[2]?.notes ?? '');
}

/** First day of month `YYYY-MM-01`, shifted by whole months (local calendar). */
export function addCalendarMonthsDateKey(monthStartYmd, deltaMonths) {
  const raw = String(monthStartYmd || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = new Date(y, mo - 1 + Number(deltaMonths), 1);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-CA');
}

/** e.g. "May 2026" */
export function formatMonthYearEnUSFromKey(dateKey) {
  const raw = String(dateKey || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(d);
}

/**
 * Fixed monthly section headings (carry-forward from prior month's "Next month's plan").
 * @param {'carry_plan'|'month_work'|'next_plan'} variant
 * @param {{ lastMonthFirst: string, thisMonthFirst: string, nextMonthFirst: string }} ctx - en-CA `YYYY-MM-01` month anchors
 */
export function formatMonthlySectionTitle(variant, ctx) {
  const thisMY = formatMonthYearEnUSFromKey(ctx.thisMonthFirst);
  const nextMY = formatMonthYearEnUSFromKey(ctx.nextMonthFirst);
  if (variant === 'carry_plan') {
    return `Plan (${thisMY})`;
  }
  if (variant === 'month_work') {
    return `Work Result (${thisMY})`;
  }
  if (variant === 'next_plan') {
    return `Plan (${nextMY})`;
  }
  return '';
}

/**
 * Third monthly block ("Next month's plan") - becomes the following month's first section body.
 */
export function getNextMonthPlanNotesFromMonthlyReport(monthReport) {
  if (!monthReport?.sections?.length) return '';
  const sections = monthReport.sections;
  const named = sections.find((s) =>
    /(?:next\s+month'?s?\s+plan|plan\s+for\s+[a-z]+\s+\d{4})/i.test(String(s.title || ''))
  );
  if (named && named.notes != null) return String(named.notes);
  if (isLegacyThreeBlockReportSections(sections)) {
    return String(sections[2]?.notes ?? '');
  }
  return String(sections[1]?.notes ?? sections[2]?.notes ?? '');
}

/** Indices for work result / plan / extras inside a saved fixed-layout report. */
function fixedLayoutSavedIndices(sections) {
  const legacy = isLegacyThreeBlockReportSections(sections);
  return {
    work: legacy ? 1 : 0,
    plan: legacy ? 2 : 1,
    extrasFrom: legacy ? 3 : 2
  };
}

function notesOrEmpty(sec) {
  return sec?.notes != null ? String(sec.notes) : '';
}

/** Work result body: saved content, or prior period plan when still empty. */
function workResultNotesWithCarryForward(savedSections, carried) {
  const { work } = fixedLayoutSavedIndices(savedSections);
  const saved = notesOrEmpty(savedSections[work]).trim();
  if (saved) return notesOrEmpty(savedSections[work]);
  return carried != null ? String(carried) : '';
}

/** e.g. "May 17's Report" */
function formatPossessiveDayLabel(dateKey, noun) {
  const raw = String(dateKey || '').split('T')[0];
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return noun;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return noun;
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d);
  return `${month} ${d.getDate()}'s ${noun}`;
}

/** e.g. "May 4–10's Report" from a Monday week-start key. */
function formatPossessiveWeekLabel(weekStartYmd, noun) {
  const range = formatWeekRangeLabelFromWeekStartKey(weekStartYmd);
  const short = range.replace(/, \d{4}$/, '').trim();
  return short ? `${short}'s ${noun}` : noun;
}

/** e.g. "May 2026's Report" */
function formatPossessiveMonthLabel(monthStartYmd, noun) {
  const my = formatMonthYearEnUSFromKey(monthStartYmd);
  return my ? `${my}'s ${noun}` : noun;
}

/** Page heading for submit composer (period only; dates live in section titles). */
export function getReportComposerPageTitle(period) {
  return `${getPeriodTitle(period)} Report`;
}

/** Page heading when reports and plans are separate documents. */
export function getKindComposerPageTitle(period, kind) {
  const pt = getPeriodTitle(period);
  const k = String(kind || '').toLowerCase();
  return k === 'plan' ? `${pt} Plan` : `${pt} Report`;
}

/** Composer label for a single-kind document (work result OR plan for the anchor period). */
export function getKindSectionDisplay(period, kind, anchorDateStr) {
  const normalized = normalizeDateForPeriod(anchorDateStr, period);
  const isPlan = String(kind || '').toLowerCase() === 'plan';

  if (isPlan) {
    if (period === REPORT_PERIODS.WEEKLY) {
      return {
        label: formatPossessiveWeekLabel(normalized, 'Plan'),
        subtitle: '',
        hint: 'Outline priorities and commitments for this week.'
      };
    }
    if (period === REPORT_PERIODS.MONTHLY) {
      return {
        label: formatPossessiveMonthLabel(normalized, 'Plan'),
        subtitle: '',
        hint: 'Set direction and intentions for this month.'
      };
    }
    return {
      label: formatPossessiveDayLabel(normalized, 'Plan'),
      subtitle: '',
      hint: 'Describe what you plan to work on for this day.'
    };
  }

  return getFixedSectionDisplay(period, 'work', anchorDateStr);
}

function planNotesForAnchor(planDocs, anchorDateStr, period) {
  const anchor = normalizeDateForPeriod(anchorDateStr, period);
  const list = Array.isArray(planDocs) ? planDocs : [];
  const doc = list.find((r) => {
    if (Number(r.state ?? 0) < 1) return false;
    const raw = typeof r.date === 'string' ? r.date.split('T')[0] : '';
    if (!raw) return false;
    return normalizeDateForPeriod(raw, period) === anchor;
  });
  if (!doc?.sections?.length) return '';
  const { work, plan } = fixedLayoutSavedIndices(doc.sections);
  return notesOrEmpty(doc.sections[plan] ?? doc.sections[work] ?? doc.sections[0]);
}

/**
 * Single-section layout: report = work result (+ extras); plan = plan for anchor (+ extras).
 * `planDocs` is used to pre-fill empty work from the submitted plan for the same anchor.
 */
export function rebuildKindSections(doc, planDocs, period, anchorDateStr, kind) {
  const normalizedDate = normalizeDateForPeriod(anchorDateStr, period);
  const s = doc?.sections || [];
  const { work, plan, extrasFrom } = fixedLayoutSavedIndices(s);
  const isPlan = String(kind || '').toLowerCase() === 'plan';
  const extras =
    s.length > extrasFrom
      ? s.slice(extrasFrom).map((sec) => ({
          title: sec.title != null ? String(sec.title) : 'New Section',
          notes: sec.notes != null ? String(sec.notes) : ''
        }))
      : [];
  const display = getKindSectionDisplay(period, kind, normalizedDate);

  if (isPlan) {
    const notes = notesOrEmpty(s[plan] ?? s[work] ?? s[0]);
    return [{ title: display.label, notes }, ...extras];
  }

  const carried = planNotesForAnchor(planDocs, normalizedDate, period);
  return [
    {
      title: display.label,
      notes: workResultNotesWithCarryForward(s, carried)
    },
    ...extras
  ];
}

/** Sections array for export/print from a kind read view (plans use tickets). */
export function sectionsFromKindReadView(readView) {
  if (!readView) return [];
  if (Array.isArray(readView.tickets) && readView.tickets.length) {
    return readView.tickets.map((t) => {
      const row = {
        title: t.title != null ? String(t.title) : 'Ticket',
        notes: t.notes != null ? String(t.notes) : ''
      };
      if (t.planNotes != null && String(t.planNotes).trim()) {
        row.planNotes = String(t.planNotes);
      }
      if (t.checked === true || t.checked === false) row.checked = t.checked;
      if (t.percent != null && t.percent !== '') row.percent = Number(t.percent);
      return row;
    });
  }
  const out = [];
  if (readView.main) {
    out.push({
      title: readView.main.label || 'Content',
      notes: readView.main.notes || ''
    });
  }
  if (Array.isArray(readView.extras)) out.push(...readView.extras);
  return out;
}

/** History / read-only body for one kind (not the old two-column compare). */
export function buildKindDocumentReadView(doc, period, anchorDateStr, kind) {
  const normalized = normalizeDateForPeriod(anchorDateStr, period);
  const isPlan = String(kind || '').toLowerCase() === 'plan';
  if (isPlan) {
    return buildPlanTicketsReadView(doc, period, normalized);
  }
  const reportRead = buildReportTicketsReadView(doc, period, normalized);
  if (reportRead.tickets.length || reportRead.pending) {
    return reportRead;
  }
  const hasSubmittedDoc = doc != null && Number(doc.state ?? 0) >= 1;
  const display = getKindSectionDisplay(period, kind, normalized);
  const s = hasSubmittedDoc ? doc.sections || [] : [];
  const { work, plan, extrasFrom } = fixedLayoutSavedIndices(s);
  const mainNotes = isPlan
    ? notesOrEmpty(s[plan] ?? s[work] ?? s[0])
    : notesOrEmpty(s[work] ?? s[0]);

  const extras =
    hasSubmittedDoc && s.length > extrasFrom
      ? s.slice(extrasFrom).map((sec) => ({
          title: sec.title != null ? String(sec.title) : 'Section',
          notes: sec.notes != null ? String(sec.notes) : ''
        }))
      : [];

  return {
    anchorDate: normalized,
    main: {
      label: display.label,
      notes: mainNotes,
      pending: !hasSubmittedDoc
    },
    extras
  };
}

/**
 * Composer UI labels for fixed-layout work / plan slots (shorter than persisted section titles).
 * @param {string} period - `daily` | `weekly` | `monthly`
 * @param {'work'|'plan'} slot
 * @param {string} anchorDateStr - report anchor (daily: day, weekly: Monday, monthly: month start)
 */
export function getFixedSectionDisplay(period, slot, anchorDateStr) {
  const normalized = normalizeDateForPeriod(anchorDateStr, period);

  if (period === REPORT_PERIODS.DAILY) {
    const workDate = normalized;
    const planDate = addCalendarDaysDateKey(normalized, 1);
    if (slot === 'work') {
      return {
        label: formatPossessiveDayLabel(workDate, 'Work Result'),
        subtitle: '',
        hint: 'Started from your prior plan when empty — update with what you completed today.'
      };
    }
    return {
      label: formatPossessiveDayLabel(planDate, 'Plan'),
      subtitle: '',
      hint: ''
    };
  }

  if (period === REPORT_PERIODS.WEEKLY) {
    const weekMon = normalized;
    const nextWeekMon = addCalendarDaysDateKey(weekMon, 7);
    if (slot === 'work') {
      return {
        label: formatPossessiveWeekLabel(weekMon, 'Work Result'),
        subtitle: '',
        hint: 'Started from last week’s plan when empty — summarize outcomes, risks, and decisions.'
      };
    }
    return {
      label: formatPossessiveWeekLabel(nextWeekMon, 'Plan'),
      subtitle: '',
      hint: ''
    };
  }

  if (period === REPORT_PERIODS.MONTHLY) {
    const monthFirst = normalized;
    const nextMonthFirst = addCalendarMonthsDateKey(monthFirst, 1);
    if (slot === 'work') {
      return {
        label: formatPossessiveMonthLabel(monthFirst, 'Work Result'),
        subtitle: '',
        hint: 'Started from last month’s plan when empty — capture delivery, risks, and lessons.'
      };
    }
    return {
      label: formatPossessiveMonthLabel(nextMonthFirst, 'Plan'),
      subtitle: '',
      hint: ''
    };
  }

  return {
    label: slot === 'work' ? 'Report' : 'Plan',
    subtitle: '',
    hint: ''
  };
}

/**
 * Input / editor placeholder copy for report sections (composer, history, review).
 * @param {string} period - `daily` | `weekly` | `monthly`
 * @param {number} index - 0-based section index
 * @param {{ fixedThreeSectionLayout?: boolean }} [opts]
 * @returns {{ title: string, notes: string, mirror: string }}
 */
export function getReportSectionPlaceholders(period, index, opts = {}) {
  const fixed = !!opts.fixedThreeSectionLayout;
  const titlePh = 'Short heading (shown in history)';
  const notesGeneric =
    'What you did, outcomes, blockers-add links or images if helpful.';
  const extraNotes = 'Optional extra topic: scope, updates, evidence…';

  if (!fixed) {
    return { title: titlePh, notes: notesGeneric, mirror: '' };
  }

  if (index >= 2) {
    return { title: titlePh, notes: extraNotes, mirror: '' };
  }

  if (period === REPORT_PERIODS.WEEKLY) {
    if (index === 0) {
      return {
        title: titlePh,
        notes: `Summarize this week's work: wins, metrics, risks, and decisions.`,
        mirror: ''
      };
    }
    return {
      title: titlePh,
      notes: 'Outline priorities and commitments for next week.',
      mirror: ''
    };
  }

  if (period === REPORT_PERIODS.MONTHLY) {
    if (index === 0) {
      return {
        title: titlePh,
        notes: 'Capture this month’s delivery, risks, dependencies, and lessons.',
        mirror: ''
      };
    }
    return {
      title: titlePh,
      notes: 'Set direction and intentions for the coming month.',
      mirror: ''
    };
  }

  if (index === 0) {
    return {
      title: titlePh,
      notes: 'Describe today’s completed work, outcomes, and anything that blocked you.',
      mirror: ''
    };
  }

  return {
    title: titlePh,
    notes: 'List what you plan to work on tomorrow (or your next working session).',
    mirror: ''
  };
}

/** Normalize section payloads before save/submit. */
export function sectionsForReportPersistence(sections, fixedThreeSectionLayout) {
  if (!Array.isArray(sections)) return sections;
  return sections.map((s) => {
    const row = {
      title: s?.title != null ? String(s.title) : '',
      notes: s?.notes != null ? String(s.notes) : ''
    };
    if (s?.planNotes != null) row.planNotes = String(s.planNotes);
    if (s?.checked === true || s?.checked === false) row.checked = s.checked;
    if (s?.percent != null && s?.percent !== '') {
      const n = Number(s.percent);
      if (Number.isFinite(n)) row.percent = Math.min(100, Math.max(0, Math.round(n)));
    }
    return row;
  });
}

/** Body sections for document view, export, and print. */
export function sectionsForDocumentBody(sections, fixedThreeSectionLayout) {
  if (!Array.isArray(sections)) return [];
  return [...sections];
}

/** Saved work-result HTML from a report document (no carry-forward merge). */
export function getSavedWorkResultNotesFromDoc(doc) {
  const s = doc?.sections || [];
  const { work } = fixedLayoutSavedIndices(s);
  return notesOrEmpty(s[work]);
}

/** Saved next-period plan HTML from a report document. */
export function getSavedNextPlanNotesFromDoc(doc) {
  const s = doc?.sections || [];
  const { plan } = fixedLayoutSavedIndices(s);
  return notesOrEmpty(s[plan]);
}

/**
 * Prior period's submitted plan for the anchor (e.g. yesterday's plan for today).
 * @returns {{ label: string, notes: string }}
 */
export function getPriorPeriodPlanForAnchor(period, anchorDateStr, list) {
  const normalized = normalizeDateForPeriod(anchorDateStr, period);
  const reports = Array.isArray(list) ? list : [];

  if (period === REPORT_PERIODS.DAILY) {
    const yStr = addCalendarDaysDateKey(normalized, -1);
    const yesterdayDoc = reports.find((r) => r.date.split('T')[0] === yStr);
    return {
      label: formatPossessiveDayLabel(normalized, 'Plan'),
      notes: getCarryForwardPlanNotesFromDailyReport(yesterdayDoc)
    };
  }

  if (period === REPORT_PERIODS.WEEKLY) {
    const prevWeekMon = addCalendarDaysDateKey(normalized, -7);
    const lastWeekDoc = reports.find((r) => r.date.split('T')[0] === prevWeekMon);
    return {
      label: formatPossessiveWeekLabel(normalized, 'Plan'),
      notes: getNextWeekPlanNotesFromWeeklyReport(lastWeekDoc)
    };
  }

  if (period === REPORT_PERIODS.MONTHLY) {
    const prevMonthFirst = addCalendarMonthsDateKey(normalized, -1);
    const prevMonthDoc = reports.find((r) => r.date.split('T')[0] === prevMonthFirst);
    return {
      label: formatPossessiveMonthLabel(normalized, 'Plan'),
      notes: getNextMonthPlanNotesFromMonthlyReport(prevMonthDoc)
    };
  }

  return { label: 'Plan', notes: '' };
}

/** True when HTML notes contain visible text. */
export function notesHaveVisibleContent(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return false;
  return raw.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
}

/** Saved reports for one member (for history compare / plan preview). */
export function reportsForUserFromList(list, userId) {
  const uid = String(userId ?? '').trim();
  if (!uid) return [];
  return (Array.isArray(list) ? list : []).filter(
    (r) => String(r.userId ?? '') === uid && Number(r.state ?? 0) >= 1
  );
}

/**
 * History read-only view: anchor period plan (left, from prior submission) | work result (right).
 * When `doc` is null or missing, work result is marked pending (not submitted for this period yet).
 */
export function buildReportHistoryCompareView(doc, list, period, anchorDateStr) {
  const normalized = normalizeDateForPeriod(anchorDateStr, period);
  const hasSubmittedDoc = doc != null && Number(doc.state ?? 0) >= 1;
  const raw = hasSubmittedDoc ? doc.sections || [] : [];
  const { extrasFrom } = fixedLayoutSavedIndices(raw);
  const periodPlan = getPriorPeriodPlanForAnchor(period, normalized, list);
  const workDisplay = getFixedSectionDisplay(period, 'work', normalized);

  const extras =
    hasSubmittedDoc && raw.length > extrasFrom
      ? raw.slice(extrasFrom).map((sec) => ({
          title: sec.title != null ? String(sec.title) : 'Section',
          notes: sec.notes != null ? String(sec.notes) : ''
        }))
      : [];

  return {
    anchorDate: normalized,
    periodPlan,
    workResult: {
      label: workDisplay.label,
      notes: hasSubmittedDoc ? getSavedWorkResultNotesFromDoc(doc) : '',
      pending: !hasSubmittedDoc
    },
    extras
  };
}

/**
 * Submitted report document: work result (left) + next-period plan (right), plus optional extras.
 */
export function buildSubmittedReportSideBySide(sections, period, anchorDateStr) {
  const s = Array.isArray(sections) ? sections : [];
  const { work, plan, extrasFrom } = fixedLayoutSavedIndices(s);
  const normalized = normalizeDateForPeriod(anchorDateStr, period);
  const workDisplay = getFixedSectionDisplay(period, 'work', normalized);
  const planDisplay = getFixedSectionDisplay(period, 'plan', normalized);
  const workSec = s[work];
  const planSec = s[plan];

  return {
    anchorDate: normalized,
    workResult: {
      label: (workSec?.title && String(workSec.title).trim()) || workDisplay.label,
      notes: notesOrEmpty(workSec)
    },
    nextPlan: {
      label: (planSec?.title && String(planSec.title).trim()) || planDisplay.label,
      notes: notesOrEmpty(planSec)
    },
    extras:
      s.length > extrasFrom
        ? s.slice(extrasFrom).map((sec) => ({
            title: sec.title != null ? String(sec.title) : 'Section',
            notes: sec.notes != null ? String(sec.notes) : ''
          }))
        : []
  };
}

/** Flat sections for export/print from a history compare payload (plan + work result only). */
export function historyCompareSectionsForExport(compare) {
  if (!compare) return [];
  const plan = compare.periodPlan || compare.priorPlan;
  const sections = [
    { title: plan?.label || 'Plan', notes: plan?.notes || '' },
    {
      title: compare.workResult?.label || 'Work Result',
      notes: compare.workResult?.pending
        ? '<p><em>Not submitted yet</em></p>'
        : compare.workResult?.notes || ''
    }
  ];
  (compare.extras || []).forEach((s) => sections.push({ title: s.title, notes: s.notes }));
  return sections;
}

/**
 * Rebuild fixed-layout sections: [0] work result (prior plan as default when empty), [1] next plan, then extras.
 * `list` must contain reports for a single user when viewing another user's report (filter before calling).
 */
export function rebuildFixedLayoutSections(doc, list, period, anchorDateStr) {
  const normalizedDate = normalizeDateForPeriod(anchorDateStr, period);
  const s = doc?.sections || [];
  const { work: workIdx, plan: planIdx, extrasFrom } = fixedLayoutSavedIndices(s);

  if (period === REPORT_PERIODS.DAILY) {
    const yStr = addCalendarDaysDateKey(normalizedDate, -1);
    const tStr = addCalendarDaysDateKey(normalizedDate, 1);
    const yesterdayDoc = list.find((r) => r.date.split('T')[0] === yStr);
    const carried = getCarryForwardPlanNotesFromDailyReport(yesterdayDoc);
    const extras =
      s.length > extrasFrom
        ? s.slice(extrasFrom).map((sec) => ({
            title: sec.title != null ? String(sec.title) : 'New Section',
            notes: sec.notes != null ? String(sec.notes) : ''
          }))
        : [];
    return [
      {
        title: formatDailySectionTitle(normalizedDate, 'today_work'),
        notes: workResultNotesWithCarryForward(s, carried)
      },
      {
        title: formatDailySectionTitle(tStr, 'tomorrow_plan'),
        notes: notesOrEmpty(s[planIdx])
      },
      ...extras
    ];
  }

  if (period === REPORT_PERIODS.WEEKLY) {
    const weekMon = normalizedDate;
    const prevWeekMon = addCalendarDaysDateKey(weekMon, -7);
    const nextWeekMon = addCalendarDaysDateKey(weekMon, 7);
    const lastWeekDoc = list.find((r) => r.date.split('T')[0] === prevWeekMon);
    const carried = getNextWeekPlanNotesFromWeeklyReport(lastWeekDoc);
    const wctx = {
      lastWeekMonday: prevWeekMon,
      thisWeekMonday: weekMon,
      nextWeekMonday: nextWeekMon
    };
    const extras =
      s.length > extrasFrom
        ? s.slice(extrasFrom).map((sec) => ({
            title: sec.title != null ? String(sec.title) : 'New Section',
            notes: sec.notes != null ? String(sec.notes) : ''
          }))
        : [];
    return [
      {
        title: formatWeeklySectionTitle('week_work', wctx),
        notes: workResultNotesWithCarryForward(s, carried)
      },
      {
        title: formatWeeklySectionTitle('next_plan', wctx),
        notes: notesOrEmpty(s[planIdx])
      },
      ...extras
    ];
  }

  if (period === REPORT_PERIODS.MONTHLY) {
    const monthFirst = normalizedDate;
    const prevMonthFirst = addCalendarMonthsDateKey(monthFirst, -1);
    const nextMonthFirst = addCalendarMonthsDateKey(monthFirst, 1);
    const prevMonthDoc = list.find((r) => r.date.split('T')[0] === prevMonthFirst);
    const carried = getNextMonthPlanNotesFromMonthlyReport(prevMonthDoc);
    const mctx = {
      lastMonthFirst: prevMonthFirst,
      thisMonthFirst: monthFirst,
      nextMonthFirst
    };
    const extras =
      s.length > extrasFrom
        ? s.slice(extrasFrom).map((sec) => ({
            title: sec.title != null ? String(sec.title) : 'New Section',
            notes: sec.notes != null ? String(sec.notes) : ''
          }))
        : [];
    return [
      {
        title: formatMonthlySectionTitle('month_work', mctx),
        notes: workResultNotesWithCarryForward(s, carried)
      },
      {
        title: formatMonthlySectionTitle('next_plan', mctx),
        notes: notesOrEmpty(s[planIdx])
      },
      ...extras
    ];
  }

  return s.map((sec) => ({
    title: sec.title != null ? String(sec.title) : '',
    notes: sec.notes != null ? String(sec.notes) : ''
  }));
}
