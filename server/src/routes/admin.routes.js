import express from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { GROUP_TYPES, GROUP_TYPE_VALUES } from '../constants/summarize.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Daily from '../models/Daily.js';
import Weekly from '../models/Weekly.js';
import Monthly from '../models/Monthly.js';
import TimeEntry from '../models/TimeEntry.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { hasAdminPrivileges, ROLES, normalizeRole } from '../utils/roleMapper.js';
import { USER_GROUP_VALUES, DEFAULT_USER_GROUP } from '../constants/groups.js';
import { WORKING_ROLE_VALUES } from '../constants/profiles.js';
import { userOrderStages, USER_ORDER_CLEANUP } from '../utils/userOrder.js';

const router = express.Router();

// All admin routes require a valid session (must run before requireRole / handlers that use req.user)
router.use(requireAuth);

/* ======================================================
   GROUP MANAGEMENT (Super Admin only)
====================================================== */

// GET /admin/groups - List all groups (read: any authenticated, write: super admin only)
router.get('/groups', async (req, res, next) => {
  try {
    const groups = await Group.find().sort({ sortOrder: 1, code: 1 }).lean();
    res.json(createSuccessResponse({ groups }));
  } catch (error) {
    next(error);
  }
});

// POST /admin/groups - Create group
router.post('/groups', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, code, sortOrder, type } = req.body;
    if (!name || !code) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        'name and code are required',
        400
      ));
    }
    const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await Group.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json(createErrorResponse(
        'DUPLICATE_GROUP',
        `Group with code "${normalizedCode}" already exists`,
        400
      ));
    }
    if (type !== undefined && !GROUP_TYPE_VALUES.includes(type)) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        `type must be one of: ${GROUP_TYPE_VALUES.join(', ')}`,
        400
      ));
    }
    const group = await Group.create({
      name: name.trim(),
      code: normalizedCode,
      sortOrder: sortOrder ?? 0,
      type: type ?? GROUP_TYPES.NORMAL
    });
    res.status(201).json(createSuccessResponse({ group }, 'Group created successfully'));
  } catch (error) {
    next(error);
  }
});

// PUT /admin/groups/:id - Update group
router.put('/groups/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Group not found', 404));
    }
    const { name, code, sortOrder, type } = req.body;
    if (type !== undefined) {
      if (!GROUP_TYPE_VALUES.includes(type)) {
        return res.status(400).json(createErrorResponse(
          'VALIDATION_ERROR',
          `type must be one of: ${GROUP_TYPE_VALUES.join(', ')}`,
          400
        ));
      }
      group.type = type;
    }
    if (name !== undefined) group.name = name.trim();
    if (code !== undefined) {
      const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, '_');
      const existing = await Group.findOne({ code: normalizedCode, _id: { $ne: group._id } });
      if (existing) {
        return res.status(400).json(createErrorResponse(
          'DUPLICATE_GROUP',
          `Group with code "${normalizedCode}" already exists`,
          400
        ));
      }
      group.code = normalizedCode;
    }
    if (sortOrder !== undefined) group.sortOrder = sortOrder;
    await group.save();
    res.json(createSuccessResponse({ group }, 'Group updated successfully'));
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/groups/:id - Delete group
router.delete('/groups/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Group not found', 404));
    }
    const userCount = await User.countDocuments({ group: group.code });
    if (userCount > 0) {
      return res.status(400).json(createErrorResponse(
        'GROUP_IN_USE',
        `Cannot delete group: ${userCount} user(s) are assigned to it. Reassign users first.`,
        400
      ));
    }
    await Group.findByIdAndDelete(req.params.id);
    res.json(createSuccessResponse(null, 'Group deleted successfully'));
  } catch (error) {
    next(error);
  }
});

// Valid group values: all Group codes from DB
const getValidGroupValues = async () => {
  const groups = await Group.find().select('code').lean();
  const codes = groups.map(g => g.code);
  return codes;
};

const hubstaffIdField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  });

