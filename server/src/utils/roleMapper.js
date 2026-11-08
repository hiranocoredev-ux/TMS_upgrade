/**
 * Role mapping: legacy DB values (degree, ADMIN, BOSS, …) -> canonical roles.
 * Use normalizeRole(user.role, user.degree) for permissions.
 */

import {
  ROLES,
  LEGACY_ROLES,
  normalizeRole,
  isAdminRole,
  canOverrideOwnership,
  canViewTeamData,
} from '../constants/roles.js';

export const getNormalizedRole = (user) => {
  if (!user) return ROLES.GROUP_MEMBER;
  return normalizeRole(user.role, user.degree);
};

export const hasAdminPrivileges = (user) => {
  if (!user || !user.role) return false;
  return isAdminRole(user.role, user.degree);
};

export const canUserOverrideOwnership = (user) => {
  if (!user || !user.role) return false;
  return canOverrideOwnership(user.role, user.degree);
};

export const canUserViewTeamData = (user) => {
  if (!user || !user.role) return false;
  return canViewTeamData(user.role, user.degree);
};

export const hasRole = (user, role) => {
  if (!user || !user.role) return false;
  return normalizeRole(user.role, user.degree) === normalizeRole(role);
};

export const hasAnyRole = (user, roles) => {
  if (!user || !user.role) return false;
  const userNorm = normalizeRole(user.role, user.degree);
  return roles.some((r) => normalizeRole(r) === userNorm);
};

export const getRoleDisplayName = (role, degree) => {
  const normalized = normalizeRole(role, degree);
  switch (normalized) {
    case ROLES.SUPER_ADMIN:
      return 'Super Admin';
    case ROLES.GROUP_BOSS:
      return 'Group Boss';
    case ROLES.GROUP_MEMBER:
      return 'Member';
    case ROLES.FINANCE_MANAGER:
      return 'Finance Manager';
    default:
      return role || 'Unknown';
  }
};

export const needsRoleMigration = (role) =>
  role === LEGACY_ROLES.BOSS ||
  role === LEGACY_ROLES.ADMIN ||
  role === LEGACY_ROLES.MEMBER ||
  role === LEGACY_ROLES.GUEST;

export {
  ROLES,
  LEGACY_ROLES,
  normalizeRole,
  isAdminRole,
  canOverrideOwnership,
  canViewTeamData,
};
