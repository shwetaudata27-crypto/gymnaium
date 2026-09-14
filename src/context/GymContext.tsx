import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Client } from '@/types/gym';
import { authService } from '@/services/authService';
import { clientApi } from '@/services/apiService';
import { localRepository } from '@/services/localRepository';
import { syncService } from '@/services/syncService';

interface GymContextType {
  clients: Client[];
  loading: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  refreshClients: () => Promise<void>;
  syncNow: () => Promise<void>;
  updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  getClientBySearch: (searchTerm: string) => Client[];
  getClientById: (clientId: string) => Client | undefined;
  isAdminLoggedIn: boolean;
  adminLogin: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  adminLogout: () => void;
  isGateUnlocked: boolean;
  unlockGate: () => void;
  lockGate: () => void;
}

const GymContext = createContext<GymContextType | undefined>(undefined);

export function GymProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isGateUnlocked, setIsGateUnlocked] = useState(false);

  const refreshClients = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedClients = await localRepository.getClients();
      console.info('[dashboard] loaded clients', { count: fetchedClients.length });
      setClients(fetchedClients);
    } catch (error) {
      console.error('Failed to load local clients:', error);
      setClients((currentClients) => {
        if (currentClients.length > 0) {
          console.warn('[dashboard] keeping existing local clients', {
            count: currentClients.length,
          });
          return currentClients;
        }
        return [];
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncService.syncEverything(lastSyncAt || undefined);
      const timestamp = new Date().toISOString();
      setLastSyncAt(timestamp);
      localStorage.setItem('usgym_last_sync', timestamp);
      await refreshClients();
      console.info('[sync] completed', result);
    } catch (error) {
      console.error('[sync] failed', error);
    } finally {
      setSyncing(false);
    }
  }, [lastSyncAt, refreshClients]);

  useEffect(() => {
    const initialize = async () => {
      await localRepository.initialize();
      await refreshClients();
      const savedLastSync = localStorage.getItem('usgym_last_sync');
      if (savedLastSync) {
        setLastSyncAt(savedLastSync);
      }

      const authenticated = await authService.isAuthenticated();
      if (authenticated) {
        setIsAdminLoggedIn(true);
      }

      const syncResult = await syncService.waitForOnlineAndSync();
      if (syncResult.success) {
        const timestamp = new Date().toISOString();
        setLastSyncAt(timestamp);
        localStorage.setItem('usgym_last_sync', timestamp);
      }
      await refreshClients();
    };

    initialize();

    const checkGateStatus = () => {
      try {
        setIsGateUnlocked(sessionStorage.getItem('gym_gate_unlocked') === 'true');
      } catch {
        setIsGateUnlocked(false);
      }
    };

    const handleOnline = async () => {
      const syncResult = await syncService.waitForOnlineAndSync();
      if (syncResult.success) {
        const timestamp = new Date().toISOString();
        setLastSyncAt(timestamp);
        localStorage.setItem('usgym_last_sync', timestamp);
      }
      await refreshClients();
    };

    checkGateStatus();
    window.addEventListener('storage', checkGateStatus);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('storage', checkGateStatus);
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshClients, syncNow]);

  const unlockGate = useCallback(() => {
    try {
      sessionStorage.setItem('gym_gate_unlocked', 'true');
      setIsGateUnlocked(true);
    } catch { /* no-op */ }
    refreshClients();
  }, [refreshClients]);

  const lockGate = useCallback(() => {
    try {
      sessionStorage.removeItem('gym_gate_unlocked');
      localStorage.removeItem('gym_admin_id_token');
      localStorage.removeItem('gym_admin_access_token');
      localStorage.removeItem('gym_admin_token');
      localStorage.removeItem('gym_admin_role');
      setIsGateUnlocked(false);
      setIsAdminLoggedIn(false);
      setClients([]);
    } catch { /* no-op */ }
  }, []);

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>) => {
    try {
      await clientApi.update(clientId, updates);
      await refreshClients();
    } catch (error) {
      console.error('Failed to update client:', error);
    }
  }, [refreshClients]);

  const deleteClient = useCallback(async (clientId: string) => {
    try {
      await clientApi.remove(clientId);
      await refreshClients();
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  }, [refreshClients]);

  const getClientBySearch = (searchTerm: string): Client[] => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(
      client =>
        (client.name || '').toLowerCase().includes(term) ||
        (client.clientId || '').includes(term) ||
        ((client.email || '').toLowerCase().includes(term)) ||
        ((client.phone || '').includes(term))
    );
  };

  const getClientById = (clientId: string): Client | undefined => {
    return clients.find(client => client.clientId === clientId);
  };

  // Backend-based admin login
  const adminLogin = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      await authService.login(username, password);
      setIsAdminLoggedIn(true);
      await refreshClients();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to login. Please try again.';
      console.error('Login failed:', message, error);
      return { success: false, message };
    }
  };

  const adminLogout = () => {
    authService.logout();
    setIsAdminLoggedIn(false);
    setClients([]);
  };

  return (
    <GymContext.Provider
      value={{
        clients,
        loading,
        syncing,
        lastSyncAt,
        refreshClients,
        syncNow,
        updateClient,
        deleteClient,
        getClientBySearch,
        getClientById,
        isAdminLoggedIn,
        adminLogin,
        adminLogout,
        isGateUnlocked,
        unlockGate,
        lockGate,
      }}
    >
      {children}
    </GymContext.Provider>
  );
}

export function useGym() {
  const context = useContext(GymContext);
  if (context === undefined) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
}

// Non-throwing variant for components that may render outside the provider
// (e.g. public pages). Returns undefined when no provider is present.
export function useGymOptional() {
  return useContext(GymContext);
}
