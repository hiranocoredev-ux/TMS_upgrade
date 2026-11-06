import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  getSummarize,
  saveWeeklyInputs,
  saveProfileTargets,
  runWeekendRules,
  saveWorktimeDeduction,
} from '../controllers/summarizeController.js';

const router = express.Router();

router.use(requireAuth);

// Summarize table (finance, call counts, getting citizen), weekly or monthly.
router.get('/', getSummarize);
// Weekly call counts (per member) and getting-citizen counts (per group).
router.put('/weekly-inputs', requireRole('SUPER_ADMIN'), saveWeeklyInputs);
// Monthly profile targets per member (and the job-offer count for job members).
router.put('/profile-targets', requireRole('SUPER_ADMIN'), saveProfileTargets);
// Percentage points taken off a member's Final WorkTime % for one week.
router.put('/worktime-deduction', requireRole('SUPER_ADMIN'), saveWorktimeDeduction);
// Weekend working-day rules for members under the weekly threshold.
router.post('/weekend-rules', requireRole('SUPER_ADMIN'), runWeekendRules);

export default router;
