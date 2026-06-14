import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
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
      <div className="animate-fade-in flex-1 flex flex-col min-h-0" style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="section-label">Balances</span>
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#334155' }} />
              <span className="section-label" style={{ color: '#6366f1' }}>{currentGroup.name}</span>
            </div>
            <h1 className="page-title">Balances &amp; Debts</h1>
            <p className="text-[13px] mt-1" style={{ color: '#475569' }}>
              Who owes whom, net group standing, and expense drilldowns.
            </p>
          </div>
          <button onClick={() => handleOpenSettle()} className="btn-primary">
            <HandCoins size={15} />
            <span>Record Payment</span>
          </button>
        </div>

        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-[13px]"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}
          >
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 stagger">
          {/* Column 1: Net Balances */}
          <div className="animate-fade-in hover-lift" style={{
            padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '0',
            background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #6366f1 0%, #6366f160 40%, transparent 100%)' }} />
            <div className="section-label mb-5 flex items-center gap-2">
              <Scale size={13} style={{ color: '#6366f1' }} />
              Net Balances
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
                </div>
              ) : netBalances.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: '#334155' }}>Everyone is fully settled up!</p>
              ) : (
                netBalances.map((item) => {
                  const isOwed = item.amount > 0;
                  return (
                    <button
                      key={item.userId}
                      onClick={() => handleMemberClick(item)}
                      className="w-full flex items-center justify-between p-3 rounded-xl text-left cursor-pointer transition-all"
                      style={{
                        background: selectedMember?.userId === item.userId
                          ? 'rgba(99,102,241,0.08)'
                          : 'rgba(255,255,255,0.025)',
                        border: selectedMember?.userId === item.userId
                          ? '1px solid rgba(99,102,241,0.25)'
                          : '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] uppercase shrink-0"
                          style={{
                            background: isOwed ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))' : 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.05))',
                            border: isOwed ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(244,63,94,0.25)',
                            color: isOwed ? '#10b981' : '#f43f5e',
                            boxShadow: isOwed ? '0 2px 8px rgba(16,185,129,0.15)' : '0 2px 8px rgba(244,63,94,0.15)',
                          }}
                        >
                          {item.userName.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-[12.5px] font-semibold text-white">{item.userName}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                            {isOwed ? 'is owed money' : 'owes money'}
                          </div>
                        </div>
                      </div>
                      <div
                        className="mono text-[13px] font-semibold shrink-0"
                        style={{ color: isOwed ? '#10b981' : '#f43f5e' }}
                      >
                        {isOwed ? '+' : ''}₹{Math.abs(item.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Simplified Debts */}
          <div className="animate-fade-in hover-lift" style={{
            padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '0',
            background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
            animationDelay: '60ms',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #10b981 0%, #10b98160 40%, transparent 100%)' }} />
            <div className="section-label mb-5 flex items-center gap-2">
              <HandCoins size={13} style={{ color: '#6366f1' }} />
              Simplified Debts
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
                </div>
              ) : simplifiedDebts.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-3xl">🎉</span>
                  <h3 className="text-[13px] font-semibold text-white mt-3">All settled up!</h3>
                  <p className="text-[11px] mt-1" style={{ color: '#334155' }}>No outstanding balances to simplify.</p>
                </div>
              ) : (
                simplifiedDebts.map((debt, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl flex items-center justify-between gap-2 transition-colors"
                    style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.05))', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)', boxShadow: '0 2px 8px rgba(244,63,94,0.15)' }}
                      >
                        {debt.fromName?.substring(0, 2)?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-white flex items-center gap-1.5 flex-wrap">
                          <span className="truncate max-w-[80px]">{debt.fromName}</span>
                          <span style={{ color: '#334155' }}>→</span>
                          <span className="truncate max-w-[80px]">{debt.toName}</span>
                        </div>
                        <div className="mono text-[11px] font-semibold mt-0.5" style={{ color: '#f43f5e' }}>
                          ₹{Number(debt.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenSettle(debt)}
                      className="px-3 py-1.5 font-semibold rounded-xl text-[11px] shrink-0 cursor-pointer transition-all"
                      style={{
                        background: 'rgba(99,102,241,0.12)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        color: '#a5b4fc',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = 'white'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; e.currentTarget.style.color = '#a5b4fc'; }}
                    >
                      Settle
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: Member Drilldown */}
          <div className="animate-fade-in hover-lift" style={{
            padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '0',
            background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
            animationDelay: '120ms',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #3b82f6 0%, #3b82f660 40%, transparent 100%)' }} />
            <div className="section-label mb-1 flex items-center gap-2">
              <FileText size={13} style={{ color: '#6366f1' }} />
              Balance Drilldown
            </div>
            <p className="text-[10px] mb-5 mt-1" style={{ color: '#334155' }}>Select a member to trace their bills</p>

            <div className="flex-1 overflow-y-auto">
              {isDrilldownLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
                </div>
              ) : !selectedMember ? (
                <div className="text-center py-16" style={{ color: '#334155' }}>
                  <Info size={20} className="mx-auto mb-2" />
                  <p className="text-[12px]">Select any flatmate to trace their ledger step-by-step.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Ledger Header */}
                  <div
                    className="p-4 rounded-xl flex items-center justify-between"
                    style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <div>
                      <h4 className="text-[13px] font-bold text-white">{selectedMember.userName}</h4>
                      <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Cumulative Group Standing</p>
                    </div>
                    <div
                      className="mono text-[15px] font-semibold"
                      style={{ color: drilldownTotal >= 0 ? '#10b981' : '#f43f5e' }}
                    >
                      {drilldownTotal >= 0 ? '+' : ''}₹{drilldownTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Ledger Items */}
                  <div className="space-y-2">
                    {drilldownData.length === 0 ? (
                      <p className="text-[12px] text-center py-6" style={{ color: '#334155' }}>No bills linked to this member.</p>
                    ) : (
                      drilldownData.map((item, idx) => {
                        const isPayer = item.paid_by_user_id === selectedMember.userId;
                        const dateStr = new Date(item.expense_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', timeZone: 'UTC'
                        });
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl text-xs space-y-1.5 transition-colors"
                            style={{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)' }}
                          >
                            <div className="flex items-center justify-between" style={{ color: '#475569', fontSize: '10px', fontFamily: 'monospace' }}>
                              <span className="flex items-center gap-1">
                                <Calendar size={11} /> {dateStr}
                              </span>
                              <span className="capitalize">{item.split_type} split</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-white truncate max-w-[150px]">{item.description}</span>
                              <span
                                className="mono font-semibold shrink-0"
                                style={{ color: item.net_effect >= 0 ? '#10b981' : '#f43f5e' }}
                              >
                                {item.net_effect >= 0 ? '+' : ''}₹{item.net_effect.toFixed(2)}
                              </span>
                            </div>
                            <div
                              className="flex items-center justify-between pt-1.5 mt-1"
                              style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#475569', fontSize: '10px' }}
                            >
                              <div>
                                {isPayer
                                  ? <span>Paid <strong className="text-white">₹{Number(item.amount_inr).toFixed(2)}</strong></span>
                                  : <span>Payer: <strong className="text-white">{item.paid_by_name}</strong></span>
                                }
                              </div>
                              <div><span>Owed <strong className="text-white">₹{Number(item.my_share).toFixed(2)}</strong></span></div>
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
          <div className="modal-backdrop animate-fade-in">
            <div
              className="animate-scale-in w-full max-w-md p-8 relative overflow-hidden"
              style={{
                background: 'rgba(13, 13, 28, 0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset',
                backdropFilter: 'blur(30px)',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)' }} />

              <div className="flex items-center justify-between pb-5 mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h2 className="text-[17px] font-bold text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <HandCoins size={16} style={{ color: '#818cf8' }} />
                  </div>
                  <span>Record Payment</span>
                </h2>
                <button
                  onClick={() => setIsSettleOpen(false)}
                  className="p-1.5 rounded-xl cursor-pointer transition-colors"
                  style={{ color: '#475569' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <X size={18} />
                </button>
              </div>

              {settleError && (
                <div
                  className="flex items-center gap-2.5 p-3.5 rounded-xl mb-4 text-[12px]"
                  style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}
                >
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

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSettleOpen(false)}
                    className="btn-ghost flex-1 py-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSettle}
                    className="btn-primary flex-1 py-3"
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
