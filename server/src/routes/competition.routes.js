import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  getSettings,
  putSettings,
  listRuleDefinitions,
  createRuleDefinition,
  updateRuleDefinition,
  deleteRuleDefinition,
  listAdjustments,
  createAdjustment,
  updateAdjustment,
  deleteAdjustment,
  getDashboard,
  getUserDetail,
  getGroupDetail,
  getHistorySummary,
  getHistoryDetail,
  getWorktimeRules,
  upsertWorktimeDayRule,
  deleteWorktimeDayRule,
  upsertWorktimeUserDayRule,
  deleteWorktimeUserDayRule,
} from '../controllers/competition.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/settings', getSettings);
router.put('/settings', putSettings);

router.get('/rule-definitions', listRuleDefinitions);
router.post('/rule-definitions', createRuleDefinition);
router.patch('/rule-definitions/:id', updateRuleDefinition);
router.delete('/rule-definitions/:id', deleteRuleDefinition);

router.get('/adjustments', listAdjustments);
router.post('/adjustments', createAdjustment);
router.patch('/adjustments/:id', updateAdjustment);
router.delete('/adjustments/:id', deleteAdjustment);

router.get('/dashboard', getDashboard);
router.get('/detail/user', getUserDetail);
router.get('/detail/group', getGroupDetail);
router.get('/history/summary', getHistorySummary);
router.get('/history/detail', getHistoryDetail);
router.get('/worktime-rules', getWorktimeRules);
router.put('/worktime-rules/day', upsertWorktimeDayRule);
router.delete('/worktime-rules/day/:month/:date', deleteWorktimeDayRule);
router.put('/worktime-rules/user-day', upsertWorktimeUserDayRule);
router.delete('/worktime-rules/user-day/:month/:date/:userId', deleteWorktimeUserDayRule);

export default router;
