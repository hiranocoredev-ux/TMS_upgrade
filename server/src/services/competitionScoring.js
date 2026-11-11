import User from '../models/User.js';
import { monthRangeKeys } from '../utils/businessMonth.js';
import Worklog from '../models/Worklog.js';
import MonthlyFinancialPlan from '../models/MonthlyFinancialPlan.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import { withCountable } from '../utils/transactionReview.js';
import WorktimeTarget from '../models/WorktimeTarget.js';
import CompetitionAdjustment from '../models/CompetitionAdjustment.js';
import CompetitionWorktimeDayRule from '../models/CompetitionWorktimeDayRule.js';
import CompetitionWorktimeUserDayRule from '../models/CompetitionWorktimeUserDayRule.js';
import { isNonMemberRole } from '../constants/roles.js';
import {
  estDateKeyToUtcDate,
  getESTDateKey,
  getESTMonthStartKey,
  shiftESTDateKey,
  shiftESTMonthStartKey
} from '../utils/estTime.js';

export const MONTH_RE = /^\d{4}-\d{2}$/;

const DEFAULT_TARGET_MINUTES = 13 * 60 + 30;
const MINUTES_PER_DAY = 24 * 60;

export function parseMonthKey(monthKey) {
  if (!MONTH_RE.test(monthKey)) return null;
  const [y, m] = monthKey.split('-').map(Number);
  return { y, m };
}

/** Inclusive first day and exclusive next-month first day as YYYY-MM-DD (EST calendar). */
export function monthDateRangeKeys(monthKey) {
  if (!parseMonthKey(monthKey)) return null;
  // A month runs from the 6th to the 5th of the next month.
  const { start, endExclusive } = monthRangeKeys(monthKey);
  return { start, endExclusive };
}

export function listEstDaysInMonth(monthKey, upToDateInclusive) {
  const range = monthDateRangeKeys(monthKey);
  if (!range) return [];

  const start = range.start;
  let endExclusive = range.endExclusive;

  if (upToDateInclusive !== undefined) {
    if (!upToDateInclusive || upToDateInclusive < start) return [];
    const cap = shiftESTDateKey(upToDateInclusive, 1);
    if (cap < endExclusive) endExclusive = cap;
  }

  const keys = [];
  for (let d = start; d < endExclusive; d = shiftESTDateKey(d, 1)) {
    keys.push(d);
  }
  return keys;
}

/**
 * Last EST date in `monthKey` that is (a) strictly before today, and (b) not a
 * weekend/holiday per `ruleContext`. Returns null if the month hasn't started
 * yet or contains no completed working day.
 */
function findLastCompletedWorkingDayKey(monthKey, ruleContext) {
  const range = monthDateRangeKeys(monthKey);
  if (!range) return null;

  const todayKey = getESTDateKey();
  const monthLastDay = shiftESTDateKey(range.endExclusive, -1);
  const yesterdayKey = shiftESTDateKey(todayKey, -1);
  let cursor = monthLastDay < yesterdayKey ? monthLastDay : yesterdayKey;

  while (cursor >= range.start) {
    const rule = ruleContext && ruleContext.dayRuleMap
      ? ruleContext.dayRuleMap.get(String(cursor))
      : null;
    const isHoliday = rule ? !!rule.isHoliday : isWeekendDateKey(cursor);
    if (!isHoliday) return cursor;
    cursor = shiftESTDateKey(cursor, -1);
  }
  return null;
}

function monthUtcBounds(monthKey) {
  const range = monthDateRangeKeys(monthKey);
  if (!range) return null;
  const startUtc = estDateKeyToUtcDate(range.start);
  const endUtc = estDateKeyToUtcDate(range.endExclusive);
  return { startUtc, endUtc };
}

