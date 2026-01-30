import React from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Users, Heart, MessageSquare, TrendingUp, AlertCircle, Globe } from 'lucide-react';
import StatCard from '../components/StatCard';
import { ANALYTICS_DATA, MOCK_USERS } from '../constants';

const DashboardHome: React.FC = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Global ecosystem metrics and synchronization status</p>
        </div>
        <div className="flex space-x-3">
           <div className="flex items-center px-4 py-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
             <Globe size={16} className="text-cyan-500 mr-2" />
             <span className="text-sm font-bold text-gray-700 dark:text-slate-300">Hub: Lagos Central</span>
           </div>
          <span className="inline-flex items-center px-4 py-2 rounded-2xl text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            12,452 Citizens Online
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Citizens" 
          value="1,245,678" 
          change={12.5} 
          icon={<Users />} 
          color="bg-cyan-500" 
        />
        <StatCard 
          title="Match Velocity" 
          value="24,192" 
          change={8.2} 
          icon={<Heart />} 
          color="bg-rose-500" 
        />
        <StatCard 
          title="Packet Traffic" 
          value="892,400" 
          change={15.4} 
          icon={<MessageSquare />} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="Network Growth" 
          value="+4.2%" 
          change={1.2} 
          icon={<TrendingUp />} 
          color="bg-teal-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Citizen Engagement Flow</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Real-time data synchronization</p>
            </div>
            <select className="bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 px-6 py-3 outline-none cursor-pointer">
              <option>Last 7 Cycles</option>
              <option>Last 30 Cycles</option>
            </select>
          </div>
          <div className="relative h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={ANALYTICS_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#1e293b" : "#f3f4f6"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  cursor={{ stroke: '#06b6d4', strokeWidth: 2 }}
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    padding: '16px'
                  }}
                  itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Area type="monotone" dataKey="active" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorActive)" />
                <Area type="monotone" dataKey="matches" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorHeart)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security Alerts</h2>
            <p className="text-xs text-rose-500 font-bold uppercase tracking-widest">Action Required</p>
          </div>
          <div className="flex-1 space-y-4">
            {MOCK_USERS.filter(u => u.reportCount > 0).map(user => (
              <div key={user.id} className="group flex items-center justify-between p-5 rounded-3xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 hover:border-brand-500/50 transition-all cursor-pointer">
                <div className="flex items-center">
                  <div className="relative">
                    <img src={user.avatar} className="h-12 w-12 rounded-2xl object-cover mr-4 ring-2 ring-white dark:ring-slate-700" alt={user.name} />
                    <div className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800 shadow-sm animate-pulse"></div>
                  </div>
                  <div>
                    <p className="text-sm font-black dark:text-white">{user.name}</p>
                    <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider">{user.reportCount} Global Reports</p>
                  </div>
                </div>
                <button className="p-3 bg-white dark:bg-slate-700 rounded-2xl text-slate-400 group-hover:text-brand-500 transition-all shadow-sm">
                  <AlertCircle size={18} />
                </button>
              </div>
            ))}
          </div>
          <button className="w-full py-5 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 rounded-2xl hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-all shadow-sm">
            Launch Safety Protocol
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
