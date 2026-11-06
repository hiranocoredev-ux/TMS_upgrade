import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES, hasAdminPrivileges } from '../utils/roleMapper.js';
import { taskPermissions, projectPermissions } from '../utils/permissions/entityPermissions.js';
import dotenv from 'dotenv';

dotenv.config();

const BOSS_CAN_EDIT_PROJECTS = process.env.BOSS_CAN_EDIT_PROJECTS === 'true';

const router = express.Router();

router.use(requireAuth);

const checklistItemSchema = z.object({
  text: z.string().min(1),
  done: z.boolean().optional()
});

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.union([z.string().datetime(), z.date()]).optional().or(z.literal('')),
  checklist: z.array(checklistItemSchema).optional(),
  attachments: z.array(z.string()).optional()
});

const updateTaskSchema = taskSchema.partial();

// Use centralized permission helpers (ownership-first)

// GET /projects/:projectId/tasks - List tasks for a project
router.get('/:projectId/tasks', async (req, res, next) => {
  try {
    const { status, priority, page = '1', limit = '50' } = req.query;
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'PROJECT_NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Check view permission (ownership-first: owner, collaborator, or admin can view)
    if (!projectPermissions.canView(req.user, project)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view tasks for this project',
        403
      ));
    }

    const query = { projectId: project._id };

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('comments.createdBy', 'email name')
        .populate('attachments')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Task.countDocuments(query)
    ]);

    res.json(createSuccessResponse({
      tasks,
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

// GET /projects/:projectId/tasks/:id - Get single task
router.get('/:projectId/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('comments.createdBy', 'email name')
      .populate('attachments');

    if (!task) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Task not found',
        404
      ));
    }

    // Verify task belongs to the project
    if (task.projectId.toString() !== req.params.projectId) {
      return res.status(400).json(createErrorResponse(
        'INVALID_PROJECT',
        'Task does not belong to the specified project',
        400
      ));
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return res.status(404).json(createErrorResponse(
        'PROJECT_NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Check view permission (ownership-first: owner, collaborator, or admin can view)
    if (!taskPermissions.canView(req.user, task, project)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this task',
        403
      ));
    }

    res.json(createSuccessResponse({ task }));
  } catch (error) {
    next(error);
  }
});

// POST /projects/:projectId/tasks - Create task
router.post('/:projectId/tasks', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json(createErrorResponse(
        'PROJECT_NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Only project owner can create tasks (ownership-first)
    const canCreate = taskPermissions.canCreate(req.user, project);
    if (!canCreate) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to create tasks for this project. Only project owners can create tasks.',
        403
      ));
    }

    const validatedData = taskSchema.parse(req.body);

    const task = new Task({
      ...validatedData,
      projectId: project._id,
      dueDate: validatedData.dueDate && validatedData.dueDate !== ''
        ? (validatedData.dueDate instanceof Date ? validatedData.dueDate : new Date(validatedData.dueDate))
        : undefined
    });

    await task.save();
    await task.populate('comments.createdBy', 'email name');
    await task.populate('attachments');

    // Audit log
    await auditLog(req, 'TASK_CREATE', 'TASK', task._id.toString(), {
      ...getRequestMeta(req),
      task: {
        title: task.title,
        projectId: task.projectId.toString(),
        status: task.status
      }
    });

    res.status(201).json(createSuccessResponse({ task }, 'Task created successfully'));
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

// PUT /projects/:projectId/tasks/:id - Update task
router.put('/:projectId/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Task not found',
        404
      ));
    }

    // Verify task belongs to the project
    if (task.projectId.toString() !== req.params.projectId) {
      return res.status(400).json(createErrorResponse(
        'INVALID_PROJECT',
        'Task does not belong to the specified project',
        400
      ));
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return res.status(404).json(createErrorResponse(
        'PROJECT_NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Permission check (ownership-first): owner, collaborator, or admin can update
    const editPermission = taskPermissions.canEdit(req.user, task, project);
    if (!editPermission.canEdit) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        editPermission.reason || 'You do not have permission to update this task. Only project owners, collaborators, or admins can update tasks.',
        403
      ));
    }

    const validatedData = updateTaskSchema.parse(req.body);

    // Store old values for audit
    const oldValues = {
      title: task.title,
      status: task.status,
      priority: task.priority
    };

    // Convert date string to Date object if provided
    if (validatedData.dueDate !== undefined) {
      if (validatedData.dueDate === '' || validatedData.dueDate === null) {
        task.dueDate = null;
      } else {
        task.dueDate = validatedData.dueDate instanceof Date
          ? validatedData.dueDate
          : new Date(validatedData.dueDate);
      }
    }

    // Update other fields
    Object.keys(validatedData).forEach(key => {
      if (key !== 'dueDate' && validatedData[key] !== undefined) {
        task[key] = validatedData[key];
      }
    });

    await task.save();
    await task.populate('comments.createdBy', 'email name');
    await task.populate('attachments');

    // Audit log
    await auditLog(req, 'TASK_UPDATE', 'TASK', task._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        title: task.title,
        status: task.status,
        priority: task.priority
      }
    });

    res.json(createSuccessResponse({ task }, 'Task updated successfully'));
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

// DELETE /projects/:projectId/tasks/:id
router.delete('/:projectId/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Task not found',
        404
      ));
    }

    // Verify task belongs to the project
    if (task.projectId.toString() !== req.params.projectId) {
      return res.status(400).json(createErrorResponse(
        'INVALID_PROJECT',
        'Task does not belong to the specified project',
        400
      ));
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      return res.status(404).json(createErrorResponse(
        'PROJECT_NOT_FOUND',
        'Project not found',
        404
      ));
    }

    // Only owner or admin can delete tasks (ownership-first)
    if (!taskPermissions.canDelete(req.user, task, project)) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to delete this task. Only project owners can delete tasks.',
        403
      ));
    }

    await task.deleteOne();

    // Audit log
    await auditLog(req, 'TASK_DELETE', 'TASK', task._id.toString(), {
      ...getRequestMeta(req),
      task: {
        title: task.title,
        projectId: task.projectId.toString()
      }
    });

    res.json(createSuccessResponse(null, 'Task deleted successfully'));
  } catch (error) {
    next(error);
  }
});

export default router;

