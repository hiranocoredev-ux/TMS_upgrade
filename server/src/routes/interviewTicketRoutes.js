import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as interviewTicketController from '../controllers/interviewTicketController.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

/**
 * Time View
 * GET /interview-boards/:boardId/tickets/time-view
 */
router.get(
  '/time-view',
  interviewTicketController.getTicketsTimeView
);

/**
 * Tickets CRUD
 */
router.get(
  '/',
  interviewTicketController.listTickets
);

router.get(
  '/:id',
  interviewTicketController.getTicket
);

router.post(
  '/',
  interviewTicketController.createTicket
);

router.put(
  '/:id',
  interviewTicketController.updateTicket
);

router.patch(
  '/:id/move-stage',
  interviewTicketController.moveTicketStage
);

router.delete(
  '/:id',
  interviewTicketController.deleteTicket
);

/**
 * Activity log
 */
router.get(
  '/:id/activity',
  interviewTicketController.getTicketActivity
);

export default router;
