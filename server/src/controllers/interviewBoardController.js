import InterviewBoard from '../models/InterviewBoard.js';
import InterviewStage from '../models/InterviewStage.js';
import InterviewTicket from '../models/InterviewTicket.js';
import InterviewActivityLog from '../models/InterviewActivityLog.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES } from '../constants/roles.js';

/**
 * Validate interview board data
 */
const validateInterviewBoard = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate && (!data.title || data.title.trim().length === 0)) {
    errors.push('Title is required');
  }
  if (data.title && data.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }
  if (data.visibility && !['private', 'shared', 'team'].includes(data.visibility)) {
    errors.push('Visibility must be private, shared, or team');
  }
  if (data.status && !['active', 'archived'].includes(data.status)) {
    errors.push('Status must be active or archived');
  }

  return errors;
};

/**
 * Check if user can access a board
 * For interviews management: all authenticated users can access (no role checks)
 */
export const canAccessBoard = async (user, board) => {
  if (!user || !board) return false;
  
  // Owner always has access
  if (board.ownerUserId.toString() === user._id.toString()) {
    return true;
  }
  
  // Private boards: only owner can access
  if (board.visibility === 'private') {
    return false;
  }
  
  // Shared boards: check if user is in sharedWith list
  if (board.visibility === 'shared') {
    if (board.sharedWith && board.sharedWith.some(id => id.toString() === user._id.toString())) {
      return true;
    }
    
    // If allowAllMembers is enabled, all authenticated users can access
    if (board.settings?.allowAllMembers) {
      return true;
    }
    
    return false;
  }
  
  // Team boards: all authenticated users can access (no role check)
  if (board.visibility === 'team') {
    return true;
  }
  
  // Default: allow access for all authenticated users
  return true;
};

/**
 * Check if user can edit a board
 * All active members (ADMIN and MEMBER) with board access can edit
 */
export const canEditBoard = async (user, board) => {
  if (!user || !board) return false;
  
  const userRole = normalizeRole(user.role, user.degree);
  
  if (userRole === ROLES.SUPER_ADMIN) {
    return true;
  }
  
  if (board.ownerUserId.toString() === user._id.toString()) {
    return true;
  }
  
  // All active members (ADMIN and MEMBER) with board access can edit
  if (await canAccessBoard(user, board)) {
    return true;
  }
  
  return false;
};

/**
 * List boards user can access
 */
