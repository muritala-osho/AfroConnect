const _viteApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const API_BASE = _viteApiUrl ? `${_viteApiUrl}/api` : '/api';

const TOKEN_KEY = 'afroconnect_token';
const REFRESH_TOKEN_KEY = 'afroconnect_refresh_token';

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const setRefreshToken = (token: string) => localStorage.setItem(REFRESH_TOKEN_KEY, token);

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Callback invoked when the refresh token is invalid / expired so App.tsx can
// force the user back to the login screen without coupling adminApi to React.
let onSessionExpired: (() => void) | null = null;
export const setOnAdminSessionExpired = (cb: (() => void) | null) => {
  onSessionExpired = cb;
};

// Serialise concurrent refresh calls so we don't fire multiple /refresh
// requests in parallel when several API calls 401 at the same time.
let isRefreshing = false;
type RefreshWaiter = (token: string | null) => void;
let refreshWaiters: RefreshWaiter[] = [];

function drainWaiters(token: string | null) {
  refreshWaiters.forEach(fn => fn(token));
  refreshWaiters = [];
}

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise<string | null>(resolve => {
      refreshWaiters.push(resolve);
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      drainWaiters(null);
      onSessionExpired?.();
      return null;
    }

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    // Network-level failure: keep tokens, let callers retry later.
    if (!res.ok) {
      const isAuthFailure = res.status === 401 || res.status === 403;
      if (isAuthFailure) {
        clearToken();
        drainWaiters(null);
        onSessionExpired?.();
        return null;
      }
      drainWaiters(null);
      return null;
    }

    const data = await res.json().catch(() => ({}));

    if (!data.success || !data.token) {
      clearToken();
      drainWaiters(null);
      onSessionExpired?.();
      return null;
    }

    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    drainWaiters(data.token);
    return data.token;
  } catch {
    // Transient network error — don't log out, let UI retry.
    drainWaiters(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Perform a fetch and, on 401, silently refresh then retry once.
async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { ...init, headers: { ...authHeaders(), ...(init.headers as Record<string, string> || {}) } });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      // Return the original 401 so callers can handle it.
      return res;
    }
    // Retry with the new token.
    return fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> || {}),
        Authorization: `Bearer ${newToken}`,
      },
    });
  }

  return res;
}

const handleResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 401) {
      clearToken();
      onSessionExpired?.();
    }
    const text = await res.text();
    if (!res.ok || !contentType.includes('json')) {
      throw new Error(
        res.ok
          ? 'Server returned an unexpected response. Check that VITE_API_URL is set correctly.'
          : `Server error (${res.status}): Backend may be unreachable. Please check your API URL configuration.`
      );
    }
    return JSON.parse(text);
  }
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      onSessionExpired?.();
    }
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
};

