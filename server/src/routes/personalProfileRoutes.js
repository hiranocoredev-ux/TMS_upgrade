import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as personalProfileController from '../controllers/personalProfileController.js';

const router = express.Router();

router.use(requireAuth);

// GET /personal-profiles - List with filters
router.get('/', personalProfileController.listPersonalProfiles);

// GET /personal-profiles/:id
router.get('/:id', personalProfileController.getPersonalProfile);

// POST /personal-profiles - Create
router.post('/', personalProfileController.createPersonalProfile);

// PUT /personal-profiles/:id - Update
router.put('/:id', personalProfileController.updatePersonalProfile);

    // DELETE /personal-profiles/:id
router.delete('/:id', personalProfileController.deletePersonalProfile);

// POST /personal-profiles/:id/picture - Upload profile picture
router.patch('/:id/picture', personalProfileController.uploadPersonalProfilePicture);
// POST /personal-profiles/:id/attachments - Upload multiple attachments
router.patch('/:id/attachments', personalProfileController.uploadAttachment);
// POST /personal-profiles/:id/attachments/multiple - Upload multiple attachments
router.patch('/:id/attachments/multiple', personalProfileController.uploadAttachments);
// DELETE /personal-profiles/:id/attachments/:fileId - Delete attachment
router.delete('/:id/attachments/:fileId', personalProfileController.deleteAttachment);

export default router;
