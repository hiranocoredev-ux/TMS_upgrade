import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { createErrorResponse } from '../utils/errors.js';
import { hasAnyRole, hasAdminPrivileges } from '../utils/roleMapper.js';
import {
  normalizeRole,
  ROLES,
  isFinanceManagerRole,
  isSystemAdminRole,
  isFullAdminRole,
  canManageAllFinance,
} from '../constants/roles.js';

dotenv.config();

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json(createErrorResponse(
        'AUTH_REQUIRED',
        'Authentication required'
      ));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found'
      ));
    }
    
    if (user.status === 'disabled') {
      return res.status(403).json(createErrorResponse(
        'ACCOUNT_DISABLED',
        'Account is disabled'
      ));
    }
    
    // Attach full user object to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(createErrorResponse(
        'INVALID_TOKEN',
        'Invalid token'
      ));
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(createErrorResponse(
        'TOKEN_EXPIRED',
        'Token has expired'
      ));
    }
    return res.status(401).json(createErrorResponse(
      'AUTH_ERROR',
      'Authentication error'
    ));
  }
};

// Alias for backward compatibility
export const authenticate = requireAuth;

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createErrorResponse(
        'AUTH_REQUIRED',
        'Authentication required'
      ));
    }
    
    // Super-admin bypasses all role checks (includes legacy TEAM_BOSS degree mapping)
    if (normalizeRole(req.user.role, req.user.degree) === ROLES.SUPER_ADMIN) {
      return next();
    }

    // Admin may do whatever a super admin may on these routes. Finance writes
    // use requireFinanceManager / requireFinanceWriter, which exclude admins.
    if (isSystemAdminRole(req.user.role, req.user.degree) && roles.includes(ROLES.SUPER_ADMIN)) {
      return next();
    }
    
    // Use role mapper to check if user has any of the required roles
    // This automatically handles BOSS → ADMIN mapping
    if (!hasAnyRole(req.user, roles)) {
      // Also check direct role match for backward compatibility
      if (!roles.includes(req.user.role)) {
        return res.status(403).json(createErrorResponse(
          'INSUFFICIENT_PERMISSIONS',
          'Insufficient permissions'
        ));
      }
    }
    
    next();
  };
};

const FINANCE_READ_ONLY = 'Finance is read-only for your role. Only a Finance Manager can make this change.';

/** Strictly the super admin (not admin): protected accounts, database backup / restore. */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(createErrorResponse('AUTH_REQUIRED', 'Authentication required'));
  }
  if (normalizeRole(req.user.role, req.user.degree) === ROLES.SUPER_ADMIN) return next();
  return res.status(403).json(createErrorResponse('INSUFFICIENT_PERMISSIONS', 'Only a Super Admin can do this'));
};

/** Finance changes for every team that only a finance manager may make (e.g. week periods). */
export const requireFinanceWriter = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(createErrorResponse('AUTH_REQUIRED', 'Authentication required'));
  }
  if (canManageAllFinance(req.user.role, req.user.degree)) return next();
  return res.status(403).json(createErrorResponse(
    'INSUFFICIENT_PERMISSIONS',
    isFullAdminRole(req.user.role, req.user.degree) ? FINANCE_READ_ONLY : 'Insufficient permissions'
  ));
};

/**
 * Finance create/update/delete: a group boss (their own group; legacy ADMIN/BOSS
 * included) or a finance manager (every team). Super admin and admin see finance
 * read-only and are refused.
 */
export const requireFinanceManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(createErrorResponse(
      'AUTH_REQUIRED',
      'Authentication required'
    ));
  }
  if (isFullAdminRole(req.user.role, req.user.degree)) {
    return res.status(403).json(createErrorResponse('INSUFFICIENT_PERMISSIONS', FINANCE_READ_ONLY));
  }
  if (hasAdminPrivileges(req.user) || isFinanceManagerRole(req.user.role, req.user.degree)) {
    return next();
  }
  return res.status(403).json(createErrorResponse(
    'INSUFFICIENT_PERMISSIONS',
    'Insufficient permissions'
  ));
};

