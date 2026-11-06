/**
 * Summarize table builder (pure — no DB access, so it can be unit tested).
 *
 * Builds the group-by-group summarize table for one window (a week period or a
 * month made of the month's week periods):
 *
 *   Finance      per member: plan, income, outcome, profit, pending income, result %
 *                per group:  total profit / total plan
 *   Member count per member: result / plan (weekly values entered by super admin) —
 *                calls for a normal team, job interviews for a job team
 *                per group:  sum of member results / sum of member plans
 *   Group count  per group only: result / plan (weekly values entered by super admin;
 *                a week without an entry uses DEFAULT_GROUP_COUNT_PLAN and a 0 result).
 *                A normal team is scored on "getting citizen", a job team on job offers.
 *   A plan of 0 / none means nothing to measure against, so that member is left out
 *   of the percent: their profit is not in the group's finance result, and their
 *   count is not in the group's count. Their money still shows in the group's sums.
 *
 * A member excluded for the week (super admin's switch) stays in the list, marked,
 * but is left out of every group total, average and count.
 *
 * Worktime % is not built here — the client computes it with the same code as
 * Worktime Management. Each member carries `worktimeDeduction`: the percentage
 * points super admin took off their Final WorkTime % for the week (0 = none).
 *
 * Finance money rules match the Finance Overview: only `accepted` transactions
 * count as income/outcome, `pending` income is reported separately, `canceled` is
 * ignored. Result % = profit / plan, where profit = income - outcome.
 */

import {
  DEFAULT_GROUP_COUNT_PLAN,
  GROUP_COUNT_METRICS,
  GROUP_METRICS_BY_TYPE,
  GROUP_TYPES,
  normalizeGroupType,
} from '../../constants/summarize.js';

const BOSS_ROLES = new Set(['GROUP_BOSS', 'BOSS', 'ADMIN']);

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Percentage of `value` against `plan`; null when there is no plan to compare with. */
export const rateOf = (value, plan) => (plan > 0 ? round2((value / plan) * 100) : null);

// No plan means nothing to measure against, so the count has no result.
const countRate = ({ plan, result }) => ({ plan, result, rate: rateOf(result, plan ?? 0) });

/**
 * Sum weekly call-count rows per user across the window's weeks.
 * A user's plan stays null unless at least one week has a plan.
 * @returns {Map<string, {plan: number|null, result: number}>}
 */
export function sumCallCounts(rows = []) {
  const map = new Map();
  for (const r of rows) {
    const uid = String(r.userId);
    const cur = map.get(uid) || { plan: null, result: 0 };
    if (r.plan != null) cur.plan = (cur.plan ?? 0) + (Number(r.plan) || 0);
    cur.result += Number(r.result) || 0;
    map.set(uid, cur);
  }
  return map;
}

/**
 * Plan/result of one group metric across the window's weeks. A week without an
 * entry (or without a plan) counts the default plan.
 * @returns {Map<string, {plan: number, result: number}>}
 */
export function sumGroupCounts({ groupCodes = [], periodIds = [], rows = [], metric = GROUP_COUNT_METRICS.CITIZEN }) {
  const byKey = new Map(
    rows
      .filter((r) => (r.metric || GROUP_COUNT_METRICS.CITIZEN) === metric)
      .map((r) => [`${r.groupCode}|${String(r.periodId)}`, r]),
  );
  const map = new Map();
  for (const code of groupCodes) {
    let plan = 0;
    let result = 0;
    for (const pid of periodIds) {
      const r = byKey.get(`${code}|${String(pid)}`);
      plan += r?.plan != null ? Number(r.plan) || 0 : DEFAULT_GROUP_COUNT_PLAN;
      result += Number(r?.result) || 0;
    }
    map.set(code, { plan, result });
  }
  return map;
}

const emptyMoney = () => ({ plan: 0, income: 0, outcome: 0, profit: 0, pending: 0 });

const addMoney = (total, m) => {
  total.plan += m.plan;
  total.income += m.income;
  total.outcome += m.outcome;
  total.profit += m.profit;
  total.pending += m.pending;
};

