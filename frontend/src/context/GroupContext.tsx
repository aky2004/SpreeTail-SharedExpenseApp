import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Group } from '../types';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface GroupContextType {
  groups: Group[];
  currentGroup: Group | null;
  isLoadingGroups: boolean;
  setCurrentGroup: (group: Group | null) => void;
  refreshGroups: () => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  joinGroup: (inviteCode: string, joinedAt: string) => Promise<{ group: Group }>;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroupState] = useState<Group | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshGroups = useCallback(async () => {
    if (!isAuthenticated) {
      setGroups([]);
      setCurrentGroupState(null);
      setIsLoadingGroups(false);
      return;
    }

    try {
      setIsLoadingGroups(true);
      const res = await api.get('/groups');
      const groupList = res.data.groups || [];
      setGroups(groupList);

      if (groupList.length > 0) {
        // Recover selected group from localStorage if valid
        const savedId = localStorage.getItem('expensio_current_group_id');
        const activeGroup = groupList.find((g: Group) => g.id.toString() === savedId) || groupList[0];
        setCurrentGroupState(activeGroup);
        localStorage.setItem('expensio_current_group_id', activeGroup.id.toString());
      } else {
        setCurrentGroupState(null);
        localStorage.removeItem('expensio_current_group_id');
        
        // If not on onboarding or login/register, redirect to onboarding
        const publicPaths = ['/login', '/register', '/onboarding'];
        if (!publicPaths.includes(location.pathname)) {
          navigate('/onboarding');
        }
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [isAuthenticated, navigate, location.pathname]);

  const setCurrentGroup = (group: Group | null) => {
    setCurrentGroupState(group);
    if (group) {
      localStorage.setItem('expensio_current_group_id', group.id.toString());
    } else {
      localStorage.removeItem('expensio_current_group_id');
    }
  };

  const createGroup = async (name: string) => {
    const res = await api.post('/groups', { name });
    const newGroup = res.data.group;
    await refreshGroups();
    setCurrentGroup(newGroup);
    return newGroup;
  };

  const joinGroup = async (inviteCode: string, joinedAt: string) => {
    const res = await api.post('/groups/join', { invite_code: inviteCode, joined_at: joinedAt });
    const joinedGroup = res.data.group;
    await refreshGroups();
    setCurrentGroup(joinedGroup);
    return res.data;
  };

  useEffect(() => {
    refreshGroups();
  }, [isAuthenticated, refreshGroups]);

  return (
    <GroupContext.Provider
      value={{
        groups,
        currentGroup,
        isLoadingGroups,
        setCurrentGroup,
        refreshGroups,
        createGroup,
        joinGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
}
