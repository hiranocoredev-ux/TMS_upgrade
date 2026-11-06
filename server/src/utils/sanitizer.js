/**
 * Sensitive Field Sanitizer
 * 
 * PRD v3.0: Mask sensitive fields based on ownership and role
 * 
 * Philosophy:
 * - Owners see everything
 * - ADMIN can see everything (team oversight)
 * - Others see masked version of sensitive fields
 * - SUPER_ADMIN always sees everything
 * 
 * Usage:
 * const sanitized = sanitizeForRequester(user, entity, entityType);
 */

import { ROLES } from '../constants/roles.js';
import { isOwner } from './permissions.js';
import { hasAdminPrivileges, canUserOverrideOwnership } from './roleMapper.js';

/**
 * Mask a string (show first and last chars, mask middle)
 * @param {String} str - String to mask
 * @param {Number} visibleStart - Number of chars to show at start (default: 2)
 * @param {Number} visibleEnd - Number of chars to show at end (default: 2)
 * @returns {String} Masked string
 */
export const maskString = (str, visibleStart = 2, visibleEnd = 2) => {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= visibleStart + visibleEnd) return '***'; // Too short, mask all
  
  const start = str.substring(0, visibleStart);
  const end = str.substring(str.length - visibleEnd);
  const masked = '*'.repeat(Math.max(3, str.length - visibleStart - visibleEnd));
  
  return `${start}${masked}${end}`;
};

/**
 * Mask email (show domain, mask username)
 * @param {String} email - Email to mask
 * @returns {String} Masked email
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  
  const [username, domain] = email.split('@');
  if (!domain) return maskString(email);
  
  const maskedUsername = username.length > 2 
    ? `${username[0]}***${username[username.length - 1]}`
    : '***';
  
  return `${maskedUsername}@${domain}`;
};

/**
 * Mask phone number (show country code, mask rest)
 * @param {String} phone - Phone number to mask
 * @returns {String} Masked phone
 */
export const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  
  // If starts with + (country code), preserve first 3 chars
  if (phone.startsWith('+')) {
    if (phone.length <= 6) return '***';
    return `${phone.substring(0, 3)}${'*'.repeat(phone.length - 6)}${phone.substring(phone.length - 2)}`;
  }
  
  // Otherwise mask all but last 2 digits
  if (phone.length <= 4) return '***';
  return `${'*'.repeat(phone.length - 2)}${phone.substring(phone.length - 2)}`;
};

/**
 * Mask bank account number (show last 4 digits)
 * @param {String} accountNumber - Account number to mask
 * @returns {String} Masked account
 */
export const maskBankAccount = (accountNumber) => {
  if (!accountNumber || typeof accountNumber !== 'string') return accountNumber;
  if (accountNumber.length <= 4) return '****';
  return `****${accountNumber.substring(accountNumber.length - 4)}`;
};

/**
 * Mask ID number (show first and last 2 chars)
 * @param {String} idNumber - ID number to mask
 * @returns {String} Masked ID
 */
export const maskIdNumber = (idNumber) => {
  if (!idNumber || typeof idNumber !== 'string') return idNumber;
  if (idNumber.length <= 4) return '****';
  return `${idNumber.substring(0, 2)}${'*'.repeat(idNumber.length - 4)}${idNumber.substring(idNumber.length - 2)}`;
};

/**
 * Check if user should see unmasked sensitive fields
 * PRD v3.0: ADMIN may view only non-sensitive subset unless explicitly allowed
 * @param {Object} user - User object
 * @param {Object} entity - Entity object
 * @returns {Boolean}
 */
export const shouldShowUnmasked = (user, entity) => {
  if (!user || !entity) return false;
  
  // SUPER_ADMIN always sees everything
  if (user.role === ROLES.SUPER_ADMIN || canUserOverrideOwnership(user)) {
    return true;
  }
  
  // Owner always sees everything (ownership-first)
  if (isOwner(user, entity)) {
    return true;
  }
  
  // ADMIN sees masked version by default (unless explicitly allowed via env var)
  // Check if ADMIN_SENSITIVE_ACCESS is enabled
  const adminSensitiveAccess = process.env.ADMIN_SENSITIVE_ACCESS === 'true';
  if (hasAdminPrivileges(user)) {
    return adminSensitiveAccess; // Only unmasked if explicitly enabled
  }
  
  return false;
};

/**
 * Sanitize JobProfile for requester
 * @param {Object} user - User object (requester)
 * @param {Object} profile - JobProfile object
 * @returns {Object} Sanitized profile
 */
