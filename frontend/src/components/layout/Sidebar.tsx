import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGroup } from '../../context/GroupContext';
import {
  LayoutDashboard,
  Receipt,
  Scale,
  HandCoins,
  FileSpreadsheet,
  LogOut,
  ChevronDown,
  Plus,
  Users,
  Wallet
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { groups, currentGroup, setCurrentGroup } = useGroup();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleGroupSelect = (group: any) => {
    setCurrentGroup(group);
    setIsDropdownOpen(false);
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    { name: 'Balances', path: '/balances', icon: Scale },
    { name: 'Settlements', path: '/settlements', icon: HandCoins },
    { name: 'CSV Import', path: '/import', icon: FileSpreadsheet },
    { name: 'Group Members', path: '/group-members', icon: Users },
  ];

  return (
    <aside className="w-65 h-screen bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-card)] flex flex-col justify-between select-none shrink-0 font-inter">
      {/* Top Section */}
      <div className="flex flex-col overflow-y-auto grow">
        {/* Branding & Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-[var(--color-border-card)]">
          <div className="p-2 bg-[var(--color-accent)]/10 rounded-lg text-[var(--color-accent)] shadow-[0_0_15px_rgba(0,180,166,0.15)] animate-pulse-subtle">
            <Wallet size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              EXP<span className="text-[var(--color-accent)]">ensio</span>
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] tracking-widest uppercase">
              Shared Expense App
            </p>
          </div>
        </div>

        {/* Group Switcher */}
        <div className="p-4 border-b border-[var(--color-border-card)] relative">
          <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block mb-1.5 px-2">
            Active Group
          </label>
          {currentGroup ? (
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] border border-[var(--color-border-card)] rounded-xl text-left cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center font-bold font-mono text-sm shrink-0 uppercase">
                  {currentGroup.name.substring(0, 2)}
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-semibold text-white truncate leading-tight">
                    {currentGroup.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    Code: {currentGroup.invite_code}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/onboarding')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.2)]"
            >
              <Plus size={16} />
              <span>Create / Join Group</span>
            </button>
          )}

          {/* Group Switcher Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-[calc(100%-4px)] left-4 right-4 z-50 bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] py-2 mt-1 max-h-60 overflow-y-auto animate-fade-in">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleGroupSelect(group)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--color-bg-card-hover)] transition-colors duration-150 cursor-pointer ${
                    currentGroup?.id === group.id ? 'bg-[var(--color-accent)]/5 border-l-3 border-[var(--color-accent)]' : 'border-l-3 border-transparent'
                  }`}
                >
                  <div className="w-7 h-7 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {group.name.substring(0, 2)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-white truncate">
                      {group.name}
                    </div>
                    <div className="text-[9px] text-[var(--color-text-muted)]">
                      Code: {group.invite_code}
                    </div>
                  </div>
                </button>
              ))}
              <div className="border-t border-[var(--color-border-card)] mt-2 pt-2 px-2">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/onboarding');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-white hover:bg-[var(--color-accent)]/10 rounded-lg transition-all duration-200 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>New Group Flow</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-[inset_0_0_8px_rgba(0,180,166,0.05)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-card-hover)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? 'text-[var(--color-accent)]' : ''} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom User Profile + Logout */}
      <div className="p-4 border-t border-[var(--color-border-card)]">
        {user && (
          <div className="flex items-center justify-between gap-2.5 mb-3 px-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center font-bold text-sm shrink-0 border border-[var(--color-accent)]/20 uppercase shadow-[0_0_10px_rgba(0,180,166,0.1)]">
                {user.name.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-white truncate leading-tight">
                  {user.name}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                  {user.email}
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[var(--color-border-card)] hover:border-red-500/30 hover:bg-red-500/5 text-[var(--color-text-muted)] hover:text-red-400 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
