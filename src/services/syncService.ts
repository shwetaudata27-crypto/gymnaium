import { localRepository } from '@/services/localRepository';
import { syncApi } from '@/services/apiService';
import { SyncOperation, Client, Payment, Plan } from '@/types/gym';

const DEFAULT_RETRY_DELAY_MS = 1000;

function makeId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export const syncService = {
  async enqueueClient(client: Client, action: 'create' | 'update' | 'delete') {
    const payload = { ...client };
    return localRepository.addSyncOperation({
      id: makeId(),
      entity: 'client',
      action,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: client.updatedAt || new Date().toISOString(),
    });
  },

  async enqueuePayment(payment: Payment, action: 'create' | 'update' | 'delete') {
    return localRepository.addSyncOperation({
      id: makeId(),
      entity: 'payment',
      action,
      payload: { ...payment },
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: payment.updatedAt || new Date().toISOString(),
    });
  },

  async enqueuePlan(plan: Plan, action: 'create' | 'update' | 'delete') {
    return localRepository.addSyncOperation({
      id: makeId(),
      entity: 'plan',
      action,
      payload: { ...plan },
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: plan.updatedAt || new Date().toISOString(),
    });
  },

  async processQueue() {
    if (!isOnline()) {
      return { success: false, reason: 'offline' };
    }

    const operations = await localRepository.getPendingSyncOperations();
    if (!operations.length) {
      return { success: true, synced: 0 };
    }

    let synced = 0;
    for (const operation of operations) {
      try {
        if (operation.entity === 'client') {
          await syncApi.syncMembers([operation]);
        } else if (operation.entity === 'payment') {
          await syncApi.syncPayments([operation]);
        } else if (operation.entity === 'plan') {
          await syncApi.syncPlans([operation]);
        } else {
          continue;
        }
        await localRepository.clearSyncOperation(operation.id);
        synced += 1;
      } catch (error) {
        console.warn('Sync operation failed', operation, error);
      }
    }

    return { success: true, synced };
  },

  async syncEverything(since?: string) {
    if (!isOnline()) {
      return { success: false, reason: 'offline' };
    }

    const result = await this.processQueue();
    let updates;
    try {
      updates = await syncApi.fetchUpdates(since);
    } catch (error) {
      console.warn('Failed to fetch server updates', error);
      return { ...result, success: false, reason: 'remote-unavailable' };
    }

    if (updates?.members?.length) {
      for (const member of updates.members) {
        await localRepository.saveClient({
          ...member,
          membershipType: typeof member.membershipType === 'string' ? JSON.parse(member.membershipType) : member.membershipType,
        } as any, { preserveUpdatedAt: true });
      }
    }

    if (updates?.payments?.length) {
      for (const payment of updates.payments) {
        await localRepository.savePayment({
          ...payment,
          externalId: payment.externalId || payment.id?.toString?.() || `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        } as any, { preserveUpdatedAt: true });
      }
    }

    if (updates?.plans?.length) {
      for (const plan of updates.plans) {
        await localRepository.savePlan({
          ...plan,
          externalId: plan.externalId || plan.id?.toString?.() || `server-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        } as any, { preserveUpdatedAt: true });
      }
    }

    return { ...result, updates };
  },

  async waitForOnlineAndSync(retryMs = DEFAULT_RETRY_DELAY_MS) {
    const syncNow = async () => {
      return this.syncEverything();
    };

    if (isOnline()) {
      return syncNow();
    }

    return new Promise((resolve) => {
      const finish = async () => {
        window.removeEventListener('online', finish);
        resolve(await syncNow());
      };
      window.addEventListener('online', finish, { once: true });
      setTimeout(async () => {
        if (isOnline()) {
          finish();
        } else {
          resolve({ success: false, reason: 'still-offline' });
        }
      }, retryMs);
    });
  },
};
