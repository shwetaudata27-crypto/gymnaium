// API Configuration - endpoint base URL is centralized and controlled by VITE_API_URL.
// In development, always use relative paths so Vite can proxy /api, /adminlogin,
// and /userlogin to the local backend even if the shell has an old VITE_API_URL.
const rawRuntimeHostname = typeof window !== 'undefined' ? window.location.hostname : '';
const runtimeHostname = rawRuntimeHostname || '127.0.0.1';
const rawEnvApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
const isDev = import.meta.env.DEV === true;
const hasPlaceholderApiUrl = rawEnvApiUrl.includes('<') || rawEnvApiUrl.includes('>');
const hasLegacyRailwayApiUrl = /work-backend-production-be8c\.up\.railway\.app/i.test(rawEnvApiUrl);
const envApiUrl = isDev || hasPlaceholderApiUrl || hasLegacyRailwayApiUrl ? '' : rawEnvApiUrl;

export const API_URL = envApiUrl || (isDev ? '' : `http://${runtimeHostname}:5000`);

const withBase = (path: string) => {
  if (envApiUrl || !isDev) {
    return `${API_URL.replace(/\/$/, '')}${path}`;
  }
  return path;
};

export const API_ENDPOINTS = {
  auth: {
    login: withBase('/adminlogin'),
    userLogin: withBase('/userlogin'),
  },
  clients: {
    register: withBase('/api/clients/register'),
    getAll: withBase('/api/clients'),
    getById: (id: string) => withBase(`/api/clients/${id}`),
  },
  payments: {
    create: withBase('/api/payments'),
    getByClientId: (id: string) => withBase(`/api/payments/${id}`),
  },
  email: {
    send: withBase('/api/email/send'),
  },
  reviews: {
    create: withBase('/api/reviews'),
    getAll: withBase('/api/reviews'),
  },
  renewals: {
    create: withBase('/api/renewals'),
    getAll: withBase('/api/renewals'),
    getByClientId: (clientId: string) => withBase(`/api/renewals/${clientId}`),
    update: (renewalId: string) => withBase(`/api/renewals/${renewalId}`),
    sendEmail: (renewalId: string) => withBase(`/api/renewals/${renewalId}/email`),
    delete: (renewalId: string) => withBase(`/api/renewals/${renewalId}`),
  },
  renewalPayments: {
    create: withBase('/api/renewal-payments'),
    getAll: withBase('/api/renewal-payments'),
    getByRenewalId: (renewalId: string) => withBase(`/api/renewal-payments/${renewalId}`),
  },
  db: {
    download: withBase('/api/db/download'),
    status: withBase('/api/db/status'),
  },
  sync: {
    members: withBase('/api/sync/members'),
    payments: withBase('/api/sync/payments'),
    plans: withBase('/api/sync/plans'),
    reports: withBase('/api/sync/reports'),
    updates: withBase('/api/sync/updates'),
  },
  health: withBase('/api/health'),
};
