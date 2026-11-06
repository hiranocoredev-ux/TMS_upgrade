import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as profileController from '../controllers/profileController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/metadata', profileController.getMetadata);
router.get('/summary', profileController.getSummary);

router.get('/', profileController.listProfiles);
router.post('/', profileController.createProfile);

router.get('/:id', profileController.getProfile);
router.put('/:id', profileController.updateProfile);
router.delete('/:id', profileController.deleteProfile);

router.patch('/:id/picture', profileController.uploadPicture);

router.post('/:id/tabs/:role/reveal', profileController.revealTabDevices);
router.post('/:id/tabs/:role/credentials/:credentialId/reveal', profileController.revealPlatformCredential);

router.post('/:id/tabs/:role/transactions', profileController.addTabTransaction);
router.delete('/:id/tabs/:role/transactions/:transactionId', profileController.deleteTabTransaction);

export default router;
