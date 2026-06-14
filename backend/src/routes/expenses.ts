import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import * as expenseService from '../services/expense.service';
import * as groupService from '../services/group.service';
import { getSupportedCurrencies } from '../services/currency.service';

const router = Router();

router.use(verifyToken);

/**
 * GET /api/expenses/currencies
 * Get supported currencies with exchange rates.
 */
router.get('/currencies', (req: Request, res: Response) => {
  res.json({ currencies: getSupportedCurrencies() });
});

/**
 * GET /api/expenses/group/:groupId
 * List expenses for a group (paginated).
 */
router.get('/group/:groupId', async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Verify membership
    const isMember = await groupService.isGroupMember(groupId, req.user!.id);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const result = await expenseService.getGroupExpenses(groupId, page, limit);
    res.json(result);
  } catch (error: any) {
    console.error('List expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

/**
 * POST /api/expenses/group/:groupId
 * Create a new expense with splits.
 */
router.post('/group/:groupId', async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);

    const isMember = await groupService.isGroupMember(groupId, req.user!.id);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const { description, amount_original, currency, exchange_rate, expense_date, split_type, split_with, split_values, notes, paid_by_user_id } = req.body;

    if (!description || !amount_original || !expense_date || !split_type || !split_with?.length) {
      res.status(400).json({ error: 'Missing required fields: description, amount_original, expense_date, split_type, split_with' });
      return;
    }

    const result = await expenseService.createExpense(groupId, {
      description,
      amount_original: parseFloat(amount_original),
      currency: currency || 'INR',
      exchange_rate: exchange_rate ? parseFloat(exchange_rate) : 1,
      expense_date,
      split_type,
      split_with,
      split_values: split_values?.map(Number),
      notes,
      paid_by_user_id: paid_by_user_id || req.user!.id,
    }, req.user!.id);

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create expense error:', error);
    res.status(400).json({ error: error.message || 'Failed to create expense' });
  }
});

/**
 * GET /api/expenses/:id
 * Get expense detail with full split breakdown.
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);
    const expense = await expenseService.getExpenseDetail(expenseId);
    res.json({ expense });
  } catch (error: any) {
    if (error.message === 'Expense not found') {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

/**
 * PATCH /api/expenses/:id
 * Update an expense.
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);
    const expense = await expenseService.updateExpense(expenseId, req.body, req.user!.id);
    res.json({ expense });
  } catch (error: any) {
    console.error('Update expense error:', error);
    res.status(400).json({ error: error.message || 'Failed to update expense' });
  }
});

/**
 * DELETE /api/expenses/:id
 * Soft delete an expense (sets is_deleted = true).
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const expenseId = parseInt(req.params.id);
    await expenseService.deleteExpense(expenseId);
    res.json({ message: 'Expense deleted' });
  } catch (error: any) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
