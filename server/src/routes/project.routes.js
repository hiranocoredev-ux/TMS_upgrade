import express from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { hasAdminPrivileges, ROLES, normalizeRole } from '../utils/roleMapper.js';
import { isFullAdminRole } from '../constants/roles.js';
import { projectPermissions } from '../utils/permissions/entityPermissions.js';
import dotenv from 'dotenv';

dotenv.config();

const BOSS_CAN_EDIT_PROJECTS = process.env.BOSS_CAN_EDIT_PROJECTS === 'true';

const router = express.Router();

router.use(requireAuth);

const milestoneSchema = z.object({
  name: z.string().min(1),
  dueDate: z.union([z.string().datetime(), z.date()]),
  percent: z.number().min(0).max(100).optional()
});

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  clientCompanyName: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'done']).optional(),
  collaboratorUserIds: z.array(z.string()).optional(),
  clientContacts: z.object({
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    telegram: z.string().optional()
  }).optional(),
  attachments: z.array(z.string()).optional(),
  sourceJobTicketId: z.string().optional(),
  milestones: z.array(milestoneSchema).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  repoLinks: z.array(z.string().url()).optional()
});

const updateProjectSchema = projectSchema.partial();

const commentSchema = z.object({
  text: z.string().min(1, 'Comment text is required')
});

const progressLogSchema = z.object({
  text: z.string().min(1, 'Progress log text is required'),
  attachments: z.array(z.string()).optional()
});

// Use centralized permission helpers (ownership-first)

// GET /projects - List with filters
router.get('/', async (req, res, next) => {
  try {
    const { status, owner, search, page = '1', limit = '20' } = req.query;
    const user = req.user;

    const query = {};

    // RBAC: Members can only see own projects or projects where they're collaborators
    if (normalizeRole(user.role, user.degree) === ROLES.GROUP_MEMBER) {
      query.$or = [
        { ownerUserId: user._id },
        { collaboratorUserIds: user._id }
      ];
    } else if (owner) {
      // Boss/Admin can filter by owner
      query.ownerUserId = owner;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        { clientCompanyName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];

      if (query.$or) {
        query.$and = [
          query.$or,
          { $or: searchConditions }
        ];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [projects, total] = await Promise.all([
      Project.find(query)
        .populate('ownerUserId', 'email name')
        .populate('collaboratorUserIds', 'email name')
        .populate('sourceJobTicketId', 'title')
        .populate('attachments')
        .populate('progressLogs.createdByUserId', 'email name')
        .populate('progressLogs.attachments')
        .populate('comments.createdBy', 'email name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Project.countDocuments(query)
    ]);

    // Filter clientContacts based on permissions
    const projectsWithContacts = projects.map(project => {
      const projectObj = { ...project };
      // Only owner and boss/admin can see clientContacts
      const isOwner = project.ownerUserId._id.toString() === user._id.toString();
      const isBossOrAdmin = isFullAdminRole(user.role, user.degree) || hasAdminPrivileges(user);
      
      if (!isOwner && !isBossOrAdmin) {
        delete projectObj.clientContacts;
      }
      return projectObj;
    });

    res.json(createSuccessResponse({
      projects: projectsWithContacts,
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

// GET /projects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('ownerUserId', 'email name')
      .populate('collaboratorUserIds', 'email name')
      .populate('sourceJobTicketId', 'title')
      .populate('attachments')
      .populate('progressLogs.createdByUserId', 'email name')
      .populate('progressLogs.attachments')
      .populate('comments.createdBy', 'email name');

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Check view permission (ownership-first)
    if (!projectPermissions.canView(req.user, project)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this project',
        403
      ));
    }

    // Hide client contacts if not owner or admin
    const projectObj = project.toObject();
    const perms = projectPermissions.getPermissions(req.user, project);
    if (!perms.isOwner && !hasAdminPrivileges(req.user) && !isFullAdminRole(req.user.role, req.user.degree)) {
      delete projectObj.clientContacts;
    }

    res.json(createSuccessResponse({ project: projectObj }));
  } catch (error) {
    next(error);
  }
});

// POST /projects - Create
router.post('/', async (req, res, next) => {
  try {
    const validatedData = projectSchema.parse(req.body);

    // Convert milestone dates
    if (validatedData.milestones) {
      validatedData.milestones = validatedData.milestones.map(m => ({
        ...m,
        dueDate: m.dueDate instanceof Date ? m.dueDate : new Date(m.dueDate)
      }));
    }

    const project = new Project({
      ...validatedData,
      ownerUserId: req.user._id
    });

    await project.save();
    await project.populate('ownerUserId', 'email name');
    await project.populate('collaboratorUserIds', 'email name');

    // Audit log
    await auditLog(req, 'PROJECT_CREATE', 'PROJECT', project._id.toString(), {
      ...getRequestMeta(req),
      project: { name: project.name, status: project.status }
    });

    res.status(201).json(createSuccessResponse({ project }, 'Project created successfully'));
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

// PUT /projects/:id - Update
router.put('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Check edit permissions (ownership-first): owner can CRUD, admin can edit if enabled
    const editPermission = projectPermissions.canEdit(req.user, project);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        editPermission.reason || 'You do not have permission to edit this project',
        403
      ));
    }

    const validatedData = updateProjectSchema.parse(req.body);

    // Store old values for audit
    const oldValues = {
      name: project.name,
      status: project.status,
      progressPercent: project.progressPercent
    };

    // Convert milestone dates if provided
    if (validatedData.milestones) {
      validatedData.milestones = validatedData.milestones.map(m => ({
        ...m,
        dueDate: m.dueDate instanceof Date ? m.dueDate : new Date(m.dueDate)
      }));
    }

    Object.assign(project, validatedData);
    await project.save();
    await project.populate('ownerUserId', 'email name');
    await project.populate('collaboratorUserIds', 'email name');

    // Audit log
    await auditLog(req, 'PROJECT_UPDATE', 'PROJECT', project._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        name: project.name,
        status: project.status,
        progressPercent: project.progressPercent
      }
    });

    res.json(createSuccessResponse({ project }, 'Project updated successfully'));
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

// DELETE /projects/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Only owner or admin can delete (ownership-first)
    if (!projectPermissions.canDelete(req.user, project)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to delete this project. Only project owners can delete projects.',
        403
      ));
    }

    // Delete all associated tasks
    await Task.deleteMany({ projectId: project._id });

    await project.deleteOne();

    // Audit log
    await auditLog(req, 'PROJECT_DELETE', 'PROJECT', project._id.toString(), {
      ...getRequestMeta(req),
      project: { name: project.name }
    });

    res.json(createSuccessResponse(null, 'Project deleted successfully'));
  } catch (error) {
    next(error);
  }
});

