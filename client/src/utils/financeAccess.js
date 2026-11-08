import { normalizeRole, ROLES, canManageAllFinance } from '../constants/roles.js';

const META_GROUPS = ['SUPER_ADMIN', 'ADMIN'];

/** Sees finance for every team: super admin or finance manager. */
export function isGlobalFinanceViewerUser(user) {
  if (!user) return false;
  if (canManageAllFinance(user.role, user.degree)) return true;
  return !!(user.group && META_GROUPS.includes(user.group));
}

/**
 * Matches server finance manager routes (super admin, group boss or finance
 * manager; legacy TEAM_BOSS degree maps to super admin).
 */
export function isFinanceManagerUser(user) {
  if (!user) return false;
  const r = normalizeRole(user.role, user.degree);
  return r === ROLES.SUPER_ADMIN || r === ROLES.GROUP_BOSS || r === ROLES.FINANCE_MANAGER;
}

/** Params for GET /admin/users when building finance member pickers. */
export function financeUsersListParams(user, { limit = 1000 } = {}) {
  const params = { limit };
  if (!isGlobalFinanceViewerUser(user) && user?.group && !META_GROUPS.includes(user.group)) {
    params.group = user.group;
  }
  return params;
}
