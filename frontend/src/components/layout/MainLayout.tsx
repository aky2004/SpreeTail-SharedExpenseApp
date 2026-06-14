import React from 'react';
import Sidebar from './Sidebar';
import { useGroup } from '../../context/GroupContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isLoadingGroups } = useGroup();

  if (isLoadingGroups) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--color-bg-darkest)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
          <p className="text-xs text-[var(--color-text-muted)] font-medium font-inter tracking-wider">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex text-[var(--color-text-primary)]"
         style={{ background: 'var(--color-bg-darkest)' }}>
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto flex flex-col relative">
        {children}
      </main>
    </div>
  );
}
