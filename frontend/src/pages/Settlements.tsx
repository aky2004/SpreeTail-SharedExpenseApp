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
      <div className="animate-fade-in flex-1 flex flex-col min-h-0" style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="section-label">Settlements</span>
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#334155' }} />
              <span className="section-label" style={{ color: '#6366f1' }}>{currentGroup.name}</span>
            </div>
            <h1 className="page-title">Payment History</h1>
            <p className="text-[13px] mt-1" style={{ color: '#475569' }}>
              Historical ledger of recorded direct debt settlements.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-[13px]"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* List of settlements */}
        <div className="animate-fade-in hover-lift" style={{
          background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
          display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #10b981 0%, #10b98160 40%, transparent 100%)', zIndex: 20 }} />
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
              </div>
            ) : settlements.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
                >
                  <HandCoins size={24} style={{ color: '#6366f1' }} />
                </div>
                <h3 className="text-[15px] font-semibold text-white">No payments recorded</h3>
                <p className="text-[12px] max-w-sm" style={{ color: '#475569' }}>
                  Record payments from the Balances screen to settle up.
                </p>
              </div>
            ) : (
              <table className="data-table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="pl-6">Date</th>
                    <th>Sender (Payer)</th>
                    <th className="text-center">Transfer</th>
                    <th>Recipient (Payee)</th>
                    <th className="text-right pr-6">Amount Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((settlement) => {
                    const dateStr = new Date(settlement.settled_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
                    });
                    return (
                      <tr key={settlement.id} className="group transition-colors">
                        {/* Date */}
                        <td className="pl-6">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} style={{ color: '#475569' }} />
                            <span style={{ color: '#64748b', fontSize: '12px' }}>{dateStr}</span>
                          </div>
                        </td>

                        {/* Payer */}
                        <td>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
                            >
                              {settlement.payer_name?.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-[13px]">{settlement.payer_name}</div>
                              <div className="text-[10px]" style={{ color: '#475569' }}>{settlement.payer_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Arrow */}
                        <td className="text-center">
                          <div
                            className="inline-flex p-1.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}
                          >
                            <ArrowRight size={13} />
                          </div>
                        </td>

                        {/* Payee */}
                        <td>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                              style={{
                                background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
                                border: '1px solid rgba(16,185,129,0.25)',
                                boxShadow: '0 2px 8px rgba(16,185,129,0.15)',
                                color: '#10b981',
                              }}
                            >
                              {settlement.payee_name?.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-[13px]">{settlement.payee_name}</div>
                              <div className="text-[10px]" style={{ color: '#475569' }}>{settlement.payee_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="pr-6 text-right">
                          <span className="mono text-[14px] font-semibold" style={{ color: '#10b981' }}>
                            ₹{Number(settlement.amount_inr).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
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
