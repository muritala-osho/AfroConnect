import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import NotificationCenter from './components/NotificationCenter';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardHome from './views/DashboardHome';
import UserManagement from './views/UserManagement';
import Analytics from './views/Analytics';
import Payments from './views/Payments';
import ReportsQueue from './views/ReportsQueue';
import SystemSettings from './views/SystemSettings';
import IDVerification from './views/IDVerification';
import AdminProfile from './views/AdminProfile';
import Broadcasts from './views/Broadcasts';
import ContentModeration from './views/ContentModeration';
import SupportDesk from './views/SupportDesk';
import AgentDashboard from './views/AgentDashboard';
import Appeals from './views/Appeals';
import ChurnIntelligence from './views/ChurnIntelligence';
import AuditLog from './views/AuditLog';
import RevokeVerification from './views/RevokeVerification';
import { AuthState, AdminRole } from './types';
import { NAV_ITEMS } from './constants';
import { LogIn, ShieldCheck, Sun, Moon, CheckCircle, AlertCircle, X, Loader2, Lock, Search } from 'lucide-react';
import { adminApi, clearToken } from './services/adminApi';
import { AuthProvider } from './contexts/AuthContext';
import AccessDenied from './components/AccessDenied';

const ALL_TABS = ['dashboard', 'users', 'analytics', 'payments', 'reports', 'content', 'settings', 'verification', 'revoke-verification', 'profile', 'broadcasts', 'support', 'agent', 'appeals', 'churn', 'audit'];

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const BADGE_POLL_MS = 90_000;

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', users: 'User Management', analytics: 'Analytics',
  payments: 'Finances & Revenue', reports: 'Safety Reports', content: 'Content Moderation',
  support: 'Support Desk', agent: 'My Tickets', settings: 'System Settings',
  verification: 'Verification Requests', 'revoke-verification': 'Revoke Verified Badge',
  broadcasts: 'Broadcasts', appeals: 'Appeals',
  churn: 'Churn Intelligence', profile: 'My Profile', audit: 'Audit Log',
};