/** Competition participants (excludes non-member roles: super admin, admin, finance manager). */
export async function loadParticipantUsers() {
  const users = await User.find({})
    .select('name email group hubstaff_id avatarUrl role degree')
    .sort({ group: 1, name: 1 })
    .lean();
  return users.filter((u) => !isNonMemberRole(u.role, u.degree));
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function estWeekday(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return -1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isWeekendDateKey(dateKey) {
  const wd = estWeekday(dateKey);
  return wd === 0 || wd === 6;
}

function clampMinutes(v) {
  const n = safeNumber(v);
  return Math.max(0, Math.min(MINUTES_PER_DAY, n));
}

async function monthlyProfitByUser(userIds, monthKey) {
  const bounds = monthUtcBounds(monthKey);
  const map = new Map(userIds.map((id) => [String(id), 0]));
  if (!bounds) return map;

  // Only transactions that count in totals (created before approval was required, or fully approved).
  const txs = await FinanceTransaction.find(withCountable({
    userId: { $in: userIds },
    status: 'accepted',
    date: { $gte: bounds.startUtc, $lt: bounds.endUtc },
  }))
    .select('userId type amount')
    .lean();

  for (const t of txs) {
    const id = String(t.userId);
    if (!map.has(id)) continue;
    const amt = safeNumber(t.amount);
    const cur = map.get(id);
    if (t.type === 'income') map.set(id, cur + amt);
    else map.set(id, cur - amt);
  }
  return map;
}

async function monthlyPlansByUser(userIds, monthKey) {
  const rows = await MonthlyFinancialPlan.find({
    userId: { $in: userIds },
    month: monthKey,
  })
    .select('userId monthlyFinancialGoal')
    .lean();
  const map = new Map();
  rows.forEach((r) => map.set(String(r.userId), safeNumber(r.monthlyFinancialGoal)));
  return map;
}

async function worktimeTargetsByUser(userIds, monthKey) {
  const rows = await WorktimeTarget.find({
    userId: { $in: userIds },
    month: monthKey,
  })
    .select('userId targetMinutes')
    .lean();
  const map = new Map();
  rows.forEach((r) =>
    map.set(String(r.userId), safeNumber(r.targetMinutes, DEFAULT_TARGET_MINUTES))
  );
  return map;
}

async function loadWorktimeRuleContext(userIds, monthKey) {
  const [dayRules, userDayRules] = await Promise.all([
    CompetitionWorktimeDayRule.find({ month: monthKey }).select('date isHoliday targetDeltaMinutes').lean(),
    CompetitionWorktimeUserDayRule.find({
      month: monthKey,
      userId: { $in: userIds },
    })
      .select('date userId targetMinutes')
      .lean(),
  ]);

  const dayRuleMap = new Map(dayRules.map((r) => [String(r.date), r]));
  const userDayMap = new Map();
  userDayRules.forEach((r) => {
    userDayMap.set(`${String(r.userId)}|${String(r.date)}`, r);
  });
  return { dayRuleMap, userDayMap };
}

function getEffectiveTargetMinutes(baseTargetMinutes, dateKey, userId, ruleContext) {
  const rule = ruleContext.dayRuleMap.get(String(dateKey));
  const userRule = ruleContext.userDayMap.get(`${String(userId)}|${String(dateKey)}`);

  let target = clampMinutes(baseTargetMinutes);
  const weekendDefaultHoliday = isWeekendDateKey(dateKey);
  const isHoliday = rule ? !!rule.isHoliday : weekendDefaultHoliday;
  if (isHoliday) target = 0;
  if (rule && safeNumber(rule.targetDeltaMinutes) !== 0) {
    target = clampMinutes(target + safeNumber(rule.targetDeltaMinutes));
  }
  if (userRule) {
    // 'work' forces a working day (weekend / holiday included) at this target.
    target = clampMinutes(userRule.targetMinutes);
  }
  return target;
}

function buildWorklogIndex(worklogs, hubstaffIdSet) {
  const byMemberDate = new Map();
  for (const w of worklogs) {
    const m = String(w.member || '');
    if (!hubstaffIdSet.has(m)) continue;
    const date = String(w.date || '');
    const real = safeNumber(w.real_time);
    const add = safeNumber(parseFloat(w.add_time) || 0);
    const key = `${m}|${date}`;
    byMemberDate.set(key, real + add);
  }
  return byMemberDate;
}

/**
 * Finance score per user: (profit / plan) * 100 * financeWeight ; 0 if no plan.
 */
export function financeScoreForUser(profit, planGoal, financeWeight) {
  if (!planGoal || planGoal <= 0) return 0;
  return (profit / planGoal) * 100 * financeWeight;
}

/**
 * Worktime competition score for month (always <= 0).
 * dayScore = -max(0, targetHours - workedHours) * worktimeWeight
 */
export function computeUserWorktimeScoreForMonth(
  user,
  days,
  baseTargetMinutes,
  byMemberDate,
  worktimeWeight,
  ruleContext
) {
  const hub = user.hubstaff_id ? String(user.hubstaff_id) : '';
  if (!hub || worktimeWeight <= 0) return 0;
  let sum = 0;
  for (const date of days) {
    const effectiveTargetMinutes = getEffectiveTargetMinutes(
      baseTargetMinutes,
      date,
      user._id,
      ruleContext
    );
    const targetHoursPerDay = effectiveTargetMinutes / 60;
    if (targetHoursPerDay <= 0) continue;
    const sec = safeNumber(byMemberDate.get(`${hub}|${date}`));
    const workedHours = sec / 3600;
    const deficit = Math.max(0, targetHoursPerDay - workedHours);
    sum -= deficit * worktimeWeight;
  }
  return Math.min(0, sum);
}

export async function computeMonthlyLeaderboards(monthKey, settings) {
  const financeWeight = safeNumber(settings.financeWeight, 1);
  const worktimeWeight = safeNumber(settings.worktimeWeight, 1);

  const users = await loadParticipantUsers();
  const userIds = users.map((u) => u._id);

  const range = monthDateRangeKeys(monthKey);
  if (!range) {
    return { users: [], groups: [], byUserId: new Map(), byGroupCode: new Map() };
  }

  const [profitByUser, planByUser, targetsByUser, ruleContext] = await Promise.all([
    monthlyProfitByUser(userIds, monthKey),
    monthlyPlansByUser(userIds, monthKey),
    worktimeTargetsByUser(userIds, monthKey),
    loadWorktimeRuleContext(userIds, monthKey),
  ]);

  const lastCompletedDay = findLastCompletedWorkingDayKey(monthKey, ruleContext);
  const days = listEstDaysInMonth(monthKey, lastCompletedDay);

  const hubSet = new Set(
    users.map((u) => (u.hubstaff_id ? String(u.hubstaff_id) : '')).filter(Boolean)
  );
  const worklogEndExclusive = lastCompletedDay
    ? shiftESTDateKey(lastCompletedDay, 1)
    : range.endExclusive;
  const worklogs = days.length
    ? await Worklog.find({
        member: { $in: [...hubSet] },
        date: { $gte: range.start, $lt: worklogEndExclusive },
      })
        .select('member date real_time add_time')
        .lean()
    : [];

  const byMemberDate = buildWorklogIndex(worklogs, hubSet);

  const userAdjustments = await CompetitionAdjustment.find({
    month: monthKey,
    scope: 'user',
    userId: { $in: userIds },
  })
    .select('userId points kind')
    .lean();

  const groupAdjustments = await CompetitionAdjustment.find({
    month: monthKey,
    scope: 'group',
  })
    .select('groupCode points kind')
    .lean();

  const adjustmentSumByUser = new Map();
  const bonusSumByUser = new Map();
  const penaltySumByUser = new Map();
  userAdjustments.forEach((a) => {
    const id = String(a.userId);
    const pts = safeNumber(a.points);
    adjustmentSumByUser.set(id, (adjustmentSumByUser.get(id) || 0) + pts);
    const k = String(a.kind || '').toLowerCase();
    if (k === 'bonus') {
      bonusSumByUser.set(id, (bonusSumByUser.get(id) || 0) + Math.max(0, pts));
    } else if (k === 'penalty') {
      penaltySumByUser.set(id, (penaltySumByUser.get(id) || 0) + Math.min(0, pts));
    } else {
      if (pts > 0) bonusSumByUser.set(id, (bonusSumByUser.get(id) || 0) + pts);
      if (pts < 0) penaltySumByUser.set(id, (penaltySumByUser.get(id) || 0) + pts);
    }
  });

  const adjustmentSumByGroup = new Map();
  const bonusSumByGroup = new Map();
  const penaltySumByGroup = new Map();
  groupAdjustments.forEach((a) => {
    const raw = a.groupCode === undefined || a.groupCode === null ? '' : String(a.groupCode);
    const g = raw.trim() === '' ? '__ungrouped__' : raw.trim();
    const pts = safeNumber(a.points);
    adjustmentSumByGroup.set(g, (adjustmentSumByGroup.get(g) || 0) + pts);
    const k = String(a.kind || '').toLowerCase();
    if (k === 'bonus') {
      bonusSumByGroup.set(g, (bonusSumByGroup.get(g) || 0) + Math.max(0, pts));
    } else if (k === 'penalty') {
      penaltySumByGroup.set(g, (penaltySumByGroup.get(g) || 0) + Math.min(0, pts));
    } else {
      if (pts > 0) bonusSumByGroup.set(g, (bonusSumByGroup.get(g) || 0) + pts);
      if (pts < 0) penaltySumByGroup.set(g, (penaltySumByGroup.get(g) || 0) + pts);
    }
  });

  const byUserId = new Map();

  for (const u of users) {
    const id = String(u._id);
    const profit = profitByUser.get(id) || 0;
    const plan = planByUser.get(id) ?? 0;
    const finance = financeScoreForUser(profit, plan, financeWeight);
    const targetMin = targetsByUser.get(id) ?? DEFAULT_TARGET_MINUTES;
    const worktime = computeUserWorktimeScoreForMonth(
      u,
      days,
      targetMin,
      byMemberDate,
      worktimeWeight,
      ruleContext
    );
    const adjustment = adjustmentSumByUser.get(id) || 0;
    const bonusScore = bonusSumByUser.get(id) || 0;
    const penaltyScore = penaltySumByUser.get(id) || 0;
    const total = finance + worktime + adjustment;

    byUserId.set(id, {
      userId: u._id,
      name: u.name,
      email: u.email,
      group: u.group || '',
      avatarUrl: u.avatarUrl || '',
      profit,
      planGoal: plan,
      financeScore: +finance.toFixed(4),
      worktimeScore: +worktime.toFixed(4),
      bonusScore: +bonusScore.toFixed(4),
      penaltyScore: +penaltyScore.toFixed(4),
      adjustmentScore: +adjustment.toFixed(4),
      total: +total.toFixed(4),
    });
  }

  const usersRanked = [...byUserId.values()].sort((a, b) => b.total - a.total);
  usersRanked.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  const groupCodes = [...new Set(users.map((u) => (u.group && String(u.group).trim()) || '__ungrouped__'))];
  const byGroupCode = new Map();

  for (const gRaw of groupCodes) {
    const displayGroup = gRaw === '__ungrouped__' ? '' : gRaw;
    const members = users.filter(
      (u) => ((u.group && String(u.group).trim()) || '') === displayGroup
    );
    let financeSum = 0;
    let workSum = 0;
    members.forEach((m) => {
      const row = byUserId.get(String(m._id));
      if (!row) return;
      financeSum += row.financeScore;
      workSum += row.worktimeScore;
    });
    const n = members.length || 1;
    const financeAvg = financeSum / n;
    const workGroup = workSum;
    const gKey = displayGroup || '__ungrouped__';
    const adjG = adjustmentSumByGroup.get(gKey) || adjustmentSumByGroup.get('') || 0;
    const bonusG = bonusSumByGroup.get(gKey) || bonusSumByGroup.get('') || 0;
    const penaltyG = penaltySumByGroup.get(gKey) || penaltySumByGroup.get('') || 0;
    const total = financeAvg + workGroup + adjG;
    byGroupCode.set(gKey, {
      groupCode: displayGroup,
      groupLabel: displayGroup || 'Unassigned',
      memberCount: members.length,
      financeScore: +financeAvg.toFixed(4),
      worktimeScore: +workGroup.toFixed(4),
      bonusScore: +bonusG.toFixed(4),
      penaltyScore: +penaltyG.toFixed(4),
      adjustmentScore: +adjG.toFixed(4),
      total: +total.toFixed(4),
      memberUserIds: members.map((m) => m._id),
    });
  }

  const groupsRanked = [...byGroupCode.values()].sort((a, b) => b.total - a.total);
  groupsRanked.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  return { users: usersRanked, groups: groupsRanked, byUserId, byGroupCode };
}

export async function buildUserDayBreakdown(monthKey, user, settings) {
  const financeWeight = safeNumber(settings.financeWeight, 1);
  const worktimeWeight = safeNumber(settings.worktimeWeight, 1);

  const hub = user.hubstaff_id ? String(user.hubstaff_id) : '';
  const id = String(user._id);

  const [profit] = [...(await monthlyProfitByUser([user._id], monthKey)).values()];
  const plan = (await monthlyPlansByUser([user._id], monthKey)).get(id) ?? 0;
  const finance = financeScoreForUser(profit ?? 0, plan, financeWeight);

  const targetMin =
    (await worktimeTargetsByUser([user._id], monthKey)).get(id) ?? DEFAULT_TARGET_MINUTES;
  const ruleContext = await loadWorktimeRuleContext([user._id], monthKey);

  const lastCompletedDay = findLastCompletedWorkingDayKey(monthKey, ruleContext);
  const days = listEstDaysInMonth(monthKey, lastCompletedDay);

  let worklogs = [];
  if (hub && days.length) {
    const range = monthDateRangeKeys(monthKey);
    if (range) {
      const worklogEndExclusive = lastCompletedDay
        ? shiftESTDateKey(lastCompletedDay, 1)
        : range.endExclusive;
      worklogs = await Worklog.find({
        member: hub,
        date: { $gte: range.start, $lt: worklogEndExclusive },
      })
        .select('date real_time add_time')
        .lean();
    }
  }
  const map = new Map();
  worklogs.forEach((w) => {
    const sec =
      safeNumber(w.real_time) + safeNumber(parseFloat(w.add_time) || 0);
    map.set(String(w.date), sec);
  });

  const daily = days.map((date) => {
    const effectiveTargetMinutes = getEffectiveTargetMinutes(targetMin, date, user._id, ruleContext);
    const targetHoursPerDay = effectiveTargetMinutes / 60;
    const sec = safeNumber(map.get(date));
    const workedHours = sec / 3600;
    const deficit = hub && targetHoursPerDay > 0 ? Math.max(0, targetHoursPerDay - workedHours) : 0;
    const dayScore = hub && targetHoursPerDay > 0 ? -(deficit * worktimeWeight) : 0;
    return {
      date,
      targetHours: +targetHoursPerDay.toFixed(4),
      workedHours: +workedHours.toFixed(4),
      deficitHours: +deficit.toFixed(4),
      dayScore: +dayScore.toFixed(4),
    };
  });

  const worktimeTotal = hub
    ? daily.reduce((s, d) => s + d.dayScore, 0)
    : 0;

  const userAdjustments = await CompetitionAdjustment.find({
    month: monthKey,
    scope: 'user',
    userId: user._id,
  })
    .populate('ruleDefinitionId', 'title kind')
    .sort({ createdAt: -1 })
    .lean();

  return {
    finance: +finance.toFixed(4),
    profit: profit ?? 0,
    planGoal: plan,
    worktimeMonth: +Math.min(0, worktimeTotal).toFixed(4),
    daily,
    adjustments: userAdjustments.map((a) => ({
      _id: a._id,
      kind: a.kind,
      title: a.title,
      description: a.description,
      points: a.points,
      createdAt: a.createdAt,
    })),
  };
}

export async function buildGroupBreakdown(monthKey, groupCodeQuery, leaderboards) {
  const trimmed = (groupCodeQuery || '').trim();
  const { users: allUsers } = leaderboards;
  const members = allUsers.filter((u) => (u.group || '').trim() === trimmed);

  const adjustmentRows = await CompetitionAdjustment.find({
    month: monthKey,
    scope: 'group',
    groupCode: trimmed,
  })
    .sort({ createdAt: -1 })
    .lean();

  const groupRow = leaderboards.groups.find((g) => (g.groupCode || '').trim() === trimmed);

  return {
    groupCode: trimmed,
    groupLabel: trimmed || 'Unassigned',
    summary: groupRow || null,
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name,
      financeScore: m.financeScore,
      worktimeScore: m.worktimeScore,
      adjustmentScore: m.adjustmentScore,
      total: m.total,
      rank: m.rank,
    })),
    adjustments: adjustmentRows.map((a) => ({
      _id: a._id,
      kind: a.kind,
      title: a.title,
      description: a.description,
      points: a.points,
      createdAt: a.createdAt,
    })),
  };
}