// POST /projects/:id/comments - Add comment
router.post('/:id/comments', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Check view permission (ownership-first)
    const canViewProject = projectPermissions.canView(req.user, project);
    if (!canViewProject) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to comment on this project',
        403
      ));
    }

    // Boss/Admin and collaborators can comment (access.canView implies they can comment)
    const validatedData = commentSchema.parse(req.body);

    project.comments = project.comments || [];
    project.comments.push({
      text: validatedData.text,
      createdBy: req.user._id,
      createdAt: new Date()
    });

    await project.save();
    await project.populate('comments.createdBy', 'email name');

    // Audit log
    await auditLog(req, 'PROJECT_COMMENT_ADD', 'PROJECT', project._id.toString(), {
      ...getRequestMeta(req),
      project: { name: project.name }
    });

    const lastComment = project.comments[project.comments.length - 1];
    res.status(201).json(createSuccessResponse({ comment: lastComment }, 'Comment added successfully'));
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

// POST /projects/:id/progress-logs - Add progress log
router.post('/:id/progress-logs', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Check view permission (ownership-first)
    const canViewProject = projectPermissions.canView(req.user, project);
    if (!canViewProject) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to add progress logs to this project',
        403
      ));
    }

    const validatedData = progressLogSchema.parse(req.body);

    project.progressLogs = project.progressLogs || [];
    project.progressLogs.push({
      text: validatedData.text,
      attachments: validatedData.attachments || [],
      createdByUserId: req.user._id,
      createdAt: new Date()
    });

    await project.save();
    await project.populate('progressLogs.createdByUserId', 'email name');
    await project.populate('progressLogs.attachments');

    // Audit log
    await auditLog(req, 'PROJECT_PROGRESS_LOG_ADD', 'PROJECT', project._id.toString(), {
      ...getRequestMeta(req),
      project: { name: project.name }
    });

    const lastLog = project.progressLogs[project.progressLogs.length - 1];
    res.status(201).json(createSuccessResponse({ progressLog: lastLog }, 'Progress log added successfully'));
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