const roleField = z.enum([
  'SUPER_ADMIN',
  'GROUP_BOSS',
  'GROUP_MEMBER',
  'ADMIN',
  'BOSS',
  'MEMBER',
  'GUEST',
]);

// One working role per member (Normal Working / Bittensor / Job Working).
const workingRoleField = z.enum(['', ...WORKING_ROLE_VALUES]).optional();

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  group: z.string().min(1).optional(),
  role: roleField.optional(),
  paymentRequestApprover: z.boolean().optional(),
  workingRole: workingRoleField,
  status: z.enum(['active', 'disabled', 'pending']).optional(),
  hubstaff_id: hubstaffIdField
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long').optional(),
  group: z.string().min(1).optional(),
  role: roleField.optional(),
  paymentRequestApprover: z.boolean().optional(),
  workingRole: workingRoleField,
  status: z.enum(['active', 'disabled', 'pending']).optional(),
  hubstaff_id: hubstaffIdField
});

// Get users with filtering and pagination
router.get('/users', async (req, res, next) => {
  try {
    const {
      search = '',
      group = '',
      role = '',
      status = '',
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    if (group) {
      query.group = group;
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    // Execute query
    const groupsForOrder = await Group.find().select('code sortOrder').lean();
    const [users, total] = await Promise.all([
      User.aggregate([
        { $match: query },
        ...userOrderStages(groupsForOrder),
        { $skip: skip },
        { $limit: limitNum },
        { $project: { passwordHash: 0 } },
        USER_ORDER_CLEANUP,
      ]),
      User.countDocuments(query)
    ]);

    // Format users
    const formattedUsers = users.map((user) => {
      const canonicalRole = normalizeRole(user.role, user.degree);
      return {
        id: user._id,
        email: user.email,
        name: user.name,
        group: canonicalRole === ROLES.SUPER_ADMIN ? null : user.group,
        role: canonicalRole,
        paymentRequestApprover: !!user.paymentRequestApprover,
        workingRole: user.workingRole || '',
        workingRoles: Array.isArray(user.workingRoles) ? user.workingRoles : [],
        status: user.status,
        avatarUrl: user.avatarUrl || '',
        hubstaff_id: user.hubstaff_id || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    });

    res.json(createSuccessResponse({
      users: formattedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }));
  } catch (error) {
    next(error);
  }
});

// Create user (admin only)
router.post('/users', async (req, res, next) => {
  try {
    const validatedData = createUserSchema.parse(req.body);

    const canonicalRole = normalizeRole(validatedData.role || ROLES.GROUP_MEMBER);

    // Validate group for non-SUPER_ADMIN users only
    if (canonicalRole !== ROLES.SUPER_ADMIN && !validatedData.group) {
      return res.status(400).json(createErrorResponse(
        'GROUP_REQUIRED',
        'Group is required for non-SUPER_ADMIN users',
        400
      ));
    }
    if (canonicalRole !== ROLES.SUPER_ADMIN && validatedData.group) {
      const validGroups = await getValidGroupValues();
      if (!validGroups.includes(validatedData.group)) {
        return res.status(400).json(createErrorResponse(
          'INVALID_GROUP',
          `Invalid group. Must be one of: ${validGroups.join(', ')}`,
          400
        ));
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json(createErrorResponse(
        'USER_EXISTS',
        'User with this email already exists',
        400
      ));
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN
    if (normalizeRole(validatedData.role) === ROLES.SUPER_ADMIN && normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only SUPER_ADMIN can create SUPER_ADMIN users',
        403
      ));
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!1';
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = new User({
      email: validatedData.email.toLowerCase(),
      passwordHash,
      name: validatedData.name,
      group: canonicalRole === ROLES.SUPER_ADMIN
        ? null
        : (validatedData.group || DEFAULT_USER_GROUP),
      role: canonicalRole,
      paymentRequestApprover:
        normalizeRole(req.user.role, req.user.degree) === ROLES.SUPER_ADMIN &&
        validatedData.paymentRequestApprover === true,
      workingRole: canonicalRole === ROLES.SUPER_ADMIN ? '' : (validatedData.workingRole || ''),
      status: validatedData.status || 'pending',
      hubstaff_id: validatedData.hubstaff_id ?? null
    });

    await user.save();

    // Audit log
    await auditLog(req, 'USER_CREATE', 'USER', user._id.toString(), {
      ...getRequestMeta(req),
      createdUser: {
        email: user.email,
        name: user.name,
        group: user.group,
        role: user.role,
        workingRole: user.workingRole || '',
        status: user.status
      }
    });

    // Return user summary and temporary password
    res.status(201).json(createSuccessResponse({
      user: user.toSummary(),
      tempPassword // Return temp password for v1 local use
    }, 'User created successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    if (error.code === 11000) {
      return res.status(400).json(createErrorResponse(
        'USER_EXISTS',
        'User with this email already exists',
        400
      ));
    }
    next(error);
  }
});

// Update user (admin only)
router.put('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        404
      ));
    }

    const currentRole = normalizeRole(user.role, user.degree);
    const nextRole = validatedData.role !== undefined
      ? normalizeRole(validatedData.role)
      : currentRole;

    // Validate group only for non-SUPER_ADMIN users
    if (nextRole !== ROLES.SUPER_ADMIN && validatedData.group !== undefined) {
      const validGroups = await getValidGroupValues();
      if (!validGroups.includes(validatedData.group)) {
        return res.status(400).json(createErrorResponse(
          'INVALID_GROUP',
          `Invalid group. Must be one of: ${validGroups.join(', ')}`,
          400
        ));
      }
    }

    // Only SUPER_ADMIN can update SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN' && normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Cannot modify SUPER_ADMIN user',
        403
      ));
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (validatedData.role === 'SUPER_ADMIN' && normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only SUPER_ADMIN can assign SUPER_ADMIN role',
        403
      ));
    }

    const targetCanon = validatedData.role
      ? normalizeRole(validatedData.role)
      : null;

    // Only privileged users assign GROUP_BOSS
    if (
      targetCanon === ROLES.GROUP_BOSS &&
      normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN &&
      !hasAdminPrivileges(req.user)
    ) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only Super Admin or Group Boss can assign Group Boss role',
        403
      ));
    }

    // Prevent self-disabling
    if (validatedData.status === 'disabled' && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json(createErrorResponse(
        'CANNOT_DISABLE_SELF',
        'Cannot disable your own account',
        400
      ));
    }

    // Store old values for audit
    const oldValues = {
      group: user.group,
      role: user.role,
      status: user.status,
      workingRole: user.workingRole || ''
    };

    // Update fields
    if (validatedData.role !== undefined) {
      user.role = nextRole;
      // Drop legacy degree once role is explicitly managed.
      user.degree = undefined;
    }
    if (nextRole === ROLES.SUPER_ADMIN) {
      user.group = null;
    } else if (validatedData.group !== undefined) {
      user.group = validatedData.group;
    } else if (!user.group) {
      user.group = DEFAULT_USER_GROUP;
    }
    if (validatedData.status !== undefined) user.status = validatedData.status;
    if (validatedData.paymentRequestApprover !== undefined) {
      if (normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN) {
        return res.status(403).json(createErrorResponse(
          'INSUFFICIENT_PERMISSIONS',
          'Only SUPER_ADMIN can assign payment request approver',
          403
        ));
      }
      user.paymentRequestApprover = validatedData.paymentRequestApprover;
    }
    if (validatedData.workingRole !== undefined) {
      user.workingRole = nextRole === ROLES.SUPER_ADMIN ? '' : (validatedData.workingRole || '');
    }
    if (nextRole === ROLES.SUPER_ADMIN) {
      // A super admin works no profile role.
      user.workingRole = '';
    }
    if (validatedData.hubstaff_id !== undefined) user.hubstaff_id = validatedData.hubstaff_id;
    if (validatedData.email !== undefined) user.email = validatedData.email.toLowerCase().trim();
    if (validatedData.name !== undefined) user.name = validatedData.name.trim();

    await user.save();

    /**
     * If the user's group changed, migrate the snapshot `group` field on all
     * of their historical Daily/Weekly/Monthly reports AND TimeEntry records
     * so that the new group's boss (and super admin viewing that group) can
     * see the user's full report/plan history and work-time totals. Without
     * this, records still carry the OLD group value and become invisible to
     * the new group's listing query. The competition system aggregates from
     * the same TimeEntry collection, so this also restores competition
     * visibility for moved users.
     *
     * Worklog (Hubstaff sync) is not group-scoped (keyed by hubstaff member
     * id), so it requires no migration.
     */
    if (
      oldValues.group !== undefined &&
      oldValues.group !== null &&
      user.group &&
      String(oldValues.group) !== String(user.group)
    ) {
      const migrationFilter = { userId: user._id };
      const migrationUpdate = { $set: { group: user.group } };
      const [dailyRes, weeklyRes, monthlyRes, timeRes] = await Promise.all([
        Daily.updateMany(migrationFilter, migrationUpdate),
        Weekly.updateMany(migrationFilter, migrationUpdate),
        Monthly.updateMany(migrationFilter, migrationUpdate),
        TimeEntry.updateMany(migrationFilter, migrationUpdate),
      ]);
      await auditLog(req, 'USER_GROUP_MIGRATION', 'USER', user._id.toString(), {
        ...getRequestMeta(req),
        oldGroup: oldValues.group,
        newGroup: user.group,
        migrated: {
          daily: dailyRes?.modifiedCount || 0,
          weekly: weeklyRes?.modifiedCount || 0,
          monthly: monthlyRes?.modifiedCount || 0,
          timeEntry: timeRes?.modifiedCount || 0,
        },
      });
    }

    // Audit log
    await auditLog(req, 'USER_UPDATE', 'USER', user._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        group: user.group,
        role: user.role,
        status: user.status,
        workingRole: user.workingRole || ''
      },
      updatedUser: {
        email: user.email,
        name: user.name
      }
    });

    res.json(createSuccessResponse({
      user: user.toSummary()
    }, 'User updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    if (error.code === 11000) {
      return res.status(400).json(createErrorResponse(
        'USER_EXISTS',
        'User with this email already exists',
        400
      ));
    }
    next(error);
  }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        404
      ));
    }

    // Only SUPER_ADMIN can reset SUPER_ADMIN password
    if (user.role === 'SUPER_ADMIN' && normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Cannot reset SUPER_ADMIN password',
        403
      ));
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!1';
    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    await user.save();

    // Audit log
    await auditLog(req, 'USER_RESET_PASSWORD', 'USER', user._id.toString(), {
      ...getRequestMeta(req),
      resetUser: {
        email: user.email,
        name: user.name,
        group: user.group,
        role: user.role
      }
    });

    res.json(createSuccessResponse({
      tempPassword // Return temp password for v1 local use
    }, 'Password reset successfully'));
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        404
      ));
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json(createErrorResponse(
        'CANNOT_DELETE_SELF',
        'You cannot delete your own account',
        400
      ));
    }

    if (user.role === 'SUPER_ADMIN' && normalizeRole(req.user.role, req.user.degree) !== ROLES.SUPER_ADMIN) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Cannot delete SUPER_ADMIN user',
        403
      ));
    }

    const deletedMeta = {
      email: user.email,
      name: user.name,
      group: user.group,
      role: user.role
    };

    await User.findByIdAndDelete(id);

    await auditLog(req, 'USER_DELETE', 'USER', id, {
      ...getRequestMeta(req),
      deletedUser: deletedMeta
    });

    res.json(createSuccessResponse(null, 'User deleted successfully'));
  } catch (error) {
    next(error);
  }
});

export default router;