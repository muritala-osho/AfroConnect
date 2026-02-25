import React, { useState, useEffect } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardHome from './views/DashboardHome';
import UserManagement from './views/UserManagement';
import Analytics from './views/Analytics';
import Payments from './views/Payments';
import ReportsQueue from './views/ReportsQueue';
import SystemSettings from './views/SystemSettings';
import IDVerification from './views/IDVerification';
import AdminProfile from './views/AdminProfile';
import { AuthState, AdminRole, User } from './types';
import { LogIn, ShieldCheck, Github, Sun, Moon, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { adminApi, clearToken } from './services/adminApi';

const AfroLogo = () => (
  <svg width="100%" height="100%" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M100 20C55.8 20 20 55.8 20 100C20 144.2 55.8 180 100 180C144.2 180 180 144.2 180 100C180 55.8 144.2 20 100 20Z" fill="#14B8A6"/>
    <path d="M75 90C75 80 85 75 100 75C115 75 125 80 125 90V130C125 135 120 140 115 140H85C80 140 75 135 75 130V90Z" fill="white"/>
    <circle cx="100" cy="55" r="20" fill="white"/>
    <path d="M100 25C108 25 115 32 115 40C115 48 108 55 100 55C92 55 85 48 85 40C85 32 92 25 100 25Z" fill="#2DD4BF"/>
    <path d="M100 10C115 10 125 20 125 35C125 50 115 60 100 60C85 60 75 50 75 35C75 20 85 10 100 10Z" fill="#2DD4BF" opacity="0.3"/>
  </svg>
);

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('afroconnect_auth');
    return saved ? JSON.parse(saved) : { isAuthenticated: false, user: null };
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

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

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
          avatar: data.user.photos?.[0] || undefined
        }
      });
      showToast("Root access authorized. Synchronizing workspace...", "success");
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, user: null });
    localStorage.removeItem('afroconnect_auth');
    clearToken();
    showToast("Session terminated safely.", "success");
  };

  const handleUpdateAdminProfile = (updatedAdmin: any) => {
    setAuth(prev => ({ ...prev, user: updatedAdmin }));
    showToast("Admin identity synchronized.", "success");
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-teal-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-cyan-400/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-teal-600/10 blur-[100px] rounded-full"></div>

        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-teal-100 dark:border-slate-800 relative z-10 transition-all duration-300">
          <div className="p-10 text-center bg-teal-600 dark:bg-teal-700 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <button onClick={toggleTheme} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
            <div className="h-28 w-28 bg-white rounded-[2.5rem] mx-auto flex items-center justify-center mb-6 shadow-2xl p-4 transform hover:scale-105 transition-transform">
               <AfroLogo />
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight">AfroConnect</h2>
            <p className="text-teal-100 text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-80">Central Platform Command</p>
          </div>
          <form className="p-10 space-y-8" onSubmit={handleLogin}>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Administrator Handle</label>
                <input 
                  type="email" 
                  placeholder="admin@afroconnect.ai"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Security Key</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 focus:ring-2 focus:ring-teal-500 outline-none transition-all dark:text-white font-medium"
                  required
                />
              </div>
            </div>
            {loginError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
                <AlertCircle size={16} className="text-rose-500 shrink-0" />
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{loginError}</span>
              </div>
            )}
            <button 
              type="submit" 
              disabled={loginLoading}
              className="w-full py-5 bg-teal-600 dark:bg-teal-500 text-white font-black rounded-2xl hover:bg-teal-700 dark:hover:bg-teal-600 shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center uppercase tracking-widest text-xs active:scale-[0.98] disabled:opacity-60"
            >
              {loginLoading ? <Loader2 size={20} className="mr-3 animate-spin" /> : <LogIn size={20} className="mr-3" />}
              {loginLoading ? 'Authenticating...' : 'Authorize Access'}
            </button>
          </form>
          <div className="px-10 pb-10 text-center">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">Biometric Verification Enabled • V.2.4.1</p>
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
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 flex items-center justify-between px-10 z-10 shrink-0">
          <div className="flex items-center">
            <div className="flex items-center px-4 py-2 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl group cursor-help transition-all">
              <ShieldCheck size={16} className="text-emerald-500 mr-2 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Global Link Active</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleTheme}
              className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-500 dark:text-slate-400 hover:text-cyan-500 transition-all border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <div className="flex items-center gap-4 pl-6 border-l border-gray-100 dark:border-slate-800">
              <div className="hidden sm:flex flex-col items-end cursor-pointer" onClick={() => setActiveTab('profile')}>
                <p className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">{auth.user?.name}</p>
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-black uppercase tracking-widest">{auth.user?.role}</p>
              </div>
              <img 
                src={auth.user?.avatar || `https://ui-avatars.com/api/?name=${auth.user?.name}&background=14b8a6&color=fff&bold=true`} 
                className="h-11 w-11 rounded-[1.25rem] shadow-lg border-2 border-white dark:border-slate-800 hover:scale-105 transition-transform cursor-pointer object-cover"
                alt="Admin Avatar"
                onClick={() => setActiveTab('profile')}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardHome />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'analytics' && <Analytics />}
            {activeTab === 'payments' && <Payments />}
            {activeTab === 'reports' && <ReportsQueue />}
            {activeTab === 'settings' && <SystemSettings showToast={showToast} />}
            {activeTab === 'verification' && <IDVerification />}
            {activeTab === 'profile' && <AdminProfile auth={auth} onUpdate={handleUpdateAdminProfile} />}

            {!['dashboard', 'users', 'analytics', 'payments', 'reports', 'settings', 'verification', 'profile'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-12 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-slate-800 animate-fadeIn">
                <div className="bg-teal-50 dark:bg-teal-500/10 p-10 rounded-[2.5rem] mb-10 shadow-inner group">
                  <Github size={64} className="text-teal-400 dark:text-teal-500 group-hover:rotate-12 transition-transform" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">System Node Synchronizing</h3>
                <p className="text-gray-500 dark:text-slate-400 max-w-lg mx-auto font-medium leading-relaxed">
                  The <span className="text-cyan-500 font-bold uppercase tracking-widest text-xs">[{activeTab}]</span> module is undergoing core optimization. Full operational capability will be restored shortly.
                </p>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className="mt-10 px-10 py-4 bg-teal-600 text-white font-black rounded-2xl hover:bg-teal-700 shadow-2xl shadow-teal-500/30 transition-all uppercase tracking-widest text-xs active:scale-95"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>

        {notification && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-fadeIn">
            <div className={`px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border backdrop-blur-md ${
              notification.type === 'success' 
              ? 'bg-emerald-500/90 text-white border-emerald-400' 
              : 'bg-rose-500/90 text-white border-rose-400'
            }`}>
              {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="text-xs font-black uppercase tracking-widest">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-all">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
