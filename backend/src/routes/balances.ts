import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

// TODO: Phase 4 — implement balance calculation
router.get('/', (req, res) => {
  res.json({ message: 'Balances — not yet implemented' });
});

export default router;
