import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import JobTicket, { TICKET_STAGES, CLOSED_STAGES } from '../models/JobTicket.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES } from '../utils/roleMapper.js';
import { jobTicketPermissions } from '../utils/permissions/entityPermissions.js';

const router = express.Router();

router.use(requireAuth);

const jobTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  platformSource: z.string().optional(),
  jobUrl: z.string().url().optional().or(z.literal('')),
  clientName: z.string().optional(),
  descriptionRichText: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  jobProfileId: z.string().optional(),
  bidDate: z.union([z.string().datetime(), z.date(), z.literal('')]).optional(),
  bidAmount: z.number().positive().optional().nullable(),
  followUpDate: z.union([z.string().datetime(), z.date(), z.literal('')]).optional(),
  currentStage: z.enum(TICKET_STAGES).optional(),
  outcomeReason: z.string().optional()
});

const updateJobTicketSchema = jobTicketSchema.partial().extend({
  bidDate: z.union([z.string().datetime(), z.date(), z.literal(''), z.null()]).optional(),
  bidAmount: z.number().positive().optional().nullable(),
  followUpDate: z.union([z.string().datetime(), z.date(), z.literal(''), z.null()]).optional()
});

const moveStageSchema = z.object({
  toStage: z.enum(TICKET_STAGES),
  reason: z.string().optional()
});

// Use centralized permission helpers (ownership-first)

// GET /job-tickets - List with filters
router.get('/', async (req, res, next) => {
  try {
    const {
      profile,
      stage,
      status,
      platform,
      tags,
      search,
      dateFrom,
      dateTo,
      page = '1',
      limit = '20'
    } = req.query;

    const user = req.user;
    const query = {};

    // All authenticated users can see all tickets (no assignedUserId filtering)

    if (profile) {
      query.jobProfileId = profile;
    }

    if (stage) {
      query.currentStage = stage;
    }

    if (status) {
      query.status = status;
    }

    if (platform) {
      query.platformSource = { $regex: platform, $options: 'i' };
    }

    if (tags && tags.length > 0) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    if (search) {
      const searchConditions = [
        { title: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { platformSource: { $regex: search, $options: 'i' } },
        { descriptionRichText: { $regex: search, $options: 'i' } }
      ];

      // Combine search with existing query
      if (Object.keys(query).length > 0) {
        const existingConditions = { ...query };
        query = {
          $and: [
            existingConditions,
            { $or: searchConditions }
          ]
        };
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      JobTicket.find(query)
        .populate('jobProfileId', 'name')
        .populate('stageHistory.changedByUserId', 'email name')
        .populate('attachments')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      JobTicket.countDocuments(query)
    ]);

    res.json(createSuccessResponse({
      tickets,
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

// GET /job-tickets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await JobTicket.findById(req.params.id)
      .populate('jobProfileId', 'name')
      .populate('stageHistory.changedByUserId', 'email name')
      .populate('attachments');

    if (!ticket) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job ticket not found',
        404
      ));
    }

    // Check view permission (ownership-first)
    if (!jobTicketPermissions.canView(req.user, ticket)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this job ticket',
        403
      ));
    }

    res.json(createSuccessResponse({ ticket }));
  } catch (error) {
    next(error);
  }
});

