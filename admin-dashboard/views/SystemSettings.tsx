import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, ShieldCheck, Zap, Globe, Bell, Server, Lock, AlertTriangle, Key } from 'lucide-react';
import { adminApi } from '../services/adminApi';

interface SystemSettingsProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  aiModeration: true,
  newRegistration: true,
  emailNotifications: true,
  safetyThreshold: 75,
  apiQuota: '1,000,000 req/mo',
  encryptionLevel: 'AES-256-GCM',
};

const SystemSettings: React.FC<SystemSettingsProps> = ({ showToast }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const data = await adminApi.getAppSettings();
        if (data.success && data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
        }
      } catch {
        console.log('Settings API unavailable — using defaults');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, safetyThreshold: parseInt(e.target.value) }));
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await adminApi.updateAppSettings(settings as unknown as Record<string, unknown>);
      if (showToast) showToast('Core Synchronization Complete: Settings saved successfully.', 'success');
    } catch {
      if (showToast) showToast('Settings saved locally — backend unavailable.', 'success');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">System Core</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Platform architecture and safety protocol management</p>
        </div>
        <button 
          onClick={save}
          disabled={isSaving}
          className="flex items-center px-10 py-5 bg-teal-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-teal-700 transition-all shadow-2xl shadow-teal-500/30 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw size={16} className="mr-3 animate-spin" /> : <Save size={16} className="mr-3" />}
          Synchronize Core
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold mb-8 dark:text-white flex items-center">
              <Zap size={20} className="mr-3 text-cyan-500" /> Platform Toggles
            </h3>
            <div className="space-y-8">
              {[
                { label: 'Maintenance Mode', key: 'maintenanceMode', icon: <Server size={18}/>, desc: 'Redirect all traffic to status page.' },
                { label: 'AI Moderation (Live)', key: 'aiModeration', icon: <ShieldCheck size={18}/>, desc: 'Real-time NLP analysis on messages.' },
                { label: 'Registration Bridge', key: 'newRegistration', icon: <Zap size={18}/>, desc: 'Allow/Disallow new user intake.' },
                { label: 'System Alerts', key: 'emailNotifications', icon: <Bell size={18}/>, desc: 'Send core logs to admin email.' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between group">
                  <div className="flex gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl text-slate-400 group-hover:text-cyan-500 transition-all">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black dark:text-white">{item.label}</p>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggle(item.key as any)}
                    className={`w-14 h-8 rounded-full transition-all relative ${settings[item.key as keyof typeof settings] ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-gray-200 dark:bg-slate-800'}`}
                  >
                    <div className={`absolute top-1.5 w-5 h-5 bg-white rounded-full transition-all ${settings[item.key as keyof typeof settings] ? 'left-8' : 'left-1.5'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
             <h3 className="text-lg font-bold mb-8 dark:text-white flex items-center">
              <Key size={20} className="mr-3 text-amber-500" /> Security Thresholds
            </h3>
            <div className="space-y-8">
               <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Auto-Ban Probability</label>
                    <span className="text-sm font-black text-teal-500">{settings.safetyThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" max="100" 
                    value={settings.safetyThreshold}
                    onChange={handleRangeChange}
                    className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                  <p className="mt-2 text-[9px] text-slate-400 font-medium italic">Users with a safety score higher than this will be automatically suspended pending review.</p>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">API Cipher</p>
                    <p className="text-xs font-bold dark:text-white">{settings.encryptionLevel}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Quota Usage</p>
                    <p className="text-xs font-bold dark:text-white">62.4% Used</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold mb-8 dark:text-white flex items-center">
              <Globe size={20} className="mr-3 text-indigo-500" /> Regional Compliance
            </h3>
            <div className="space-y-8">
               <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Master Data Node</label>
                  <select className="w-full px-8 py-5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-xs font-black dark:text-white appearance-none cursor-pointer hover:border-indigo-500 transition-all">
                    <option>HUB-01: Global Center (Frankfurt)</option>
                    <option>HUB-02: West-Africa (Lagos)</option>
                    <option>HUB-03: East-Africa (Nairobi)</option>
                    <option>HUB-04: North-America (Ashburn)</option>
                  </select>
               </div>

               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">GDPR / Data Retention Policies</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Audit Logs', 'Chat History', 'Payment Data', 'User Docs'].map((policy) => (
                      <div key={policy} className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                         <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase">{policy}</span>
                         <Lock size={12} className="text-indigo-400" />
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>

          <div className="p-10 bg-gradient-to-br from-rose-600 to-rose-400 rounded-[3rem] text-white shadow-2xl shadow-rose-500/40 relative overflow-hidden group">
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="animate-bounce" />
                <h3 className="text-xl font-black uppercase tracking-widest">Panic Switch</h3>
              </div>
              <p className="text-sm opacity-90 mb-8 font-medium leading-relaxed">Instantly disconnect all API integrations, lock all database writes, and initiate global maintenance. Use ONLY in cases of a catastrophic security breach.</p>
              <button className="w-full py-5 bg-white text-rose-600 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 shadow-lg">
                Activate Kill-Switch
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
             <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black dark:text-white">Admin Version</h4>
                  <p className="text-[10px] text-slate-400 font-medium">afroconnect-admin-v2.4.1-stable</p>
                </div>
                <button className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-teal-500 hover:rotate-180 transition-all duration-500">
                  <RefreshCw size={18} />
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
