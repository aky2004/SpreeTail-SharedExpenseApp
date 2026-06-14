import { Wallet } from 'lucide-react';

/**
 * Dashboard page — placeholder until Phase 6.
 * Will show summary cards, who-owes-whom, recent expenses, and charts.
 */
export default function Dashboard() {
  return (
    <div className="p-8 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="glass-card p-12 flex flex-col items-center justify-center gap-4">
        <Wallet className="w-16 h-16" style={{ color: 'var(--color-accent)' }} />
        <h2 className="text-xl font-semibold">Welcome to EXPensio</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Dashboard with charts and summaries coming in Phase 6.
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Use the sidebar to navigate to Groups, Expenses, and Import.
        </p>
      </div>
    </div>
  );
}
