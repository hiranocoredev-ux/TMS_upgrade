import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  startTimer,
  stopTimer,
  getRunning,
  createEntry,
  getMyEntries,
  updateEntry,
  deleteEntry,
  deleteAllMyEntries,
  getSummary,
  getUserEntries,
} from '../controllers/timeEntry.controller.js';

const router = express.Router();

router.use(requireAuth);

// ── Timer ──────────────────────────────────────────────
router.post('/start', startTimer);
router.post('/stop', stopTimer);
router.get('/running', getRunning);

// ── My entries (any authenticated user) ───────────────
router.get('/my', getMyEntries);
router.delete('/my/all', deleteAllMyEntries);
router.post('/', createEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

// ── Admin / Boss only ──────────────────────────────────
router.get('/summary', requireRole('SUPER_ADMIN', 'GROUP_BOSS', 'ADMIN', 'BOSS'), getSummary);
router.get('/user/:userId', requireRole('SUPER_ADMIN', 'GROUP_BOSS', 'ADMIN', 'BOSS'), getUserEntries);

export default router;
