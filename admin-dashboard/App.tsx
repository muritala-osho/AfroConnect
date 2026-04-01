import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
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
import Appeals from './views/Appeals';
import { AuthState, AdminRole } from './types';
import { LogIn, ShieldCheck, Sun, Moon, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { adminApi, clearToken } from './services/adminApi';

const ALL_TABS = ['dashboard', 'users', 'analytics', 'payments', 'reports', 'content', 'settings', 'verification', 'profile', 'broadcasts', 'support', 'appeals'];


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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('afroconnect_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('afroconnect_auth', JSON.stringify(auth));
  }, [auth]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
  };

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await adminApi.login(loginEmail, loginPassword);
      if (!data.user?.isAdmin) {
        clearToken();
        setLoginError('Access denied. Admin privileges required.');
        setLoginLoading(false);
        return;
      }
      setAuth({
        isAuthenticated: true,
        user: {
          name: data.user.name,
          role: AdminRole.SUPER_ADMIN,
          email: data.user.email,
          avatar: data.user.photos?.[0] || undefined,
        },
      });
      showToast('Access authorized. Welcome back.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, user: null });
    localStorage.removeItem('afroconnect_auth');
    clearToken();
    showToast('Session terminated safely.', 'success');
  };

  const handleUpdateAdminProfile = (updatedAdmin: AuthState['user']) => {
    setAuth(prev => ({ ...prev, user: updatedAdmin }));
    showToast('Profile updated successfully.', 'success');
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-teal-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-cyan-400/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-teal-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-teal-100 dark:border-slate-800 relative z-10">
          <div className="p-10 text-center bg-teal-600 dark:bg-teal-800 text-white relative overflow-hidden">
            <button
              onClick={toggleTheme}
              className="absolute top-4 right-4 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="h-28 w-28 bg-white rounded-[2.5rem] mx-auto flex items-center justify-center mb-6 shadow-2xl overflow-hidden">
              <img src="/afroconnect-logo.png" alt="AfroConnect" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">AfroConnect</h2>
            <p className="text-teal-100 text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-80">Admin Command Center</p>
          </div>

          <form className="p-10 space-y-8" onSubmit={handleLogin}>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="admin@afroconnect.app"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white font-medium"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl">
                <AlertCircle size={16} className="text-rose-500 shrink-0" />
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-5 bg-teal-600 dark:bg-teal-500 text-white font-black rounded-2xl hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center uppercase tracking-widest text-xs active:scale-[0.98] disabled:opacity-60"
            >
              {loginLoading ? <Loader2 size={20} className="mr-3 animate-spin" /> : <LogIn size={20} className="mr-3" />}
              {loginLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="px-10 pb-8 text-center">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">
              Secured • JWT Protected • Admin Only
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminRole={auth.user?.role || AdminRole.SUPPORT}
        adminName={auth.user?.name || 'Admin'}
        adminAvatar={auth.user?.avatar}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
              <ShieldCheck size={14} className="text-emerald-500 mr-2" />
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">System Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-500 dark:text-slate-400 hover:text-teal-500 transition-all border border-gray-100 dark:border-slate-700"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-100 dark:border-slate-800">
              <div className="hidden sm:flex flex-col items-end cursor-pointer" onClick={() => setActiveTab('profile')}>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-none mb-0.5">{auth.user?.name}</p>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-black uppercase tracking-widest">{auth.user?.role}</p>
              </div>
              <img
                src={auth.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(auth.user?.name || 'Admin')}&background=14b8a6&color=fff&bold=true`}
                className="h-10 w-10 rounded-xl shadow border-2 border-white dark:border-slate-800 hover:scale-105 transition-transform cursor-pointer object-cover"
                alt="Admin"
                onClick={() => setActiveTab('profile')}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard'    && <DashboardHome />}
            {activeTab === 'users'        && <UserManagement showToast={showToast} />}
            {activeTab === 'analytics'    && <Analytics />}
            {activeTab === 'payments'     && <Payments />}
            {activeTab === 'reports'      && <ReportsQueue />}
            {activeTab === 'content'      && <ContentModeration showToast={showToast} />}
            {activeTab === 'support'      && <SupportDesk showToast={showToast} />}
            {activeTab === 'settings'     && <SystemSettings showToast={showToast} />}
            {activeTab === 'verification' && <IDVerification />}
            {activeTab === 'broadcasts'   && <Broadcasts showToast={showToast} />}
            {activeTab === 'appeals'      && <Appeals showToast={showToast} />}
            {activeTab === 'profile'      && <AdminProfile auth={auth} onUpdate={handleUpdateAdminProfile} showToast={showToast} />}

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
          </div>
        </div>
      </main>

      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-fadeIn">
          <div
            className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md ${
              notification.type === 'success'
                ? 'bg-emerald-500/90 text-white border-emerald-400'
                : 'bg-rose-500/90 text-white border-rose-400'
            }`}
          >
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
};

export default App;
