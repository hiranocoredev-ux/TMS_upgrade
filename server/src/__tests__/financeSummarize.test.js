/**
 * Finance summarize builder tests (pure — no DB).
 * Run with: npm test -- financeSummarize.test.js
 */

import { describe, it, expect } from '@jest/globals';
import { buildFinanceSummarize, rateOf } from '../utils/summarize/financeSummarize.js';

const member = (id, name, group, extra = {}) => ({
  _id: id,
  name,
  group,
  role: 'GROUP_MEMBER',
  status: 'active',
  ...extra,
});

const income = (userId, total, status = 'accepted') => ({ userId, type: 'income', status, total, count: 1 });

describe('buildFinanceSummarize', () => {
  // Plan / income figures from the team's summarize spreadsheet (Group1).
  const users = [
    member('sun', 'Sun', 'G1'),
    member('ms', 'MS', 'G1'),
    member('blue', 'Blue', 'G1'),
    member('eros', 'Eros', 'G1'),
    member('kai', 'Kai', 'G1'),
  ];
  const planByUser = new Map([['sun', 4000], ['ms', 3500], ['blue', 5000], ['eros', 1310], ['kai', 1250]]);
  const txRows = [income('sun', 705), income('ms', 4192.44), income('blue', 553), income('eros', 908), income('kai', 3430)];

  it('computes member results and group averages like the spreadsheet', () => {
    const { groups } = buildFinanceSummarize({ groups: [{ code: 'G1', name: 'Group1' }], users, planByUser, txRows });
    const g1 = groups[0];
    const byName = Object.fromEntries(g1.members.map((m) => [m.name, m]));

    expect(byName.Sun.incomeRate).toBe(17.63);
    expect(byName.MS.incomeRate).toBe(119.78);
    expect(byName.Kai.incomeRate).toBe(274.4);
    expect(g1.averages.plan).toBe(3012);
    expect(g1.averages.income).toBe(1957.69);
    expect(g1.totals.incomeRate).toBe(65);
  });

  it('counts only accepted money, reports pending income separately, and derives profit', () => {
    const { groups } = buildFinanceSummarize({
      users: [member('a', 'A', 'G1')],
      planByUser: new Map([['a', 1000]]),
      txRows: [
        income('a', 600),
        income('a', 200, 'pending'),
        { userId: 'a', type: 'outcome', status: 'accepted', total: 100, count: 1 },
        { userId: 'a', type: 'outcome', status: 'pending', total: 999, count: 1 },
      ],
    });
    const a = groups[0].members[0];

    expect(a.income).toBe(600);
    expect(a.outcome).toBe(100);
    expect(a.pending).toBe(200);
    expect(a.profit).toBe(500);
    expect(a.incomeRate).toBe(60);
    expect(a.profitRate).toBe(50);
  });

  it('has no result when there is no plan', () => {
    expect(rateOf(500, 0)).toBeNull();
    const { groups } = buildFinanceSummarize({ users: [member('a', 'A', 'G1')], txRows: [income('a', 50)] });
    expect(groups[0].members[0].hasPlan).toBe(false);
    expect(groups[0].members[0].incomeRate).toBeNull();
  });

  it('hides inactive users without data but keeps them when they have money in the window', () => {
    const { groups } = buildFinanceSummarize({
      users: [
        member('a', 'Active', 'G1'),
        member('d1', 'Disabled idle', 'G1', { status: 'disabled' }),
        member('d2', 'Disabled earner', 'G1', { status: 'disabled' }),
      ],
      txRows: [income('d2', 10)],
    });
    expect(groups[0].members.map((m) => m.name).sort()).toEqual(['Active', 'Disabled earner']);
  });

  it('orders groups by sortOrder, puts bosses first, and keeps unknown group codes', () => {
    const { groups, overall } = buildFinanceSummarize({
      groups: [
        { code: 'G2', name: 'Group2', sortOrder: 2 },
        { code: 'G1', name: 'Group1', sortOrder: 1 },
        { code: 'G3', name: 'Empty group', sortOrder: 3 },
      ],
      users: [
        member('x', 'Zed', 'G2'),
        member('y', 'Amy', 'G1'),
        member('z', 'Boss', 'G1', { role: 'GROUP_BOSS' }),
        member('w', 'Lost', 'LEGACY'),
      ],
    });
    expect(groups.map((g) => g.code)).toEqual(['G1', 'G2', 'LEGACY']);
    expect(groups[0].members.map((m) => m.name)).toEqual(['Boss', 'Amy']);
    expect(overall.memberCount).toBe(4);
    expect(overall.groupCount).toBe(3);
  });
});
