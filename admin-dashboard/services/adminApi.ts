const API_BASE = '/api';

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

  // ─── Legacy admin support routes (kept for backward compat) ───────────────
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

  // ─── Unified support system endpoints ─────────────────────────────────────

  // GET /api/support/all — admin sees all, agent sees assigned only
  getAllSupportTickets: async (params?: { status?: string; category?: string; priority?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.category) query.set('category', params.category);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.page) query.set('page', String(params.page));
    const res = await fetch(`${API_BASE}/support/all?${query}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  // GET /api/support/ticket/:id — fetch single ticket with messages
  getSupportTicket: async (ticketId: string) => {
    const res = await fetch(`${API_BASE}/support/ticket/${ticketId}`, { headers: authHeaders() });
    return handleResponse(res);
  },

  // POST /api/support/reply — unified reply for admin/agent/user
  replySupportUnified: async (ticketId: string, content: string) => {
    const res = await fetch(`${API_BASE}/support/reply`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ticketId, content }),
    });
    return handleResponse(res);
  },

  // PATCH /api/support/status — update ticket status
  updateSupportStatus: async (ticketId: string, status: string) => {
    const res = await fetch(`${API_BASE}/support/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ ticketId, status }),
    });
    return handleResponse(res);
  },

  // PATCH /api/support/assign — assign ticket to agent (admin only)
  assignSupportTicket: async (ticketId: string, agentId: string | null) => {
    const res = await fetch(`${API_BASE}/support/assign`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ ticketId, agentId }),
    });
    return handleResponse(res);
  },

  // GET /api/support/agents — list all staff users
  getSupportAgents: async () => {
    const res = await fetch(`${API_BASE}/support/agents`, { headers: authHeaders() });
    return handleResponse(res);
  },

  // ─── Churn & appeals ──────────────────────────────────────────────────────
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
};

export default adminApi;
