import React, { useState } from 'react';
import { NAV_ITEMS } from '../constants';
import { AdminRole } from '../types';
import { LogOut, ChevronDown } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminRole: AdminRole;
  adminName: string;
  adminAvatar?: string;
  onLogout: () => void;
  pendingCounts?: { reports: number; verifications: number; tickets: number };
}

const SECTION_GROUPS = [
  {
    label: 'Overview',
    ids: ['dashboard'],
  },
  {
    label: 'Management',
    ids: ['users', 'verification', 'reports', 'content', 'appeals', 'churn'],
  },
  {
    label: 'Revenue',
    ids: ['payments', 'analytics'],
  },
  {
    label: 'Communication',
    ids: ['broadcasts', 'support', 'agent'],
  },
  {
    label: 'System',
    ids: ['settings', 'profile'],
  },
];

const BADGE_MAP: Record<string, keyof NonNullable<SidebarProps['pendingCounts']>> = {
  reports: 'reports',
  verification: 'verifications',
  support: 'tickets',
  agent: 'tickets',
};

const AfroLogo = () => (
  <img
    src="/logo.png"
    alt="AfroConnect"
    width={52}
    height={52}
    style={{ borderRadius: 14, objectFit: 'cover' }}
    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
  />
);

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  adminRole,
  adminName,
  adminAvatar,
  onLogout,
  pendingCounts,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const filteredItems = NAV_ITEMS.filter(item => item.roles.includes(adminRole));

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const getBadge = (id: string): number => {
    const key = BADGE_MAP[id];
    if (!key || !pendingCounts) return 0;
    return pendingCounts[key] || 0;
  };

  return (
    <div className="flex flex-col h-screen w-[220px] bg-[#0d3d38] text-white shrink-0 border-r border-white/5 select-none">
      <div
        className="flex flex-col items-center justify-center py-6 border-b border-white/5 cursor-pointer group"
        onClick={() => setActiveTab('dashboard')}
      >
        <div className="mb-2.5 group-hover:scale-105 transition-transform duration-200">
          <AfroLogo />
        </div>
        <span className="text-[15px] font-black tracking-tight">
          Afro<span className="text-teal-400">Connect</span>
        </span>
        <span className="text-[9px] font-black text-teal-500/70 uppercase tracking-[0.2em] mt-1">
          Staff Portal
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
        {SECTION_GROUPS.map(group => {
          const groupItems = filteredItems.filter(item => group.ids.includes(item.id));
          if (groupItems.length === 0) return null;
          const isCollapsed = collapsedSections[group.label];

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleSection(group.label)}
                className="flex items-center justify-between w-full px-4 py-2 text-[9px] font-black text-teal-500/60 uppercase tracking-[0.18em] hover:text-teal-400 transition-colors"
              >
                {group.label}
                <ChevronDown
                  size={10}
                  className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>

              {!isCollapsed && (
                <nav className="space-y-0.5 px-2">
                  {groupItems.map(item => {
                    const isActive = activeTab === item.id;
                    const badge = getBadge(item.id);

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-xl transition-all duration-150 group/item ${
                          isActive
                            ? 'bg-teal-600/30 text-white font-bold border-l-[3px] border-teal-400 pl-[9px]'
                            : 'text-teal-100/70 hover:bg-white/5 hover:text-white font-medium border-l-[3px] border-transparent pl-[9px]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`shrink-0 transition-colors ${isActive ? 'text-teal-400' : 'text-teal-500/50 group-hover/item:text-teal-400'}`}>
                            {item.icon}
                          </span>
                          <span className="truncate text-[13px]">{item.label}</span>
                        </div>

                        {badge > 0 && (
                          <span className="shrink-0 h-5 min-w-[20px] px-1.5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-badgePop">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 p-3 space-y-1">
        <button
          onClick={() => setActiveTab('profile')}
          className="flex items-center w-full px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
        >
          <div className="relative shrink-0">
            <img
              src={adminAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(adminName)}&background=14b8a6&color=fff&bold=true`}
              className="h-9 w-9 rounded-xl border-2 border-teal-700/50 group-hover:border-teal-400/50 transition-colors object-cover"
              alt="Admin"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adminName)}&background=14b8a6&color=fff&bold=true`;
              }}
            />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-[#0d3d38]" />
          </div>
          <div className="ml-3 overflow-hidden text-left">
            <p className="text-[13px] font-bold text-white truncate group-hover:text-teal-300 transition-colors leading-tight">
              {adminName}
            </p>
            <p className="text-[9px] text-teal-500/60 font-black uppercase tracking-widest leading-tight mt-0.5">
              {adminRole}
            </p>
          </div>
        </button>

        <button
          onClick={onLogout}
          className="flex items-center w-full px-3 py-2.5 text-[13px] font-semibold text-teal-100/50 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all group"
        >
          <LogOut size={15} className="mr-2.5 group-hover:-translate-x-0.5 transition-transform" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
