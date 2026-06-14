import { query } from '../db/connection';
import { GroupBalanceResult, NetBalance, SimplifiedDebt } from '../types';

/**
 * CRITICAL FUNCTION: Calculate group balances.
 *
 * This is a pure function that can be traced by hand in the live session.
 * Given expenses, splits, settlements, and memberships, it computes:
 *   1. Net balance per user (positive = owed money, negative = owes money)
 *   2. Simplified debts (minimum cash flow)
 *
 * ALGORITHM:
 *   Step 1: For each non-deleted expense:
 *     - Payer gets credit = amount_inr
 *     - Each split member gets debit = share_amount_inr
 *     - net[user] = sum(credits) - sum(debits)
 *
 *   Step 2: For each settlement:
 *     - Payer's net -= amount_inr (they paid out cash)
 *     - Payee's net += amount_inr (they received cash)
 *
 *   Step 3: Membership date-gating is already handled:
 *     - Splits only exist for members who were active on expense_date
 *     - This was enforced at expense creation time
 *
 *   Step 4: Simplify debts using minimum cash flow algorithm
 *     - Sort by net balance
 *     - Match largest debtor with largest creditor
 *     - Produces minimum number of payments
 *
 * @param expenses     Array of { id, paid_by_user_id, amount_inr, is_deleted }
 * @param splits       Array of { expense_id, user_id, share_amount_inr }
 * @param settlements  Array of { payer_id, payee_id, amount_inr }
 * @param userNames    Map of userId -> userName for display
 */
export function calculateGroupBalances(
  expenses: Array<{ id: number; paid_by_user_id: number; amount_inr: number; is_deleted: boolean }>,
  splits: Array<{ expense_id: number; user_id: number; share_amount_inr: number }>,
  settlements: Array<{ payer_id: number; payee_id: number; amount_inr: number }>,
  userNames: Map<number, string>
): GroupBalanceResult {

  // Step 1: Build net balance from expenses
  const netMap = new Map<number, number>();

  // Initialize all known users to 0
  for (const [userId] of userNames) {
    netMap.set(userId, 0);
  }

  // Process each non-deleted expense
  for (const expense of expenses) {
    if (expense.is_deleted) continue;

    // Payer gets credit for the full amount they paid
    const payerId = expense.paid_by_user_id;
    const currentPayerNet = netMap.get(payerId) || 0;
    netMap.set(payerId, currentPayerNet + Number(expense.amount_inr));
  }

  // Each split member is debited their share
  // Build a set of non-deleted expense IDs for filtering
  const activeExpenseIds = new Set(
    expenses.filter(e => !e.is_deleted).map(e => e.id)
  );

  for (const split of splits) {
    if (!activeExpenseIds.has(split.expense_id)) continue;

    const userId = split.user_id;
    const currentNet = netMap.get(userId) || 0;
    netMap.set(userId, currentNet - Number(split.share_amount_inr));
  }

  // Step 2: Apply settlements
  for (const settlement of settlements) {
    // Payer gave money → their net decreases (they spent cash)
    const payerNet = netMap.get(settlement.payer_id) || 0;
    netMap.set(settlement.payer_id, payerNet - Number(settlement.amount_inr));

    // Payee received money → their net increases (they received cash)
    const payeeNet = netMap.get(settlement.payee_id) || 0;
    netMap.set(settlement.payee_id, payeeNet + Number(settlement.amount_inr));
  }

  // Build netBalances array
  const netBalances: NetBalance[] = [];
  for (const [userId, amount] of netMap) {
    const roundedAmount = Math.round(amount * 100) / 100;
    if (Math.abs(roundedAmount) > 0.01) { // Skip zero balances
      netBalances.push({
        userId,
        userName: userNames.get(userId) || `User ${userId}`,
        amount: roundedAmount,
      });
    }
  }

  // Sort: creditors first (positive), then debtors (negative)
  netBalances.sort((a, b) => b.amount - a.amount);

  // Step 4: Simplify debts using minimum cash flow
  const simplifiedDebts = simplifyDebts(netBalances, userNames);

  return { netBalances, simplifiedDebts };
}

/**
 * Minimum cash flow algorithm.
 *
 * Given net balances (positive = owed, negative = owes):
 * 1. Find max creditor and max debtor
 * 2. Transfer min(credit, |debt|) from debtor to creditor
 * 3. Update balances and repeat until all are zero
 *
 * This produces the minimum number of transactions needed to settle all debts.
 * Aisha's requirement: "one number per person — who pays whom, how much, done."
 */
