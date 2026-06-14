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
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard',     path: '/dashboard',    icon: LayoutDashboard },
  { name: 'Expenses',      path: '/expenses',      icon: Receipt },
  { name: 'Balances',      path: '/balances',      icon: Scale },
  { name: 'Settlements',   path: '/settlements',   icon: HandCoins },
  { name: 'CSV Import',    path: '/import',        icon: FileSpreadsheet },
  { name: 'Group Members', path: '/group-members', icon: Users },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { groups, currentGroup, setCurrentGroup } = useGroup();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleGroupSelect = (group: any) => {
    setCurrentGroup(group);
    setIsDropdownOpen(false);
  };

  const initials = (str: string) => str?.substring(0, 2)?.toUpperCase() ?? '??';

  return (
    <aside
      style={{
        width: '228px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0a0a1a 0%, #07071200 100%), #080816',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* ── Logo / Brand ─────────────────────────────────── */}
      <div style={{ padding: '22px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Geist', sans-serif", fontWeight: 700,
            fontSize: '12px', color: 'white', letterSpacing: '-0.02em', flexShrink: 0,
          }}>
            ST
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Spree<span style={{ color: '#818cf8' }}>Tail</span>
            </div>
            <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2d3748', marginTop: '3px' }}>
              Shared Finance
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────── */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)', margin: '0 16px' }} />

      {/* ── Workspace / Group Switcher ───────────────────── */}
      <div style={{ padding: '16px 12px 8px', position: 'relative' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d3748', paddingLeft: '8px', marginBottom: '8px' }}>
          Workspace
        </div>

        {currentGroup ? (
          <>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                background: isDropdownOpen ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isDropdownOpen ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{
                width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, color: '#a5b4fc',
              }}>
                {initials(currentGroup.name)}
              </div>
              <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                  {currentGroup.name}
                </div>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#475569', marginTop: '2px' }}>
                  #{currentGroup.invite_code}
                </div>
              </div>
              <ChevronDown
                size={13}
                style={{ color: '#475569', flexShrink: 0, transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}
              />
            </button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% - 4px)', left: '12px', right: '12px', zIndex: 50,
                  background: '#0d0d20', border: '1px solid rgba(99,102,241,0.18)',
                  borderRadius: '12px', overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                  animation: 'scaleIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div style={{ padding: '6px' }}>
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => handleGroupSelect(group)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                        background: currentGroup?.id === group.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                        border: 'none', textAlign: 'left', transition: 'background 0.12s ease',
                        borderLeft: currentGroup?.id === group.id ? '2px solid #6366f1' : '2px solid transparent',
                      }}
                      onMouseEnter={e => { if (currentGroup?.id !== group.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (currentGroup?.id !== group.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, background: 'rgba(99,102,241,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 700, color: '#818cf8' }}>
                        {initials(group.name)}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#475569' }}>#{group.invite_code}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 6px' }} />
                <div style={{ padding: '6px' }}>
                  <button
                    onClick={() => { setIsDropdownOpen(false); navigate('/onboarding'); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 500, color: '#6366f1', background: 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Plus size={12} />
                    New Group
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => navigate('/onboarding')}
            className="btn-primary"
            style={{ width: '100%', fontSize: '12px', padding: '9px 14px' }}
          >
            <Plus size={13} />
            Create / Join Group
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d3748', paddingLeft: '8px', marginBottom: '6px', marginTop: '4px' }}>
          Navigation
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={15}
                    style={{ color: isActive ? '#818cf8' : '#3d4a5c', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '13px' }}>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── User Profile ─────────────────────────────────── */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            padding: '9px 10px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '6px',
          }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.35))',
              border: '1.5px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: '#a5b4fc',
            }}>
              {initials(user.name)}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                {user.name}
              </div>
              <div style={{ fontSize: '9.5px', color: '#3d4a5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                {user.email}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '9px', border: 'none', cursor: 'pointer',
            fontSize: '12px', fontWeight: 500, color: '#3d4a5c', background: 'transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; e.currentTarget.style.color = '#f43f5e'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3d4a5c'; }}
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
