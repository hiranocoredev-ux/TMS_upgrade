import FinancePeriod from '../models/FinancePeriod.js';
import PeriodicFinancialPlan from '../models/PeriodicFinancialPlan.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import { withCountable } from '../utils/transactionReview.js';
import SummarizeCallCount from '../models/SummarizeCallCount.js';
import SummarizeGroupCount from '../models/SummarizeGroupCount.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { buildSummarize } from '../utils/summarize/buildSummarize.js';
import { achievementByUser } from './worktimeAchievement.js';
import {
  finalWorktimePercent,
  WEEKEND_RULE_SOURCE,
  WEEKEND_RULE_TARGET_MINUTES,
  WEEKEND_RULE_THRESHOLD_PERCENT,
} from '../constants/summarize.js';
import { getESTDateKey } from '../utils/estTime.js';
import { NON_MEMBER_ROLES } from '../constants/roles.js';

/**
 * The weekend rule: a member whose weekly Summarize Total came in under
 * WEEKEND_RULE_THRESHOLD_PERCENT works the Saturday and Sunday that open the
 * next week, with a WEEKEND_RULE_TARGET_MINUTES target instead of a day off.
 *
 * The rules are ordinary per-user day rules, so they show up in Competition →
 * Rules & settings like any other. This automation only ever touches the rows it
 * created itself (source = WEEKEND_RULE_SOURCE); rules set by hand are left alone.
 */

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

const addDays = (dateKey, days) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const weekdayOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat

/** The Saturday and Sunday that follow a week's last day. */
export const weekendAfter = (lastDayKey) => {
  let saturday = addDays(lastDayKey, 1);
  for (let i = 0; i < 7 && weekdayOf(saturday) !== 6; i += 1) saturday = addDays(saturday, 1);
  return [saturday, addDays(saturday, 1)];
};

/** The latest week period that has already finished. */
export const findLastFinishedPeriod = async (now = new Date()) => {
  const todayKey = getESTDateKey(now);
  const periods = await FinancePeriod.find({}).select('_id definition month startDate endDate').sort({ endDate: -1 }).lean();
  return periods.find((p) => toDateKey(p.endDate) < todayKey) || null;
};

/**
 * Every member's Summarize Total for one week period — the same three parts the
 * weekly page shows: finance, final worktime and their weekly count. A part
 * without a plan is left out; a member switched off for the week is skipped.
 */
