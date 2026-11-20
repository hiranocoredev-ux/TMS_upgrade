import express from 'express';
import multer from 'multer';
import path from 'path';
import { createModuleStorage } from '../middleware/upload.middleware.js';
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
  listPendingManualTime,
  reviewManualTime,
  getHubstaffOrg,
  updateHubstaffOrg,
} from '../controllers/workflow.controller.js';

const router = express.Router();

// Public ingest endpoints called by the Python sync service to write worklogs.
// Registered BEFORE requireAuth so it skips the JWT check.
router.post('/', upsertWorkLog);

router.use(requireAuth);

router.get('/chart', getChartData);
router.get('/users', getWorkflowUsers);
/** Screenshots attached to added time: images only, up to 5 MB each. */
const SCREENSHOT_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const screenshotUpload = multer({
  storage: createModuleStorage('worktime_screenshots'),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ok = SCREENSHOT_EXTS.includes(path.extname(file.originalname).toLowerCase()) && /^image\//.test(file.mimetype);
    cb(ok ? null : new Error('Screenshots must be PNG, JPG or WEBP images'), ok);
  },
}).any();
const withScreenshots = (req, res, next) =>
  screenshotUpload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each screenshot must be 5 MB or smaller' : err.message;
    return res.status(400).json({ ok: false, message });
  });

router.post('/add-time', requireRole('SUPER_ADMIN', 'GROUP_BOSS', 'ADMIN', 'BOSS'), withScreenshots, addTime);
// Hubstaff organization ID (part of the Hubstaff links); it changes every two weeks.
router.get('/hubstaff-org', getHubstaffOrg);
router.put('/hubstaff-org', requireRole('SUPER_ADMIN'), updateHubstaffOrg);
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
// Added time from group bosses waits here until a super admin / admin reviews it.
router.get('/manual-time/pending', requireRole('SUPER_ADMIN'), listPendingManualTime);
router.post('/manual-time/review', requireRole('SUPER_ADMIN'), reviewManualTime);

export default router;
