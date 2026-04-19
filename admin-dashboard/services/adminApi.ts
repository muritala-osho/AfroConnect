const _viteApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const API_BASE = _viteApiUrl ? `${_viteApiUrl}/api` : '/api';

const getToken = (): string | null => localStorage.getItem('afroconnect_token');

export const setToken = (token: string) => localStorage.setItem('afroconnect_token', token);
export const clearToken = () => localStorage.removeItem('afroconnect_token');

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const handleResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 401) {
      clearToken();
      window.location.reload();
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
      window.location.reload();
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
    if (data.success && data.token) setToken(data.token);
    return data;
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getActivityMonitoring: async () => {
    const res = await fetch(`${API_BASE}/admin/activity-monitoring`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getUsers: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    const res = await fetch(`${API_BASE}/admin/users?${query}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getUser: async (userId: string) => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  banUser: async (userId: string, banned: boolean, reason?: string) => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/ban`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ banned, reason }),
    });
    return handleResponse(res);
  },

  suspendUser: async (userId: string, suspended: boolean, days?: number) => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/suspend`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ suspended, days }),
    });
    return handleResponse(res);
  },

  deleteUser: async (userId: string) => {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  getReports: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/admin/reports${query}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  resolveReport: async (reportId: string, action: string, notes?: string) => {
    const res = await fetch(`${API_BASE}/admin/reports/${reportId}/resolve`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ action, notes }),
    });
    return handleResponse(res);
  },

  deleteReportedContent: async (reportId: string) => {
    const res = await fetch(`${API_BASE}/admin/flagged-content/report-${reportId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'reject' }),
    });
    return handleResponse(res);
  },

  getSubscriptionsRevenue: async () => {
    const res = await fetch(`${API_BASE}/admin/subscriptions-revenue`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getVerifications: async () => {
    const res = await fetch(`${API_BASE}/admin/verifications`, { headers: authHeaders() });
    return handleResponse(res);
  },

  approveVerification: async (userId: string) => {
    const res = await fetch(`${API_BASE}/admin/verifications/${userId}/approve`, {
      method: 'PUT',
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  rejectVerification: async (userId: string, reason?: string) => {
    const res = await fetch(`${API_BASE}/admin/verifications/${userId}/reject`, {
      method: 'PUT',
      headers: authHeaders(),
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
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/verification/verify-face/by-url`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return handleResponse(res);
  },

  deleteStory: async (storyId: string) => {
    const res = await fetch(`${API_BASE}/admin/stories/${storyId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  getAnalytics: async () => {
    const res = await fetch(`${API_BASE}/admin/analytics`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getFlaggedContent: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/admin/flagged-content${query}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  moderateContent: async (contentId: string, action: 'approve' | 'reject') => {
    const res = await fetch(`${API_BASE}/admin/flagged-content/${contentId}`, {
      method: 'PUT',
      headers: authHeaders(),
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
    const res = await fetch(`${API_BASE}/admin/broadcasts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  getBroadcastHistory: async () => {
    const res = await fetch(`${API_BASE}/admin/broadcasts`, { headers: authHeaders() });
    return handleResponse(res);
  },

  updateAppSettings: async (settings: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res);
  },

  getAppSettings: async () => {
    const res = await fetch(`${API_BASE}/admin/settings`, { headers: authHeaders() });
    return handleResponse(res);
  },

  activateKillSwitch: async () => {
    const res = await fetch(`${API_BASE}/admin/kill-switch`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  deactivateKillSwitch: async () => {
    const res = await fetch(`${API_BASE}/admin/kill-switch/deactivate`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleResponse(res);
  },

  getSupportTickets: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/admin/support-tickets${query}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  replySupportTicket: async (ticketId: string, content: string) => {
    const res = await fetch(`${API_BASE}/admin/support-tickets/${ticketId}/reply`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    });
    return handleResponse(res);
  },

  updateSupportTicketStatus: async (ticketId: string, status: 'open' | 'in-progress' | 'closed') => {
    const res = await fetch(`${API_BASE}/admin/support-tickets/${ticketId}/status`, {
      method: 'PUT',
      headers: authHeaders(),
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
    const res = await fetch(`${API_BASE}/support/all?${query}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getSupportTicket: async (ticketId: string) => {
    const res = await fetch(`${API_BASE}/support/ticket/${ticketId}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  replySupportUnified: async (ticketId: string, content: string) => {
    const res = await fetch(`${API_BASE}/support/reply`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ticketId, content }),
    });
    return handleResponse(res);
  },

  updateSupportStatus: async (ticketId: string, status: string) => {
    const res = await fetch(`${API_BASE}/support/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ ticketId, status }),
    });
    return handleResponse(res);
  },

  assignSupportTicket: async (ticketId: string, agentId: string | null) => {
    const res = await fetch(`${API_BASE}/support/assign`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ ticketId, agentId }),
    });
    return handleResponse(res);
  },

  getSupportAgents: async () => {
    const res = await fetch(`${API_BASE}/support/agents`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getChurnOverview: async () => {
    const res = await fetch(`${API_BASE}/engagement/admin/churn-overview`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getAppeals: async () => {
    const res = await fetch(`${API_BASE}/admin/appeals`, { headers: authHeaders() });
    return handleResponse(res);
  },

  reviewAppeal: async (userId: string, action: 'approve' | 'reject', adminResponse?: string) => {
    const res = await fetch(`${API_BASE}/admin/appeals/${userId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ action, adminResponse }),
    });
    return handleResponse(res);
  },

  getUserDemographics: async () => {
    const res = await fetch(`${API_BASE}/admin/user-demographics`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getRevenueHistory: async () => {
    const res = await fetch(`${API_BASE}/admin/revenue-history`, { headers: authHeaders() });
    return handleResponse(res);
  },

  getBoostsRevenue: async () => {
    const res = await fetch(`${API_BASE}/admin/boosts-revenue`, { headers: authHeaders() });
    return handleResponse(res);
  },

  updateAdminProfile: async (payload: { name?: string; email?: string; avatar?: string }) => {
    const res = await fetch(`${API_BASE}/admin/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  getRecentActivity: async () => {
    const res = await fetch(`${API_BASE}/admin/recent-activity`, { headers: authHeaders() });
    return handleResponse(res);
  },
};

export default adminApi;