export const listInterviewBoards = async (req, res, next) => {
  try {
    const { status, visibility, search } = req.query;
    const user = req.user;
    const userRole = normalizeRole(user.role, user.degree);
    
    const query = {};
    
    if (userRole === ROLES.SUPER_ADMIN) {
      // SUPER_ADMIN sees all
    } else if (userRole === ROLES.GROUP_BOSS || userRole === ROLES.GROUP_MEMBER) {
      query.$or = [
        { ownerUserId: user._id },
        { visibility: 'team' },
        { 
          visibility: 'shared',
          $or: [
            { sharedWith: user._id },
            { 'settings.allowAllMembers': true }
          ]
        }
      ];
    } else {
      query.ownerUserId = user._id;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (visibility) {
      query.visibility = visibility;
    }
    
    if (search) {
      query.$or = [
        ...(query.$or || []),
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const boards = await InterviewBoard.find(query)
      .populate('ownerUserId', 'email name')
      .populate('sharedWith', 'email name')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json(createSuccessResponse({ boards }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get board details
 */
export const getInterviewBoard = async (req, res, next) => {
  try {
    const board = await InterviewBoard.findById(req.params.id)
      .populate('ownerUserId', 'email name')
      .populate('sharedWith', 'email name');
    
    if (!board) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Interview board not found',
        404
      ));
    }
    
    if (!(await canAccessBoard(req.user, board))) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to view this board',
        403
      ));
    }
    
    res.json(createSuccessResponse({ board }));
  } catch (error) {
    next(error);
  }
};

/**
 * Create board
 */
export const createInterviewBoard = async (req, res, next) => {
  try {
    const validationErrors = validateInterviewBoard(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        validationErrors[0],
        400
      ));
    }
    
    const boardData = {
      title: req.body.title,
      description: req.body.description || '',
      visibility: req.body.visibility || 'private',
      sharedWith: req.body.sharedWith || [],
      settings: req.body.settings || {
        allowAllMembers: false,
        allowGuests: false
      },
      status: req.body.status || 'active',
      ownerUserId: req.user._id
    };
    
    const board = new InterviewBoard(boardData);
    await board.save();
    await board.populate('ownerUserId', 'email name');
    await board.populate('sharedWith', 'email name');
    
    // Create default stages for new board
    const defaultStages = [
      { name: 'Scheduled (Intro)', order: 0 },
      { name: 'Scheduled (Round 1)', order: 1 },
      { name: 'Scheduled (Round 2)', order: 2 },
      { name: 'Interview Done', order: 3 },
      { name: 'Offer', order: 4 },
      { name: 'Rejected', order: 5 }
    ];
    
    const stages = await InterviewStage.insertMany(
      defaultStages.map(stage => ({
        boardId: board._id,
        name: stage.name,
        order: stage.order,
        createdBy: req.user._id
      }))
    );
    
    await auditLog(req, 'INTERVIEW_BOARD_CREATE', 'INTERVIEW_BOARD', board._id.toString(), {
      ...getRequestMeta(req),
      board: { title: board.title, visibility: board.visibility }
    });
    
    res.status(201).json(createSuccessResponse({
      board,
      stages
    }, 'Interview board created successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update board
 */
export const updateInterviewBoard = async (req, res, next) => {
  try {
    const board = await InterviewBoard.findById(req.params.id);
    
    if (!board) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Interview board not found',
        404
      ));
    }
    
    if (!(await canEditBoard(req.user, board))) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to edit this board',
        403
      ));
    }
    
    const validationErrors = validateInterviewBoard(req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        validationErrors[0],
        400
      ));
    }
    
    const oldValues = {
      title: board.title,
      visibility: board.visibility,
      sharedWith: board.sharedWith?.map(id => id.toString()) || []
    };
    
    // Update only provided fields
    if (req.body.title !== undefined) board.title = req.body.title;
    if (req.body.description !== undefined) board.description = req.body.description || '';
    if (req.body.visibility !== undefined) board.visibility = req.body.visibility;
    if (req.body.sharedWith !== undefined) board.sharedWith = req.body.sharedWith || [];
    if (req.body.settings !== undefined) board.settings = { ...board.settings, ...req.body.settings };
    if (req.body.status !== undefined) board.status = req.body.status;
    
    await board.save();
    await board.populate('ownerUserId', 'email name');
    await board.populate('sharedWith', 'email name');
    
    await auditLog(req, 'INTERVIEW_BOARD_UPDATE', 'INTERVIEW_BOARD', board._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        title: board.title,
        visibility: board.visibility,
        sharedWith: board.sharedWith?.map(id => id.toString()) || []
      }
    });
    
    res.json(createSuccessResponse({ board }, 'Interview board updated successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Delete board
 */
export const deleteInterviewBoard = async (req, res, next) => {
  try {
    const board = await InterviewBoard.findById(req.params.id);
    
    if (!board) {
      return res.status(404).json(createErrorResponse(
        'NOT_FOUND',
        'Interview board not found',
        404
      ));
    }
    
    const userRole = normalizeRole(req.user.role);
    if (board.ownerUserId.toString() !== req.user._id.toString() && userRole !== ROLES.SUPER_ADMIN) {
      return res.status(403).json(createErrorResponse(
        'ACCESS_DENIED',
        'You do not have permission to delete this board',
        403
      ));
    }
    
    // Delete related stages and tickets (cascade delete)
    await InterviewStage.deleteMany({ boardId: board._id });
    await InterviewTicket.deleteMany({ boardId: board._id });
    await InterviewActivityLog.deleteMany({ boardId: board._id });
    
    await board.deleteOne();
    
    await auditLog(req, 'INTERVIEW_BOARD_DELETE', 'INTERVIEW_BOARD', board._id.toString(), {
      ...getRequestMeta(req),
      board: { title: board.title }
    });
    
    res.json(createSuccessResponse(null, 'Interview board deleted successfully'));
  } catch (error) {
    next(error);
  }
};
