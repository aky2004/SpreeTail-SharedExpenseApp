import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import * as balanceService from '../services/balance.service';
import { isGroupMember } from '../services/group.service';

const router = Router();

// All balance routes require authentication
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
 * GET /api/balances/group/:groupId
 * Fetch net balances and simplified debts for a group
 */
router.get('/group/:groupId', checkGroupAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const balances = await balanceService.getGroupBalances(groupId);
    res.json(balances);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/balances/group/:groupId/member/:userId
 * Fetch detailed expense breakdown for a single member (drilldown)
 */
router.get('/group/:groupId/member/:userId', checkGroupAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const targetUserId = parseInt(req.params.userId);

    if (isNaN(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Ensure the target user is a member of the group
    const isTargetMember = await isGroupMember(groupId, targetUserId);
    if (!isTargetMember) {
      res.status(404).json({ error: 'Member not found in this group' });
      return;
    }

    const detail = await balanceService.getMemberBalanceDetail(groupId, targetUserId);
    res.json(detail);
  } catch (error) {
    next(error);
  }
});

export default router;