export const adminApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(res);
    if (data.success && data.token) {
      setToken(data.token);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
    }
    return data;
  },

  getBadgeCounts: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/badge-counts`);
    return handleResponse(res);
  },

  getPushVapidKey: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/push-vapid-key`);
    return handleResponse(res);
  },

  subscribePush: async (subscription: PushSubscriptionJSON) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/push-subscribe`, {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
    return handleResponse(res);
  },

  unsubscribePush: async (endpoint?: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/push-unsubscribe`, {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
    return handleResponse(res);
  },

  testPush: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/push-test`, { method: 'POST' });
    return handleResponse(res);
  },

  getStats: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/stats`);
    return handleResponse(res);
  },

  getActivityMonitoring: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/activity-monitoring`);
    return handleResponse(res);
  },

  getUsers: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    const res = await fetchWithAuth(`${API_BASE}/admin/users?${query}`);
    return handleResponse(res);
  },

  getUser: async (userId: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}`);
    return handleResponse(res);
  },

  banUser: async (userId: string, banned: boolean, reason?: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ banned, reason }),
    });
    return handleResponse(res);
  },

  suspendUser: async (userId: string, suspended: boolean, days?: number) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/suspend`, {
      method: 'PUT',
      body: JSON.stringify({ suspended, days }),
    });
    return handleResponse(res);
  },

  deleteUser: async (userId: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  getReports: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetchWithAuth(`${API_BASE}/admin/reports${query}`);
    return handleResponse(res);
  },

  resolveReport: async (reportId: string, action: string, notes?: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/reports/${reportId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ action, notes }),
    });
    return handleResponse(res);
  },

  deleteReportedContent: async (reportId: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/flagged-content/report-${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'reject' }),
    });
    return handleResponse(res);
  },

  getSubscriptionsRevenue: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/subscriptions-revenue`);
    return handleResponse(res);
  },

  getPremiumMembers: async (params?: {
    page?: number; limit?: number; search?: string;
    source?: string; plan?: string; status?: string; autoRenew?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.source) query.set('source', params.source);
    if (params?.plan) query.set('plan', params.plan);
    if (params?.status) query.set('status', params.status);
    if (params?.autoRenew) query.set('autoRenew', params.autoRenew);
    const res = await fetchWithAuth(`${API_BASE}/admin/premium-members?${query}`);
    return handleResponse(res);
  },

  lookupUsers: async (q: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/lookup?q=${encodeURIComponent(q)}`);
    return handleResponse(res);
  },

  grantPremium: async (userId: string, payload: { durationDays: number; reason?: string }) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/grant-premium`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  revokePremium: async (userId: string, reason?: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/revoke-premium`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  getVerifications: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/verifications`);
    return handleResponse(res);
  },

  revokeVerification: async (userId: string, reason: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/revoke-verification/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  approveVerification: async (userId: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/verifications/${userId}/approve`, {
      method: 'PUT',
    });
    return handleResponse(res);
  },

  rejectVerification: async (userId: string, reason?: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/verifications/${userId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  verifyFace: async (userId: string): Promise<{
    success: boolean;
    verified: boolean;
    similarity: number;
    distance?: number;
    liveness: { passed: boolean; issues: string[] };
    error?: string;
    message?: string;
  }> => {
    const res = await fetchWithAuth(`${API_BASE}/verification/verify-face/by-url`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return handleResponse(res);
  },

  deleteStory: async (storyId: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/stories/${storyId}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  getAnalytics: async (period: '7d' | '30d' = '7d') => {
    const res = await fetchWithAuth(`${API_BASE}/admin/analytics?period=${encodeURIComponent(period)}`);
    return handleResponse(res);
  },

  getFlaggedContent: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetchWithAuth(`${API_BASE}/admin/flagged-content${query}`);
    return handleResponse(res);
  },

  moderateContent: async (contentId: string, action: 'approve' | 'reject') => {
    const res = await fetchWithAuth(`${API_BASE}/admin/flagged-content/${contentId}`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    });
    return handleResponse(res);
  },

  sendBroadcast: async (payload: {
    title: string;
    body: string;
    target: string;
    imageUrl?: string;
    scheduled?: boolean;
  }) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/broadcasts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  getBroadcastHistory: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/broadcasts`);
    return handleResponse(res);
  },

  getScheduledBroadcasts: async (limit = 100) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/scheduled-broadcasts?limit=${limit}`);
    return handleResponse(res);
  },

  scheduleBroadcast: async (payload: {
    title: string;
    body: string;
    target: string;
    imageUrl?: string;
    scheduledAt: string;
  }) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/scheduled-broadcasts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  cancelScheduledBroadcast: async (id: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/scheduled-broadcasts/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  fireScheduledBroadcast: async (id: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/scheduled-broadcasts/${id}/fire`, { method: 'POST' });
    return handleResponse(res);
  },

  updateAppSettings: async (settings: Record<string, unknown>) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return handleResponse(res);
  },

  getAppSettings: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/settings`);
    return handleResponse(res);
  },

  activateKillSwitch: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/kill-switch`, { method: 'POST' });
    return handleResponse(res);
  },

  deactivateKillSwitch: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/kill-switch/deactivate`, { method: 'POST' });
    return handleResponse(res);
  },

  getSupportTickets: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetchWithAuth(`${API_BASE}/admin/support-tickets${query}`);
    return handleResponse(res);
  },

  replySupportTicket: async (ticketId: string, content: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/support-tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return handleResponse(res);
  },

  updateSupportTicketStatus: async (ticketId: string, status: 'open' | 'in-progress' | 'closed') => {
    const res = await fetchWithAuth(`${API_BASE}/admin/support-tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  getAllSupportTickets: async (params?: { status?: string; category?: string; priority?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.category) query.set('category', params.category);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.page) query.set('page', String(params.page));
    const res = await fetchWithAuth(`${API_BASE}/support/all?${query}`);
    return handleResponse(res);
  },

  getSupportTicket: async (ticketId: string) => {
    const res = await fetchWithAuth(`${API_BASE}/support/ticket/${ticketId}`);
    return handleResponse(res);
  },

  replySupportUnified: async (ticketId: string, content: string) => {
    const res = await fetchWithAuth(`${API_BASE}/support/reply`, {
      method: 'POST',
      body: JSON.stringify({ ticketId, content }),
    });
    return handleResponse(res);
  },

  updateSupportStatus: async (ticketId: string, status: string) => {
    const res = await fetchWithAuth(`${API_BASE}/support/status`, {
      method: 'PATCH',
      body: JSON.stringify({ ticketId, status }),
    });
    return handleResponse(res);
  },

  assignSupportTicket: async (ticketId: string, agentId: string | null) => {
    const res = await fetchWithAuth(`${API_BASE}/support/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ ticketId, agentId }),
    });
    return handleResponse(res);
  },

  getSupportAgents: async () => {
    const res = await fetchWithAuth(`${API_BASE}/support/agents`);
    return handleResponse(res);
  },

  getChurnOverview: async () => {
    const res = await fetchWithAuth(`${API_BASE}/engagement/admin/churn-overview`);
    return handleResponse(res);
  },

  getAppeals: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/appeals`);
    return handleResponse(res);
  },

  reviewAppeal: async (userId: string, action: 'approve' | 'reject', adminResponse?: string) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/appeals/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ action, adminResponse }),
    });
    return handleResponse(res);
  },

  getUserDemographics: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/user-demographics`);
    return handleResponse(res);
  },

  getRevenueHistory: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/revenue-history`);
    return handleResponse(res);
  },

  getBoostsRevenue: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/boosts-revenue`);
    return handleResponse(res);
  },

  updateAdminProfile: async (payload: { name?: string; email?: string; avatar?: string }) => {
    const res = await fetchWithAuth(`${API_BASE}/admin/profile`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  getRecentActivity: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/recent-activity`);
    return handleResponse(res);
  },

  listIcebreakers: async () => {
    const res = await fetchWithAuth(`${API_BASE}/icebreakers/admin`);
    return handleResponse(res);
  },
  createIcebreaker: async (payload: { category: string; question: string; relatedInterests: string[]; isActive?: boolean }) => {
    const res = await fetchWithAuth(`${API_BASE}/icebreakers/admin`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
  updateIcebreaker: async (id: string, payload: Partial<{ category: string; question: string; relatedInterests: string[]; isActive: boolean }>) => {
    const res = await fetchWithAuth(`${API_BASE}/icebreakers/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
  deleteIcebreaker: async (id: string) => {
    const res = await fetchWithAuth(`${API_BASE}/icebreakers/admin/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  getSentryConfig: async () => {
    const res = await fetchWithAuth(`${API_BASE}/admin/sentry/config`);
    return handleResponse(res);
  },
  getSentryOverview: async (range: '24h' | '7d' | '14d' | '30d' = '24h', project?: string) => {
    const params = new URLSearchParams({ range });
    if (project) params.set('project', project);
    const res = await fetchWithAuth(`${API_BASE}/admin/sentry/overview?${params.toString()}`);
    return handleResponse(res);
  },
};

export default adminApi;