export const sanitizeJobProfile = (user, profile) => {
  if (!user || !profile) return profile;
  
  // Clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(profile));
  
  // Check if user should see unmasked data
  const showUnmasked = shouldShowUnmasked(user, profile);
  
  if (!showUnmasked) {
    // Mask sensitive fields (moved to top level in refactored model)
    if (sanitized.email) {
      sanitized.email = maskEmail(sanitized.email);
    }
    if (sanitized.phone) {
      sanitized.phone = maskPhone(sanitized.phone);
    }
    if (sanitized.address) {
      sanitized.address = maskString(sanitized.address, 3, 3);
    }
    // Sensitive fields (masked for non-owners)
    if (sanitized.bankAccount) {
      sanitized.bankAccount = maskBankAccount(sanitized.bankAccount);
    }
    if (sanitized.idNumber) {
      sanitized.idNumber = maskIdNumber(sanitized.idNumber);
    }
    if (sanitized.driverLicenseNumber) {
      sanitized.driverLicenseNumber = maskIdNumber(sanitized.driverLicenseNumber);
    }
  }
  
  return sanitized;
};

/**
 * Sanitize FreelancerAccount for requester
 * @param {Object} user - User object (requester)
 * @param {Object} account - FreelancerAccount object
 * @returns {Object} Sanitized account
 */
export const sanitizeFreelancerAccount = (user, profile) => {
  if (!user || !profile) return profile;
  
  // Clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(profile));
  if (profile.pictureFileId) {
    sanitized.pictureFileId = profile.pictureFileId;
  } else {
    sanitized.pictureFileId = null;
  }
  // Check if user should see unmasked data
  const showUnmasked = shouldShowUnmasked(user, profile);
  
  if (!showUnmasked) {
    // Mask sensitive fields (moved to top level in refactored model)
    if (sanitized.email) {
      sanitized.email = maskEmail(sanitized.email);
    }
    if (sanitized.phone) {
      sanitized.phone = maskPhone(sanitized.phone);
    }
    if (sanitized.address) {
      sanitized.address = maskString(sanitized.address, 3, 3);
    }
    // Sensitive fields (masked for non-owners)
    if (sanitized.bankAccount) {
      sanitized.bankAccount = maskBankAccount(sanitized.bankAccount);
    }
    if (sanitized.idNumber) {
      sanitized.idNumber = maskIdNumber(sanitized.idNumber);
    }
    if (sanitized.driverLicenseNumber) {
      sanitized.driverLicenseNumber = maskIdNumber(sanitized.driverLicenseNumber);
    }
  }
  
  return sanitized;
};

/**
 * Sanitize PersonalProfile for requester
 * @param {Object} user - User object (requester)
 * @param {Object} profile - PersonalProfile object
 * @returns {Object} Sanitized profile
 */
export const sanitizePersonalProfile = (user, profile) => {
  if (!user || !profile) return profile;
  
  // Clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(profile));
  if (profile.pictureFileId) {
    sanitized.pictureFileId = profile.pictureFileId;
  } else {
    sanitized.pictureFileId = null;
  }
  // Check if user should see unmasked data
  const showUnmasked = shouldShowUnmasked(user, profile);
  
  if (!showUnmasked) {
    // Mask sensitive fields (moved to top level in refactored model)
    if (sanitized.email) {
      sanitized.email = maskEmail(sanitized.email);
    }
    if (sanitized.phone) {
      sanitized.phone = maskPhone(sanitized.phone);
    }
    if (sanitized.address) {
      sanitized.address = maskString(sanitized.address, 3, 3);
    }
    // Sensitive fields (masked for non-owners)
    if (sanitized.bankAccount) {
      sanitized.bankAccount = maskBankAccount(sanitized.bankAccount);
    }
    if (sanitized.idNumber) {
      sanitized.idNumber = maskIdNumber(sanitized.idNumber);
    }
    if (sanitized.driverLicenseNumber) {
      sanitized.driverLicenseNumber = maskIdNumber(sanitized.driverLicenseNumber);
    }
  }
  
  return sanitized;
};

/**
 * Generic sanitizer that routes to entity-specific sanitizer
 * @param {Object} user - User object (requester)
 * @param {Object} entity - Entity object
 * @param {String} entityType - Entity type ('JOB_PROFILE', 'FREELANCER_ACCOUNT', 'PERSONAL_PROFILE')
 * @returns {Object} Sanitized entity
 */
export const sanitizeForRequester = (user, entity, entityType) => {
  if (!user || !entity) return entity;
  
  switch (entityType) {
    case 'JOB_PROFILE':
      return sanitizeJobProfile(user, entity);
    case 'FREELANCER_ACCOUNT':
      return sanitizeFreelancerAccount(user, entity);
    case 'PERSONAL_PROFILE':
      return sanitizePersonalProfile(user, entity);
    default:
      // Unknown entity type, return as-is
      console.warn(`Unknown entity type for sanitization: ${entityType}`);
      return entity;
  }
};

/**
 * Sanitize array of entities
 * @param {Object} user - User object (requester)
 * @param {Array} entities - Array of entity objects
 * @param {String} entityType - Entity type
 * @returns {Array} Array of sanitized entities
 */
export const sanitizeEntities = (user, entities, entityType) => {
  if (!Array.isArray(entities)) return entities;
  return entities.map(entity => sanitizeForRequester(user, entity, entityType));
};

