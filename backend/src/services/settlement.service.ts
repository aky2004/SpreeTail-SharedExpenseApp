import { query } from '../db/connection';
import { Settlement } from '../types';
import { isGroupMember } from './group.service';

/**
 * Record a settlement (direct payment) between two members of a group.
 */
export async function recordSettlement(
  groupId: number,
  payerId: number,
  payeeId: number,
  amountInr: number,
  settledAt: string,
  recordedById: number
): Promise<Settlement> {
  // Validate payer and payee are not the same
  if (payerId === payeeId) {
    throw new Error('Payer and payee must be different members');
  }

  // Validate amount is positive
  if (amountInr <= 0) {
    throw new Error('Settlement amount must be greater than zero');
  }

  // Verify group memberships
  const payerIsMember = await isGroupMember(groupId, payerId);
  const payeeIsMember = await isGroupMember(groupId, payeeId);

  if (!payerIsMember) {
    throw new Error('Payer is not a member of the group');
  }
  if (!payeeIsMember) {
    throw new Error('Payee is not a member of the group');
  }

  // Insert settlement record
  const result = await query(
    `INSERT INTO settlements (group_id, payer_id, payee_id, amount_inr, settled_at, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [groupId, payerId, payeeId, amountInr, settledAt, recordedById]
  );

  return result.rows[0];
}

/**
 * Get all settlements in a group.
 */
export async function getSettlementsByGroup(groupId: number): Promise<any[]> {
  const result = await query(
    `SELECT s.*, 
            u_payer.name as payer_name, u_payer.email as payer_email,
            u_payee.name as payee_name, u_payee.email as payee_email
     FROM settlements s
     JOIN users u_payer ON u_payer.id = s.payer_id
     JOIN users u_payee ON u_payee.id = s.payee_id
     WHERE s.group_id = $1
     ORDER BY s.settled_at DESC, s.created_at DESC`,
    [groupId]
  );
  return result.rows;
}
