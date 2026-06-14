import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

// TODO: Phase 4 — implement settlement recording
router.get('/', (req, res) => {
  res.json({ message: 'Settlements — not yet implemented' });
});

export default router;