// POST /job-tickets - Create
router.post('/', async (req, res, next) => {
  try {
    const validatedData = jobTicketSchema.parse(req.body);

    // Convert date strings to Date objects
    const ticketData = {
      ...validatedData,
      bidDate: validatedData.bidDate && validatedData.bidDate !== '' 
        ? (validatedData.bidDate instanceof Date ? validatedData.bidDate : new Date(validatedData.bidDate))
        : undefined,
      followUpDate: validatedData.followUpDate && validatedData.followUpDate !== ''
        ? (validatedData.followUpDate instanceof Date ? validatedData.followUpDate : new Date(validatedData.followUpDate))
        : undefined,
      currentStage: validatedData.currentStage || 'NEW'
    };

    const ticket = new JobTicket(ticketData);

    // Stage history will be initialized when first stage move happens
    // Initial creation doesn't need history entry

    await ticket.save();
    await ticket.populate('jobProfileId', 'name');

    // Audit log
    await auditLog(req, 'JOB_TICKET_CREATE', 'JOB_TICKET', ticket._id.toString(), {
      ...getRequestMeta(req),
      ticket: {
        title: ticket.title,
        currentStage: ticket.currentStage
      }
    });

    res.status(201).json(createSuccessResponse({ ticket }, 'Job ticket created successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    next(error);
  }
});

// PUT /job-tickets/:id - Update
router.put('/:id', async (req, res, next) => {
  try {
    const ticket = await JobTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job ticket not found',
        404
      ));
    }

    // Check view permission (ownership-first)
    if (!jobTicketPermissions.canView(req.user, ticket)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this job ticket',
        403
      ));
    }

    // Check edit permission (ownership-first)
    const editPermission = jobTicketPermissions.canEdit(req.user, ticket);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        editPermission.reason || 'You do not have permission to update this job ticket',
        403
      ));
    }

    const validatedData = updateJobTicketSchema.parse(req.body);

    // Store old values for audit
    const oldValues = {
      title: ticket.title,
      currentStage: ticket.currentStage,
      status: ticket.status
    };

    // Convert date strings to Date objects
    if (validatedData.bidDate !== undefined) {
      if (validatedData.bidDate === '' || validatedData.bidDate === null) {
        ticket.bidDate = null;
      } else {
        ticket.bidDate = validatedData.bidDate instanceof Date ? validatedData.bidDate : new Date(validatedData.bidDate);
      }
    }
    if (validatedData.followUpDate !== undefined) {
      if (validatedData.followUpDate === '' || validatedData.followUpDate === null) {
        ticket.followUpDate = null;
      } else {
        ticket.followUpDate = validatedData.followUpDate instanceof Date ? validatedData.followUpDate : new Date(validatedData.followUpDate);
      }
    }
    if (validatedData.bidAmount !== undefined) {
      ticket.bidAmount = validatedData.bidAmount;
    }

    // Update other fields (excluding currentStage which is handled by move-stage)
    Object.keys(validatedData).forEach(key => {
      if (key !== 'bidDate' && key !== 'followUpDate' && key !== 'bidAmount' && key !== 'currentStage') {
        if (validatedData[key] !== undefined) {
          ticket[key] = validatedData[key];
        }
      }
    });

    await ticket.save();
    await ticket.populate('jobProfileId', 'name');

    // Audit log
    await auditLog(req, 'JOB_TICKET_UPDATE', 'JOB_TICKET', ticket._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        title: ticket.title,
        currentStage: ticket.currentStage,
        status: ticket.status
      }
    });

    res.json(createSuccessResponse({ ticket }, 'Job ticket updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    next(error);
  }
});

// DELETE /job-tickets/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const ticket = await JobTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job ticket not found',
        404
      ));
    }

    // Only Boss/Admin can delete
    // Check delete permission (ownership-first)
    if (!jobTicketPermissions.canDelete(req.user, ticket)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to delete job tickets',
        403
      ));
    }

    await ticket.deleteOne();

    // Audit log
    await auditLog(req, 'JOB_TICKET_DELETE', 'JOB_TICKET', ticket._id.toString(), {
      ...getRequestMeta(req),
      ticket: { title: ticket.title }
    });

    res.json(createSuccessResponse(null, 'Job ticket deleted successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /job-tickets/:id/move-stage - Move to different stage
router.post('/:id/move-stage', async (req, res, next) => {
  try {
    const ticket = await JobTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Job ticket not found',
        404
      ));
    }

    // Check view permission (ownership-first)
    if (!jobTicketPermissions.canView(req.user, ticket)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to modify this job ticket',
        403
      ));
    }

    const validatedData = moveStageSchema.parse(req.body);
    const { toStage, reason } = validatedData;

    // Validate transition (can add business rules here)
    if (toStage === ticket.currentStage) {
      return res.status(400).json(createErrorResponse(
        'INVALID_TRANSITION',
        'Ticket is already in this stage',
        400
      ));
    }

    // Store old values
    const fromStage = ticket.currentStage;
    const oldStatus = ticket.status;

    // Update stage
    ticket.currentStage = toStage;
    ticket.addStageHistory(fromStage, toStage, req.user._id, reason || '');

    // If moving to closed stages, update status and outcome reason
    if (CLOSED_STAGES.includes(toStage)) {
      ticket.status = 'closed';
      if (req.body.outcomeReason) {
        ticket.outcomeReason = req.body.outcomeReason;
      }
    }

    await ticket.save();
    await ticket.populate('jobProfileId', 'name');
    await ticket.populate('stageHistory.changedByUserId', 'email name');

    // Audit log - TICKET_MOVE_STAGE
    await auditLog(req, 'TICKET_MOVE_STAGE', 'JOB_TICKET', ticket._id.toString(), {
      ...getRequestMeta(req),
      ticket: {
        title: ticket.title,
        fromStage,
        toStage,
        reason: reason || ''
      },
      statusChange: {
        from: oldStatus,
        to: ticket.status
      }
    });

    res.json(createSuccessResponse(
      { ticket },
      `Ticket moved from ${fromStage} to ${toStage}`
    ));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    next(error);
  }
});

export default router;
