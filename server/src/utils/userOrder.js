import { normalizeRole, ROLES } from '../constants/roles.js';

/**
 * How members are listed everywhere in the system: by team, the group boss
 * first, then the rest of the team by name.
 *
 * Group order comes from each Group's `sortOrder`; a user whose group is
 * unknown (or who has none, like a super admin) sorts after the teams.
 */

const UNKNOWN_GROUP_ORDER = 9999;

/** Boss-ish roles, including the legacy values normalizeRole folds into GROUP_BOSS. */
export const BOSS_ROLE_VALUES = Object.freeze(['GROUP_BOSS', 'BOSS', 'ADMIN']);

export const isBossUser = (user) =>
  normalizeRole(user?.role, user?.degree) === ROLES.GROUP_BOSS;

/** code → sortOrder, from the Group documents (any order). */
export const groupOrderMap = (groups = []) => {
  const map = new Map();
  [...groups]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.code).localeCompare(String(b.code)))
    .forEach((group, index) => map.set(group.code, group.sortOrder ?? index));
  return map;
};

/**
 * Comparator for a list already in memory.
 * @param {Map<string, number>} order - from groupOrderMap()
 */
export const compareUsersForDisplay = (order = new Map()) => (a, b) => {
  const groupA = order.get(a.group) ?? UNKNOWN_GROUP_ORDER;
  const groupB = order.get(b.group) ?? UNKNOWN_GROUP_ORDER;
  if (groupA !== groupB) return groupA - groupB;

  const codeDiff = String(a.group || '').localeCompare(String(b.group || ''));
  if (codeDiff !== 0) return codeDiff;

  const bossDiff = Number(isBossUser(b)) - Number(isBossUser(a));
  if (bossDiff !== 0) return bossDiff;

  return String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), undefined, {
    sensitivity: 'base',
  });
};

export const sortUsersForDisplay = (users = [], groups = []) =>
  [...users].sort(compareUsersForDisplay(groupOrderMap(groups)));

/**
 * The same ordering inside MongoDB, so a paginated query returns the right
 * page. Returns the $addFields / $sort stages to splice into an aggregation;
 * the helper fields are stripped again by `USER_ORDER_CLEANUP`.
 */
export const userOrderStages = (groups = []) => {
  const branches = [...groupOrderMap(groups).entries()].map(([code, order]) => ({
    case: { $eq: ['$group', code] },
    then: order,
  }));

  return [
    {
      $addFields: {
        __groupOrder: branches.length
          ? { $switch: { branches, default: UNKNOWN_GROUP_ORDER } }
          : UNKNOWN_GROUP_ORDER,
        __bossOrder: { $cond: [{ $in: ['$role', BOSS_ROLE_VALUES] }, 0, 1] },
        __nameKey: { $toLower: { $ifNull: ['$name', { $ifNull: ['$email', ''] }] } },
      },
    },
    { $sort: { __groupOrder: 1, group: 1, __bossOrder: 1, __nameKey: 1 } },
  ];
};

export const USER_ORDER_CLEANUP = Object.freeze({
  $project: { __groupOrder: 0, __bossOrder: 0, __nameKey: 0 },
});
