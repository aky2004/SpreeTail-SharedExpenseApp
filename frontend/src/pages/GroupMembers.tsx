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
      <div className="animate-fade-in flex-1 flex flex-col min-h-0" style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="section-label">Members</span>
              <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#334155' }} />
              <span className="section-label" style={{ color: '#6366f1' }}>{currentGroup.name}</span>
            </div>
            <h1 className="page-title">Group Members</h1>
            <p className="text-[13px] mt-1" style={{ color: '#475569' }}>
              Manage who is in <span className="font-semibold text-white">{currentGroup.name}</span> and their membership periods.
            </p>
          </div>
          <button onClick={() => setIsAddOpen(true)} className="btn-primary py-2.5 px-5">
            <UserPlus size={15} />
            <span>Add Member</span>
          </button>
        </div>

        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-[13px]"
            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#f43f5e' }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Members Table */}
        <div className="animate-fade-in hover-lift" style={{
          background: 'rgba(13,13,28,0.9)', borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset',
          display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1.5px', background: 'linear-gradient(90deg, #6366f1 0%, #6366f160 40%, transparent 100%)', zIndex: 20 }} />
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <table className="data-table">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="pl-6">Member</th>
                    <th>Join Date</th>
                    <th>Departure Date</th>
                    <th>Status</th>
                    <th className="pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isLeft = member.left_at !== null;
                    const joinedDateStr = new Date(member.joined_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
                    });
                    const leftDateStr = isLeft
                      ? new Date(member.left_at).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
                        })
                      : 'Present';

                    return (
                      <tr key={member.id}>
                        {/* Name / Email */}
                        <td className="pl-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[12px] uppercase shrink-0"
                              style={{
                                background: isLeft ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))',
                                border: isLeft ? 'none' : '1px solid rgba(99,102,241,0.25)',
                                color: isLeft ? '#64748b' : '#a5b4fc',
                              }}
                            >
                              {member.user_name?.substring(0, 2)}
                            </div>
                            <div>
                              <div className={`text-[13px] font-semibold ${isLeft ? 'line-through text-[#64748b]' : 'text-white'}`}>
                                {member.user_name}
                              </div>
                              <div className="text-[11px]" style={{ color: '#475569' }}>{member.user_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Join Date */}
                        <td>
                          <div className="flex items-center gap-2 text-[12px] mono" style={{ color: '#64748b' }}>
                            <Calendar size={13} style={{ color: '#6366f1' }} />
                            <span>{joinedDateStr}</span>
                          </div>
                        </td>

                        {/* Departure Date */}
                        <td>
                          <div className="flex items-center gap-2 text-[12px] mono" style={{ color: '#64748b' }}>
                            <Calendar size={13} style={{ color: '#475569' }} />
                            <span className={isLeft ? 'text-[#fb923c] font-medium' : ''}>{leftDateStr}</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>
                          {isLeft ? (
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                              Departed
                            </span>
                          ) : (
                            <span className="badge badge-emerald">
                              Active
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="pr-6 text-right">
                          {!isLeft && (
                            <button
                              onClick={() => {
                                setDepartingMember(member);
                                setDepartureDate(new Date().toISOString().split('T')[0]);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,146,60,0.4)'; e.currentTarget.style.color = '#fb923c'; e.currentTarget.style.background = 'rgba(251,146,60,0.05)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
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
            </div>
          )}
        </div>

        {/* Add Member Modal */}
        {isAddOpen && (
          <div className="modal-backdrop">
            <div className="w-full max-w-md p-8 animate-scale-in relative overflow-hidden"
              style={{
                background: 'rgba(13, 13, 28, 0.95)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset',
                backdropFilter: 'blur(30px)'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 100%)' }} />
              <h2 className="text-[18px] font-bold text-white mb-1">Add Group Member</h2>
              <p className="text-[13px] mb-5" style={{ color: '#475569' }}>
                Invite a registered user to join this group.
              </p>
              
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 pl-1" style={{ color: '#64748b' }}>
                    User Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center" style={{ color: '#64748b' }}>
                      <Mail size={15} />
                    </span>
                    <input
                      type="email"
                      required
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 pl-1" style={{ color: '#64748b' }}>
                    Join Date
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center" style={{ color: '#64748b' }}>
                      <Calendar size={15} />
                    </span>
                    <input
                      type="date"
                      required
                      value={addJoinDate}
                      onChange={(e) => setAddJoinDate(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="btn-ghost flex-1 py-2.5">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingAdd} className="btn-primary flex-1 py-2.5">
                    {isSubmittingAdd ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Departure Modal */}
        {departingMember && (
          <div className="modal-backdrop">
            <div className="w-full max-w-md p-8 animate-scale-in relative overflow-hidden"
              style={{
                background: 'rgba(13, 13, 28, 0.95)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset',
                backdropFilter: 'blur(30px)'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)' }} />
              <h2 className="text-[18px] font-bold text-white mb-1">Set Departure Date</h2>
              <p className="text-[13px] mb-5" style={{ color: '#475569' }}>
                Record the date <span className="font-semibold text-white">{departingMember.user_name}</span> moved out or left the group.
              </p>
              
              <form onSubmit={handleSetDeparture} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 pl-1" style={{ color: '#64748b' }}>
                    Departure Date
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center" style={{ color: '#64748b' }}>
                      <Calendar size={15} />
                    </span>
                    <input
                      type="date"
                      required
                      value={departureDate}
                      min={departingMember.joined_at ? departingMember.joined_at.split('T')[0] : undefined}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setDepartingMember(null)} className="btn-ghost flex-1 py-2.5">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDepart}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer shadow-lg"
                    style={{
                      background: isSubmittingDepart ? 'rgba(249,115,22,0.5)' : '#f97316',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(249,115,22,0.15)'
                    }}
                    onMouseEnter={e => { if (!isSubmittingDepart) e.currentTarget.style.background = '#ea580c'; }}
                    onMouseLeave={e => { if (!isSubmittingDepart) e.currentTarget.style.background = '#f97316'; }}
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
