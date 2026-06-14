import { query, getClient } from '../db/connection';
import { SplitType, Expense, ExpenseSplit, CreateExpenseRequest } from '../types';
import { convertToINR, getExchangeRate } from './currency.service';
import { getActiveMembersOnDate } from './group.service';

/**
 * CRITICAL FUNCTION: Calculate split amounts for an expense.
 *
 * This is a pure function that can be traced by hand.
 * Given a total amount, split type, list of member IDs, and optional split values,
 * it returns the INR share for each member.
 *
 * Rounding policy: round to 2 decimal places. Any remainder (due to rounding)
 * is added to the FIRST member's share (typically the payer).
 *
 * @param totalAmountInr  Total expense in INR
 * @param splitType       One of: equal, percentage, exact, shares
 * @param memberIds       Array of user IDs participating in the split
 * @param splitValues     Parallel array of values (%, amounts, or share counts)
 * @returns Array of { userId, shareAmountInr, splitValue }
 */
export function calculateSplits(
  totalAmountInr: number,
  splitType: SplitType,
  memberIds: number[],
  splitValues?: number[]
): Array<{ userId: number; shareAmountInr: number; splitValue: number | null }> {
  const n = memberIds.length;
  if (n === 0) throw new Error('At least one member required for split');

  switch (splitType) {
    case 'equal': {
      // Each member pays totalAmountInr / n
      // Remainder goes to the first member (payer)
      const perPerson = Math.floor(totalAmountInr * 100 / n) / 100;
      const remainder = Math.round((totalAmountInr - perPerson * n) * 100) / 100;

      return memberIds.map((userId, i) => ({
        userId,
        shareAmountInr: i === 0 ? perPerson + remainder : perPerson,
        splitValue: null, // no split value for equal splits
      }));
    }

    case 'percentage': {
      if (!splitValues || splitValues.length !== n) {
        throw new Error('Percentage split requires one value per member');
      }

      const totalPct = splitValues.reduce((sum, v) => sum + v, 0);

      // Normalize if not exactly 100% (anomaly handler logs this)
      const normalizedPcts = totalPct === 100
        ? splitValues
        : splitValues.map(v => (v / totalPct) * 100);

      let allocated = 0;
      const splits = memberIds.map((userId, i) => {
        const share = i === n - 1
          ? Math.round((totalAmountInr - allocated) * 100) / 100  // last person gets remainder
          : Math.round(totalAmountInr * normalizedPcts[i] / 100 * 100) / 100;
        allocated += share;
        return {
          userId,
          shareAmountInr: share,
          splitValue: normalizedPcts[i],
        };
      });

      return splits;
    }

    case 'exact': {
      if (!splitValues || splitValues.length !== n) {
        throw new Error('Exact split requires one amount per member');
      }

      const totalExact = splitValues.reduce((sum, v) => sum + v, 0);
      if (Math.abs(totalExact - totalAmountInr) > 0.01) {
        throw new Error(
          `Exact split amounts (${totalExact}) don't match total (${totalAmountInr})`
        );
      }

      return memberIds.map((userId, i) => ({
        userId,
        shareAmountInr: splitValues[i],
        splitValue: splitValues[i],
      }));
    }

    case 'shares': {
      if (!splitValues || splitValues.length !== n) {
        throw new Error('Shares split requires one share count per member');
      }

      const totalShares = splitValues.reduce((sum, v) => sum + v, 0);
      if (totalShares === 0) throw new Error('Total shares cannot be zero');

      let allocated = 0;
      const splits = memberIds.map((userId, i) => {
        const share = i === n - 1
          ? Math.round((totalAmountInr - allocated) * 100) / 100
          : Math.round(totalAmountInr * splitValues[i] / totalShares * 100) / 100;
        allocated += share;
        return {
          userId,
          shareAmountInr: share,
          splitValue: splitValues[i],
        };
      });

      return splits;
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}

/**
 * Create a new expense with splits.
 * Validates membership on expense date before creating.
 */
export async function createExpense(
  groupId: number,
  data: CreateExpenseRequest,
  createdBy: number
): Promise<{ expense: any; splits: any[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Convert currency
  const exchangeRate = data.currency === 'INR' ? 1 : (data.exchange_rate || getExchangeRate(data.currency));
  const amountInr = convertToINR(data.amount_original, data.currency, exchangeRate);

  // Check membership on expense date
  const activeMembers = await getActiveMembersOnDate(groupId, data.expense_date);
  const activeMemberIds = activeMembers.map(m => m.user_id);

  // Warn about inactive members in split
  for (const userId of data.split_with) {
    if (!activeMemberIds.includes(userId)) {
      const memberName = activeMembers.find(m => m.user_id === userId)?.user_name || `User ${userId}`;
      warnings.push(`${memberName} was not an active member on ${data.expense_date}`);
    }
  }

  // Calculate splits
  const splits = calculateSplits(amountInr, data.split_type, data.split_with, data.split_values);

  // Save to database in a transaction
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, paid_by_user_id, description, amount_original, currency, amount_inr, exchange_rate, expense_date, split_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [groupId, data.paid_by_user_id || createdBy, data.description, data.amount_original, data.currency, amountInr, exchangeRate, data.expense_date, data.split_type, data.notes || null, createdBy]
    );
    const expense = expenseResult.rows[0];

    // Insert splits
    const savedSplits = [];
    for (const split of splits) {
      const splitResult = await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, share_amount_inr, split_value)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [expense.id, split.userId, split.shareAmountInr, split.splitValue]
      );
      savedSplits.push(splitResult.rows[0]);
    }

    await client.query('COMMIT');
    return { expense, splits: savedSplits, warnings };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all expenses for a group (paginated, excludes soft-deleted).
 */
export async function getGroupExpenses(
  groupId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ expenses: any[]; total: number }> {
  const offset = (page - 1) * limit;

  const countResult = await query(
    'SELECT COUNT(*) FROM expenses WHERE group_id = $1 AND is_deleted = FALSE',
    [groupId]
  );

  const result = await query(
    `SELECT e.*, u.name as paid_by_name
     FROM expenses e
     JOIN users u ON u.id = e.paid_by_user_id
     WHERE e.group_id = $1 AND e.is_deleted = FALSE
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT $2 OFFSET $3`,
    [groupId, limit, offset]
  );

  return {
    expenses: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
}

/**
 * Get a single expense with its splits.
 */
export async function getExpenseDetail(expenseId: number): Promise<any> {
  const expenseResult = await query(
    `SELECT e.*, u.name as paid_by_name
     FROM expenses e
     JOIN users u ON u.id = e.paid_by_user_id
     WHERE e.id = $1`,
    [expenseId]
  );

  if (expenseResult.rows.length === 0) {
    throw new Error('Expense not found');
  }

  const splitsResult = await query(
    `SELECT es.*, u.name as user_name
     FROM expense_splits es
     JOIN users u ON u.id = es.user_id
     WHERE es.expense_id = $1
     ORDER BY u.name`,
    [expenseId]
  );

  return {
    ...expenseResult.rows[0],
    splits: splitsResult.rows,
  };
}

/**
 * Soft delete an expense.
 */
export async function deleteExpense(expenseId: number): Promise<void> {
  await query(
    'UPDATE expenses SET is_deleted = TRUE WHERE id = $1',
    [expenseId]
  );
}

/**
 * Update an expense (description, amount, splits, etc.)
 */
export async function updateExpense(
  expenseId: number,
  data: Partial<CreateExpenseRequest>,
  updatedBy: number
): Promise<any> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get current expense
    const current = await client.query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
    if (current.rows.length === 0) throw new Error('Expense not found');
    const expense = current.rows[0];

    // Update expense fields
    const amountOriginal = data.amount_original ?? expense.amount_original;
    const currency = data.currency ?? expense.currency;
    const exchangeRate = currency === 'INR' ? 1 : (data.exchange_rate ?? expense.exchange_rate);
    const amountInr = convertToINR(amountOriginal, currency, exchangeRate);

    await client.query(
      `UPDATE expenses SET
        description = COALESCE($1, description),
        amount_original = $2,
        currency = $3,
        amount_inr = $4,
        exchange_rate = $5,
        expense_date = COALESCE($6, expense_date),
        split_type = COALESCE($7, split_type),
        notes = COALESCE($8, notes)
       WHERE id = $9`,
      [
        data.description, amountOriginal, currency, amountInr, exchangeRate,
        data.expense_date, data.split_type, data.notes, expenseId
      ]
    );

    // Recalculate splits if split_with provided
    if (data.split_with && data.split_with.length > 0) {
      const splitType = data.split_type || expense.split_type;
      const splits = calculateSplits(amountInr, splitType, data.split_with, data.split_values);

      // Delete old splits and insert new ones
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [expenseId]);
      for (const split of splits) {
        await client.query(
          'INSERT INTO expense_splits (expense_id, user_id, share_amount_inr, split_value) VALUES ($1, $2, $3, $4)',
          [expenseId, split.userId, split.shareAmountInr, split.splitValue]
        );
      }
    }

    await client.query('COMMIT');
    return await getExpenseDetail(expenseId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
