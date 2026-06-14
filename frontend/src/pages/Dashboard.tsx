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
  ArrowUpRight,
  PlusCircle,
  FileSpreadsheet,
  HandCoins,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function Dashboard() {
  const { currentGroup } = useGroup();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
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

      // Fetch expenses
      const expensesRes = await api.get(`/expenses/group/${currentGroup.id}?limit=100`);
      setExpenses(expensesRes.data.expenses || []);

      // Fetch balances
      const balancesRes = await api.get(`/balances/group/${currentGroup.id}`);
      setNetBalances(balancesRes.data.netBalances || []);
      setSimplifiedDebts(balancesRes.data.simplifiedDebts || []);

      // Fetch import logs
      const logsRes = await api.get(`/import/group/${currentGroup.id}/logs`);
      setImportLogs(logsRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup]);

  useEffect(() => {
    fetchData();
  }, [currentGroup, fetchData]);

  if (!currentGroup) {
    return (
      <MainLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <p className="text-[var(--color-text-muted)]">No active group selected.</p>
        </div>
      </MainLayout>
    );
  }

  // --- Calculations ---

  // 1. Total Group Spending (INR)
  const totalGroupSpending = expenses.reduce((sum, e) => sum + Number(e.amount_inr), 0);

  // 2. Logged-in User's standing
  const myStanding = netBalances.find(b => b.userId === user?.id);
  const myStandingAmount = myStanding ? myStanding.amount : 0;

  // 3. Active members count
  const memberCount = netBalances.length;

  // 4. Pending duplicate/import reviews
  const pendingReviews = importLogs.filter(l => l.status === 'previewing').length;

  // 5. Category Analysis
  const getCategory = (desc: string): string => {
    const d = desc.toLowerCase();
    if (d.includes('rent')) return 'Rent';
    if (
      d.includes('grocery') || d.includes('groceries') || d.includes('basket') ||
      d.includes('dmart') || d.includes('pizza') || d.includes('dinner') ||
      d.includes('lunch') || d.includes('brunch') || d.includes('swiggy') ||
      d.includes('bites') || d.includes('food') || d.includes('cake')
    ) return 'Food';
    if (d.includes('wifi') || d.includes('electricity') || d.includes('cylinder') || d.includes('bill')) return 'Utilities';
    if (d.includes('maid') || d.includes('cleaning') || d.includes('salary')) return 'Services';
    if (
      d.includes('flight') || d.includes('villa') || d.includes('scooter') ||
      d.includes('cab') || d.includes('parasailing') || d.includes('trip') ||
      d.includes('airport') || d.includes('farewell')
    ) return 'Travel';
    return 'Other';
  };

  const categoryTotals: Record<string, number> = {};
  expenses.forEach(e => {
    const cat = getCategory(e.description);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount_inr);
  });

  const chartCategoryData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Math.round(value)
  })).sort((a, b) => b.value - a.value);

  // 6. Member Spending Analysis
  const memberSpendingTotals: Record<string, number> = {};
  expenses.forEach(e => {
    const payer = e.paid_by_name || `User ${e.paid_by_user_id}`;
    memberSpendingTotals[payer] = (memberSpendingTotals[payer] || 0) + Number(e.amount_inr);
  });

  const chartMemberData = Object.entries(memberSpendingTotals).map(([name, value]) => ({
    name: name.split(' ')[0], // short name
    value: Math.round(value)
  })).sort((a, b) => b.value - a.value);

  const colors = ['#00B4A6', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];

  return (
    <MainLayout>
      <div className="p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0 overflow-y-auto animate-fade-in font-inter">
        
        {/* Header HUD */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Workspace Dashboard</span>
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-semibold mt-1">
              Active Group: <span className="text-[var(--color-accent)]">{currentGroup.name}</span> (Invite Code: {currentGroup.invite_code})
            </p>
          </div>
          <div className="hidden md:flex gap-3">
            <button
              onClick={() => navigate('/expenses')}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border-card)] hover:bg-[var(--color-bg-card-hover)] text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Receipt size={14} />
              <span>View Bills</span>
            </button>
            <button
              onClick={() => navigate('/balances')}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border-card)] hover:bg-[var(--color-bg-card-hover)] text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Scale size={14} />
              <span>Debts</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-sm shrink-0">
            ⚠️ {error}
          </div>
        )}

        {/* Stats Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 shrink-0">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 shrink-0">
            {/* Card 1: User's Net Standing */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3 text-[var(--color-text-muted)]">
                <span className="text-xs font-semibold uppercase tracking-wider">Your Standing</span>
                <div className={`p-1.5 rounded-lg border ${myStandingAmount >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  {myStandingAmount >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
              </div>
              <h3 className={`text-2xl font-bold font-mono ${myStandingAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {myStandingAmount >= 0 ? '+' : ''}₹{myStandingAmount.toFixed(2)}
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {myStandingAmount >= 0 ? 'You are owed in this group' : 'You owe cash to others'}
              </p>
            </div>

            {/* Card 2: Total Group Expenses */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3 text-[var(--color-text-muted)]">
                <span className="text-xs font-semibold uppercase tracking-wider">Group Spending</span>
                <div className="p-1.5 rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-400">
                  <Receipt size={16} />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white font-mono">
                ₹{totalGroupSpending.toFixed(2)}
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Sum of {expenses.length} logged group bills
              </p>
            </div>

            {/* Card 3: Group Members */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3 text-[var(--color-text-muted)]">
                <span className="text-xs font-semibold uppercase tracking-wider">Members registered</span>
                <div className="p-1.5 rounded-lg border bg-purple-500/10 border-purple-500/20 text-purple-400">
                  <Users size={16} />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white font-mono">
                {memberCount}
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Participating in billing calculations
              </p>
            </div>

            {/* Card 4: Pending Import Reviews */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3 text-[var(--color-text-muted)]">
                <span className="text-xs font-semibold uppercase tracking-wider">Duplicate Reviews</span>
                <div className={`p-1.5 rounded-lg border ${pendingReviews > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                  <AlertOctagon size={16} />
                </div>
              </div>
              <h3 className={`text-2xl font-bold font-mono ${pendingReviews > 0 ? 'text-amber-400' : 'text-white'}`}>
                {pendingReviews}
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {pendingReviews > 0 ? 'Import runs awaiting review' : 'No import conflicts pending'}
              </p>
            </div>
          </div>
        )}

        {/* Charts & Actions Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 shrink-0">
          
          {/* Chart 1: Spending by Category */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg flex flex-col h-72">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Bills by Category</h4>
            <div className="flex-1 min-h-0">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : chartCategoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCategoryData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-bg-sidebar)', border: '1px solid var(--color-border-card)', borderRadius: '10px' }}
                      labelStyle={{ color: 'white', fontWeight: 'bold', fontSize: '11px' }}
                      itemStyle={{ color: 'var(--color-accent)', fontSize: '11px' }}
                      formatter={(value) => [`₹${value}`, 'Spending']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartCategoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Spending by Member */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg flex flex-col h-72">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Bills Paid by Member</h4>
            <div className="flex-1 min-h-0">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : chartMemberData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartMemberData} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={9} tickLine={false} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={9} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-bg-sidebar)', border: '1px solid var(--color-border-card)', borderRadius: '10px' }}
                      labelStyle={{ color: 'white', fontWeight: 'bold', fontSize: '11px' }}
                      itemStyle={{ color: 'var(--color-accent)', fontSize: '11px' }}
                      formatter={(value) => [`₹${value}`, 'Paid']}
                    />
                    <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg flex flex-col justify-between h-72">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 shrink-0">Quick Workspace Actions</h4>
            <div className="space-y-2.5 grow overflow-y-auto flex flex-col justify-center">
              <button
                onClick={() => navigate('/expenses')}
                className="w-full flex items-center justify-between p-3.5 bg-zinc-900/10 hover:bg-zinc-800/20 border border-[var(--color-border-card)]/40 hover:border-[var(--color-accent)]/30 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-lg">
                    <PlusCircle size={16} />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-semibold text-white block">Log Shared Bill</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">Supports all 4 split rules</span>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => navigate('/balances')}
                className="w-full flex items-center justify-between p-3.5 bg-zinc-900/10 hover:bg-zinc-800/20 border border-[var(--color-border-card)]/40 hover:border-[var(--color-accent)]/30 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <HandCoins size={16} />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-semibold text-white block">Record Settlement</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">Settle group flatmate debts</span>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => navigate('/import')}
                className="w-full flex items-center justify-between p-3.5 bg-zinc-900/10 hover:bg-zinc-800/20 border border-[var(--color-border-card)]/40 hover:border-[var(--color-accent)]/30 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-semibold text-white block">Import CSV Ledger</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">Anomaly review & auto-fixing</span>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Lower Lists: Recent Expenses vs Simplified Debts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 shrink-0">
          
          {/* Panel 1: Recent Expenses */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Recent Bills</h4>
              <button
                onClick={() => navigate('/expenses')}
                className="text-[11px] text-[var(--color-accent)] hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : expenses.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-12">No expenses recorded yet.</p>
              ) : (
                expenses.slice(0, 5).map((expense) => (
                  <div
                    key={expense.id}
                    className="p-3 bg-zinc-900/10 border border-[var(--color-border-card)]/30 rounded-xl flex items-center justify-between gap-4 text-xs hover:bg-zinc-800/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-white block truncate max-w-[200px]">{expense.description}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] block mt-0.5">
                        Paid by {expense.paid_by_name} on {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-white font-mono block">₹{Number(expense.amount_inr).toFixed(2)}</span>
                      <span className="text-[9px] text-[var(--color-text-muted)] bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 capitalize inline-block mt-1">
                        {expense.split_type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Panel 2: Simplified Debts standing */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 shadow-lg flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Outstanding Debts</h4>
              <button
                onClick={() => navigate('/balances')}
                className="text-[11px] text-[var(--color-accent)] hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
              >
                <span>Settle Debts</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
                </div>
              ) : simplifiedDebts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-[var(--color-text-muted)]">
                  <span>🎉</span>
                  <p className="mt-1 font-medium">Group is completely settled up!</p>
                </div>
              ) : (
                simplifiedDebts.slice(0, 5).map((debt, index) => (
                  <div
                    key={index}
                    className="p-3 bg-zinc-900/10 border border-[var(--color-border-card)]/30 rounded-xl flex items-center justify-between gap-4 text-xs hover:bg-zinc-800/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-white truncate max-w-[120px]">{debt.fromName}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">pays</span>
                      <span className="font-semibold text-white truncate max-w-[120px]">{debt.toName}</span>
                    </div>
                    <div className="font-bold text-[var(--color-accent)] font-mono shrink-0">
                      ₹{Number(debt.amount).toFixed(2)}
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
