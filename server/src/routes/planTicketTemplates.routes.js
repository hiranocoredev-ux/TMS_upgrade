import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {
  getPlanTicketTemplates,
  getPlanTicketTemplatesAdmin,
  createPlanTicketTemplate,
  updatePlanTicketTemplate,
  deletePlanTicketTemplate
} from '../controllers/planTicketTemplates.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getPlanTicketTemplates);

router.get(
  '/admin',
  requireRole('SUPER_ADMIN'),
  getPlanTicketTemplatesAdmin
);

router.post('/', requireRole('SUPER_ADMIN'), createPlanTicketTemplate);

router.put('/:id', requireRole('SUPER_ADMIN'), updatePlanTicketTemplate);

router.delete('/:id', requireRole('SUPER_ADMIN'), deletePlanTicketTemplate);

export default router;
