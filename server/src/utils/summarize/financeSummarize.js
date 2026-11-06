/**
 * Finance summarize builder (pure — no DB access, so it can be unit tested).
 *
 * Turns users, their plan for the selected window (week period or month) and
 * their aggregated transactions into the group-by-group summarize table:
 *   - per member: plan, income, outcome, profit, pending income, result %
 *   - per group:  totals + per-member averages
 *   - overall:    totals across every listed group
 *
 * Money rules match the Finance Overview: only `accepted` transactions count as
 * income/outcome, `pending` income is reported separately, `canceled` is ignored.
 * Result % = value / plan (the group result is total value / total plan, which is
 * the same as average value / average plan).
 */

const BOSS_ROLES = new Set(['GROUP_BOSS', 'BOSS', 'ADMIN']);

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Percentage of `value` against `plan`; null when there is no plan to compare with. */
export const rateOf = (value, plan) => (plan > 0 ? round2((value / plan) * 100) : null);

const emptyMoney = () => ({ plan: 0, income: 0, outcome: 0, profit: 0, pending: 0 });

const withRates = (money) => ({
  ...money,
  incomeRate: rateOf(money.income, money.plan),
  profitRate: rateOf(money.profit, money.plan),
});

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

const summarizeMembers = (members) => {
  const total = emptyMoney();
  let plannedCount = 0;
  for (const m of members) {
    addMoney(total, m);
    if (m.hasPlan) plannedCount += 1;
  }
  return {
    memberCount: members.length,
    plannedCount,
    totals: withRates(roundMoney(total)),
    averages: averageMoney(total, members.length),
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
 * @param {Map<string, number>} input.planByUser - userId -> plan goal for the window
 * @param {Array<{userId:any,type:'income'|'outcome',status:string,total:number,count:number}>} input.txRows
 *        transactions aggregated per (user, type, status) inside the window
 */
export function buildFinanceSummarize({ groups = [], users = [], planByUser = new Map(), txRows = [] }) {
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

  const membersByGroup = new Map();
  for (const u of users) {
    const uid = String(u._id);
    const tx = moneyByUser.get(uid) || { income: 0, outcome: 0, pending: 0, txCount: 0 };
    const hasPlan = planByUser.has(uid);
    const plan = hasPlan ? Number(planByUser.get(uid)) || 0 : 0;

    // Keep the table focused on people who are actually working: active users,
    // plus anyone (e.g. since disabled) who still has a plan or money in this window.
    const isActiveMember = u.status === 'active' && u.role !== 'GUEST';
    if (!isActiveMember && !hasPlan && tx.txCount === 0) continue;

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
      transactionCount: tx.txCount,
      ...withRates(money),
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
    ...known.map((g) => ({ code: g.code, name: g.name || g.code })),
    ...orphanCodes.map((c) => ({ code: c, name: c })),
  ];

  const resultGroups = [];
  const allMembers = [];
  for (const g of orderedGroups) {
    const members = (membersByGroup.get(g.code) || []).sort(compareMembers);
    if (members.length === 0) continue;
    allMembers.push(...members);
    resultGroups.push({ code: g.code, name: g.name, members, ...summarizeMembers(members) });
  }

  return {
    groups: resultGroups,
    overall: { groupCount: resultGroups.length, ...summarizeMembers(allMembers) },
  };
}
