import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import api from '../api/client';
import { HandCoins, Calendar, ArrowRight } from 'lucide-react';

export default function Settlements() {
  const { currentGroup } = useGroup();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async () => {
    if (!currentGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get(`/settlements/group/${currentGroup.id}`);
      setSettlements(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settlements');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup]);

  useEffect(() => {
    fetchSettlements();
  }, [currentGroup, fetchSettlements]);

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
      <div className="p-8 max-w-4xl mx-auto w-full flex-1 flex flex-col min-h-0 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Payment History</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Historical ledger of recorded direct debt settlements for <span className="text-[var(--color-accent)] font-semibold">{currentGroup.name}</span>.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-sm shrink-0">
            ⚠️ {error}
          </div>
        )}

        {/* List of settlements */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
              </div>
            ) : settlements.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 text-[var(--color-text-muted)] flex items-center justify-center mb-3">
                  <HandCoins size={24} />
                </div>
                <h3 className="text-base font-semibold text-white">No payments recorded</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm">
                  Record payments from the Balances screen to settle up.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--color-bg-sidebar)]">
                  <tr className="border-b border-[var(--color-border-card)]">
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pl-6">Date</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Sender (Payer)</th>
                    <th className="p-4 text-xs style font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-center">Transfer</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Recipient (Payee)</th>
                    <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right pr-6">Amount Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-card)]">
                  {settlements.map((settlement) => {
                    const dateStr = new Date(settlement.settled_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC'
                    });

                    return (
                      <tr key={settlement.id} className="hover:bg-[var(--color-bg-card-hover)]/20 transition-colors">
                        {/* Date */}
                        <td className="p-4 pl-6 text-sm text-[var(--color-text-muted)]">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} />
                            <span>{dateStr}</span>
                          </div>
                        </td>

                        {/* Payer */}
                        <td className="p-4 text-sm text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                              {settlement.payer_name?.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{settlement.payer_name}</div>
                              <div className="text-[10px] text-[var(--color-text-muted)]">{settlement.payer_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Arrow */}
                        <td className="p-4 text-center">
                          <div className="inline-flex p-1.5 bg-[var(--color-accent)]/5 rounded-full border border-[var(--color-accent)]/10 text-[var(--color-accent)]">
                            <ArrowRight size={14} />
                          </div>
                        </td>

                        {/* Payee */}
                        <td className="p-4 text-sm text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                              {settlement.payee_name?.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{settlement.payee_name}</div>
                              <div className="text-[10px] text-[var(--color-text-muted)]">{settlement.payee_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="p-4 pr-6 text-sm font-bold text-emerald-400 text-right font-mono">
                          ₹ {Number(settlement.amount_inr).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
