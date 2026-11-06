/**
 * Ownership-First Permission Helpers
 * 
 * PRD v3.0 Permission Philosophy:
 * - Ownership is the primary access control
 * - Roles grant additional permissions beyond ownership
 * - SUPER_ADMIN bypasses all checks
 * 
 * Usage Pattern:
 * 1. Check if user is owner → if yes, grant access
 * 2. Check if user has role-based access → if yes, grant access
 * 3. Check if user has assignment-based access → if yes, grant access
 * 4. Otherwise, deny access
 */

import { ROLES } from '../constants/roles.js';
import { hasAdminPrivileges, canUserOverrideOwnership, normalizeRole } from './roleMapper.js';

/**
 * Check if user is the owner of an entity
 * @param {Object} user - User object
 * @param {Object|String} entity - Entity object or ownerId string/ObjectId
 * @param {String} ownerField - Field name for owner (default: 'ownerUserId')
 * @returns {Boolean}
 */
export const isOwner = (user, entity, ownerField = 'ownerUserId') => {
  if (!user || !entity) return false;
  
  // Handle entity as object
  if (typeof entity === 'object' && entity !== null) {
    const ownerId = entity[ownerField];
    if (!ownerId) return false;
    return ownerId.toString() === user._id.toString();
  }
  
  // Handle entity as ownerId string/ObjectId
  return entity.toString() === user._id.toString();
};

/**
 * Check if user can view an entity (ownership-first)
 * @param {Object} user - User object
 * @param {Object} entity - Entity object
 * @param {Object} options - Permission options
 * @returns {Boolean}
 */
export const canView = (user, entity, options = {}) => {
  if (!user || !entity) return false;
  
  // SUPER_ADMIN can view everything
  if (user.role === ROLES.SUPER_ADMIN || canUserOverrideOwnership(user)) {
    return true;
  }
  
  const {
    ownerField = 'ownerUserId',
    collaboratorField = 'collaboratorUserIds',
    allowAdmin = true,
    allowCollaborator = false,
    customCheck = null
  } = options;
  
  // 1. Check ownership (first priority)
  if (isOwner(user, entity, ownerField)) {
    return true;
  }
  
  // 3. Check collaboration
  if (allowCollaborator && collaboratorField && entity[collaboratorField]) {
    const collaborators = Array.isArray(entity[collaboratorField]) 
      ? entity[collaboratorField] 
      : [entity[collaboratorField]];
    
    if (collaborators.some(id => id.toString() === user._id.toString())) {
      return true;
    }
  }
  
  // 4. Check admin privileges
  if (allowAdmin && hasAdminPrivileges(user)) {
    return true;
  }
  
  // 5. Custom check (if provided)
  if (customCheck && typeof customCheck === 'function') {
    return customCheck(user, entity);
  }
  
  return false;
};

/**
 * Check if user can edit an entity (ownership-first)
 * @param {Object} user - User object
 * @param {Object} entity - Entity object
 * @param {Object} options - Permission options
 * @returns {Object} { canEdit: Boolean, reason?: String }
 */
export const canEdit = (user, entity, options = {}) => {
  if (!user || !entity) {
    return { canEdit: false, reason: 'User or entity not provided' };
  }
  
  // SUPER_ADMIN can edit everything
  if (user.role === ROLES.SUPER_ADMIN || canUserOverrideOwnership(user)) {
    return { canEdit: true };
  }
  
  const {
    ownerField = 'ownerUserId',
    allowAdmin = true,
    adminCanEdit = false, // Default: admin can view but not edit
    customCheck = null
  } = options;

  // 1. Check ownership (first priority)
  if (isOwner(user, entity, ownerField)) {
    return { canEdit: true };
  }
  
  // 3. Check admin privileges (if admin editing is allowed)
  if (allowAdmin && adminCanEdit && hasAdminPrivileges(user)) {
    return { canEdit: true };
  }
  
  // 4. Custom check (if provided)
  if (customCheck && typeof customCheck === 'function') {
    const result = customCheck(user, entity);
    return typeof result === 'boolean' ? { canEdit: result } : result;
  }
  
  return { canEdit: false, reason: 'Insufficient permissions' };
};

/**
 * Check if user can delete an entity (ownership-first)
 * @param {Object} user - User object
 * @param {Object} entity - Entity object
 * @param {Object} options - Permission options
 * @returns {Boolean}
 */
export const canDelete = (user, entity, options = {}) => {
  if (!user || !entity) return false;
  
  // SUPER_ADMIN can delete everything (except other SUPER_ADMIN users)
  if (user.role === ROLES.SUPER_ADMIN || canUserOverrideOwnership(user)) {
    return true;
  }
  
  const {
    ownerField = 'ownerUserId',
    allowAdmin = true,
    requireAdmin = false, // If true, only admin can delete
    customCheck = null
  } = options;
  
  // If only admin can delete, check admin privilege
  if (requireAdmin && !hasAdminPrivileges(user)) {
    return false;
  }
  
  // 1. Check ownership (first priority)
  if (isOwner(user, entity, ownerField)) {
    return true;
  }
  
  // 2. Check admin privileges (if admin deletion is allowed)
  if (allowAdmin && hasAdminPrivileges(user)) {
    return true;
  }
  
  // 3. Custom check (if provided)
  if (customCheck && typeof customCheck === 'function') {
    return customCheck(user, entity);
  }
  
  return false;
};

/**
 * Check if user can create an entity
 * @param {Object} user - User object
 * @param {Object} options - Permission options
 * @returns {Boolean}
 */
export const canCreate = (user, options = {}) => {
  if (!user) return false;
  
  // SUPER_ADMIN can create everything
  if (user.role === ROLES.SUPER_ADMIN || canUserOverrideOwnership(user)) {
    return true;
  }
  
  const {
    requireAdmin = false,
    allowAdmin = true,
    allowMember = false
  } = options;

  // Check if admin required
  if (requireAdmin && !hasAdminPrivileges(user)) {
    return false;
  }

  // Check if member allowed
  if (allowMember && normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER) {
    return true;
  }

  // Check admin privileges
  if (allowAdmin && hasAdminPrivileges(user)) {
    return true;
  }

  return false;
};

/**
 * Get permission summary for an entity (ownership-first)
 * @param {Object} user - User object
 * @param {Object} entity - Entity object
 * @param {Object} options - Permission options
 * @returns {Object} { canView: Boolean, canEdit: Boolean, canDelete: Boolean, isOwner: Boolean }
 */
export const getPermissions = (user, entity, options = {}) => {
  const viewResult = canView(user, entity, options);
  const editResult = canEdit(user, entity, options);
  const deleteResult = canDelete(user, entity, options);
  const ownerResult = isOwner(user, entity, options.ownerField);
  
  return {
    canView: viewResult,
    canEdit: editResult.canEdit || false,
    canDelete: deleteResult,
    isOwner: ownerResult,
    reason: editResult.reason || null
  };
};

