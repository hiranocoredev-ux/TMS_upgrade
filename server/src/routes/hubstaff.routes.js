import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getMembers, getActivities, getTimeEntries, getSummary } from '../controllers/hubstaff.controller.js';

const router = express.Router();

router.use(requireAuth);

// GET /api/hubstaff/members
router.get('/members', getMembers);

// GET /api/hubstaff/activities?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&user_ids=1,2,3
router.get('/activities', getActivities);

// GET /api/hubstaff/time-entries?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&user_ids=1,2,3
router.get('/time-entries', getTimeEntries);

// GET /api/hubstaff/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&user_ids=1,2,3
router.get('/summary', getSummary);

export default router;