const roundMoney = (m) => ({
  plan: round2(m.plan),
  income: round2(m.income),
  outcome: round2(m.outcome),
  profit: round2(m.profit),
  pending: round2(m.pending),
});

const averageMoney = (total, count) =>
  count > 0
    ? roundMoney({
        plan: total.plan / count,
        income: total.income / count,
        outcome: total.outcome / count,
        profit: total.profit / count,
        pending: total.pending / count,
      })
    : emptyMoney();

const summarizeMembers = (allMembers) => {
  // Excluded members are shown, but nothing of theirs is counted.
  const members = allMembers.filter((m) => !m.excluded);
  const total = emptyMoney();
  const calls = { plan: 0, result: 0 };
  // Only members with a plan take part in a percent — there is nothing to measure
  // the others against — while the money sums still show everyone's numbers.
  let plannedProfit = 0;
  let plannedCount = 0;
  for (const m of members) {
    addMoney(total, m);
    if (m.hasPlan) {
      plannedCount += 1;
      plannedProfit += m.profit;
    }
    if ((m.calls.plan ?? 0) > 0) {
      calls.plan += m.calls.plan;
      calls.result += m.calls.result;
    }
  }
  return {
    memberCount: members.length,
    excludedCount: allMembers.length - members.length,
    plannedCount,
    totals: { ...roundMoney(total), result: rateOf(plannedProfit, total.plan) },
    averages: averageMoney(total, members.length),
    calls: countRate(calls),
  };
};

const compareMembers = (a, b) => {
  const bossDiff = Number(BOSS_ROLES.has(b.role)) - Number(BOSS_ROLES.has(a.role));
  if (bossDiff !== 0) return bossDiff;
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
};

/**
 * @param {object} input
 * @param {Array<{code:string,name:string,sortOrder?:number}>} input.groups - known groups, any order
 * @param {Array<{_id:any,name:string,email?:string,role?:string,group:string,status?:string,avatarUrl?:string}>} input.users
 * @param {Map<string, number>} input.planByUser - userId -> finance plan goal for the window
 * @param {Array<{userId:any,type:'income'|'outcome',status:string,total:number,count:number}>} input.txRows
 *        transactions aggregated per (user, type, status) inside the window
 * @param {Array<{userId:any,periodId:any,plan:number|null,result:number}>} [input.callRows] - call counts of the window's weeks
 * @param {Array<{groupCode:string,periodId:any,metric:string,plan:number|null,result:number}>} [input.groupCountRows] - weekly group counts (citizen / interview / offer)
 * @param {Array<any>} [input.periodIds] - the window's week periods (drives the group count default plan)
 * @param {Set<string>|Array<string>} [input.excludedUserIds] - members switched off for this week
 * @param {Map<string, number>} [input.worktimeDeductionByUser] - userId -> points off the Final WorkTime %
 */
