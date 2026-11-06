import {
  sortUsersForDisplay,
  compareUsersForDisplay,
  groupOrderMap,
  userOrderStages,
} from '../utils/userOrder.js';

/**
 * One ordering for every member list in the system: by team, the group boss
 * first, then the rest of the team by name.
 */

const groups = [
  { code: 'G2', name: 'Group 2', sortOrder: 2 },
  { code: 'G1', name: 'Group 1', sortOrder: 1 },
  { code: 'G3', name: 'Group 3', sortOrder: 3 },
];

const user = (name, group, role = 'GROUP_MEMBER') => ({ name, group, role });

describe('sortUsersForDisplay', () => {
  it('lists teams in their own order, not by code', () => {
    const sorted = sortUsersForDisplay(
      [user('Zoe', 'G3'), user('Amy', 'G2'), user('Ben', 'G1')],
      groups,
    );
    expect(sorted.map((u) => u.group)).toEqual(['G1', 'G2', 'G3']);
  });

  it('puts each team\'s boss first, then the rest by name', () => {
    const sorted = sortUsersForDisplay(
      [
        user('Zoe', 'G1'),
        user('amy', 'G1'),
        user('Sun', 'G1', 'GROUP_BOSS'),
        user('Ben', 'G1'),
      ],
      groups,
    );
    expect(sorted.map((u) => u.name)).toEqual(['Sun', 'amy', 'Ben', 'Zoe']);
  });

  it('treats the legacy boss roles as bosses', () => {
    const sorted = sortUsersForDisplay(
      [user('Ann', 'G1'), user('Old', 'G1', 'BOSS')],
      groups,
    );
    expect(sorted.map((u) => u.name)).toEqual(['Old', 'Ann']);
  });

  it('sorts a member of an unknown team after the known ones', () => {
    const sorted = sortUsersForDisplay(
      [user('Nobody', 'GX'), user('Ben', 'G3'), user('Amy', 'G1')],
      groups,
    );
    expect(sorted.map((u) => u.name)).toEqual(['Amy', 'Ben', 'Nobody']);
  });

  it('falls back to name when two members tie', () => {
    const compare = compareUsersForDisplay(groupOrderMap(groups));
    expect(compare(user('amy', 'G1'), user('Amy', 'G1'))).toBe(0);
  });
});

describe('userOrderStages', () => {
  it('sorts by team, boss, then name inside the query', () => {
    const [addFields, sort] = userOrderStages(groups);
    expect(Object.keys(sort.$sort)).toEqual(['__groupOrder', 'group', '__bossOrder', '__nameKey']);

    const branches = addFields.$addFields.__groupOrder.$switch.branches;
    expect(branches.map((b) => b.case.$eq[1])).toEqual(['G1', 'G2', 'G3']);
    expect(branches.map((b) => b.then)).toEqual([1, 2, 3]);
  });

  it('still sorts when no group is configured', () => {
    const [addFields] = userOrderStages([]);
    expect(addFields.$addFields.__groupOrder).toBe(9999);
  });
});
