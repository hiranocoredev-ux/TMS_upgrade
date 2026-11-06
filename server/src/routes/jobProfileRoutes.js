import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as jobProfileController from '../controllers/jobProfileController.js';

const router = express.Router();

router.use(requireAuth);

// GET /job-profiles - List with filters
router.get('/', jobProfileController.listJobProfiles);

// GET /job-profiles/:id
router.get('/:id', jobProfileController.getJobProfile);

// POST /job-profiles - Create
router.post('/', jobProfileController.createJobProfile);

// PUT /job-profiles/:id - Update
router.put('/:id', jobProfileController.updateJobProfile);

// DELETE /job-profiles/:id
router.delete('/:id', jobProfileController.deleteJobProfile);

// POST /job-profiles/:id/picture - Upload profile picture
router.patch('/:id/picture', jobProfileController.uploadProfilePicture);

// POST /job-profiles/:id/attachments - Upload single attachment (legacy)
router.patch('/:id/attachments', jobProfileController.uploadAttachment);

// POST /job-profiles/:id/attachments/multiple - Upload multiple attachments
router.patch('/:id/attachments/multiple', jobProfileController.uploadAttachments);

// DELETE /job-profiles/:id/attachments/:fileId - Delete attachment
router.delete('/:id/attachments/:fileId', jobProfileController.deleteAttachment);

export default router;
