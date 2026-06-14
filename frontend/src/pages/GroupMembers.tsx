import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useGroup } from '../context/GroupContext';
import api from '../api/client';
import { UserPlus, LogOut, Calendar, Mail } from 'lucide-react';

export default function GroupMembers() {
  const { currentGroup } = useGroup();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addJoinDate, setAddJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const [departingMember, setDepartingMember] = useState<any | null>(null);
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingDepart, setIsSubmittingDepart] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!currentGroup) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get(`/groups/${currentGroup.id}`);
      setMembers(res.data.members || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup]);

  useEffect(() => {
    fetchMembers();
  }, [currentGroup, fetchMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    try {
      setIsSubmittingAdd(true);
      setError(null);
      await api.post(`/groups/${currentGroup.id}/members`, {
        email: addEmail,
        joined_at: addJoinDate
      });
      setAddEmail('');
      setIsAddOpen(false);
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleSetDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !departingMember) return;
    try {
      setIsSubmittingDepart(true);
      setError(null);
      await api.patch(`/groups/${currentGroup.id}/members/${departingMember.user_id}`, {
        left_at: departureDate
      });
      setDepartingMember(null);
      fetchMembers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record departure');
    } finally {
      setIsSubmittingDepart(false);
    }
  };

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
      <div className="p-8 max-w-5xl mx-auto w-full animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Group Members</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Manage who is in <span className="text-[var(--color-accent)] font-semibold">{currentGroup.name}</span> and their membership periods.
            </p>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,180,166,0.2)] hover:-translate-y-0.5"
          >
            <UserPlus size={16} />
            <span>Add Member</span>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-6 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Members Table */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border-card)] bg-[var(--color-bg-sidebar)]/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pl-6">Member</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Join Date</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Departure Date</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-card)]">
                {members.map((member) => {
                  const isLeft = member.left_at !== null;
                  const joinedDateStr = new Date(member.joined_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC'
                  });
                  const leftDateStr = isLeft
                    ? new Date(member.left_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC'
                      })
                    : 'Present';

                  return (
                    <tr key={member.id} className="hover:bg-[var(--color-bg-card-hover)]/35 transition-colors duration-150">
                      {/* Name / Email */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border uppercase shadow-sm ${
                            isLeft 
                              ? 'bg-zinc-800/50 text-zinc-500 border-zinc-700/30' 
                              : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20'
                          }`}>
                            {member.user_name?.substring(0, 2)}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${isLeft ? 'text-zinc-500 line-through' : 'text-white'}`}>
                              {member.user_name}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)]">{member.user_email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Join Date */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                          <Calendar size={14} className="text-[var(--color-accent)]/70" />
                          <span>{joinedDateStr}</span>
                        </div>
                      </td>

                      {/* Departure Date */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                          <Calendar size={14} className="text-zinc-600" />
                          <span className={isLeft ? 'text-orange-400/80 font-medium' : ''}>{leftDateStr}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-4">
                        {isLeft ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Departed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 shadow-[0_0_10px_rgba(0,180,166,0.05)]">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-4 pr-6 text-right">
                        {!isLeft && (
                          <button
                            onClick={() => {
                              setDepartingMember(member);
                              setDepartureDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 hover:border-orange-500/30 hover:bg-orange-500/5 text-zinc-400 hover:text-orange-400 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
                          >
                            <LogOut size={13} />
                            <span>Set Departure</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Member Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in">
              <h2 className="text-xl font-bold text-white mb-1">Add Group Member</h2>
              <p className="text-xs text-[var(--color-text-muted)] mb-5">
                Invite a registered user to join this group.
              </p>
              
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    User Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--color-text-muted)]">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      required
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Join Date
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--color-text-muted)]">
                      <Calendar size={16} />
                    </span>
                    <input
                      type="date"
                      required
                      value={addJoinDate}
                      onChange={(e) => setAddJoinDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 py-2.5 border border-[var(--color-border-card)] hover:bg-[var(--color-bg-card-hover)] text-white font-semibold rounded-xl text-sm cursor-pointer transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdd}
                    className="flex-1 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent)]/50 text-white font-semibold rounded-xl text-sm cursor-pointer transition-all duration-200 shadow-[0_4px_12px_rgba(0,180,166,0.2)]"
                  >
                    {isSubmittingAdd ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Departure Modal */}
        {departingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in">
              <h2 className="text-xl font-bold text-white mb-1">Set Departure Date</h2>
              <p className="text-xs text-[var(--color-text-muted)] mb-5">
                Record the date <span className="text-[var(--color-accent)] font-semibold">{departingMember.user_name}</span> moved out or left the group.
              </p>
              
              <form onSubmit={handleSetDeparture} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 pl-1">
                    Departure Date
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--color-text-muted)]">
                      <Calendar size={16} />
                    </span>
                    <input
                      type="date"
                      required
                      value={departureDate}
                      min={departingMember.joined_at ? departingMember.joined_at.split('T')[0] : undefined}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-card)] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDepartingMember(null)}
                    className="flex-1 py-2.5 border border-[var(--color-border-card)] hover:bg-[var(--color-bg-card-hover)] text-white font-semibold rounded-xl text-sm cursor-pointer transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDepart}
                    className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold rounded-xl text-sm cursor-pointer transition-all duration-200 shadow-[0_4px_12px_rgba(249,115,22,0.2)]"
                  >
                    {isSubmittingDepart ? 'Saving...' : 'Set Departed'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
