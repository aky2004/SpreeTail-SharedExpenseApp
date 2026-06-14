import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

// TODO: Phase 3 — implement expense CRUD
router.get('/', (req, res) => {
  res.json({ message: 'Expenses — not yet implemented' });
});

export default router;
