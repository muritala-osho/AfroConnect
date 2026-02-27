const API_BASE = window.location.origin;
let authToken = localStorage.getItem('admin_token') || '';

async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  return res.json();
}

function logout() {
  authToken = '';
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  location.reload();
}

function showDashboard(user) {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('dashboardContainer').style.display = 'flex';
  if (user) {
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = user.name || 'Admin';
    const roleEl = document.getElementById('adminRole');
    if (roleEl) roleEl.textContent = user.isAdmin ? 'Super Admin' : 'Admin';
    const avatarEl = document.getElementById('adminAvatar');
    if (avatarEl && user.photos && user.photos[0]) avatarEl.src = user.photos[0];
  }
  initDashboardEvents();
  loadDashboardStats();
  loadUsers();
  loadReports();
  loadPayments();
  loadSupportTickets();
  setTimeout(initCharts, 100);
}

function showLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('dashboardContainer').style.display = 'none';
}

async function validateToken() {
  if (!authToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) return false;
    const data = await res.json();
    const user = data.user || data.data;
    if (!user || !user.isAdmin) return false;
    localStorage.setItem('admin_user', JSON.stringify(user));
    return user;
  } catch (e) {
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');

    errorEl.style.display = 'none';
    btn.disabled = true;
    btnText.textContent = 'Signing in...';
    spinner.style.display = 'inline-block';

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const user = data.user || data.data;
      const token = data.token;

      if (!user || !user.isAdmin) {
        throw new Error('Access denied. Admin privileges required.');
      }

      authToken = token;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      showDashboard(user);
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed. Please try again.';
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Sign In';
      spinner.style.display = 'none';
    }
  });

  if (authToken) {
    const user = await validateToken();
    if (user) {
      showDashboard(user);
    } else {
      authToken = '';
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      showLogin();
    }
  } else {
    showLogin();
  }
});

function initDashboardEvents() {
  const navItems = document.querySelectorAll('.sidebar nav li');
  const tabContents = document.querySelectorAll('.tab-content');
  const themeToggle = document.getElementById('themeToggle');
  const profileTrigger = document.getElementById('adminProfileTrigger');
  const profileModal = document.getElementById('profileModal');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      tabContents.forEach(t => t.classList.remove('active'));
      const target = document.getElementById(tab);
      if (target) target.classList.add('active');
      if (tab === 'dashboard') loadDashboardStats();
      if (tab === 'users') loadUsers();
      if (tab === 'moderation') loadReports();
      if (tab === 'payments') loadPayments();
      if (tab === 'support') loadSupportTickets();
    });
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      document.body.classList.toggle('light-theme');
      const icon = themeToggle.querySelector('i');
      if (icon) icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
    });
  }

  if (profileTrigger && profileModal) {
    profileTrigger.addEventListener('click', () => profileModal.classList.add('active'));
    profileModal.querySelectorAll('.close').forEach(c => c.addEventListener('click', () => profileModal.classList.remove('active')));
  }
}

async function loadDashboardStats() {
  try {
    const [statsRes, activityRes] = await Promise.all([
      apiCall('/api/admin/stats').catch(() => null),
      apiCall('/api/admin/activity-monitoring').catch(() => null)
    ]);

    if (statsRes && statsRes.data) {
      const s = statsRes.data;
      const statCards = document.querySelectorAll('#dashboard .stat-card');
      if (statCards[0]) statCards[0].querySelector('h3').textContent = (s.totalUsers || 0).toLocaleString();
      if (statCards[2]) statCards[2].querySelector('h3').textContent = (s.totalMatches || 0).toLocaleString();
      if (statCards[3]) statCards[3].querySelector('h3').textContent = '$' + (s.monthlyRevenue || 0).toLocaleString();
    }

    if (activityRes && activityRes.data) {
      const a = activityRes.data;
      const statCards = document.querySelectorAll('#dashboard .stat-card');
      if (statCards[1]) statCards[1].querySelector('h3').textContent = (a.active24h || 0).toLocaleString();
    }
  } catch (e) {
    console.log('Using static dashboard data');
  }
}

async function loadUsers() {
  try {
    const res = await apiCall('/api/admin/users');
    if (!res.data || !res.data.length) return;
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = res.data.slice(0, 50).map(u => `
      <tr>
        <td style="display:flex;align-items:center;gap:10px">
          <img src="${u.photos?.[0] || 'https://via.placeholder.com/32'}" style="width:32px;height:32px;border-radius:50%;object-fit:cover" onerror="this.src='https://via.placeholder.com/32'">
          <div>
            <strong>${u.name || 'Unknown'}</strong>
            <br><small style="color:var(--text-muted)">${u.email || ''}</small>
          </div>
        </td>
        <td><span class="badge-status ${u.isBanned ? 'badge-banned' : 'badge-active'}">${u.isBanned ? 'Banned' : 'Active'}</span></td>
        <td>${u.location?.city || u.location?.country || 'N/A'}</td>
        <td>${u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'N/A'}</td>
        <td>
          <button class="btn-sm btn-primary" onclick="viewUserDetail('${u._id}')">View</button>
          <button class="btn-sm ${u.isBanned ? 'btn-success' : 'btn-danger'}" onclick="toggleBan('${u._id}', ${!u.isBanned})">${u.isBanned ? 'Unban' : 'Ban'}</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.log('Could not load users');
  }
}

async function viewUserDetail(userId) {
  try {
    const res = await apiCall(`/api/admin/users/${userId}`);
    const u = res.data || res.user;
    if (!u) return;
    const modal = document.getElementById('userDetailModal');
    document.getElementById('detailUserAvatar').src = u.photos?.[0] || 'https://via.placeholder.com/120';
    document.getElementById('detailUserName').textContent = u.name || 'Unknown';
    document.getElementById('detailUserEmail').textContent = u.email || '';
    document.getElementById('detailUserStatus').innerHTML = `<span class="badge-status ${u.isBanned ? 'badge-banned' : 'badge-active'}">${u.isBanned ? 'Banned' : 'Active'}</span>`;
    document.getElementById('detailUserBio').textContent = u.bio || 'No bio';
    const picsGrid = document.getElementById('detailProfilePictures');
    picsGrid.innerHTML = (u.photos || []).map(p => `<img src="${p}" alt="Photo" onerror="this.src='https://via.placeholder.com/80'">`).join('');
    const vPhoto = document.getElementById('detailVerificationPhoto');
    if (vPhoto) vPhoto.src = u.verificationPhoto || 'https://via.placeholder.com/300x200?text=No+Photo';
    modal.classList.add('active');
  } catch (e) {
    alert('Could not load user details');
  }
}

function closeUserDetail() {
  document.getElementById('userDetailModal').classList.remove('active');
}

async function toggleBan(userId, ban) {
  try {
    await apiCall(`/api/admin/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ ban, reason: ban ? 'Admin action' : '' })
    });
    loadUsers();
  } catch (e) {
    alert('Action failed');
  }
}

