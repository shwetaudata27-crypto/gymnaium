// Admin / user authentication against the in-repo Express backend.
// File name kept ("authService.ts") so existing imports keep working —

import { API_ENDPOINTS } from '@/config/api';
const ADMIN_LOGIN_URL = API_ENDPOINTS.auth.login;
const GATE_LOGIN_URL = API_ENDPOINTS.auth.userLogin;
const ADMIN_FLAG = 'gym_admin_logged_in';
const ROLE_KEY = 'gym_admin_role';
const USERNAME_KEY = 'gym_admin_username';

function storeAdminLogin(role: string | null, username: string | null) {
  try {
    localStorage.setItem(ADMIN_FLAG, 'true');
    if (role) localStorage.setItem(ROLE_KEY, role);
    if (username) localStorage.setItem(USERNAME_KEY, username);
  } catch {
    /* no-op */
  }
}

function clearAdminLogin() {
  try {
    localStorage.removeItem(ADMIN_FLAG);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USERNAME_KEY);
  } catch {
    /* no-op */
  }
}

function getStoredLoginFlag(): boolean {
  try {
    return localStorage.getItem(ADMIN_FLAG) === 'true';
  } catch {
    return false;
  }
}

export const authService = {
  login: async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(ADMIN_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Unable to reach backend at ${ADMIN_LOGIN_URL}. Is the server running? ${message}`);
    }

    let data: any = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (!res.ok) {
      const msg = data?.error || data?.message || 'Invalid username or password';
      throw new Error(msg);
    }

    const role = data?.role || null;
    const usernameResponse = data?.username || username;
    storeAdminLogin(role, usernameResponse);

    return { success: true, role, username: usernameResponse };
  },

  logout: () => {
    clearAdminLogin();
  },

  getAuthToken: async (): Promise<string | null> => {
    return null;
  },

  getIdToken: async (): Promise<string | null> => {
    return null;
  },

  getAccessToken: async (): Promise<string | null> => {
    return null;
  },

  getRole: (): string | null => {
    try { return localStorage.getItem(ROLE_KEY); } catch { return null; }
  },

  isAuthenticated: async (): Promise<boolean> => {
    return getStoredLoginFlag();
  },
};
