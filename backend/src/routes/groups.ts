import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import * as groupService from '../services/group.service';

const router = Router();

// All group routes require authentication
router.use(verifyToken);

/**
 * GET /api/groups
 * List all groups the logged-in user belongs to.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const groups = await groupService.getUserGroups(req.user!.id);
    res.json({ groups });
  } catch (error: any) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * POST /api/groups
 * Create a new group. Creator is auto-added as a member.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const group = await groupService.createGroup(name, req.user!.id);
    res.status(201).json({ group });
  } catch (error: any) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * POST /api/groups/join
 * Join a group by invite code. Requires joined_at date.
 */
router.post('/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const { invite_code, joined_at } = req.body;
    if (!invite_code) {
      res.status(400).json({ error: 'Invite code is required' });
      return;
    }

    const joinDate = joined_at || new Date().toISOString().split('T')[0];
    const result = await groupService.joinByInviteCode(invite_code, req.user!.id, joinDate);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Invalid invite code' || error.message.includes('already a member')) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

/**
 * GET /api/groups/:id
 * Get group details with all members (including left members).
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const group = await groupService.getGroupById(groupId);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Verify user is a member
    const isMember = await groupService.isGroupMember(groupId, req.user!.id);
    if (!isMember) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const members = await groupService.getGroupMembers(groupId);
    res.json({ group, members });
  } catch (error: any) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

/**
 * POST /api/groups/:id/members
 * Add a member to the group by email or user_id.
 */
router.post('/:id/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const { email, user_id, joined_at } = req.body;

    if (!email && !user_id) {
      res.status(400).json({ error: 'Email or user_id is required' });
      return;
    }

    const joinDate = joined_at || new Date().toISOString().split('T')[0];
    const membership = await groupService.addMember(
      groupId,
      { email, userId: user_id },
      joinDate
    );
    res.status(201).json({ membership });
  } catch (error: any) {
    if (error.message.includes('already') || error.message.includes('No user found')) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

/**
 * PATCH /api/groups/:id/members/:uid
 * Update a member (set left_at for departure).
 */
router.patch('/:id/members/:uid', async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = parseInt(req.params.uid);
    const { left_at } = req.body;

    const membership = await groupService.updateMember(groupId, userId, left_at || null);
    res.json({ membership });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

/**
 * GET /api/groups/:id/members/active
 * Get active members on a specific date.
 * Query param: ?date=2026-03-15
 */
router.get('/:id/members/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.id);
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const members = await groupService.getActiveMembersOnDate(groupId, date);
    res.json({ members, date });
  } catch (error: any) {
    console.error('Get active members error:', error);
    res.status(500).json({ error: 'Failed to fetch active members' });
  }
});

export default router;
