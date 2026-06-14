import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  Plus,
  Trash2,
  Calendar,
  X,
  AlertTriangle,
  Receipt
} from 'lucide-react';

export default function Expenses() {
  const { currentGroup } = useGroup();
  const { user } = useAuth();
  
  // Data states
  const [expenses, setExpenses] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amountOriginal, setAmountOriginal] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState('1.0');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState<'equal' | 'percentage' | 'exact' | 'shares'>('equal');
  const [paidByUserId, setPaidByUserId] = useState<string>('');
  const [selectedSplits, setSelectedSplits] = useState<number[]>([]);
  const [splitValues, setSplitValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dateWarnings, setDateWarnings] = useState<string[]>([]);

  // Detail Drawer state
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const currencyRates: Record<string, number> = {
    INR: 1,
    USD: 83.00,
    EUR: 90.50,
    GBP: 105.00
  };

  const fetchExpenses = useCallback(async () => {
    if (!currentGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get(`/expenses/group/${currentGroup.id}?limit=100`);
      setExpenses(res.data.expenses || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup]);

  const fetchGroupMembers = useCallback(async () => {
    if (!currentGroup) return;
    try {
      const res = await api.get(`/groups/${currentGroup.id}`);
      const members = res.data.members || [];
      setActiveMembers(members);
      if (members.length > 0 && !paidByUserId) {
        // Default payer to logged-in user if member, otherwise first member
        const me = members.find((m: any) => m.user_id === user?.id);
        setPaidByUserId(me ? me.user_id.toString() : members[0].user_id.toString());
        // Default split with everyone active
        const activeIds = members.filter((m: any) => m.left_at === null).map((m: any) => m.user_id);
        setSelectedSplits(activeIds);
      }
    } catch (err) {
      console.error('Failed to load group members', err);
    }
  }, [currentGroup, user, paidByUserId]);

  useEffect(() => {
    fetchExpenses();
    fetchGroupMembers();
  }, [currentGroup, fetchExpenses, fetchGroupMembers]);

  // Adjust exchange rate based on currency
  useEffect(() => {
    setExchangeRate(currencyRates[currency]?.toString() || '1.0');
  }, [currency]);

  // Check active status of members on selected expense date to fire warnings
  useEffect(() => {
    if (!expenseDate || activeMembers.length === 0) return;
    const dateObj = new Date(expenseDate);
    const warnings: string[] = [];

    selectedSplits.forEach(userId => {
      const member = activeMembers.find(m => m.user_id === userId);
      if (member) {
        const join = new Date(member.joined_at);
        const left = member.left_at ? new Date(member.left_at) : null;
        if (dateObj < join) {
          warnings.push(`${member.user_name} joined after ${expenseDate}`);
        } else if (left && dateObj > left) {
          warnings.push(`${member.user_name} left before ${expenseDate}`);
        }
      }
    });

    setDateWarnings(warnings);
  }, [expenseDate, selectedSplits, activeMembers]);

  const handleExpenseClick = async (expenseId: number) => {
    try {
      setIsDrawerOpen(true);
      setIsDetailLoading(true);
      const res = await api.get(`/expenses/${expenseId}`);
      setSelectedExpense(res.data.expense);
    } catch (err) {
      console.error('Failed to load expense detail', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCheckboxChange = (userId: number) => {
    if (selectedSplits.includes(userId)) {
      setSelectedSplits(selectedSplits.filter(id => id !== userId));
      const newValues = { ...splitValues };
      delete newValues[userId];
      setSplitValues(newValues);
    } else {
      setSelectedSplits([...selectedSplits, userId]);
    }
  };

  const handleSplitValueChange = (userId: number, val: string) => {
    setSplitValues({
      ...splitValues,
      [userId]: val
    });
  };

  // Perform split validation before submit
  const validateForm = () => {
    if (selectedSplits.length === 0) {
      return 'Please select at least one person to split with';
    }

    const amt = parseFloat(amountOriginal);
    if (isNaN(amt) || amt <= 0) {
      return 'Amount must be a positive number';
    }

    if (splitType === 'percentage') {
      let totalPct = 0;
      for (const userId of selectedSplits) {
        const val = parseFloat(splitValues[userId] || '0');
        if (isNaN(val) || val < 0) return 'Percentages must be positive numbers';
        totalPct += val;
      }
      if (Math.abs(totalPct - 100) > 0.01) {
        return `Total percentage must equal 100% (currently ${totalPct}%)`;
      }
    }

    if (splitType === 'exact') {
      const rate = parseFloat(exchangeRate) || 1;
      const totalAmountInr = amt * rate;

      let totalExactInr = 0;
      for (const userId of selectedSplits) {
        const val = parseFloat(splitValues[userId] || '0');
        if (isNaN(val) || val < 0) return 'Exact amounts must be positive numbers';
        totalExactInr += val;
      }

      if (Math.abs(totalExactInr - totalAmountInr) > 0.05) {
        const currencySymbol = currency === 'INR' ? '₹' : currency;
        return `Total exact split sum (${currencySymbol} ${totalExactInr / rate}) must equal total amount (${currencySymbol} ${amt})`;
      }
    }

    if (splitType === 'shares') {
      for (const userId of selectedSplits) {
        const val = parseFloat(splitValues[userId] || '0');
        if (isNaN(val) || val <= 0) return 'Shares must be positive numbers greater than 0';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;

    const validation = validateForm();
    if (validation) {
      setValidationError(validation);
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      // Build split values array parallel to selectedSplits
      let splitValuesArr: number[] | undefined = undefined;
      if (splitType !== 'equal') {
        splitValuesArr = selectedSplits.map(userId => parseFloat(splitValues[userId] || '0'));
      }

      await api.post(`/expenses/group/${currentGroup.id}`, {
        description,
        amount_original: parseFloat(amountOriginal),
        currency,
        exchange_rate: parseFloat(exchangeRate),
        expense_date: expenseDate,
        split_type: splitType,
        split_with: selectedSplits,
        split_values: splitValuesArr,
        paid_by_user_id: parseInt(paidByUserId),
        notes
      });

      // Clear form
      setDescription('');
      setAmountOriginal('');
      setNotes('');
      setSplitValues({});
      setIsFormOpen(false);
      fetchExpenses();
    } catch (err: any) {
      setValidationError(err.response?.data?.error || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents opening drawer
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      await api.delete(`/expenses/${expenseId}`);
      if (selectedExpense?.id === expenseId) {
        setIsDrawerOpen(false);
      }
      fetchExpenses();
    } catch (err) {
      console.error('Failed to delete expense', err);
    }
  };

  if (!currentGroup) {
    return (
      <MainLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <p className="text-[var(--color-text-muted)]">No active group selected.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Group Expenses</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Add and view shared bills. Conversions are calculated automatically.
            </p>
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.2)] hover:-translate-y-0.5"
          >
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-sm shrink-0">
            ⚠️ {error}
          </div>
        )}

        {/* Expenses Table */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 text-[var(--color-text-muted)] flex items-center justify-center mb-3">
                  <Receipt size={24} />
                </div>
                <h3 className="text-base font-semibold text-white">No expenses logged</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm">
                  Get started by adding your first expense or importing the flatmate CSV file.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--color-bg-sidebar)]">
                  <tr className="border-b border-[var(--color-border-card)]">
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pl-6">Date</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Description</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Paid By</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Original Amount</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text(--color-text-muted) text-right">INR Equivalent</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-center">Split</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-card)]">
                  {expenses.map((expense) => {
                    const dateStr = new Date(expense.expense_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC'
                    });

                    return (
                      <tr
                        key={expense.id}
                        onClick={() => handleExpenseClick(expense.id)}
                        className="hover:bg-[var(--color-bg-card-hover)]/35 cursor-pointer transition-colors duration-150 group"
                      >
                        {/* Date */}
                        <td className="p-4 pl-6 text-sm text-[var(--color-text-muted)]">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} />
                            <span>{dateStr}</span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="p-4 text-sm font-semibold text-white">
                          <div>
                            {expense.description}
                            {expense.notes && (
                              <p className="text-[10px] text-[var(--color-text-muted)] font-normal truncate max-w-[180px] mt-0.5">
                                {expense.notes}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Paid By */}
                        <td className="p-4 text-sm text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                              {expense.paid_by_name?.substring(0, 2) || 'User'}
                            </div>
                            <span className="truncate max-w-[100px]">{expense.paid_by_name}</span>
                          </div>
                        </td>

                        {/* Original Amount */}
                        <td className="p-4 text-sm font-semibold text-white text-right font-mono">
                          {expense.currency !== 'INR' && (
                            <span className="text-xs text-[var(--color-text-muted)] font-normal mr-1.5">
                              {expense.currency} {Number(expense.amount_original).toFixed(2)}
                            </span>
                          )}
                          <span>{expense.currency === 'INR' ? `₹ ${Number(expense.amount_original).toFixed(2)}` : ''}</span>
                        </td>

                        {/* INR Equivalent */}
                        <td className="p-4 text-sm font-semibold text-[var(--color-accent)] text-right font-mono">
                          ₹ {Number(expense.amount_inr).toFixed(2)}
                        </td>

                        {/* Split Type */}
                        <td className="p-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-300 capitalize border border-zinc-700">
                            {expense.split_type}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleDeleteExpense(expense.id, e)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add Expense Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] w-full max-w-lg rounded-2xl shadow-2xl p-6 my-8 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--color-border-card)] pb-4 mb-5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Receipt className="text-[var(--color-accent)]" size={20} />
                  <span>Add New Bill</span>
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-zinc-800 text-[var(--color-text-muted)] hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {validationError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-4 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {dateWarnings.length > 0 && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl mb-4 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Membership Warning:</span>
                  </div>
                  <ul className="list-disc pl-5 font-normal">
                    {dateWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Description & Amount */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                      Description
                    </label>
                    <input
                      type="text"
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Electricity Bill"
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                      Amount
                    </label>
                    <div className="flex">
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] border-r-0 rounded-l-xl px-3 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] shrink-0"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={amountOriginal}
                        onChange={(e) => setAmountOriginal(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-r-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)] font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Payer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                      Paid By
                    </label>
                    <select
                      value={paidByUserId}
                      onChange={(e) => setPaidByUserId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                    >
                      {activeMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.user_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Exchange Rate (shown if not INR) */}
                {currency !== 'INR' && (
                  <div className="p-3 bg-zinc-800/40 border border-zinc-700/30 rounded-xl">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1 pl-1">
                      Historical Exchange Rate ({currency} to INR)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">1 {currency} = </span>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        className="w-24 px-2 py-1 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-lg text-xs text-white focus:outline-none focus:border-[var(--color-accent)] font-mono text-center"
                      />
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">INR</span>
                    </div>
                  </div>
                )}

                {/* Split Type */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 pl-1">
                    Split Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['equal', 'percentage', 'exact', 'shares'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSplitType(t)}
                        className={`py-2 text-xs font-semibold rounded-xl capitalize cursor-pointer border transition-all ${
                          splitType === t
                            ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)] font-bold shadow-[0_0_10px_rgba(0,180,166,0.05)]'
                            : 'bg-zinc-800/30 border-[var(--color-border-card)] text-[var(--color-text-muted)] hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split With Checklist */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5 pl-1">
                    Split With & Values
                  </label>
                  <div className="border border-[var(--color-border-card)] rounded-xl divide-y divide-[var(--color-border-card)] overflow-hidden max-h-56 overflow-y-auto">
                    {activeMembers.map((member) => {
                      const isChecked = selectedSplits.includes(member.user_id);
                      return (
                        <div
                          key={member.user_id}
                          className="flex items-center justify-between p-3 bg-zinc-900/10 hover:bg-zinc-800/20"
                        >
                          <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-white shrink-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange(member.user_id)}
                              className="rounded border-[var(--color-border-card)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] w-4 h-4 cursor-pointer"
                            />
                            <span>{member.user_name}</span>
                            {member.left_at && (
                              <span className="text-[10px] text-orange-400 bg-orange-500/5 px-1.5 py-0.5 rounded border border-orange-500/10">
                                Left Group
                              </span>
                            )}
                          </label>

                          {/* Dynamic split fields per member */}
                          {isChecked && splitType !== 'equal' && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="any"
                                required
                                value={splitValues[member.user_id] || ''}
                                onChange={(e) => handleSplitValueChange(member.user_id, e.target.value)}
                                placeholder={splitType === 'percentage' ? '%' : splitType === 'shares' ? 'shares' : 'amount'}
                                className="w-24 px-2 py-1 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-lg text-xs text-white focus:outline-none focus:border-[var(--color-accent)] font-mono text-right"
                              />
                              <span className="text-xs text-[var(--color-text-muted)] font-semibold w-8">
                                {splitType === 'percentage' ? '%' : splitType === 'shares' ? 'sh.' : 'INR'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Notes / Memo
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes, e.g. receipt info, splitting details..."
                    className="w-full px-4 py-2 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-2.5 border border-[var(--color-border-card)] hover:bg-[var(--color-bg-card-hover)] text-white font-semibold rounded-xl text-sm cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent)]/50 text-white font-semibold rounded-xl text-sm cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,180,166,0.2)] animate-pulse-subtle"
                  >
                    {isSubmitting ? 'Logging...' : 'Log Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Expense Detail Drawer */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
            {/* Click outside target */}
            <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
            
            {/* Drawer Body */}
            <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border-card)] h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-slide-left">
              {isDetailLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : selectedExpense ? (
                <div className="flex-col h-full flex justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-border-card)] pb-4 mb-5">
                      <h3 className="text-lg font-bold text-white">Bill Details</h3>
                      <button
                        onClick={() => setIsDrawerOpen(false)}
                        className="p-1 hover:bg-zinc-800 text-[var(--color-text-muted)] hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Expense Core Stats */}
                    <div className="mb-6">
                      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Total Amount</div>
                      <div className="text-3xl font-extrabold text-[var(--color-accent)] font-mono mt-1">
                        ₹ {Number(selectedExpense.amount_inr).toFixed(2)}
                      </div>
                      {selectedExpense.currency !== 'INR' && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-1.5 font-mono">
                          Original: {selectedExpense.currency} {Number(selectedExpense.amount_original).toFixed(2)}
                          <span className="block text-[10px] text-zinc-500 mt-0.5">Exchange Rate: 1 {selectedExpense.currency} = {Number(selectedExpense.exchange_rate).toFixed(4)} INR</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* Description */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-[var(--color-border-card)]/50">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Description</span>
                        <span className="col-span-2 text-sm text-white font-medium">{selectedExpense.description}</span>
                      </div>

                      {/* Date */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-[var(--color-border-card)]/50">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Date</span>
                        <span className="col-span-2 text-sm text-white font-medium">
                          {new Date(selectedExpense.expense_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'UTC'
                          })}
                        </span>
                      </div>

                      {/* Paid By */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-[var(--color-border-card)]/50">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Paid By</span>
                        <span className="col-span-2 text-sm text-white font-medium flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center text-[9px] font-bold uppercase">
                            {selectedExpense.paid_by_name?.substring(0, 2)}
                          </div>
                          <span>{selectedExpense.paid_by_name}</span>
                        </span>
                      </div>

                      {/* Split Type */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-[var(--color-border-card)]/50">
                        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Split Type</span>
                        <span className="col-span-2 text-sm text-white font-medium capitalize">{selectedExpense.split_type}</span>
                      </div>

                      {/* Notes */}
                      {selectedExpense.notes && (
                        <div className="py-2.5">
                          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Notes</span>
                          <p className="text-xs text-zinc-300 bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-3 leading-relaxed">
                            {selectedExpense.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Split Breakdown */}
                    <div className="mt-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Split Breakdown (Rohan's Drilldown)</h4>
                      <div className="border border-[var(--color-border-card)] rounded-xl divide-y divide-[var(--color-border-card)] overflow-hidden bg-zinc-900/10">
                        {selectedExpense.splits?.map((split: any) => {
                          const isPayer = split.user_id === selectedExpense.paid_by_user_id;
                          return (
                            <div key={split.id} className="p-3 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 font-medium text-white">
                                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[9px] uppercase">
                                  {split.user_name?.substring(0, 2)}
                                </div>
                                <span>{split.user_name}</span>
                                {isPayer && <span className="text-[9px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-1 rounded">Payer</span>}
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-white font-mono">₹ {Number(split.share_amount_inr).toFixed(2)}</div>
                                {selectedExpense.split_type !== 'equal' && split.split_value !== null && (
                                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                                    {selectedExpense.split_type === 'percentage' ? `${Number(split.split_value).toFixed(1)}%` :
                                     selectedExpense.split_type === 'shares' ? `${Number(split.split_value).toFixed(0)} shares` :
                                     `exact`}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="border-t border-[var(--color-border-card)] pt-4 mt-6 flex gap-3">
                    <button
                      onClick={(e) => handleDeleteExpense(selectedExpense.id, e)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-500/30 hover:bg-red-500/5 text-red-400 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                      <span>Delete Expense</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Failed to load details.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
