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
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#070711' }}
      >
        {/* Dot grid bg */}
        <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />

        <div className="flex flex-col items-center gap-4 relative z-10">
          {/* Logo mark */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base text-white"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
              fontFamily: "'Geist', sans-serif",
            }}
          >
            ST
          </div>
          {/* Spinner */}
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor: 'rgba(99,102,241,0.2)',
              borderTopColor: '#6366f1',
            }}
          />
          <p
            className="text-[11px] tracking-widest uppercase font-medium"
            style={{ color: '#334155' }}
          >
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', background: '#070711' }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Dot grid overlay */}
        <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />

        {/* Radial glow — top right */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-160px',
            right: '-80px',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
          }}
        />

        {/* Thin top accent line — the "margin" the user wants */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, rgba(99,102,241,0.6) 0%, rgba(139,92,246,0.3) 40%, transparent 100%)',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10,
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