interface PendingCounts { reports: number; verifications: number; tickets: number; unreadTickets: number }

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const saved = localStorage.getItem('afroconnect_auth');
      return saved ? JSON.parse(saved) : { isAuthenticated: false, user: null };
    } catch {
      return { isAuthenticated: false, user: null };
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('afroconnect_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; id: number } | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({ reports: 0, verifications: 0, tickets: 0, unreadTickets: 0 });
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifIdRef = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('afroconnect_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('afroconnect_auth', JSON.stringify(auth));
  }, [auth]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    notifIdRef.current += 1;
    setNotification({ message, type, id: notifIdRef.current });
  }, []);

  const handleLogout = useCallback(() => {
    setAuth({ isAuthenticated: false, user: null });
    localStorage.removeItem('afroconnect_auth');
    clearToken();
    setPendingCounts({ reports: 0, verifications: 0, tickets: 0, unreadTickets: 0 });
    showToast('Session terminated safely.', 'success');
  }, [showToast]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        handleLogout();
        setNotification({ message: 'Session expired due to inactivity.', type: 'error', id: ++notifIdRef.current });
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [auth.isAuthenticated, handleLogout]);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const id = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutRemaining]);

  const fetchBadgeCounts = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    try {
      const [rRes, vRes, tRes] = await Promise.allSettled([
        adminApi.getReports('pending'),
        adminApi.getVerifications(),
        adminApi.getAllSupportTickets(),
      ]);
      const allTickets: any[] = tRes.status === 'fulfilled' && tRes.value?.success ? (tRes.value.tickets || []) : [];
      setPendingCounts({
        reports:       rRes.status === 'fulfilled' && rRes.value?.success ? (rRes.value.reports?.length || 0) : 0,
        verifications: vRes.status === 'fulfilled' && vRes.value?.success ? (vRes.value.verifications?.length || 0) : 0,
        tickets:       allTickets.filter((t: any) => t.status === 'open').length,
        unreadTickets: allTickets.filter((t: any) => (t.unreadByAgent ?? 0) > 0).length,
      });
    } catch {
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    fetchBadgeCounts();
    const interval = setInterval(fetchBadgeCounts, BADGE_POLL_MS);
    return () => clearInterval(interval);
  }, [auth.isAuthenticated, fetchBadgeCounts]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab('users');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const canAccessTab = (tabId: string): boolean => {
    const role = auth.user?.role;
    if (!role) return false;
    const item = NAV_ITEMS.find(n => n.id === tabId);
    if (!item) return true;
    return item.roles.includes(role);
  };

  const getDefaultTabForRole = (role?: AdminRole): string => {
    if (role === AdminRole.SUPPORT) return 'agent';
    return 'dashboard';
  };

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.role) return;
    if (!canAccessTab(activeTab)) {
      setActiveTab(getDefaultTabForRole(auth.user.role));
    }
  }, [auth.isAuthenticated, auth.user?.role, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await adminApi.login(loginEmail, loginPassword);
      const isAdmin = data.user?.isAdmin;
      const isAgent = data.user?.isSupportAgent;
      if (!isAdmin && !isAgent) {
        clearToken();
        setLoginError('Access denied. Staff privileges required.');
        setLoginLoading(false);
        return;
      }
      const isModerator = data.user?.isModerator || data.user?.role === 'moderator';
      const role = isAdmin ? AdminRole.SUPER_ADMIN : isModerator ? AdminRole.MODERATOR : AdminRole.SUPPORT;
      setLoginAttempts(0);
      setAuth({
        isAuthenticated: true,
        user: {
          name: data.user.name,
          role,
          email: data.user.email,
          avatar: data.user.photos?.[0]?.url || undefined,
        },
      });
      if (!isAdmin && isAgent) setActiveTab('agent');
      showToast(`Welcome back, ${data.user.name.split(' ')[0]}.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      const next = loginAttempts + 1;
      setLoginAttempts(next);
      if (next >= MAX_LOGIN_ATTEMPTS) {
        setLoginAttempts(0);
        setLockoutRemaining(LOCKOUT_SECONDS);
        setLoginError(`Too many failed attempts. Please wait ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setLoginError(`${msg} (${MAX_LOGIN_ATTEMPTS - next} attempt${MAX_LOGIN_ATTEMPTS - next === 1 ? '' : 's'} remaining)`);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleUpdateAdminProfile = (updatedAdmin: AuthState['user']) => {
    setAuth(prev => ({ ...prev, user: updatedAdmin }));
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-teal-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-cyan-400/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-teal-100 dark:border-slate-800 relative z-10 animate-scaleIn">
          <div className="p-10 text-center bg-teal-600 dark:bg-teal-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)' }} />
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="absolute top-4 right-4 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="h-28 w-28 bg-white rounded-[2.5rem] mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden">
              <img src="/afroconnect-logo.png" alt="AfroConnect" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">AfroConnect</h2>
            <p className="text-teal-100/70 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Staff Command Center</p>
          </div>

          <form className="p-10 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="admin@afroconnect.app"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white font-medium text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white font-medium text-sm"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="flex items-start gap-2.5 px-4 py-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl animate-fadeIn">
                <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{loginError}</span>
              </div>
            )}

            {lockoutRemaining > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl animate-fadeIn">
                <Lock size={16} className="text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Account locked. Try again in {lockoutRemaining}s.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading || lockoutRemaining > 0}
              className="w-full py-4 bg-teal-600 dark:bg-teal-500 text-white font-black rounded-2xl hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center uppercase tracking-widest text-xs active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed gap-3"
            >
              {loginLoading ? <Loader2 size={18} className="animate-spin" /> : lockoutRemaining > 0 ? <Lock size={18} /> : <LogIn size={18} />}
              {loginLoading ? 'Authenticating...' : lockoutRemaining > 0 ? `Locked (${lockoutRemaining}s)` : 'Sign In'}
            </button>
          </form>

          <div className="pb-8 text-center">
            <p className="text-[10px] text-gray-300 dark:text-slate-600 font-bold uppercase tracking-widest">
              Secured · JWT Protected · Admin Only
            </p>
          </div>
        </div>

        {notification && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-toastIn">
            <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
              notification.type === 'success'
                ? 'bg-emerald-500/95 text-white border-emerald-400'
                : 'bg-rose-500/95 text-white border-rose-400'
            }`}>
              {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-semibold">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-all">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const pageTitle = PAGE_TITLES[activeTab] || 'Dashboard';

  return (
    <AuthProvider auth={auth}>
      <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          adminRole={auth.user?.role || AdminRole.SUPPORT}
          adminName={auth.user?.name || 'Admin'}
          adminAvatar={auth.user?.avatar}
          onLogout={handleLogout}
          pendingCounts={pendingCounts}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-[60px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-6 z-10 shrink-0">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-[15px] font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                  {pageTitle}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">System Online</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canAccessTab('users') && (
                <button
                  onClick={() => setActiveTab('users')}
                  title="Search users (⌘K)"
                  className="hidden md:flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-gray-400 dark:text-slate-500 hover:text-teal-500 hover:border-teal-500/30 transition-all text-xs font-medium"
                >
                  <Search size={14} />
                  <span>Search</span>
                  <kbd className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-gray-100 dark:bg-slate-700 rounded-md tracking-widest">⌘K</kbd>
                </button>
              )}

              <NotificationCenter onNavigate={setActiveTab} />

              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-400 dark:text-slate-400 hover:text-teal-500 transition-all border border-gray-100 dark:border-slate-700"
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2.5 pl-2 ml-1 border-l border-gray-100 dark:border-slate-800 group"
              >
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-none group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {auth.user?.name?.split(' ')[0]}
                  </p>
                  <p className="text-[9px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-widest mt-0.5">
                    {auth.user?.role}
                  </p>
                </div>
                <div className="relative">
                  <img
                    src={auth.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(auth.user?.name || 'Admin')}&background=14b8a6&color=fff&bold=true`}
                    className="h-9 w-9 rounded-xl border-2 border-white dark:border-slate-800 group-hover:border-teal-400/50 hover:scale-105 transition-all object-cover shadow-sm"
                    alt="Admin"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(auth.user?.name || 'Admin')}&background=14b8a6&color=fff&bold=true`;
                    }}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                </div>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              <ErrorBoundary key={activeTab} onReset={() => setActiveTab('dashboard')}>
                {activeTab === 'dashboard'    && canAccessTab('dashboard')    && <DashboardHome />}
                {activeTab === 'users'        && canAccessTab('users')        && <UserManagement showToast={showToast} />}
                {activeTab === 'analytics'    && canAccessTab('analytics')    && <Analytics />}
                {activeTab === 'payments'     && canAccessTab('payments')     && <Payments />}
                {activeTab === 'reports'      && canAccessTab('reports')      && <ReportsQueue showToast={showToast} />}
                {activeTab === 'content'      && canAccessTab('content')      && <ContentModeration showToast={showToast} />}
                {activeTab === 'support'      && canAccessTab('support')      && <SupportDesk showToast={showToast} />}
                {activeTab === 'agent'        && canAccessTab('agent')        && <AgentDashboard showToast={showToast} />}
                {activeTab === 'settings'     && canAccessTab('settings')     && <SystemSettings showToast={showToast} />}
                {activeTab === 'verification'        && canAccessTab('verification')        && <IDVerification showToast={showToast} />}
                {activeTab === 'revoke-verification' && canAccessTab('revoke-verification') && <RevokeVerification showToast={showToast} />}
                {activeTab === 'broadcasts'   && canAccessTab('broadcasts')   && <Broadcasts showToast={showToast} />}
                {activeTab === 'appeals'      && canAccessTab('appeals')      && <Appeals showToast={showToast} />}
                {activeTab === 'churn'        && canAccessTab('churn')        && <ChurnIntelligence showToast={showToast} />}
                {activeTab === 'audit'        && canAccessTab('audit')        && <AuditLog />}
                {activeTab === 'profile'      && canAccessTab('profile')      && <AdminProfile auth={auth} onUpdate={handleUpdateAdminProfile} showToast={showToast} />}

                {ALL_TABS.includes(activeTab) && !canAccessTab(activeTab) && (
                  <AccessDenied
                    currentRole={auth.user?.role}
                    requiredRoles={NAV_ITEMS.find(n => n.id === activeTab)?.roles}
                    section={NAV_ITEMS.find(n => n.id === activeTab)?.label}
                    onBack={() => setActiveTab(getDefaultTabForRole(auth.user?.role))}
                  />
                )}

                {!ALL_TABS.includes(activeTab) && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-12 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-slate-800 animate-fadeIn">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Module Not Found</h3>
                    <p className="text-gray-500 dark:text-slate-400 mb-8">This section is under development.</p>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="px-8 py-3 bg-teal-600 text-white font-bold rounded-2xl hover:bg-teal-700 transition-all"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
        </main>

        {notification && (
          <div key={notification.id} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-toastIn">
            <div
              className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md min-w-[280px] ${
                notification.type === 'success'
                  ? 'bg-emerald-500/95 text-white border-emerald-400/50'
                  : 'bg-rose-500/95 text-white border-rose-400/50'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-semibold flex-1">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthProvider>
  );
};

export default App;
