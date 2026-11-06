import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createPaymentRequest,
  listPaymentRequests,
  updatePaymentRequestStatus,
} from '../controllers/paymentRequest.controller.js';

const router = express.Router();
router.use(requireAuth);

router.post('/payment-requests', createPaymentRequest);
router.get('/payment-requests', listPaymentRequests);
router.patch('/payment-requests/:id/status', updatePaymentRequestStatus);

export default router;