async function loadReports() {
  try {
    const res = await apiCall('/api/admin/reports?status=pending');
    const reports = res.data || [];
    const container = document.getElementById('reportsContainer');
    if (!container) return;
    if (!reports.length) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending reports</p></div>';
      return;
    }
    container.innerHTML = reports.slice(0, 20).map(r => `
      <div class="report-card">
        <div class="report-header">
          <span class="report-reason">${r.reason || r.type || 'Report'}</span>
          <span class="report-date">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
        </div>
        <div class="report-users">
          <span>Reporter: ${r.reporter?.name || 'Anonymous'}</span> &rarr;
          <span>Reported: ${r.reported?.name || 'Unknown'}</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${r.description || ''}</p>
        <div class="report-actions">
          <button class="btn-sm btn-success" onclick="resolveReport('${r._id}', 'dismiss')">Dismiss</button>
          <button class="btn-sm btn-warning" onclick="resolveReport('${r._id}', 'warn')">Warn</button>
          <button class="btn-sm btn-danger" onclick="resolveReport('${r._id}', 'ban')">Ban</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.log('Could not load reports');
  }
}

async function resolveReport(reportId, action) {
  try {
    await apiCall(`/api/admin/reports/${reportId}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ action })
    });
    loadReports();
  } catch (e) {
    alert('Could not resolve report');
  }
}

async function loadPayments() {
  try {
    const res = await apiCall('/api/admin/subscriptions-revenue');
    if (res.data) {
      const d = res.data;
      const totalEl = document.getElementById('totalSubRevenue');
      const activeEl = document.getElementById('activeSubs');
      if (totalEl) totalEl.textContent = '$' + (d.estimatedMonthlyRevenue || 0).toLocaleString();
      if (activeEl) activeEl.textContent = (d.totalActive || 0).toLocaleString();
    }
  } catch (e) {
    console.log('Could not load payments');
  }
}

async function loadSupportTickets() {
  try {
    const res = await apiCall('/api/support/tickets');
    const tickets = res.data || res.tickets || [];
    const tbody = document.getElementById('supportTableBody');
    if (!tbody || !tickets.length) return;
    tbody.innerHTML = tickets.slice(0, 20).map(t => `
      <tr>
        <td>${(t._id || '').slice(-8)}</td>
        <td>${t.user?.name || t.userName || 'Unknown'}</td>
        <td>${t.subject || 'Contact'}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.message || ''}</td>
        <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</td>
        <td><span class="badge-status ${t.status === 'resolved' ? 'badge-active' : 'badge-pending'}">${t.status || 'Open'}</span></td>
      </tr>
    `).join('');
  } catch (e) {
    console.log('Could not load support tickets');
  }
}

function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af', font: { size: 12 } } } },
    scales: {
      x: { grid: { color: 'rgba(42,42,74,0.3)' }, ticks: { color: '#9ca3af' } },
      y: { grid: { color: 'rgba(42,42,74,0.3)' }, ticks: { color: '#9ca3af' } }
    }
  };

  const growthCtx = document.getElementById('growthChart');
  if (growthCtx) {
    new Chart(growthCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'New Users',
          data: [12000, 19000, 25000, 31000, 42000, 55000],
          borderColor: '#14b8a6',
          backgroundColor: 'rgba(20,184,166,0.1)',
          fill: true,
          tension: 0.4
        }, {
          label: 'Active Users',
          data: [8000, 15000, 20000, 27000, 35000, 45000],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6,182,212,0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: commonOptions
    });
  }

  const revenueCtx = document.getElementById('revenueChart');
  if (revenueCtx) {
    new Chart(revenueCtx, {
      type: 'doughnut',
      data: {
        labels: ['Subscriptions', 'Boosts', 'Super Likes'],
        datasets: [{
          data: [65, 25, 10],
          backgroundColor: ['#14b8a6', '#06b6d4', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9ca3af' } } } }
    });
  }

  const countryCtx = document.getElementById('countryChart');
  if (countryCtx) {
    new Chart(countryCtx, {
      type: 'bar',
      data: {
        labels: ['Nigeria', 'Ghana', 'UK', 'USA', 'Kenya', 'SA'],
        datasets: [{
          label: 'Users',
          data: [35000, 22000, 18000, 15000, 12000, 9000],
          backgroundColor: ['#14b8a6', '#2dd4bf', '#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc']
        }]
      },
      options: { ...commonOptions, plugins: { legend: { display: false } } }
    });
  }
}

