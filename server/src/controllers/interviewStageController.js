import InterviewStage from '../models/InterviewStage.js';
import InterviewTicket from '../models/InterviewTicket.js';
import InterviewBoard from '../models/InterviewBoard.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES } from '../constants/roles.js';
import { canAccessBoard } from './interviewBoardController.js';

/**
 * Validate stage data
 */
const validateStage = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate && (!data.name || data.name.trim().length === 0)) {
    errors.push('Stage name is required');
  }
  if (data.name && data.name.length > 100) {
    errors.push('Stage name must be less than 100 characters');
  }
  if (data.order !== undefined && (!Number.isInteger(data.order) || data.order < 0)) {
    errors.push('Order must be a non-negative integer');
  }
  if (data.settings?.wipLimit !== undefined && data.settings.wipLimit !== null && (!Number.isInteger(data.settings.wipLimit) || data.settings.wipLimit <= 0)) {
    errors.push('WIP limit must be a positive integer or null');
  }

  return errors;
};

/**
 * List stages for board
 */
export const listStages = async (req, res, next) => {
  try {
    const stages = await InterviewStage.find({ boardId: req.params.boardId })
      .populate('createdBy', 'email name')
      .sort({ order: 1 })
      .lean();
    
    res.json(createSuccessResponse({ stages }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get stage details
 */
export const getStage = async (req, res, next) => {
  try {
    const stage = await InterviewStage.findOne({
      _id: req.params.id,
      boardId: req.params.boardId
    }).populate('createdBy', 'email name');
    
    if (!stage) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Interview stage not found',
        404
      ));
    }
    
    res.json(createSuccessResponse({ stage }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create stage
 * All members with board access can create stages (no role check)
 */
export const createStage = async (req, res, next) => {
  try {
    // req.board is already loaded and access checked by middleware
    // No additional permission check needed - all members with board access can create
    
    const validationErrors = validateStage(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        validationErrors[0],
        400
      ));
    }
    
    let order = req.body.order;
    if (order === undefined) {
      const maxStage = await InterviewStage.findOne({ boardId: req.params.boardId })
        .sort({ order: -1 })
        .lean();
      order = maxStage ? maxStage.order + 1 : 0;
    }
    
    const stageData = {
      boardId: req.params.boardId,
      name: req.body.name,
      description: req.body.description || '',
      order: order,
      color: req.body.color || '#3498db',
      settings: req.body.settings || {
        wipLimit: null,
        autoMoveRules: null
      },
      createdBy: req.user._id
    };
    
    const stage = new InterviewStage(stageData);
    await stage.save();
    await stage.populate('createdBy', 'email name');
    
    await auditLog(req, 'INTERVIEW_STAGE_CREATE', 'INTERVIEW_STAGE', stage._id.toString(), {
      ...getRequestMeta(req),
      boardId: req.params.boardId,
      stage: { name: stage.name, order: stage.order }
    });
    
    res.status(201).json(createSuccessResponse({ stage }, 'Interview stage created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update stage
 */
export const updateStage = async (req, res, next) => {
  try {
    const stage = await InterviewStage.findOne({
      _id: req.params.id,
      boardId: req.params.boardId
    });
    
    if (!stage) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Interview stage not found',
        404
      ));
    }
    
    // req.board is already loaded and access checked by middleware
    // No additional permission check needed - all members with board access can edit
    
    const validationErrors = validateStage(req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        validationErrors[0],
        400
      ));
    }
    
    const oldValues = {
      name: stage.name,
      order: stage.order,
      color: stage.color
    };
    
    // Update only provided fields
    if (req.body.name !== undefined) stage.name = req.body.name;
    if (req.body.description !== undefined) stage.description = req.body.description || '';
    if (req.body.order !== undefined) stage.order = req.body.order;
    if (req.body.color !== undefined) stage.color = req.body.color || '#3498db';
    if (req.body.settings !== undefined) {
      stage.settings = {
        wipLimit: req.body.settings.wipLimit !== undefined ? req.body.settings.wipLimit : stage.settings?.wipLimit || null,
        autoMoveRules: req.body.settings.autoMoveRules !== undefined ? req.body.settings.autoMoveRules : stage.settings?.autoMoveRules || null
      };
    }
    
    await stage.save();
    await stage.populate('createdBy', 'email name');
    
    await auditLog(req, 'INTERVIEW_STAGE_UPDATE', 'INTERVIEW_STAGE', stage._id.toString(), {
      ...getRequestMeta(req),
      boardId: req.params.boardId,
      oldValues,
      newValues: {
        name: stage.name,
        order: stage.order,
        color: stage.color
      }
    });
    
    res.json(createSuccessResponse({ stage }, 'Interview stage updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder stages
 */
export const reorderStages = async (req, res, next) => {
  try {
    // req.board is already loaded and access checked by middleware
    // No additional permission check needed - all members with board access can reorder
    
    const { stageIds } = req.body;
    
    if (!Array.isArray(stageIds)) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        'stageIds must be an array',
        400
      ));
    }
    
    const updates = stageIds.map((stageId, index) => ({
      updateOne: {
        filter: { _id: stageId, boardId: req.params.boardId },
        update: { $set: { order: index } }
      }
    }));
    
    await InterviewStage.bulkWrite(updates);
    
    await auditLog(req, 'INTERVIEW_STAGE_REORDER', 'INTERVIEW_STAGE', req.params.boardId, {
      ...getRequestMeta(req),
      boardId: req.params.boardId,
      newOrder: stageIds
    });
    
    const stages = await InterviewStage.find({ boardId: req.params.boardId })
      .populate('createdBy', 'email name')
      .sort({ order: 1 })
      .lean();
    
    res.json(createSuccessResponse({ stages }, 'Stages reordered successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete stage
 * All members with board access can delete stages
 */
export const deleteStage = async (req, res, next) => {
  try {
    const stage = await InterviewStage.findOne({
      _id: req.params.id,
      boardId: req.params.boardId
    });
    
    if (!stage) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Interview stage not found',
        404
      ));
    }
    
    // req.board is already loaded and access checked by middleware
    // No additional permission check needed - all members with board access can delete
    
    // Check if stage has tickets
    const ticketCount = await InterviewTicket.countDocuments({ stageId: stage._id });
    if (ticketCount > 0) {
      return res.status(400).json(createErrorResponse(
        'STAGE_HAS_TICKETS',
        `Cannot delete stage with ${ticketCount} ticket(s). Please move or delete tickets first.`,
        400
      ));
    }
    
    await stage.deleteOne();
    
    await auditLog(req, 'INTERVIEW_STAGE_DELETE', 'INTERVIEW_STAGE', stage._id.toString(), {
      ...getRequestMeta(req),
      boardId: req.params.boardId,
      stage: { name: stage.name }
    });
    
    res.json(createSuccessResponse(null, 'Interview stage deleted successfully'));
  } catch (error) {
    next(error);
  }
};
