import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Receipt,
  Users,
  AlertOctagon,
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  HandCoins,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,10,26,0.96)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: '10px',
      padding: '9px 14px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.08) inset',
    }}>
      <div style={{ color: '#475569', fontSize: '9.5px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div style={{ color: 'white', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
        ₹{Number(payload[0]?.value ?? 0).toLocaleString('en-IN')}
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, accentColor, delay = '0ms' }: any) => (
  <div
    className="animate-fade-in"
    style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: '14px', padding: '22px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      background: 'rgba(13,13,28,0.9)',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset`,
      animationDelay: delay,
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transform = 'translateY(-3px) scale(1.01)';
      el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.5), 0 0 40px ${accentColor}25, 0 0 0 1px ${accentColor}30 inset`;
      el.style.borderColor = `${accentColor}40`;
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLDivElement;
      el.style.transform = 'translateY(0) scale(1)';
      el.style.boxShadow = '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset';
      el.style.borderColor = 'rgba(255,255,255,0.07)';
    }}
  >
    {/* Top accent line */}
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px',
        background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}60 60%, transparent 100%)`,
        borderRadius: '14px 14px 0 0',
      }}
    />

    {/* Ambient glow blob */}
    <div style={{
      position: 'absolute', top: '-30px', right: '-20px',
      width: '100px', height: '100px',
      background: `radial-gradient(circle, ${accentColor}14 0%, transparent 70%)`,
      pointerEvents: 'none',
    }} />

    {/* Header row */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d4a5c' }}>
        {label}
      </span>
      <div
        style={{
          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
          background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}0d)`,
          border: `1px solid ${accentColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${accentColor}15`,
        }}
      >
        <Icon size={14} style={{ color: accentColor }} />
      </div>
    </div>

    {/* Value */}
    <div style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '1.55rem',
      fontWeight: 600,
      letterSpacing: '-0.03em',
      lineHeight: 1,
      color: 'white',
    }}>
      {value}
    </div>

    {/* Subtitle */}
    {sub && (
      <div style={{ fontSize: '11px', color: '#3d4a5c', lineHeight: 1.4 }}>
        {sub}
      </div>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { currentGroup } = useGroup();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [netBalances, setNetBalances] = useState<any[]>([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState<any[]>([]);
  const [importLogs, setImportLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const [expR, balR, logR] = await Promise.all([
        api.get(`/expenses/group/${currentGroup.id}?limit=100`),
        api.get(`/balances/group/${currentGroup.id}`),
        api.get(`/import/group/${currentGroup.id}/logs`),
      ]);
      setExpenses(expR.data.expenses || []);
      setNetBalances(balR.data.netBalances || []);
      setSimplifiedDebts(balR.data.simplifiedDebts || []);
      setImportLogs(logR.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup]);

  useEffect(() => { fetchData(); }, [currentGroup, fetchData]);

  if (!currentGroup) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🏠</div>
            <p style={{ color: '#64748b', fontSize: '14px' }}>No active group selected.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ─── Calculations ─────────────────────────────────────────────────────────
  const totalGroupSpending = expenses.reduce((s, e) => s + Number(e.amount_inr), 0);
  const myStanding = netBalances.find(b => b.userId === user?.id);
  const myStandingAmount = myStanding ? myStanding.amount : 0;
  const memberCount = netBalances.length;
  const pendingReviews = importLogs.filter(l => l.status === 'previewing').length;

  const getCategory = (desc: string) => {
    const d = desc.toLowerCase();
    if (d.includes('rent')) return 'Rent';
    if (['grocery', 'dmart', 'pizza', 'dinner', 'lunch', 'food', 'swiggy', 'cake'].some(k => d.includes(k))) return 'Food';
    if (['wifi', 'electricity', 'cylinder', 'bill'].some(k => d.includes(k))) return 'Utilities';
    if (['maid', 'cleaning', 'salary'].some(k => d.includes(k))) return 'Services';
    if (['flight', 'villa', 'scooter', 'cab', 'parasailing', 'trip', 'airport'].some(k => d.includes(k))) return 'Travel';
    return 'Other';
  };

  const catTotals: Record<string, number> = {};
  expenses.forEach(e => {
    const cat = getCategory(e.description);
    catTotals[cat] = (catTotals[cat] || 0) + Number(e.amount_inr);
  });
  const chartCatData = Object.entries(catTotals)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const memberSpending: Record<string, number> = {};
  expenses.forEach(e => {
    const payer = e.paid_by_name || `User ${e.paid_by_user_id}`;
    memberSpending[payer] = (memberSpending[payer] || 0) + Number(e.amount_inr);
  });
  const chartMemberData = Object.entries(memberSpending)
    .map(([name, value]) => ({ name: name.split(' ')[0], value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const barColors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#3b82f6'];

  const catColors: Record<string, string> = {
    Rent: '#6366f1', Food: '#10b981', Utilities: '#f59e0b',
    Services: '#8b5cf6', Travel: '#3b82f6', Other: '#475569',
  };

  const splitBadgeColor: Record<string, string> = {
    equal: 'badge-indigo', percentage: 'badge-violet', exact: 'badge-blue', shares: 'badge-amber',
  };

  return (
    <MainLayout>
      {/* ── Page wrapper with generous, consistent padding ── */}
      <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* ── Page Header ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px' }}>
          <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d3748' }}>
                Dashboard
              </span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#1e293b', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4f46e5' }}>
                {currentGroup.name}
              </span>
            </div>
            <h1 style={{
              fontSize: '26px', fontWeight: 700, color: 'white',
              letterSpacing: '-0.04em', lineHeight: 1.1, margin: 0,
            }}>
              Overview
            </h1>
            <p style={{ fontSize: '13px', color: '#3d4a5c', marginTop: '6px', lineHeight: 1.5 }}>
              Track spending, balances and debts for your group.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => navigate('/expenses')} className="btn-ghost" style={{ fontSize: '12.5px', padding: '8px 16px' }}>
              <Receipt size={13} />
              View Bills
            </button>
            <button onClick={() => navigate('/balances')} className="btn-primary" style={{ fontSize: '12.5px', padding: '8px 16px' }}>
              <Scale size={13} />
              Settle Up
            </button>
          </div>
        </div>

        {/* ── Error banner ────────────────────────────────── */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px', borderRadius: '14px', marginBottom: '24px',
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e',
            fontSize: '13px',
          }}>
            <AlertOctagon size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* ── Stat Cards — 4 columns ───────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '16px' }} />
            ))
          ) : (
            <>
              <StatCard
                label="Your Standing"
                value={`${myStandingAmount >= 0 ? '+' : ''}₹${Math.abs(myStandingAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                sub={myStandingAmount >= 0 ? 'You are owed money' : 'You owe money'}
                icon={myStandingAmount >= 0 ? TrendingUp : TrendingDown}
                accentColor={myStandingAmount >= 0 ? '#10b981' : '#f43f5e'}
                iconBg={myStandingAmount >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)'}
                delay="0ms"
              />
              <StatCard
                label="Group Spending"
                value={`₹${(totalGroupSpending / 1000).toFixed(1)}k`}
                sub={`${expenses.length} transactions total`}
                icon={Receipt}
                accentColor="#6366f1"
                iconBg="rgba(99,102,241,0.12)"
                delay="60ms"
              />
              <StatCard
                label="Active Members"
                value={memberCount}
                sub="in this workspace"
                icon={Users}
                accentColor="#8b5cf6"
                iconBg="rgba(139,92,246,0.12)"
                delay="120ms"
              />
              <StatCard
                label="Pending Reviews"
                value={pendingReviews}
                sub={pendingReviews > 0 ? 'Imports need attention' : 'All clear'}
                icon={AlertOctagon}
                accentColor={pendingReviews > 0 ? '#f59e0b' : '#334155'}
                iconBg={pendingReviews > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)'}
                delay="180ms"
              />
            </>
          )}
        </div>

        {/* ── Charts Row — 3 columns ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          {/* Chart: By Category */}
          <div
            className="animate-fade-in hover-lift"
            style={{
              padding: '24px', display: 'flex', flexDirection: 'column', height: '320px',
              background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #6366f1 0%, #6366f160 40%, transparent 100%)' }} />
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d4a5c', marginBottom: '20px' }}>
              Spending by Category
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {isLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1' }} />
                </div>
              ) : chartCatData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Sparkles size={20} style={{ color: '#1e293b' }} />
                  <p style={{ fontSize: '11px', color: '#334155' }}>No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCatData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke="#334155" fontSize={9} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={58} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={12}>
                      {chartCatData.map((entry, i) => (
                        <Cell key={i} fill={catColors[entry.name] || barColors[i % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart: By Member */}
          <div
            className="animate-fade-in hover-lift"
            style={{
              padding: '24px', display: 'flex', flexDirection: 'column', height: '320px',
              background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #8b5cf6 0%, #8b5cf660 40%, transparent 100%)' }} />
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d4a5c', marginBottom: '20px' }}>
              Paid by Member
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {isLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1' }} />
                </div>
              ) : chartMemberData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Sparkles size={20} style={{ color: '#1e293b' }} />
                  <p style={{ fontSize: '11px', color: '#334155' }}>No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMemberData} margin={{ left: -16, right: 4, top: 8, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#334155" fontSize={9} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={30}>
                      {chartMemberData.map((_, i) => (
                        <Cell key={i} fill={barColors[i % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div
            className="animate-fade-in hover-lift"
            style={{
              padding: '24px', display: 'flex', flexDirection: 'column', height: '320px',
              background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #10b981 0%, #10b98160 40%, transparent 100%)' }} />
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d4a5c', marginBottom: '20px' }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
              {[
                { label: 'Log Shared Bill', sub: 'Supports 4 split modes', icon: PlusCircle, color: '#818cf8', bg: 'linear-gradient(135deg, rgba(129,140,248,0.2), rgba(129,140,248,0.05))', path: '/expenses' },
                { label: 'Record Settlement', sub: 'Mark a debt as paid', icon: HandCoins, color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))', path: '/balances' },
                { label: 'Import CSV Ledger', sub: 'Anomaly review & auto-fix', icon: FileSpreadsheet, color: '#3b82f6', bg: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))', path: '/import' },
              ].map(({ label, sub, icon: Icon, color, bg, path }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 14px', borderRadius: '12px',
                    border: '1px solid transparent',
                    background: 'transparent', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', width: '100%',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '10px', background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    border: `1px solid ${color}30`, boxShadow: `0 2px 8px ${color}15`,
                  }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', lineHeight: 1.3 }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: 1.3 }}>{sub}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: '#334155', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Lower: Recent Bills + Outstanding Debts ────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '32px' }}>

          {/* Recent Bills */}
          <div className="animate-fade-in hover-lift" style={{
            padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '340px',
            background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #3b82f6 0%, #3b82f660 40%, transparent 100%)' }} />
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d4a5c' }}>
                Recent Bills
              </span>
              <button
                onClick={() => navigate('/expenses')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '3px',
                  fontSize: '11px', fontWeight: 600, color: '#6366f1',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6366f1')}
              >
                View All <ChevronRight size={12} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '10px', animationDelay: `${i * 80}ms` }} />
                ))
              ) : expenses.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0' }}>
                  <Receipt size={28} style={{ color: '#1e293b' }} />
                  <p style={{ fontSize: '12px', color: '#334155' }}>No expenses yet</p>
                </div>
              ) : (
                expenses.slice(0, 7).map((expense) => {
                  const cat = getCategory(expense.description);
                  const dotColor = catColors[cat] || '#475569';
                  return (
                    <div
                      key={expense.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', borderRadius: '10px',
                        border: '1px solid transparent', position: 'relative',
                        cursor: 'default', transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      {/* Category dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: dotColor, boxShadow: `0 0 8px ${dotColor}80`,
                      }} />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>
                          {expense.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', lineHeight: 1 }}>
                          {expense.paid_by_name} · {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                        </div>
                      </div>

                      {/* Amount + badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'white', fontFamily: "'JetBrains Mono', monospace" }}>
                          ₹{Number(expense.amount_inr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </div>
                        <span className={`badge ${splitBadgeColor[expense.split_type] || 'badge-muted'}`} style={{ fontSize: '8.5px', padding: '1px 6px' }}>
                          {expense.split_type}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Outstanding Debts */}
          <div className="animate-fade-in hover-lift" style={{
            padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '340px',
            background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
            animationDelay: '100ms',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #f43f5e 0%, #f43f5e60 40%, transparent 100%)' }} />
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3d4a5c' }}>
                Outstanding Debts
              </span>
              <button
                onClick={() => navigate('/balances')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '3px',
                  fontSize: '11px', fontWeight: 600, color: '#6366f1',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#818cf8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6366f1')}
              >
                Settle Up <ChevronRight size={12} />
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '10px', animationDelay: `${i * 80}ms` }} />
                ))
              ) : simplifiedDebts.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', lineHeight: 1 }}>🎉</div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>All settled up!</p>
                  <p style={{ fontSize: '11px', color: '#334155' }}>No outstanding debts in this group.</p>
                </div>
              ) : (
                simplifiedDebts.slice(0, 7).map((debt, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid transparent', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    {/* From avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '9px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.05))', color: '#f43f5e',
                      border: '1px solid rgba(244,63,94,0.25)',
                      fontFamily: 'system-ui', boxShadow: '0 2px 8px rgba(244,63,94,0.15)',
                    }}>
                      {debt.fromName?.substring(0, 2)?.toUpperCase()}
                    </div>

                    {/* Names */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                          {debt.fromName}
                        </span>
                        <ArrowRight size={11} style={{ color: '#475569', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                          {debt.toName}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>owes</div>
                    </div>

                    {/* Amount */}
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f43f5e', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                      ₹{Number(debt.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </MainLayout>
  );
}