export const weeklyMemberTotals = async (period) => {
  const periodId = period._id;
  const userQuery = { role: { $nin: NON_MEMBER_ROLES }, group: { $nin: ['SUPER_ADMIN', 'ADMIN', null, ''] } };
  const [users, groups] = await Promise.all([
    User.find(userQuery).select('_id name email role group status avatarUrl').lean(),
    Group.find().select('code name sortOrder type').lean(),
  ]);
  const userIds = users.map((u) => u._id);
  if (userIds.length === 0) return [];

  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  const [plans, txAggregate, callRows, groupCountRows] = await Promise.all([
    PeriodicFinancialPlan.find({ periodId, userId: { $in: userIds } }).select('userId periodicFinancialGoal').lean(),
    FinanceTransaction.aggregate([
      {
        // Same transactions as the Summarize page counts.
        $match: withCountable({
          userId: { $in: userIds },
          date: { $gte: start, $lte: end },
          status: { $in: ['accepted', 'pending'] },
        }),
      },
      { $group: { _id: { userId: '$userId', type: '$type', status: '$status' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    SummarizeCallCount.find({ periodId, userId: { $in: userIds } }).select('userId periodId plan result excluded').lean(),
    SummarizeGroupCount.find({ periodId }).select('groupCode periodId metric plan result').lean(),
  ]);

  const planByUser = new Map(plans.map((p) => [String(p.userId), Number(p.periodicFinancialGoal) || 0]));
  const txRows = txAggregate.map((r) => ({ ...r._id, total: r.total, count: r.count }));
  const excludedUserIds = new Set(callRows.filter((r) => r.excluded).map((r) => String(r.userId)));

  const { groups: summaryGroups } = buildSummarize({
    groups,
    users,
    planByUser,
    txRows,
    callRows,
    groupCountRows,
    periodIds: [periodId],
    excludedUserIds,
  });

  // Worktime over the same days the week covers (end date included).
  const realByUser = await achievementByUser({
    userIds,
    dateFrom: toDateKey(start),
    dateToExclusive: addDays(toDateKey(end), 1),
  });

  const scored = [];
  for (const group of summaryGroups) {
    for (const member of group.members) {
      if (member.excluded) continue;
      const worktime = finalWorktimePercent(realByUser.get(String(member.userId)) ?? null);
      // Same rule as the page: only the parts that can be measured count.
      const parts = [member.result, worktime, member.calls?.rate].filter(
        (v) => typeof v === 'number' && Number.isFinite(v),
      );
      scored.push({
        userId: String(member.userId),
        name: member.name,
        groupCode: group.code,
        groupName: group.name,
        finance: member.result,
        worktime,
        count: member.calls?.rate ?? null,
        total: parts.length ? parts.reduce((sum, v) => sum + v, 0) / parts.length : null,
      });
    }
  }
  return scored;
};

/**
 * Applies the weekend rule for the week that just finished.
 * @param {{ now?: Date, periodId?: string, dryRun?: boolean }} [options]
 */
export const applyWeekendWorkRules = async ({ now = new Date(), periodId, dryRun = false } = {}) => {
  const period = periodId
    ? await FinancePeriod.findById(periodId).select('_id definition month startDate endDate').lean()
    : await findLastFinishedPeriod(now);

  if (!period) {
    return { applied: [], cleared: [], period: null, weekend: null, reason: 'no finished week period' };
  }

  const [saturday, sunday] = weekendAfter(toDateKey(period.endDate));
  const members = await weeklyMemberTotals(period);

  const applied = [];
  const cleared = [];
  const ops = [];

  for (const member of members) {
    if (member.total === null) continue;
    const under = member.total < WEEKEND_RULE_THRESHOLD_PERCENT;
    for (const date of [saturday, sunday]) {
      // `month` is the calendar month the rule is filed under, as the rules page writes it.
      const filter = { month: date.slice(0, 7), date, userId: member.userId };
      if (under) {
        applied.push({ ...member, date });
        ops.push({
          updateOne: {
            filter,
            update: {
              $set: {
                targetMinutes: WEEKEND_RULE_TARGET_MINUTES,
                kind: 'work',
                reduceMinutes: 0,
                source: WEEKEND_RULE_SOURCE,
                note: `Summarize: ${period.definition} total ${member.total.toFixed(2)}% (under ${WEEKEND_RULE_THRESHOLD_PERCENT}%)`,
              },
            },
            upsert: true,
          },
        });
      } else {
        // Recovered: drop the rule this automation set, never a manual one.
        cleared.push({ ...member, date });
        ops.push({ deleteOne: { filter: { ...filter, source: WEEKEND_RULE_SOURCE } } });
      }
    }
  }

  if (ops.length > 0 && !dryRun) {
    await CompetitionWorktimeUserDayRule.bulkWrite(ops);
  }

  return {
    period: { id: String(period._id), definition: period.definition, month: period.month },
    weekend: { saturday, sunday },
    thresholdPercent: WEEKEND_RULE_THRESHOLD_PERCENT,
    targetMinutes: WEEKEND_RULE_TARGET_MINUTES,
    memberCount: members.length,
    applied,
    cleared,
    dryRun,
  };
};

/**
 * Runs the rule on a timer: the weekend it sets always belongs to the current
 * week, and writing the same rules again changes nothing, so a plain interval is
 * enough. Failures are logged, never thrown.
 */
export const startWeekendRuleScheduler = ({ intervalMs = 6 * 60 * 60 * 1000 } = {}) => {
  const run = async () => {
    try {
      const result = await applyWeekendWorkRules();
      if (result.applied.length || result.cleared.length) {
        console.log(
          `🗓  Summarize weekend rule (${result.period?.definition ?? '—'}): ` +
            `${result.applied.length} day-rule(s) set, ${result.cleared.length} cleared`,
        );
      }
    } catch (error) {
      console.warn('⚠️  Summarize weekend rule failed:', error.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
};
