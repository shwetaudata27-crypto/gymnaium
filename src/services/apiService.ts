import { API_ENDPOINTS } from "@/config/api";
import { Client, Payment, Plan } from "@/types/gym";
import { localRepository } from '@/services/localRepository';
import { syncService } from '@/services/syncService';
import { uploadDatabaseBackupToDriveIfSignedIn } from '@/services/backupService';

function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Generic fetch wrapper for the Express backend.
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const method = (options?.method || "GET").toUpperCase();
    const headers = new Headers(options?.headers);

    const hasBody = options?.body !== undefined && options?.body !== null;
    if (
      hasBody &&
      method !== "GET" &&
      method !== "HEAD" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = "Request failed";
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error ||
          errorData.message ||
          errorData.details ||
          "Request failed";
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      console.error(`API Error (${method} ${url}):`, errorMessage);
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Client API
export const clientApi = {
  register: async (
    clientData: Omit<Client, "id" | "clientId" | "createdAt" | "payments">,
  ) => {
    const now = new Date().toISOString();
    const client: Client = {
      id: 0,
      clientId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: clientData.name,
      email: clientData.email,
      phone: clientData.phone,
      dob: clientData.dob,
      address: clientData.address,
      occupation: clientData.occupation,
      emergencyContact: clientData.emergencyContact || '',
      gender: clientData.gender || '',
      membershipType: clientData.membershipType,
      slot: clientData.slot,
      membershipPeriod: clientData.membershipPeriod,
      startDate: clientData.startDate,
      endDate: clientData.endDate,
      membershipStatus: clientData.membershipStatus || 'active',
      registrationDay: clientData.registrationDay,
      createdAt: now,
      updatedAt: now,
      payments: [],
      finalAmount: clientData.finalAmount || 0,
      termsAcceptedBy: clientData.termsAcceptedBy || '',
      photo: clientData.photo || '',
      signature: clientData.signature || '',
      notes: clientData.notes || '',
    };

    await localRepository.saveClient(client);
    await syncService.enqueueClient(client, 'create');
    if (isOnline()) {
      await syncService.processQueue();
    }
    uploadDatabaseBackupToDriveIfSignedIn().catch((error) => {
      console.warn('Skipping automatic Drive backup after client create:', error);
    });

    return { success: true, client, message: 'Client saved locally' };
  },

  getAll: async () => {
    return localRepository.getClients();
  },

  getById: async (clientId: string) => {
    const clients = await localRepository.getClients();
    const client = clients.find((item) => item.clientId === clientId);
    if (!client) {
      throw new Error('Client not found');
    }
    return client;
  },

  update: async (clientId: string, updates: Partial<Client>) => {
    const clients = await localRepository.getClients();
    const existing = clients.find((item) => item.clientId === clientId);
    if (!existing) {
      throw new Error('Client not found');
    }

    const updatedClient: Client = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await localRepository.saveClient(updatedClient);
    await syncService.enqueueClient(updatedClient, 'update');
    if (isOnline()) {
      await syncService.processQueue();
    }

    return { success: true, client: updatedClient };
  },

  remove: async (clientId: string) => {
    await localRepository.deleteClient(clientId);
    await syncService.enqueueClient({ clientId, updatedAt: new Date().toISOString() } as Client, 'delete');
    if (isOnline()) {
      await syncService.processQueue();
    }
    return { success: true, message: 'Client deleted locally' };
  },
};

// Payment API
export const paymentApi = {
  create: async (paymentData: {
    clientId: string;
    name?: string;
    amount: number;
    finalAmount: number;
    paidAmount: number;
    membershipPeriod?: number;
    offerDiscount?: number;
    discount?: number;
    discountType?: string;
    notes?: string;
    paidDate?: string;
  }) => {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: 0,
      externalId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      clientId: paymentData.clientId,
      name: paymentData.name || '',
      amount: paymentData.amount,
      finalAmount: paymentData.finalAmount,
      paidAmount: paymentData.paidAmount,
      membershipPeriod: paymentData.membershipPeriod || 0,
      offerDiscount: paymentData.offerDiscount || 0,
      discount: paymentData.discount || 0,
      discountType: paymentData.discountType || '',
      notes: paymentData.notes || '',
      paidDate: paymentData.paidDate || now,
      createdAt: now,
      updatedAt: now,
    };

    await localRepository.savePayment(payment);
    await syncService.enqueuePayment(payment, 'create');
    if (isOnline()) {
      await syncService.processQueue();
    }
    uploadDatabaseBackupToDriveIfSignedIn().catch((error) => {
      console.warn('Skipping automatic Drive backup after payment create:', error);
    });

    return { success: true, message: 'Payment saved locally' };
  },

  getByClientId: async (clientId: string) => {
    return localRepository.getPayments(clientId);
  },
};

export const planApi = {
  getAll: async () => {
    return localRepository.getPlans();
  },

  save: async (planData: Omit<Plan, 'id' | 'externalId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const plan: Plan = {
      id: 0,
      externalId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: planData.name,
      description: planData.description,
      price: planData.price,
      durationMonths: planData.durationMonths,
      createdAt: now,
      updatedAt: now,
    };

    await localRepository.savePlan(plan);
    await syncService.enqueuePlan(plan, 'create');
    if (isOnline()) {
      await syncService.processQueue();
    }

    return { success: true, plan };
  },

  delete: async (planId: number) => {
    await localRepository.deletePlan(planId);
    await syncService.enqueuePlan({ id: planId, updatedAt: new Date().toISOString() } as Plan, 'delete');
    if (isOnline()) {
      await syncService.processQueue();
    }

    return { success: true, message: 'Plan deleted locally' };
  },
};

