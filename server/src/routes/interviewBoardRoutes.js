import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as interviewBoardController from '../controllers/interviewBoardController.js';

const router = express.Router();

router.use(requireAuth);

// GET /interview-boards - List boards user can access
router.get('/', interviewBoardController.listInterviewBoards);

// GET /interview-boards/:id - Get board details
router.get('/:id', interviewBoardController.getInterviewBoard);

// POST /interview-boards - Create board
router.post('/', interviewBoardController.createInterviewBoard);

// PUT /interview-boards/:id - Update board
router.put('/:id', interviewBoardController.updateInterviewBoard);

// DELETE /interview-boards/:id - Delete board
router.delete('/:id', interviewBoardController.deleteInterviewBoard);

export default router;
