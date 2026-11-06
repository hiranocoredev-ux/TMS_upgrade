import WorktimeTarget from '../models/WorktimeTarget.js';
import { monthKeyOfDateKey } from '../utils/businessMonth.js';
import CompetitionWorktimeDayRule from '../models/CompetitionWorktimeDayRule.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';

/**
 * The per-day worktime target of each member, with every rule applied:
 * the member's monthly target, the day rules (holiday / delta) and the
 * per-user day rules (personal holiday, reduced target, or a working day
 * forced onto a weekend).
 *
 * Shared by the Worktime chart and the Summarize weekend automation so both
 * read the same targets.
 */

export const DEFAULT_TARGET_MINUTES = 13 * 60 + 30;

/** Weekends are holidays unless a rule says otherwise. */
export const isWeekendDateKey = (dateKey) => {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday === 0 || weekday === 6;
};

/** `YYYY-MM-DD` keys from `dateFrom` up to (not including) `dateToExclusive`. */
export const listDateKeys = (dateFrom, dateToExclusive) => {
  const keys = [];
  const end = new Date(`${dateToExclusive}T00:00:00Z`);
  for (let d = new Date(`${dateFrom}T00:00:00Z`); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
};

const clampMinutes = (n) => Math.max(0, Math.min(1440, Number(n) || 0));

/**
 * @param {object} input
 * @param {Array<any>} input.userIds
 * @param {string} input.dateFrom - YYYY-MM-DD
 * @param {string} input.dateToExclusive - YYYY-MM-DD (exclusive, as the chart API uses)
 * @returns {Promise<{dateKeys: string[], dayTargetsByUserId: Map<string, Array<{date: string, target: number, isHoliday: boolean}>>, periodTargetMinutesByUserId: Map<string, number>}>}
 */
export async function buildDayTargets({ userIds = [], dateFrom, dateToExclusive }) {
  const dateKeys = listDateKeys(dateFrom, dateToExclusive);
  const monthKeys = [...new Set(dateKeys.map((d) => monthKeyOfDateKey(d)))];
  const ids = userIds.map(String);

  const [monthTargets, dayRules, userDayRules] = await Promise.all([
    WorktimeTarget.find({ userId: { $in: userIds }, month: { $in: monthKeys } })
      .select('userId month targetMinutes')
      .lean(),
    // Day rules are keyed by their date; `month` on those records is the
    // calendar month of the date, so the date range is the only filter.
    CompetitionWorktimeDayRule.find({ date: { $gte: dateFrom, $lt: dateToExclusive } })
      .select('date isHoliday targetDeltaMinutes')
      .lean(),
    CompetitionWorktimeUserDayRule.find({
      userId: { $in: userIds },
      date: { $gte: dateFrom, $lt: dateToExclusive },
    })
      .select('userId date targetMinutes kind reduceMinutes')
      .lean(),
  ]);

  const monthTargetMap = new Map(
    monthTargets.map((r) => {
      const parsed = Number(r.targetMinutes);
      return [`${String(r.userId)}|${String(r.month)}`, Number.isFinite(parsed) ? parsed : DEFAULT_TARGET_MINUTES];
    }),
  );
  const dayRuleMap = new Map(dayRules.map((r) => [String(r.date), r]));
  const userDayMap = new Map(
    userDayRules.map((r) => {
      const parsed = Number(r.targetMinutes);
      return [`${String(r.userId)}|${String(r.date)}`, { minutes: Number.isFinite(parsed) ? parsed : 0, kind: r.kind || 'reduce' }];
    }),
  );

  const dayTargetsByUserId = new Map();
  const periodTargetMinutesByUserId = new Map();

  for (const uid of ids) {
    let sum = 0;
    const days = [];
    for (const dateKey of dateKeys) {
      const base = monthTargetMap.get(`${uid}|${monthKeyOfDateKey(dateKey)}`) ?? DEFAULT_TARGET_MINUTES;
      const dayRule = dayRuleMap.get(dateKey);
      let target = base;
      let holiday = dayRule ? !!dayRule.isHoliday : isWeekendDateKey(dateKey);
      if (holiday) target = 0;
      if (dayRule) target = clampMinutes(target + (Number(dayRule.targetDeltaMinutes) || 0));

      const userDay = userDayMap.get(`${uid}|${dateKey}`);
      if (userDay) {
        target = userDay.minutes;
        if (userDay.kind === 'holiday') holiday = true;
        // A working day set for this member: the weekend / holiday no longer applies.
        else if (userDay.kind === 'work') holiday = false;
      }

      sum += target;
      days.push({ date: dateKey, target, isHoliday: holiday });
    }
    dayTargetsByUserId.set(uid, days);
    periodTargetMinutesByUserId.set(uid, sum);
  }

  return { dateKeys, dayTargetsByUserId, periodTargetMinutesByUserId };
}
