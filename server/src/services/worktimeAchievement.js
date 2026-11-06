import Worklog from '../models/Worklog.js';
import User from '../models/User.js';
import { buildDayTargets } from './worktimeTargets.js';

/**
 * The worktime achievement percent of a member over a date range — the same
 * rule Worktime Management shows, kept in step with the client's
 * `utils/worktimeMetrics.js` (a unit test compares the two).
 *
 * Achievement is the AVERAGE of each day's percent, each day capped at 100%,
 * where a holiday counts as 100% and a normal day is worked ÷ target.
 */

/**
 * @param {Array<{target: number, isHoliday: boolean, real_time: number, add_time: number}>} days
 * @param {{includeHoliday?: boolean}} [options]
 */
export function achievementFromDays(days = [], { includeHoliday = true } = {}) {
  let percentSum = 0;
  let counted = 0;

  for (const d of days) {
    const isHoliday = !!d.isHoliday;
    if (isHoliday && !includeHoliday) continue;
    const trackedHours = Math.max(0, (Number(d.real_time) || 0) / 3600);
    const addedHours = Math.max(0, (Number(d.add_time) || 0) / 3600);
    counted += 1;

    const target = Math.max(0, Number(d.target) || 0);
    let dayPercent;
    if (isHoliday || target <= 0) {
      // A holiday (or a day reduced to no target) always reads 100%.
      dayPercent = 100;
    } else {
      dayPercent = ((trackedHours + addedHours) * 60 / target) * 100;
    }
    percentSum += Math.min(100, dayPercent);
  }

  return counted > 0 ? percentSum / counted : 0;
}

/**
 * Achievement per member over a date range (`dateToExclusive` is exclusive, the
 * same convention the worktime chart uses).
 * @returns {Promise<Map<string, number>>} userId -> achievement %
 */
export async function achievementByUser({ userIds = [], dateFrom, dateToExclusive }) {
  const result = new Map();
  if (userIds.length === 0) return result;

  const [{ dayTargetsByUserId }, users] = await Promise.all([
    buildDayTargets({ userIds, dateFrom, dateToExclusive }),
    User.find({ _id: { $in: userIds } }).select('_id hubstaff_id').lean(),
  ]);

  const hubstaffByUser = new Map(users.map((u) => [String(u._id), u.hubstaff_id ? String(u.hubstaff_id) : null]));
  const members = [...hubstaffByUser.values()].filter(Boolean);

  const worklogs = members.length
    ? await Worklog.find({ member: { $in: members }, date: { $gte: dateFrom, $lt: dateToExclusive } })
        .select('member date real_time add_time')
        .lean()
    : [];

  const workedByMemberDay = new Map(); // `${member}|${date}` -> { real, add }
  for (const w of worklogs) {
    const key = `${String(w.member)}|${String(w.date)}`;
    const cur = workedByMemberDay.get(key) || { real: 0, add: 0 };
    cur.real += Number(w.real_time) || 0;
    cur.add += Number(w.add_time) || 0;
    workedByMemberDay.set(key, cur);
  }

  for (const [uid, days] of dayTargetsByUserId) {
    const member = hubstaffByUser.get(uid);
    const rows = days.map((d) => {
      const worked = (member && workedByMemberDay.get(`${member}|${d.date}`)) || { real: 0, add: 0 };
      return { ...d, real_time: worked.real, add_time: worked.add };
    });
    result.set(uid, achievementFromDays(rows));
  }

  return result;
}
