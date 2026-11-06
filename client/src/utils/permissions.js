/**
 * Permission helper utilities for role and editor gating (canonical 3-role model).
 */

import { 
  ROLES, 
  LEGACY_ROLES,
  normalizeRole,
  isAdminRole as isAdminRoleUtil,
  hasAnyRole as hasAnyRoleUtil,
  hasRole as hasRoleUtil,
  canViewTeamData as canViewTeamDataUtil,
  getRoleDisplayName as getRoleDisplayNameUtil
} from '../constants/roles.js';

// Re-export role constants for backward compatibility
export { ROLES, LEGACY_ROLES };

/**
 * Check if user has a specific role (with normalization)
 */
export const hasRole = (user, role) => {
  return hasRoleUtil(user, role);
};

/**
 * Check if user has any of the specified roles (with normalization)
 */
export const hasAnyRole = (user, roles) => {
  return hasAnyRoleUtil(user, roles);
};

/** Super Admin or Group Boss (legacy ADMIN/BOSS map here). */
export const isAdmin = (user) => {
  if (!user || !user.role) return false;
  return isAdminRoleUtil(user.role, user.degree);
};

/**
 * Check if user is boss or admin (for admin pages)
 * @deprecated Use isAdmin() instead - BOSS automatically maps to ADMIN
 */
export const isBossOrAdmin = (user) => {
  return isAdmin(user); // BOSS maps to ADMIN, so same as isAdmin
};

/**
 * Check if user can access admin features
 */
export const canAccessAdmin = (user) => {
  return isAdmin(user); // Includes ADMIN and legacy BOSS
};

/**
 * Check if user can view audit logs
 */
export const canViewAuditLogs = (user) => {
  return isAdmin(user); // Includes ADMIN and legacy BOSS
};

/**
 * Get role display name (for UI)
 */
export const getRoleDisplayName = (role, degree) => {
  return getRoleDisplayNameUtil(role, degree);
};

/**
 * Check if user can view team data
 */
export const canViewTeamData = (user) => {
  if (!user || !user.role) return false;
  return canViewTeamDataUtil(user.role, user.degree);
};