// Email API (SMTP via backend)
export const emailApi = {
  send: async (data: {
    clientId?: string;
    emailType?: string;
    message?: string;
    subject?: string;
    to?: string;
    text?: string;
    html?: string;
  }) => {
    const payload: any = {};
    if (data.clientId) payload.toClientId = data.clientId;
    if (data.to) payload.to = data.to;
    if (data.subject) payload.subject = data.subject;
    if (data.emailType) payload.emailType = data.emailType;
    payload.text = data.message || data.text || '';
    payload.html = data.html || undefined;

    return fetchApi<{
      success: boolean;
      message?: string;
      warning?: string;
      delivery?: {
        accepted: string[];
        rejected: string[];
        messageId?: string;
        response?: string;
      };
    }>(
      API_ENDPOINTS.email.send,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};

export const renewalApi = {
  create: async (renewalData: {
    clientId: string;
    name: string;
    membershipType: Record<string, boolean>;
    memberSlot: 'morning' | 'evening';
    membershipPeriod: number;
    startDate: string;
    endDate: string;
    finalAmount: number;
    notes?: string;
  }) => {
    return fetchApi<{ success: boolean; renewal: any }>(
      API_ENDPOINTS.renewals.create,
      {
        method: 'POST',
        body: JSON.stringify(renewalData),
      },
    );
  },

  update: async (renewalId: string, renewalData: Partial<{
    membershipType: Record<string, boolean>;
    memberSlot: 'morning' | 'evening';
    membershipPeriod: number;
    startDate: string;
    endDate: string;
    finalAmount: number;
    notes?: string;
  }>) => {
    return fetchApi<{ success: boolean; renewal: any }>(
      API_ENDPOINTS.renewals.update(renewalId),
      {
        method: 'PUT',
        body: JSON.stringify(renewalData),
      },
    );
  },

  getAll: async () => {
    return fetchApi<any[]>(API_ENDPOINTS.renewals.getAll);
  },

  getByClientId: async (clientId: string) => {
    return fetchApi<any[]>(API_ENDPOINTS.renewals.getByClientId(clientId));
  },

  sendEmail: async (renewalId: string) => {
    return fetchApi<{ success: boolean; message?: string }>(
      API_ENDPOINTS.renewals.sendEmail(renewalId),
      {
        method: 'POST',
      },
    );
  },
  remove: async (renewalId: string) => {
    return fetchApi<{ success: boolean; message?: string }>(
      API_ENDPOINTS.renewals.delete(renewalId),
      {
        method: 'DELETE',
      },
    );
  },
};

export const renewalPaymentApi = {
  create: async (paymentData: {
    renewalId: number;
    clientId: string;
    amount: number;
    finalAmount: number;
    paidAmount: number;
    membershipPeriod: number;
    offerDiscount?: number;
    discount?: number;
    discountType?: string;
    notes?: string;
    paidDate: string;
  }) => {
    return fetchApi<{ success: boolean; paymentId: number }>(
      API_ENDPOINTS.renewalPayments.create,
      {
        method: 'POST',
        body: JSON.stringify(paymentData),
      },
    );
  },

  getAll: async () => {
    return fetchApi<any[]>(API_ENDPOINTS.renewalPayments.getAll);
  },

  getByRenewalId: async (renewalId: string) => {
    return fetchApi<any[]>(API_ENDPOINTS.renewalPayments.getByRenewalId(renewalId));
  },
};

export const reviewApi = {
  create: async (data: {
    clientId?: string;
    name: string;
    rating: number;
    feedback: string;
    email?: string;
  }) => {
    return fetchApi<{ success: boolean; message: string }>(
      API_ENDPOINTS.reviews.create,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  getAll: async () => {
    return fetchApi<any[]>(API_ENDPOINTS.reviews.getAll);
  },
};

export const syncApi = {
  syncMembers: async (operations: any[]) => {
    return fetchApi<{ success: boolean; synced: number; conflicts?: any[] }>(
      API_ENDPOINTS.sync.members,
      {
        method: 'POST',
        body: JSON.stringify({ operations }),
      },
    );
  },

  syncPayments: async (operations: any[]) => {
    return fetchApi<{ success: boolean; synced: number; conflicts?: any[] }>(
      API_ENDPOINTS.sync.payments,
      {
        method: 'POST',
        body: JSON.stringify({ operations }),
      },
    );
  },

  syncPlans: async (operations: any[]) => {
    return fetchApi<{ success: boolean; synced: number; conflicts?: any[] }>(
      API_ENDPOINTS.sync.plans,
      {
        method: 'POST',
        body: JSON.stringify({ operations }),
      },
    );
  },

  syncReports: async (operations: any[]) => {
    return fetchApi<{ success: boolean; synced: number; conflicts?: any[] }>(
      API_ENDPOINTS.sync.reports,
      {
        method: 'POST',
        body: JSON.stringify({ operations }),
      },
    );
  },

  fetchUpdates: async (since?: string) => {
    const url = since ? `${API_ENDPOINTS.sync.updates}?since=${encodeURIComponent(since)}` : API_ENDPOINTS.sync.updates;
    return fetchApi<{ members: any[]; payments: any[]; plans: any[] }>(url);
  },
};

// Health check
export const healthCheck = async () => {
  return fetchApi<{ status: string }>(API_ENDPOINTS.health);
};
