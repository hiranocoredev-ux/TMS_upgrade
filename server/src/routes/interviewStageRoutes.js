import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import InterviewBoard from '../models/InterviewBoard.js';
import { createErrorResponse } from '../utils/errors.js';
import { canAccessBoard } from '../controllers/interviewBoardController.js';
import * as interviewStageController from '../controllers/interviewStageController.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

// Middleware to load board and check access
const loadBoard = async (req, res, next) => {
  try {
    const board = await InterviewBoard.findById(req.params.boardId);
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
        'You do not have permission to access this board',
        403
      ));
    }
    
    req.board = board;
    next();
  } catch (error) {
    next(error);
  }
};

// All stage routes require board access
router.use(loadBoard);

// GET /interview-boards/:boardId/stages - List stages for board
router.get('/', interviewStageController.listStages);

// GET /interview-boards/:boardId/stages/:id - Get stage details
router.get('/:id', interviewStageController.getStage);

// POST /interview-boards/:boardId/stages - Create stage
router.post('/', interviewStageController.createStage);

// PUT /interview-boards/:boardId/stages/:id - Update stage
router.put('/:id', interviewStageController.updateStage);

// PATCH /interview-boards/:boardId/stages/reorder - Reorder stages
router.patch('/reorder', interviewStageController.reorderStages);

// DELETE /interview-boards/:boardId/stages/:id - Delete stage
router.delete('/:id', interviewStageController.deleteStage);

export default router;
