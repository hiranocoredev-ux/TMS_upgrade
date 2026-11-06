import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as freelancerController from '../controllers/freelancerController.js';

const router = express.Router();

router.use(requireAuth);

// GET /freelancer-accounts - List with filters
router.get('/', freelancerController.listFreelancerAccounts);

// GET /freelancer-accounts/:id
router.get('/:id', freelancerController.getFreelancerAccount);

// POST /freelancer-accounts - Create
router.post('/', freelancerController.createFreelancerAccount);

// PUT /freelancer-accounts/:id - Update
router.put('/:id', freelancerController.updateFreelancerAccount);

// DELETE /freelancer-accounts/:id
router.delete('/:id', freelancerController.deleteFreelancerAccount);

// POST /freelancer-accounts/:id/reveal-password - Admin only
router.patch('/:id/picture', freelancerController.uploadFreelancerProfilePicture);
// POST /freelancer-accounts/:id/attachments - Upload multiple attachments
router.patch('/:id/attachments', freelancerController.uploadAttachment);
// POST /job-profiles/:id/attachments/multiple - Upload multiple attachments
router.patch('/:id/attachments/multiple', freelancerController.uploadAttachments);
// DELETE /freelancer-accounts/:id/attachments/:fileId - Delete attachment
router.delete('/:id/attachments/:fileId', freelancerController.deleteAttachment);

export default router;
