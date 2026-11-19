import { normalizeRole, ROLES, canViewAllFinance, hasFinanceManagerRole } from '../constants/roles.js';

const META_GROUPS = ['SUPER_ADMIN', 'ADMIN'];

/** Sees finance for every team: super admin, finance manager or Admin (read-only). */
export function isGlobalFinanceViewerUser(user) {
  if (!user) return false;
  if (canViewAllFinance(user.role, user.degree)) return true;
  return !!(user.group && META_GROUPS.includes(user.group));
}

/**
 * Matches server finance manager routes (super admin, group boss or finance
 * manager; legacy TEAM_BOSS degree maps to super admin). Admin (SYSTEM_ADMIN) is
 * finance read-only, so this is false for them (gates finance write buttons).
 */
export function isFinanceManagerUser(user) {
  if (!user) return false;
  const r = normalizeRole(user.role, user.degree);
  // hasFinanceManagerRole: also an Admin who holds the finance manager role.
  return r === ROLES.SUPER_ADMIN || r === ROLES.GROUP_BOSS || hasFinanceManagerRole(user);
}

/** Params for GET /admin/users when building finance member pickers. */
export function financeUsersListParams(user, { limit = 1000 } = {}) {
  const params = { limit };
  if (!isGlobalFinanceViewerUser(user) && user?.group && !META_GROUPS.includes(user.group)) {
    params.group = user.group;
  }
  return params;
}
