import { normalizeRole, ROLES, canViewAllFinance } from '../constants/roles.js';

const META_GROUPS = ['SUPER_ADMIN', 'ADMIN'];

/** Sees finance for every team: super admin, finance manager or Admin (read-only). */
export function isGlobalFinanceViewerUser(user) {
  if (!user) return false;
  if (canViewAllFinance(user.role, user.degree)) return true;
  return !!(user.group && META_GROUPS.includes(user.group));
}

/**
 * Matches server finance write routes: group boss (own group) or finance manager
 * (every team). Super admin and admin see finance read-only, so this is false for
 * them (gates finance write buttons).
 */
export function isFinanceManagerUser(user) {
  if (!user) return false;
  const r = normalizeRole(user.role, user.degree);
  return r === ROLES.GROUP_BOSS || r === ROLES.FINANCE_MANAGER;
}

/** Params for GET /admin/users when building finance member pickers. */
export function financeUsersListParams(user, { limit = 1000 } = {}) {
  const params = { limit };
  if (!isGlobalFinanceViewerUser(user) && user?.group && !META_GROUPS.includes(user.group)) {
    params.group = user.group;
  }
  return params;
}
