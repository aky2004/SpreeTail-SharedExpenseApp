import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import * as settlementService from '../services/settlement.service';
import { isGroupMember } from '../services/group.service';

const router = Router();

// All settlement routes require authentication
router.use(verifyToken);

// Middleware to verify user is a member of the group
async function checkGroupAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseInt(req.params.groupId);
    if (isNaN(groupId)) {
      res.status(400).json({ error: 'Invalid group ID' });
      return;
    }

    const userId = req.user!.id;
    const isMember = await isGroupMember(groupId, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied: You are not a member of this group' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/settlements/group/:groupId
 * Get all settlements in a group
 */
router.get('/group/:groupId', checkGroupAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const settlements = await settlementService.getSettlementsByGroup(groupId);
    res.json(settlements);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settlements/group/:groupId
 * Record a settlement in a group
 */
router.post('/group/:groupId', checkGroupAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { payer_id, payee_id, amount_inr, settled_at } = req.body;

    if (!payer_id || !payee_id || !amount_inr) {
      res.status(400).json({ error: 'payer_id, payee_id, and amount_inr are required' });
      return;
    }

    const date = settled_at || new Date().toISOString().split('T')[0];

    const settlement = await settlementService.recordSettlement(
      groupId,
      parseInt(payer_id),
      parseInt(payee_id),
      parseFloat(amount_inr),
      date,
      req.user!.id
    );

    res.status(201).json(settlement);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
