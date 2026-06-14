import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  ArrowRight,
  HandCoins,
  Scale,
  Calendar,
  X,
  Info,
  FileText
} from 'lucide-react';

export default function Balances() {
  const { currentGroup } = useGroup();
  const { user } = useAuth();

  // Data states
  const [netBalances, setNetBalances] = useState<any[]>([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown state
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [drilldownData, setDrilldownData] = useState<any[]>([]);
  const [drilldownTotal, setDrilldownTotal] = useState<number>(0);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);

  // Settlement Modal state
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePayer, setSettlePayer] = useState('');
  const [settlePayee, setSettlePayee] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!currentGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch balances
      const balanceRes = await api.get(`/balances/group/${currentGroup.id}`);
      setNetBalances(balanceRes.data.netBalances || []);
      setSimplifiedDebts(balanceRes.data.simplifiedDebts || []);

      // Fetch group members for name mappings/dropdowns
      const membersRes = await api.get(`/groups/${currentGroup.id}`);
      setActiveMembers(membersRes.data.members || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load balances');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup]);

  useEffect(() => {
    fetchBalances();
  }, [currentGroup, fetchBalances]);

  const handleMemberClick = async (member: any) => {
    if (!currentGroup) return;
    setSelectedMember(member);
    setIsDrilldownLoading(true);
    try {
      const res = await api.get(`/balances/group/${currentGroup.id}/member/${member.userId}`);
      setDrilldownData(res.data.breakdown || []);
      setDrilldownTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load drilldown data', err);
    } finally {
      setIsDrilldownLoading(false);
    }
  };

  const handleOpenSettle = (debt?: any) => {
    if (debt) {
      setSettlePayer(debt.from.toString());
      setSettlePayee(debt.to.toString());
      setSettleAmount(debt.amount.toString());
    } else {
      // Default to logged-in user as payer if in group, otherwise clear
      const me = activeMembers.find(m => m.user_id === user?.id);
      setSettlePayer(me ? me.user_id.toString() : '');
      setSettlePayee('');
      setSettleAmount('');
    }
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleError(null);
    setIsSettleOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;

    if (!settlePayer || !settlePayee || !settleAmount) {
      setSettleError('Please fill in all required fields');
      return;
    }

    if (settlePayer === settlePayee) {
      setSettleError('Payer and recipient must be different people');
      return;
    }

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setSettleError('Amount must be positive');
      return;
    }

    setIsSubmittingSettle(true);
    setSettleError(null);

    try {
      await api.post(`/settlements/group/${currentGroup.id}`, {
        payer_id: parseInt(settlePayer),
        payee_id: parseInt(settlePayee),
        amount_inr: amt,
        settled_at: settleDate
      });
      setIsSettleOpen(false);
      fetchBalances();
      
      // If the currently viewed member was updated, refresh their drilldown
      if (selectedMember) {
        handleMemberClick(selectedMember);
      }
    } catch (err: any) {
      setSettleError(err.response?.data?.error || 'Failed to record settlement');
    } finally {
      setIsSubmittingSettle(false);
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
            <h1 className="text-3xl font-bold text-white tracking-tight">Balances & Debts</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Who owes whom, net group standing, and hand-traced expense drilldowns.
            </p>
          </div>
          <button
            onClick={() => handleOpenSettle()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.2)] hover:-translate-y-0.5"
          >
            <HandCoins size={16} />
            <span>Record Payment</span>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-sm shrink-0">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* Column 1: Net Balances Summary */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-6 shadow-xl flex flex-col min-h-0">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 shrink-0">
              <Scale className="text-[var(--color-accent)]" size={18} />
              <span>Net Balances</span>
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : netBalances.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-8">Everyone is fully settled up!</p>
              ) : (
                netBalances.map((item) => {
                  const isOwed = item.amount > 0;
                  return (
                    <button
                      key={item.userId}
                      onClick={() => handleMemberClick(item)}
                      className={`w-full flex items-center justify-between p-3.5 bg-zinc-900/15 hover:bg-zinc-800/20 rounded-xl border border-transparent hover:border-[var(--color-border-card)] text-left cursor-pointer transition-all duration-200 ${
                        selectedMember?.userId === item.userId ? 'bg-zinc-800/40 border-[var(--color-border-card)] shadow-md' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase border ${
                          isOwed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                        }`}>
                          {item.userName.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{item.userName}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                            {isOwed ? 'is owed money' : 'owes money'}
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-bold font-mono ${isOwed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isOwed ? '+' : ''}₹{Math.abs(item.amount).toFixed(2)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Simplified Debts (Aisha's View) */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-6 shadow-xl flex flex-col min-h-0">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 shrink-0">
              <HandCoins className="text-[var(--color-accent)]" size={18} />
              <span>Simplified Debts</span>
            </h2>
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : simplifiedDebts.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-2xl">🎉</span>
                  <h3 className="text-xs font-semibold text-white mt-2">All settled up!</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">No outstanding balances to simplify.</p>
                </div>
              ) : (
                simplifiedDebts.map((debt, index) => (
                  <div
                    key={index}
                    className="p-3.5 bg-zinc-900/15 border border-[var(--color-border-card)]/50 rounded-xl flex items-center justify-between gap-2 hover:bg-zinc-800/10 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white truncate block">{debt.fromName}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">pays</span>
                      </div>
                      <ArrowRight size={14} className="text-[var(--color-text-muted)] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-white truncate block">{debt.toName}</span>
                        <span className="text-[10px] text-[var(--color-accent)] block mt-0.5">₹{Number(debt.amount).toFixed(2)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenSettle(debt)}
                      className="px-2.5 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold rounded-lg text-[10px] uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
                    >
                      Settle
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Member Drilldown (Rohan's View) */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-6 shadow-xl flex flex-col min-h-0">
            <h2 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2 shrink-0">
              <FileText className="text-[var(--color-accent)]" size={18} />
              <span>Balance Drilldown</span>
            </h2>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider shrink-0 mb-4">
              Select a member on the left to trace bills
            </p>
            
            <div className="flex-1 overflow-y-auto pr-1">
              {isDrilldownLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : !selectedMember ? (
                <div className="text-center py-16 text-zinc-500">
                  <Info size={20} className="mx-auto mb-2 text-zinc-600" />
                  <p className="text-xs">Select any flatmate to trace their ledger step-by-step.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Ledger Header */}
                  <div className="p-4 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedMember.userName}</h4>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Cumulative Group Standing</p>
                    </div>
                    <div className={`text-base font-extrabold font-mono ${drilldownTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {drilldownTotal >= 0 ? '+' : ''}₹{drilldownTotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Ledger Items */}
                  <div className="space-y-2.5">
                    {drilldownData.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] text-center py-6">No bills linked to this member.</p>
                    ) : (
                      drilldownData.map((item, idx) => {
                        const isPayer = item.paid_by_user_id === selectedMember.userId;
                        const dateStr = new Date(item.expense_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'UTC'
                        });

                        return (
                          <div
                            key={idx}
                            className="p-3 bg-zinc-900/10 border border-[var(--color-border-card)]/30 rounded-xl text-xs space-y-1.5 hover:bg-zinc-800/10 transition-colors"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-mono">
                              <span className="flex items-center gap-1">
                                <Calendar size={11} /> {dateStr}
                              </span>
                              <span className="capitalize">{item.split_type} split</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-white truncate max-w-[150px]">{item.description}</span>
                              <span className={`font-semibold font-mono ${item.net_effect >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {item.net_effect >= 0 ? '+' : ''}₹{item.net_effect.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border-card)]/30 pt-1.5 mt-1">
                              <div>
                                {isPayer ? (
                                  <span>Paid <strong>₹{Number(item.amount_inr).toFixed(2)}</strong></span>
                                ) : (
                                  <span>Payer: <strong>{item.paid_by_name}</strong></span>
                                )}
                              </div>
                              <div>
                                <span>Owed <strong>₹{Number(item.my_share).toFixed(2)}</strong></span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settlement Modal */}
        {isSettleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in">
              <div className="flex items-center justify-between border-b border-[var(--color-border-card)] pb-4 mb-5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HandCoins className="text-[var(--color-accent)]" size={20} />
                  <span>Record Payment</span>
                </h2>
                <button
                  onClick={() => setIsSettleOpen(false)}
                  className="p-1 hover:bg-zinc-800 text-[var(--color-text-muted)] hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {settleError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-4 text-xs">
                  ⚠️ {settleError}
                </div>
              )}

              <form onSubmit={handleSettleSubmit} className="space-y-4">
                {/* Payer selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Who paid?
                  </label>
                  <select
                    value={settlePayer}
                    onChange={(e) => setSettlePayer(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="" disabled>Select member...</option>
                    {activeMembers.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                    ))}
                  </select>
                </div>

                {/* Payee selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Who received?
                  </label>
                  <select
                    value={settlePayee}
                    onChange={(e) => setSettlePayee(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    <option value="" disabled>Select member...</option>
                    {activeMembers.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Amount (INR)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-zinc-400 font-mono text-sm">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)] font-mono"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Date of Payment
                  </label>
                  <input
                    type="date"
                    required
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                {/* Submit buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSettleOpen(false)}
                    className="flex-1 py-2.5 border border-[var(--color-border-card)] hover:bg-[var(--color-bg-card-hover)] text-white font-semibold rounded-xl text-sm cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSettle}
                    className="flex-1 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent)]/50 text-white font-semibold rounded-xl text-sm cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,180,166,0.2)]"
                  >
                    {isSubmittingSettle ? 'Saving...' : 'Record Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
