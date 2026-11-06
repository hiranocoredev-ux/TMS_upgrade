import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { attachDocumentKind } from '../middleware/documentKind.js';
import { DOCUMENT_KIND } from '../constants/documentKind.js';
import {
    getReportsByUser,
    getAllReports,
    updateReport,
    getTeamReports,
    deleteReport,
    getDailyReportHistorySummary
} from '../controllers/reports.js';
import { getReportFinanceSection } from '../controllers/reportFinance.controller.js';

const router = express.Router();
router.use(requireAuth);
router.use(attachDocumentKind(DOCUMENT_KIND.REPORT));

router.get('/daily/history-summary', getDailyReportHistorySummary);
// The income / outcome block that opens each monthly and weekly plan and report.
// Registered above /:period so the period route does not swallow it.
router.get('/finance-section', getReportFinanceSection);
router.get('/:period/:userId', getReportsByUser);
router.get('/:period', getAllReports);
router.get('/:period/group/:groupID', getTeamReports);
router.patch('/:period/:userId/:username/:group/:date', updateReport);
router.delete('/:period/:id', deleteReport);

export default router;
