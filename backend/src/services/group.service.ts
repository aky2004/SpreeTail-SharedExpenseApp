import { query, getClient } from '../db/connection';
import { Group, GroupMember, User } from '../types';

/**
 * Generate a random 6-character invite code (uppercase alphanumeric).
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous: 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new group and auto-add the creator as a member.
 */
export async function createGroup(name: string, userId: number): Promise<Group> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Generate unique invite code (retry on collision)
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await client.query('SELECT id FROM groups WHERE invite_code = $1', [inviteCode]);
      if (existing.rows.length === 0) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Create group
    const groupResult = await client.query(
      'INSERT INTO groups (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), inviteCode, userId]
    );
    const group = groupResult.rows[0];

    // Auto-add creator as member (joined today)
    await client.query(
      'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, CURRENT_DATE)',
      [group.id, userId]
    );

    await client.query('COMMIT');
    return group;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all groups the user belongs to, with member count and user's net balance.
 */
export async function getUserGroups(userId: number): Promise<any[]> {
  const result = await query(
    `SELECT g.*,
       (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.left_at IS NULL) as member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     ORDER BY g.created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get a single group by ID with full details.
 */
export async function getGroupById(groupId: number): Promise<Group | null> {
  const result = await query('SELECT * FROM groups WHERE id = $1', [groupId]);
  return result.rows[0] || null;
}

/**
 * Get all members of a group (including left members), with user details.
 */
export async function getGroupMembers(groupId: number): Promise<any[]> {
  const result = await query(
    `SELECT gm.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  return result.rows;
}

/**
 * CRITICAL FUNCTION: Get active members on a specific date.
 * Used by expense creation and balance calculation to date-gate membership.
 *
 * A member is "active on date" if:
 *   joined_at <= date AND (left_at IS NULL OR left_at >= date)
 *
 * This means:
 * - Sam (joined Apr 8) is NOT active on Mar 15
 * - Meera (left Mar 28) is NOT active on Apr 1
 * - Meera IS active on Mar 28 (farewell dinner, her last day)
 */
export async function getActiveMembersOnDate(groupId: number, date: string): Promise<any[]> {
  const result = await query(
    `SELECT gm.*, u.name as user_name, u.email as user_email, u.id as user_id
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
       AND gm.joined_at <= $2::date
       AND (gm.left_at IS NULL OR gm.left_at >= $2::date)`,
    [groupId, date]
  );
  return result.rows;
}

/**
 * Add a member to a group.
 * Can add by user_id or by email (looks up user).
 */
export async function addMember(
  groupId: number,
  userIdOrEmail: { userId?: number; email?: string },
  joinedAt: string
): Promise<any> {
  let userId = userIdOrEmail.userId;

  // If email provided, look up user
  if (!userId && userIdOrEmail.email) {
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [userIdOrEmail.email.toLowerCase()]
    );
    if (userResult.rows.length === 0) {
      throw new Error('No user found with that email');
    }
    userId = userResult.rows[0].id;
  }

  if (!userId) {
    throw new Error('User ID or email required');
  }

  // Check if already an active member
  const existing = await query(
    'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
    [groupId, userId]
  );
  if (existing.rows.length > 0) {
    throw new Error('User is already an active member of this group');
  }

  const result = await query(
    `INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, $3)
     RETURNING *`,
    [groupId, userId, joinedAt]
  );
  return result.rows[0];
}

/**
 * Update a member (primarily used to set left_at for departure).
 */
export async function updateMember(
  groupId: number,
  userId: number,
  leftAt: string | null
): Promise<any> {
  const result = await query(
    `UPDATE group_members SET left_at = $1
     WHERE group_id = $2 AND user_id = $3 AND left_at IS NULL
     RETURNING *`,
    [leftAt, groupId, userId]
  );
  if (result.rows.length === 0) {
    throw new Error('Active membership not found');
  }
  return result.rows[0];
}

/**
 * Join a group by invite code.
 */
export async function joinByInviteCode(
  inviteCode: string,
  userId: number,
  joinedAt: string
): Promise<{ group: Group; membership: any }> {
  // Find group by invite code
  const groupResult = await query(
    'SELECT * FROM groups WHERE invite_code = $1',
    [inviteCode.toUpperCase()]
  );
  if (groupResult.rows.length === 0) {
    throw new Error('Invalid invite code');
  }

  const group = groupResult.rows[0];

  // Check if already a member
  const existing = await query(
    'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
    [group.id, userId]
  );
  if (existing.rows.length > 0) {
    throw new Error('You are already a member of this group');
  }

  // Add as member
  const memberResult = await query(
    'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, $3) RETURNING *',
    [group.id, userId, joinedAt]
  );

  return { group, membership: memberResult.rows[0] };
}

/**
 * Check if a user is a member of a group (active or not).
 */
export async function isGroupMember(groupId: number, userId: number): Promise<boolean> {
  const result = await query(
    'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return result.rows.length > 0;
}
