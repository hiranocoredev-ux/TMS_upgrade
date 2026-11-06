import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import AuditLog from '../models/AuditLog.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { hasAdminPrivileges, ROLES, normalizeRole } from '../utils/roleMapper.js';

const router = express.Router();

// All audit log routes require authentication
// router.use(requireAuth);

// Get audit logs with filtering and pagination
router.get('/audit-logs', requireAuth, async (req, res, next) => {
  try {
    const {
      page = '1',
      limit = '20',
      actor = '',
      action = '',
      entityType = ''
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    // RBAC: members see own actions; bosses/super-admins see all (optional actor filter)
    if (normalizeRole(req.user.role, req.user.degree) === ROLES.GROUP_MEMBER) {
      query.actorUserId = req.user._id;
    } else if (actor) {
      query.actorUserId = actor;
    }

    if (action) {
      query.action = action;
    }

    if (entityType) {
      query.entityType = entityType;
    }

    // Execute query with population
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorUserId', 'email name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    // Format logs
    const formattedLogs = logs.map(log => ({
      id: log._id,
      actor: log.actorUserId ? {
        id: log.actorUserId._id,
        email: log.actorUserId.email,
        name: log.actorUserId.name,
        group: log.actorUserId.group,
        role: normalizeRole(log.actorUserId.role, log.actorUserId.degree)
      } : null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      meta: log.meta,
      createdAt: log.createdAt
    }));

    res.json(createSuccessResponse({
      logs: formattedLogs,
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

export default router;

