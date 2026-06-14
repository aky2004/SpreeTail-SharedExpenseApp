import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

// TODO: Phase 5 — implement CSV import
router.get('/', (req, res) => {
  res.json({ message: 'Import — not yet implemented' });
});

export default router;
