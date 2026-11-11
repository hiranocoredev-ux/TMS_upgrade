/**
 * User filtering utilities
 * Excludes non-member roles (super admin, admin, finance manager) from member lists and calculations
 */

import { isFullAdminRole, isNonMemberRole } from '../constants/roles.js';

/**
 * Filter out non-member users (super admin, admin, finance manager) from a user array
 * @param {Array} users - Array of user objects
 * @returns {Array} Filtered array without non-member users
 */
export const excludeSuperAdmin = (users) => {
  if (!Array.isArray(users)) return [];
  return users.filter(user => {
    const u = user.role ? user : (user.user || user);
    return !isNonMemberRole(u.role, u.degree);
  });
};

/**
 * Check if a user is super admin or admin (full access outside finance)
 * @param {Object} user - User object
 * @returns {Boolean}
 */
export const isSuperAdmin = (user) => {
  if (!user) return false;
  const u = user.role ? user : (user.user || user);
  return isFullAdminRole(u.role, u.degree);
};

/**
 * Filter out non-member users from finance metrics byUser array
 * @param {Array} byUser - Array of user metrics objects
 * @returns {Array} Filtered array without non-member metrics
 */
export const excludeSuperAdminFromMetrics = (byUser) => {
  if (!Array.isArray(byUser)) return [];
  return byUser.filter(item => {
    const user = item.user || item;
    return !isNonMemberRole(user.role, user.degree);
  });
};


