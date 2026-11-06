/**
 * Summarize table builder tests (pure — no DB).
 * Run with: npm test -- summarize.test.js
 */

import { describe, it, expect } from '@jest/globals';
import { buildSummarize, rateOf, sumCallCounts, sumGroupCounts } from '../utils/summarize/buildSummarize.js';
import { DEFAULT_GROUP_COUNT_PLAN, GROUP_TYPES } from '../constants/summarize.js';

const citizen = (groupCode, periodId, plan, result) => ({ groupCode, periodId, metric: 'citizen', plan, result });

const member = (id, name, group, extra = {}) => ({
  _id: id,
  name,
  group,
  role: 'GROUP_MEMBER',
  status: 'active',
  ...extra,
});

const income = (userId, total, status = 'accepted') => ({ userId, type: 'income', status, total, count: 1 });

describe('buildSummarize — finance', () => {
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

  // No outcome here, so profit === income and the results match the sheet.
  it('computes member results and group averages like the spreadsheet', () => {
    const { groups } = buildSummarize({ groups: [{ code: 'G1', name: 'Group1' }], users, planByUser, txRows });
    const g1 = groups[0];
    const byName = Object.fromEntries(g1.members.map((m) => [m.name, m]));

    expect(byName.Sun.result).toBe(17.63);
    expect(byName.MS.result).toBe(119.78);
    expect(byName.Kai.result).toBe(274.4);
    expect(g1.averages.plan).toBe(3012);
    expect(g1.averages.income).toBe(1957.69);
    expect(g1.totals.result).toBe(65);
  });

  it('counts only accepted money, reports pending income separately, and bases the result on profit', () => {
    const { groups } = buildSummarize({
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
    expect(a.result).toBe(50);
  });

  it('has no result when there is no plan', () => {
    expect(rateOf(500, 0)).toBeNull();
    const { groups } = buildSummarize({ users: [member('a', 'A', 'G1')], txRows: [income('a', 50)] });
    expect(groups[0].members[0].hasPlan).toBe(false);
    expect(groups[0].members[0].result).toBeNull();
  });

  it('hides inactive users without data but keeps them when they have money or counts in the window', () => {
    const { groups } = buildSummarize({
      users: [
        member('a', 'Active', 'G1'),
        member('d1', 'Disabled idle', 'G1', { status: 'disabled' }),
        member('d2', 'Disabled earner', 'G1', { status: 'disabled' }),
        member('d3', 'Disabled caller', 'G1', { status: 'disabled' }),
      ],
      txRows: [income('d2', 10)],
      callRows: [{ userId: 'd3', periodId: 'w1', plan: 5, result: 1 }],
      periodIds: ['w1'],
    });
    expect(groups[0].members.map((m) => m.name).sort()).toEqual(['Active', 'Disabled caller', 'Disabled earner']);
  });

  it('orders groups by sortOrder, puts bosses first, and keeps unknown group codes', () => {
    const { groups, overall } = buildSummarize({
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

describe('buildSummarize — members without a plan', () => {
  const setup = () =>
    buildSummarize({
      groups: [{ code: 'G1', name: 'Group1' }],
      users: [member('a', 'A', 'G1'), member('b', 'B', 'G1')],
      // Only A has a finance plan; B earns without one.
      planByUser: new Map([['a', 1000]]),
      txRows: [income('a', 400), income('b', 5000)],
      callRows: [
        { userId: 'a', periodId: 'w1', plan: 10, result: 4 },
        // B made calls, but nobody planned any for them.
        { userId: 'b', periodId: 'w1', plan: null, result: 9 },
      ],
      periodIds: ['w1'],
    });

  it('keeps their money in the sums', () => {
    const { groups } = setup();
    expect(groups[0].totals.income).toBe(5400);
    expect(groups[0].totals.plan).toBe(1000);
    expect(groups[0].plannedCount).toBe(1);
  });

  it('leaves them out of the finance percent', () => {
    const { groups } = setup();
    // 400 of the planned member's profit against the 1000 plan — B's 5000 is not in it.
    expect(groups[0].totals.result).toBe(40);
  });

  it('leaves them out of the count percent', () => {
    const { groups } = setup();
    expect(groups[0].calls).toEqual({ plan: 10, result: 4, rate: 40 });
    expect(groups[0].members.find((m) => m.name === 'B').calls.rate).toBeNull();
  });
});

describe('buildSummarize — excluded members (weekly)', () => {
  const setup = () =>
    buildSummarize({
      groups: [{ code: 'G1', name: 'Group1' }],
      users: [member('a', 'A', 'G1'), member('b', 'B', 'G1')],
      planByUser: new Map([['a', 1000], ['b', 1000]]),
      txRows: [income('a', 500), income('b', 3000)],
      callRows: [
        { userId: 'a', periodId: 'w1', plan: 10, result: 5 },
        { userId: 'b', periodId: 'w1', plan: 10, result: 10 },
      ],
      periodIds: ['w1'],
      excludedUserIds: new Set(['b']),
    });

  it('keeps an excluded member in the list, marked', () => {
    const { groups } = setup();
    const byName = Object.fromEntries(groups[0].members.map((m) => [m.name, m]));
    expect(byName.A.excluded).toBe(false);
    expect(byName.B.excluded).toBe(true);
    // Their own numbers are still there to look at.
    expect(byName.B.result).toBe(300);
  });

  it('leaves the excluded member out of every group number', () => {
    const { groups, overall } = setup();
    const g = groups[0];
    expect(g.memberCount).toBe(1);
    expect(g.excludedCount).toBe(1);
    expect(g.plannedCount).toBe(1);
    expect(g.totals.plan).toBe(1000);
    expect(g.totals.income).toBe(500);
    expect(g.totals.result).toBe(50);
    expect(g.averages.income).toBe(500);
    expect(g.calls).toEqual({ plan: 10, result: 5, rate: 50 });
    expect(overall.memberCount).toBe(1);
  });
});

describe('buildSummarize — member counts (calls / job interviews)', () => {
  it('rates each member and sums plans and results for the group', () => {
    const { groups, overall } = buildSummarize({
      users: [member('a', 'A', 'G1'), member('b', 'B', 'G1'), member('c', 'C', 'G1')],
      callRows: [
        { userId: 'a', periodId: 'w1', plan: 20, result: 15 },
        { userId: 'b', periodId: 'w1', plan: 10, result: 12 },
      ],
      periodIds: ['w1'],
    });
    const byName = Object.fromEntries(groups[0].members.map((m) => [m.name, m.calls]));

    expect(byName.A).toEqual({ plan: 20, result: 15, rate: 75 });
    expect(byName.B).toEqual({ plan: 10, result: 12, rate: 120 });
    // No plan means nothing to measure against: no result, and the page leaves it out.
    expect(byName.C).toEqual({ plan: null, result: 0, rate: null });
    expect(groups[0].calls).toEqual({ plan: 30, result: 27, rate: 90 });
    expect(overall.calls.rate).toBe(90);
  });

  it('sums a month from its weeks and keeps the plan empty until a week sets one', () => {
    const map = sumCallCounts([
      { userId: 'a', periodId: 'w1', plan: 10, result: 4 },
      { userId: 'a', periodId: 'w2', plan: 15, result: 16 },
      { userId: 'b', periodId: 'w1', plan: null, result: 3 },
    ]);
    expect(map.get('a')).toEqual({ plan: 25, result: 20 });
    expect(map.get('b')).toEqual({ plan: null, result: 3 });
  });
});

describe('buildSummarize — group counts (normal teams: getting citizen)', () => {
  it('uses the default plan of 2 for a week without an entry', () => {
    expect(DEFAULT_GROUP_COUNT_PLAN).toBe(2);
    const { groups } = buildSummarize({
      groups: [{ code: 'G1', name: 'Group1' }, { code: 'G2', name: 'Group2' }],
      users: [member('a', 'A', 'G1'), member('b', 'B', 'G2')],
      groupCountRows: [citizen('G1', 'w1', 4, 3)],
      periodIds: ['w1'],
    });
    expect(groups[0].citizen).toEqual({ plan: 4, result: 3, rate: 75 });
    expect(groups[1].citizen).toEqual({ plan: 2, result: 0, rate: 0 });
  });

  it('sums the weeks of a month (default plan for weeks without a plan) and totals all groups', () => {
    const map = sumGroupCounts({
      groupCodes: ['G1'],
      periodIds: ['w1', 'w2', 'w3'],
      metric: 'citizen',
      rows: [citizen('G1', 'w1', 3, 1), citizen('G1', 'w2', null, 2), { groupCode: 'G1', periodId: 'w3', metric: 'offer', plan: 9, result: 9 }],
    });
    expect(map.get('G1')).toEqual({ plan: 3 + 2 + 2, result: 3 });

    const { overall } = buildSummarize({
      users: [member('a', 'A', 'G1'), member('b', 'B', 'G2')],
      groupCountRows: [citizen('G1', 'w1', 2, 2), citizen('G2', 'w1', 2, 1)],
      periodIds: ['w1'],
    });
    expect(overall.citizen).toEqual({ plan: 4, result: 3, rate: 75 });
  });

  it('has no result when the window has no weeks (nothing planned)', () => {
    const { groups } = buildSummarize({ users: [member('a', 'A', 'G1')], periodIds: [] });
    expect(groups[0].citizen).toEqual({ plan: 0, result: 0, rate: null });
  });
});

describe('buildSummarize — job teams', () => {
  const setup = () =>
    buildSummarize({
      groups: [
        { code: 'G1', name: 'Group1', sortOrder: 1 },
        { code: 'J1', name: 'Job team', sortOrder: 2, type: GROUP_TYPES.JOB },
      ],
      users: [member('a', 'A', 'G1'), member('j', 'J', 'J1')],
      callRows: [
        { userId: 'a', periodId: 'w1', plan: 10, result: 5 },
        { userId: 'j', periodId: 'w1', plan: 10, result: 9 },
      ],
      groupCountRows: [
        citizen('G1', 'w1', 2, 1),
        { groupCode: 'J1', periodId: 'w1', metric: 'offer', plan: 4, result: 1 },
      ],
      periodIds: ['w1'],
    });

  it('scores job offers instead of getting citizen', () => {
    const { groups } = setup();
    const [normal, job] = groups;

    expect(normal.type).toBe('normal');
    expect(normal.citizen).toEqual({ plan: 2, result: 1, rate: 50 });
    expect(normal.offer).toBeNull();

    expect(job.type).toBe('job');
    expect(job.offer).toEqual({ plan: 4, result: 1, rate: 25 });
    expect(job.citizen).toBeNull();
  });

  it('keeps per-member counts for both team types (calls / job interviews)', () => {
    const { groups, overall } = setup();
    const [normal, job] = groups;

    expect(normal.calls).toEqual({ plan: 10, result: 5, rate: 50 });
    expect(job.calls).toEqual({ plan: 10, result: 9, rate: 90 });
    expect(job.members[0].calls).toEqual({ plan: 10, result: 9, rate: 90 });
    expect(overall.calls.rate).toBe(70);
  });

  it('totals each group metric only across the groups that use it', () => {
    const { overall } = setup();
    expect(overall.citizen).toEqual({ plan: 2, result: 1, rate: 50 });
    expect(overall.offer).toEqual({ plan: 4, result: 1, rate: 25 });
  });

  it('falls back to the default plan for a job team without entries', () => {
    const { groups } = buildSummarize({
      groups: [{ code: 'J1', name: 'Job team', type: GROUP_TYPES.JOB }],
      users: [member('j', 'J', 'J1')],
      periodIds: ['w1', 'w2'],
    });
    expect(groups[0].offer).toEqual({ plan: 4, result: 0, rate: 0 });
    // Nothing planned for the member, so their count has no result.
    expect(groups[0].members[0].calls.rate).toBeNull();
  });
});