export function buildSummarize({
  groups = [],
  users = [],
  planByUser = new Map(),
  txRows = [],
  callRows = [],
  groupCountRows = [],
  periodIds = [],
  excludedUserIds = new Set(),
  worktimeDeductionByUser = new Map(),
}) {
  const moneyByUser = new Map();
  const moneyFor = (uid) => {
    if (!moneyByUser.has(uid)) moneyByUser.set(uid, { income: 0, outcome: 0, pending: 0, txCount: 0 });
    return moneyByUser.get(uid);
  };

  for (const row of txRows) {
    const uid = String(row.userId);
    const amount = Number(row.total) || 0;
    const m = moneyFor(uid);
    m.txCount += Number(row.count) || 0;
    if (row.status === 'accepted') {
      if (row.type === 'income') m.income += amount;
      else if (row.type === 'outcome') m.outcome += amount;
    } else if (row.status === 'pending' && row.type === 'income') {
      m.pending += amount;
    }
  }

  const callsByUser = sumCallCounts(callRows);
  const excluded = excludedUserIds instanceof Set ? excludedUserIds : new Set((excludedUserIds || []).map(String));

  const membersByGroup = new Map();
  for (const u of users) {
    const uid = String(u._id);
    const tx = moneyByUser.get(uid) || { income: 0, outcome: 0, pending: 0, txCount: 0 };
    const hasPlan = planByUser.has(uid);
    const plan = hasPlan ? Number(planByUser.get(uid)) || 0 : 0;
    const calls = callsByUser.get(uid);

    // Keep the table focused on people who are actually working: active users,
    // plus anyone (e.g. since disabled) who still has a plan, money or counts in this window.
    const isActiveMember = u.status === 'active' && u.role !== 'GUEST';
    if (!isActiveMember && !hasPlan && tx.txCount === 0 && !calls) continue;

    const money = roundMoney({
      plan,
      income: tx.income,
      outcome: tx.outcome,
      profit: tx.income - tx.outcome,
      pending: tx.pending,
    });

    const member = {
      userId: uid,
      name: u.name || u.email || 'Unknown',
      email: u.email || '',
      role: u.role || '',
      status: u.status || '',
      avatarUrl: u.avatarUrl || '',
      hasPlan,
      excluded: excluded.has(uid),
      worktimeDeduction: Number(worktimeDeductionByUser.get(uid)) || 0,
      transactionCount: tx.txCount,
      ...money,
      result: rateOf(money.profit, money.plan),
      calls: countRate(calls || { plan: null, result: 0 }),
    };

    const code = u.group;
    if (!membersByGroup.has(code)) membersByGroup.set(code, []);
    membersByGroup.get(code).push(member);
  }

  const known = [...groups].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.code).localeCompare(String(b.code)),
  );
  const knownCodes = new Set(known.map((g) => g.code));
  // Users whose group code has no Group document still get a section instead of vanishing.
  const orphanCodes = [...membersByGroup.keys()].filter((c) => !knownCodes.has(c)).sort();
  const orderedGroups = [
    ...known.map((g) => ({ code: g.code, name: g.name || g.code, type: normalizeGroupType(g.type) })),
    ...orphanCodes.map((c) => ({ code: c, name: c, type: GROUP_TYPES.NORMAL })),
  ].filter((g) => (membersByGroup.get(g.code) || []).length > 0);

  const codes = orderedGroups.map((g) => g.code);
  const countsByMetric = Object.fromEntries(
    Object.values(GROUP_COUNT_METRICS).map((metric) => [
      metric,
      sumGroupCounts({ groupCodes: codes, periodIds, rows: groupCountRows, metric }),
    ]),
  );

  const resultGroups = [];
  const allMembers = [];
  const overallCounts = Object.fromEntries(
    Object.values(GROUP_COUNT_METRICS).map((metric) => [metric, { plan: 0, result: 0, used: false }]),
  );

  for (const g of orderedGroups) {
    const members = membersByGroup.get(g.code).sort(compareMembers);
    allMembers.push(...members);

    // Only the metrics of this group's type are scored; the others stay null.
    const groupCounts = Object.fromEntries(Object.values(GROUP_COUNT_METRICS).map((metric) => [metric, null]));
    for (const metric of GROUP_METRICS_BY_TYPE[g.type] || []) {
      const counts = countsByMetric[metric].get(g.code) || { plan: 0, result: 0 };
      groupCounts[metric] = countRate(counts);
      overallCounts[metric].plan += counts.plan;
      overallCounts[metric].result += counts.result;
      overallCounts[metric].used = true;
    }

    resultGroups.push({
      code: g.code,
      name: g.name,
      type: g.type,
      members,
      ...summarizeMembers(members),
      ...groupCounts,
    });
  }

  return {
    groups: resultGroups,
    overall: {
      groupCount: resultGroups.length,
      ...summarizeMembers(allMembers),
      ...Object.fromEntries(
        Object.values(GROUP_COUNT_METRICS).map((metric) => [
          metric,
          overallCounts[metric].used ? countRate({ plan: overallCounts[metric].plan, result: overallCounts[metric].result }) : null,
        ]),
      ),
    },
  };
}