function simplifyDebts(
  netBalances: NetBalance[],
  userNames: Map<number, string>
): SimplifiedDebt[] {
  // Create mutable copy of balances
  const balances = new Map<number, number>();
  for (const nb of netBalances) {
    balances.set(nb.userId, nb.amount);
  }

  const debts: SimplifiedDebt[] = [];

  // Keep matching until all balances are settled
  let iterations = 0;
  const MAX_ITERATIONS = 1000; // Safety guard

  while (iterations < MAX_ITERATIONS) {
    // Find max creditor (most positive) and max debtor (most negative)
    let maxCreditor = { userId: -1, amount: 0 };
    let maxDebtor = { userId: -1, amount: 0 };

    for (const [userId, amount] of balances) {
      if (amount > maxCreditor.amount + 0.01) {
        maxCreditor = { userId, amount };
      }
      if (amount < maxDebtor.amount - 0.01) {
        maxDebtor = { userId, amount };
      }
    }

    // If no significant imbalance remains, we're done
    if (maxCreditor.amount < 0.01 || maxDebtor.amount > -0.01) {
      break;
    }

    // Transfer the minimum of credit and |debt|
    const transferAmount = Math.min(maxCreditor.amount, Math.abs(maxDebtor.amount));
    const roundedTransfer = Math.round(transferAmount * 100) / 100;

    if (roundedTransfer < 0.01) break;

    debts.push({
      from: maxDebtor.userId,
      fromName: userNames.get(maxDebtor.userId) || `User ${maxDebtor.userId}`,
      to: maxCreditor.userId,
      toName: userNames.get(maxCreditor.userId) || `User ${maxCreditor.userId}`,
      amount: roundedTransfer,
    });

    // Update balances
    balances.set(maxCreditor.userId, maxCreditor.amount - roundedTransfer);
    balances.set(maxDebtor.userId, maxDebtor.amount + roundedTransfer);

    iterations++;
  }

  return debts;
}

/**
 * Fetch all data needed for balance calculation from the database,
 * then call the pure calculateGroupBalances function.
 */
export async function getGroupBalances(groupId: number): Promise<GroupBalanceResult> {
  // Fetch expenses (non-deleted)
  const expensesResult = await query(
    'SELECT id, paid_by_user_id, amount_inr, is_deleted FROM expenses WHERE group_id = $1',
    [groupId]
  );

  // Fetch all splits for this group's expenses
  const splitsResult = await query(
    `SELECT es.expense_id, es.user_id, es.share_amount_inr
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = $1`,
    [groupId]
  );

  // Fetch settlements
  const settlementsResult = await query(
    'SELECT payer_id, payee_id, amount_inr FROM settlements WHERE group_id = $1',
    [groupId]
  );

  // Fetch all members (including left) for name mapping
  const membersResult = await query(
    `SELECT DISTINCT u.id, u.name
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId]
  );

  const userNames = new Map<number, string>();
  for (const row of membersResult.rows) {
    userNames.set(row.id, row.name);
  }

  return calculateGroupBalances(
    expensesResult.rows,
    splitsResult.rows,
    settlementsResult.rows,
    userNames
  );
}

/**
 * Get individual member's balance breakdown — every expense that contributes.
 * Satisfies Rohan's requirement: full drilldown into balance composition.
 */
export async function getMemberBalanceDetail(
  groupId: number,
  userId: number
): Promise<any> {
  // Get all expenses where this user paid or has a split
  const result = await query(
    `SELECT
       e.id, e.description, e.expense_date, e.amount_inr, e.currency,
       e.amount_original, e.paid_by_user_id, e.split_type,
       u_payer.name as paid_by_name,
       es.share_amount_inr as my_share,
       CASE WHEN e.paid_by_user_id = $2 THEN e.amount_inr ELSE 0 END as i_paid
     FROM expenses e
     JOIN users u_payer ON u_payer.id = e.paid_by_user_id
     LEFT JOIN expense_splits es ON es.expense_id = e.id AND es.user_id = $2
     WHERE e.group_id = $1 AND e.is_deleted = FALSE
       AND (e.paid_by_user_id = $2 OR es.user_id = $2)
     ORDER BY e.expense_date ASC`,
    [groupId, userId]
  );

  let runningTotal = 0;
  const breakdown = result.rows.map(row => {
    const iPaid = Number(row.i_paid);
    const myShare = Number(row.my_share || 0);
    const netEffect = iPaid - myShare; // positive = I'm owed, negative = I owe
    runningTotal += netEffect;

    return {
      ...row,
      i_paid: iPaid,
      my_share: myShare,
      net_effect: Math.round(netEffect * 100) / 100,
      running_total: Math.round(runningTotal * 100) / 100,
    };
  });

  return { breakdown, total: Math.round(runningTotal * 100) / 100 };
}
