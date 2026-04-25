import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from '@/constants/config';

export const ACCESS_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'auth_refresh_token';

type TokenCallback = (token: string | null) => void;

let isRefreshing = false;
let refreshQueue: TokenCallback[] = [];
let onSessionExpiredCallback: (() => void) | null = null;

function drainQueue(token: string | null) {
  refreshQueue.forEach(cb => cb(token));
  refreshQueue = [];
}

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpiredCallback = cb;
}

export const tokenManager = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
    ]);
  },

  async refresh(): Promise<string | null> {
    if (isRefreshing) {
      return new Promise<string | null>(resolve => {
        refreshQueue.push(resolve);
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        // No refresh token at all = definitive logout state.
        await this.clearTokens();
        drainQueue(null);
        onSessionExpiredCallback?.();
        return null;
      }

      const baseUrl = getApiBaseUrl();
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Transient network failure (no internet, DNS, server cold start).
        // Do NOT clear tokens — let the next request try again.
        drainQueue(null);
        return null;
      }

      const data = await response.json().catch(() => ({}));

      // Only treat 401/403 as a real auth failure that invalidates the session.
      const isAuthFailure =
        response.status === 401 ||
        response.status === 403 ||
        data?.tokenRevoked === true;

      if (isAuthFailure) {
        await this.clearTokens();
        drainQueue(null);
        onSessionExpiredCallback?.();
        return null;
      }

      // Server error, rate limit, or any other non-OK response: keep tokens,
      // let the caller retry later instead of forcing logout.
      if (!response.ok || !data.success || !data.token) {
        drainQueue(null);
        return null;
      }

      await this.setAccessToken(data.token);
      if (data.refreshToken) {
        await this.setRefreshToken(data.refreshToken);
      }
      drainQueue(data.token);
      return data.token;
    } finally {
      isRefreshing = false;
    }
  },
};
