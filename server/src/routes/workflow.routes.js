import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  getChartData,
  getWorkflowUsers,
  addTime,
  upsertWorkLog,
  getWorktimeTargets,
  upsertWorktimeTarget,
  deleteWorktimeTarget,
  createWorktimeTargetPreset,
  updateWorktimeTargetPreset,
  deleteWorktimeTargetPreset,
  getWorktimeHubstaffUsers,
  upsertWorktimeHubstaffId,
  getFinalSyncStatus,
  triggerFinalSync,
  getManualTimeDetail,
  patchManualAdjustment,
  deleteManualAdjustment,
} from '../controllers/workflow.controller.js';

const router = express.Router();

// Public ingest endpoints called by the Python sync service to write worklogs.
// Registered BEFORE requireAuth so it skips the JWT check.
router.post('/', upsertWorkLog);

router.use(requireAuth);

router.get('/chart', getChartData);
router.get('/users', getWorkflowUsers);
router.post('/add-time', requireRole('SUPER_ADMIN', 'GROUP_BOSS', 'ADMIN', 'BOSS'), addTime);
router.get('/targets', getWorktimeTargets);
router.put('/targets', requireRole('SUPER_ADMIN'), upsertWorktimeTarget);
router.delete('/targets/:userId/:month', requireRole('SUPER_ADMIN'), deleteWorktimeTarget);
router.post('/target-presets', requireRole('SUPER_ADMIN'), createWorktimeTargetPreset);
router.put('/target-presets/:presetId', requireRole('SUPER_ADMIN'), updateWorktimeTargetPreset);
router.delete('/target-presets/:presetId', requireRole('SUPER_ADMIN'), deleteWorktimeTargetPreset);
router.get('/hubstaff-users', getWorktimeHubstaffUsers);
router.put('/hubstaff-users', requireRole('SUPER_ADMIN'), upsertWorktimeHubstaffId);
router.get('/final-sync-status', requireRole('SUPER_ADMIN'), getFinalSyncStatus);
router.post('/final-sync', requireRole('SUPER_ADMIN'), triggerFinalSync);
router.get('/manual-time-detail', getManualTimeDetail);
router.patch('/manual-time-entry', requireRole('SUPER_ADMIN'), patchManualAdjustment);
router.delete('/manual-time-entry', requireRole('SUPER_ADMIN'), deleteManualAdjustment);

export default router;
