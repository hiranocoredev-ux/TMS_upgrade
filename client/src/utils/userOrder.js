import { normalizeRole, ROLES } from '../constants/roles';

/**
 * How members are listed everywhere: by team, the group boss first, then the
 * rest of the team by name. The API already returns users in this order — use
 * these helpers for lists the browser builds or merges itself.
 */

const UNKNOWN_GROUP_ORDER = 9999;

export const isBossUser = (user) =>
  normalizeRole(user?.role, user?.degree) === ROLES.GROUP_BOSS || user?.isBoss === true;

/** code → sortOrder, from the groups endpoint (any order). */
export const groupOrderMap = (groups = []) => {
  const map = new Map();
  [...groups]
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.code).localeCompare(String(b.code)),
    )
    .forEach((group, index) => map.set(group.code, group.sortOrder ?? index));
  return map;
};

export const compareUsersForDisplay =
  (order = new Map()) =>
  (a, b) => {
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

/**
 * @param {Array} users
 * @param {Array} [groups] - from fetchGroups(); without it, teams fall back to code order
 */
export const sortUsersByGroup = (users = [], groups = []) =>
  [...users].sort(compareUsersForDisplay(groupOrderMap(groups)));
