/**
 * User filtering utilities
 * Excludes super admin from member lists and calculations
 */

import { ROLES } from '../constants/roles';

/**
 * Filter out super admin users from a user array
 * @param {Array} users - Array of user objects
 * @returns {Array} Filtered array without super admin users
 */
export const excludeSuperAdmin = (users) => {
  if (!Array.isArray(users)) return [];
  return users.filter(user => {
    const role = user.role || user.user?.role;
    return role !== ROLES.SUPER_ADMIN;
  });
};

/**
 * Check if a user is super admin
 * @param {Object} user - User object
 * @returns {Boolean}
 */
export const isSuperAdmin = (user) => {
  if (!user) return false;
  const role = user.role || user.user?.role;
  return role === ROLES.SUPER_ADMIN;
};

/**
 * Filter out super admin from finance metrics byUser array
 * @param {Array} byUser - Array of user metrics objects
 * @returns {Array} Filtered array without super admin metrics
 */
export const excludeSuperAdminFromMetrics = (byUser) => {
  if (!Array.isArray(byUser)) return [];
  return byUser.filter(item => {
    const user = item.user || item;
    const role = user.role;
    return role !== ROLES.SUPER_ADMIN;
  });
};


