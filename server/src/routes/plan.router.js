import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { attachDocumentKind } from '../middleware/documentKind.js';
import { DOCUMENT_KIND } from '../constants/documentKind.js';
import {
    getReportsByUser,
    getAllReports,
    updateReport,
    getTeamReports,
    deleteReport
} from '../controllers/reports.js';

const router = express.Router();
router.use(requireAuth);
router.use(attachDocumentKind(DOCUMENT_KIND.PLAN));

router.get('/:period/:userId', getReportsByUser);
router.get('/:period', getAllReports);
router.get('/:period/group/:groupID', getTeamReports);
router.patch('/:period/:userId/:username/:group/:date', updateReport);
router.delete('/:period/:id', deleteReport);

export default router;
