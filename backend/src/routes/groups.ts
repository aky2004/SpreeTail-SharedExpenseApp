import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// All group routes require authentication
router.use(verifyToken);

// TODO: Phase 2 — implement group CRUD
router.get('/', (req, res) => {
  res.json({ message: 'Groups list — not yet implemented' });
});

export default router;
