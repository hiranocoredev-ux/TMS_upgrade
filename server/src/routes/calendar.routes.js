import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import Interview from '../models/Interview.js';
import JobTicket from '../models/JobTicket.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { hasAdminPrivileges, ROLES, normalizeRole } from '../utils/roleMapper.js';

const router = express.Router();

router.use(requireAuth);

// Helper to build query based on user role
const buildInterviewQuery = async (user, filters = {}) => {
  const query = {};

  // All authenticated users can see all interviews (no assignedUserId filtering)

  // Apply additional filters
  if (filters.memberId) {
    // For SUPER_ADMIN/ADMIN (including legacy BOSS), allow filtering by member
    if (user.role === ROLES.SUPER_ADMIN || hasAdminPrivileges(user)) {
      query.createdByUserId = filters.memberId;
    }
  }

  if (filters.from || filters.to) {
    query.scheduledAt = {};
    if (filters.from) {
      query.scheduledAt.$gte = new Date(filters.from);
    }
    if (filters.to) {
      query.scheduledAt.$lte = new Date(filters.to);
    }
  }

  return query;
};

// GET /calendar/interviews - Calendar view with date range
router.get('/interviews', async (req, res, next) => {
  try {
    const { from, to, memberId } = req.query;

    if (!from || !to) {
      return res.status(400).json(createErrorResponse(
        'DATE_RANGE_REQUIRED',
        'Both from and to date parameters are required',
        400
      ));
    }

    const query = await buildInterviewQuery(req.user, { from, to, memberId });

    const interviews = await Interview.find(query)
      .populate('jobTicketId', 'title currentStage')
      .populate('createdByUserId', 'email name')
      .populate('resumeFileId')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json(createSuccessResponse({ interviews }));
  } catch (error) {
    next(error);
  }
});

export default router;
