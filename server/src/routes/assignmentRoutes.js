import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getEarningSummary,
  getEarningTrend
} from '../controllers/assignmentController.js';

const router = express.Router();

router.use(requireAuth);

/**
 * Everyone:
 * - create assignment
 * - view own assignments
 *
 * Admin/Boss:
 * - view all assignments
 *
 * Edit:
 * - ONLY owner
 */

// List assignments
router.get('/', listAssignments);

// Get single assignment
router.get('/:id', getAssignmentById);

// Create assignment
router.post('/', createAssignment);

// Update assignment (owner only)
router.put('/:id', updateAssignment);
// Earnings summary
router.get('/earnings/summary', getEarningSummary);

// Earnings trend chart
router.get('/earnings/trend', getEarningTrend);

// Delete assignment (owner only)
router.delete('/:id', deleteAssignment);

export default router;
