import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getDailys, getAll, updateDaily, getTeam, deleteDaily } from '../controllers/dailys.js';

const router = express.Router();
router.use(requireAuth);

router.get('/:userId', getDailys);
router.get('/', getAll);
router.get('/group/:groupID', getTeam);
router.patch('/:userId/:username/:group/:date', updateDaily);
router.delete('/:id', deleteDaily);

export default router;