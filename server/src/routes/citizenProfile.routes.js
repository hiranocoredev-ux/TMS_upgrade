import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listCitizenProfiles,
  getCitizenProfile,
  createCitizenProfile,
  updateCitizenProfile,
  updateCitizenAccount,
  deleteCitizenProfile,
} from '../controllers/citizenProfileController.js';

const router = express.Router();

router.use(requireAuth);

// Everyone reads; writing is checked per profile in the controller.
router.get('/', listCitizenProfiles);
router.get('/:id', getCitizenProfile);
router.post('/', createCitizenProfile);
router.put('/:id', updateCitizenProfile);
router.put('/:id/accounts/:platform', updateCitizenAccount);
router.delete('/:id', deleteCitizenProfile);

export default router;
