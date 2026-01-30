import React from 'react';
import { NAV_ITEMS } from '../constants';
import { AdminRole } from '../types';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminRole: AdminRole;
  adminName: string;
  adminAvatar?: string;
  onLogout: () => void;
}

const AfroLogo = () => (
  <svg width="60" height="60" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M100 20C55.8 20 20 55.8 20 100C20 144.2 55.8 180 100 180C144.2 180 180 144.2 180 100C180 55.8 144.2 20 100 20Z" fill="#14B8A6"/>
    <path d="M75 90C75 80 85 75 100 75C115 75 125 80 125 90V130C125 135 120 140 115 140H85C80 140 75 135 75 130V90Z" fill="white"/>
    <circle cx="100" cy="55" r="20" fill="white"/>
    <path d="M100 25C108 25 115 32 115 40C115 48 108 55 100 55C92 55 85 48 85 40C85 32 92 25 100 25Z" fill="#2DD4BF"/>
    <path d="M100 10C115 10 125 20 125 35C125 50 115 60 100 60C85 60 75 50 75 35C75 20 85 10 100 10Z" fill="#2DD4BF" opacity="0.3"/>
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, adminRole, adminName, adminAvatar, onLogout }) => {
  const filteredItems = NAV_ITEMS.filter(item => item.roles.includes(adminRole));

  return (
    <div className="flex flex-col h-screen w-64 bg-teal-900 text-white transition-all duration-300 dark:bg-slate-900 border-r border-teal-800 dark:border-slate-800 shrink-0">
      <div className="flex flex-col items-center justify-center py-8 border-b border-teal-800 dark:border-slate-800">
        <div className="mb-2 hover:scale-105 transition-transform cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <AfroLogo />
        </div>
        <span className="text-xl font-bold tracking-tight">Afro<span className="text-cyan-400">Connect</span></span>
        <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest mt-1 opacity-80">Admin Command</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-6 mb-4 text-xs font-semibold text-teal-400 dark:text-slate-500 uppercase tracking-widest">
          Main Console
        </div>
        <nav className="space-y-1 px-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-teal-700 dark:bg-cyan-600 text-white shadow-lg translate-x-1 border-l-4 border-cyan-400' 
                  : 'text-teal-100 hover:bg-teal-800 dark:hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`mr-3 transition-transform ${activeTab === item.id ? 'scale-110 text-cyan-400' : ''}`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-teal-800 dark:border-slate-800">
        <div className="flex items-center mb-4 px-2 group cursor-pointer" onClick={() => setActiveTab('profile')}>
          <div className="relative">
            <img 
              src={adminAvatar || `https://ui-avatars.com/api/?name=${adminName}&background=14b8a6&color=fff&bold=true`} 
              className="h-10 w-10 rounded-xl border-2 border-teal-700 group-hover:border-cyan-400 transition-colors object-cover" 
              alt="Admin"
            />
            <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-teal-900"></div>
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">{adminName}</p>
            <p className="text-[10px] text-teal-400 dark:text-slate-500 uppercase font-black">{adminRole}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-bold text-teal-100 hover:text-white hover:bg-red-600/20 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-xl transition-all group"
        >
          <LogOut size={18} className="mr-3 group-hover:-translate-x-1 transition-transform" />
          Terminate
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
