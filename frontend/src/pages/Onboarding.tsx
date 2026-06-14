import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plus, LogIn, Wallet, Users } from 'lucide-react';
import api from '../../api/client';

/**
 * Onboarding page shown after registration.
 * User can either create a new group or join an existing one.
 */
export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.post('/groups', { name: groupName });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.post('/groups/join', { invite_code: inviteCode, joined_at: joinDate });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join group');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #12121F 0%, #1A1A2E 50%, #12121F 100%)' }}>
      <div className="glass-card p-8 w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <Wallet className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
          <h1 className="text-2xl font-bold">
            Welcome, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
        </div>
        <p className="text-center mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          Get started by creating or joining a group
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-lg text-sm font-medium"
               style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('create')}
              className="glass-card p-6 flex flex-col items-center gap-3 cursor-pointer transition-all hover:border-[var(--color-accent)]"
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                   style={{ background: 'var(--color-accent-dim)' }}>
                <Plus className="w-7 h-7" style={{ color: 'var(--color-accent)' }} />
              </div>
              <span className="font-semibold">Create Group</span>
              <span className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
                Start a new expense group
              </span>
            </button>

            <button
              onClick={() => setMode('join')}
              className="glass-card p-6 flex flex-col items-center gap-3 cursor-pointer transition-all hover:border-[var(--color-accent)]"
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                   style={{ background: 'var(--color-accent-dim)' }}>
                <Users className="w-7 h-7" style={{ color: 'var(--color-accent)' }} />
              </div>
              <span className="font-semibold">Join Group</span>
              <span className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
                Use a 6-digit invite code
              </span>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateGroup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2"
                     style={{ color: 'var(--color-text-secondary)' }}>
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Flat 4B"
                required
                className="input-field"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMode('choose')} className="btn-secondary flex-1">
                Back
              </button>
              <button type="submit" disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={18} />
                    Create
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoinGroup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2"
                     style={{ color: 'var(--color-text-secondary)' }}>
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                required
                maxLength={6}
                className="input-field text-center tracking-[0.3em] text-lg font-mono"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2"
                     style={{ color: 'var(--color-text-secondary)' }}>
                When did you join?
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                required
                className="input-field"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMode('choose')} className="btn-secondary flex-1">
                Back
              </button>
              <button type="submit" disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} />
                    Join
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {mode === 'choose' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 w-full text-center text-sm hover:underline"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Skip for now →
          </button>
        )}
      </div>
    </div>
  );
}
