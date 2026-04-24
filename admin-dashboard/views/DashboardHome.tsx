import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { Users, Heart, MessageSquare, TrendingUp, AlertCircle, Globe, RefreshCw } from 'lucide-react';
import StatCard from '../components/StatCard';
import { SkeletonStatCard } from '../components/Skeleton';
import { adminApi } from '../services/adminApi';
import LiveActivityFeed from './LiveActivityFeed';

interface Stats {
  totalUsers: number;
  totalMatches: number;
  totalMessages: number;
  activeToday: number;
  pendingReports: number;
  bannedUsers: number;
  verifiedUsers: number;
}

interface Activity {
  active24h: number;
  active7d: number;
  messages24h: number;
  onlineNow: number;
}

interface DailyPoint {
  name: string;
  active: number;
  matches: number;
  messages: number;
  newUsers: number;
}

const DashboardHome: React.FC = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportsUsers, setReportsUsers] = useState<any[]>([]);
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRequiredData = useRef(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [statsRes, activityRes, reportsRes, analyticsRes] = await Promise.allSettled([
        adminApi.getStats(),
        adminApi.getActivityMonitoring(),
        adminApi.getReports('pending'),
        adminApi.getAnalytics(chartRange),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats(statsRes.value.stats);
        hasLoadedRequiredData.current = true;
      }
      if (activityRes.status === 'fulfilled' && activityRes.value?.success) {
        setActivity(activityRes.value.activity);
        hasLoadedRequiredData.current = true;
      }
      if (reportsRes.status === 'fulfilled' && reportsRes.value?.success) {
        setReportsUsers(reportsRes.value.reports?.slice(0, 5) || []);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
        setDailyData(analyticsRes.value.analytics?.dailyData || []);
      }

      const hasRequiredData =
        (statsRes.status === 'fulfilled' && statsRes.value?.success) ||
        (activityRes.status === 'fulfilled' && activityRes.value?.success);

      if (!hasRequiredData && !hasLoadedRequiredData.current) {
        setError('Unable to load live dashboard data. Please retry.');
      }
    } catch (err) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = dailyData.length > 0 ? dailyData : [];

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Live ecosystem metrics — refreshes every 60s</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-600 transition-all"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className="flex items-center px-4 py-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <Globe size={16} className="text-cyan-500 mr-2" />
            <span className="text-sm font-bold text-gray-700 dark:text-slate-300">Live Operations</span>
          </div>
          <span className="inline-flex items-center px-4 py-2 rounded-2xl text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            {activity ? `${formatNumber(activity.onlineNow)} Online` : '—'}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-sm text-rose-700 dark:text-rose-400 font-semibold">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Citizens"
              value={stats ? formatNumber(stats.totalUsers) : '—'}
              icon={<Users />}
              color="bg-cyan-500"
            />
            <StatCard
              title="Match Velocity"
              value={stats ? formatNumber(stats.totalMatches) : '—'}
              icon={<Heart />}
              color="bg-rose-500"
            />
            <StatCard
              title="Packet Traffic"
              value={stats ? formatNumber(stats.totalMessages) : '—'}
              icon={<MessageSquare />}
              color="bg-indigo-500"
            />
            <StatCard
              title="Active Today"
              value={stats ? formatNumber(stats.activeToday) : '—'}
              icon={<TrendingUp />}
              color="bg-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active 24h', value: activity ? formatNumber(activity.active24h) : '—', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/5', border: 'border-cyan-100 dark:border-cyan-500/20' },
              { label: 'Active 7d', value: activity ? formatNumber(activity.active7d) : '—', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/5', border: 'border-teal-100 dark:border-teal-500/20' },
              { label: 'Messages 24h', value: activity ? formatNumber(activity.messages24h) : '—', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/5', border: 'border-indigo-100 dark:border-indigo-500/20' },
              { label: 'Pending Reports', value: stats ? String(stats.pendingReports) : '—', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/5', border: 'border-rose-100 dark:border-rose-500/20' },
            ].map(item => (
              <div key={item.label} className={`${item.bg} border ${item.border} rounded-2xl p-5`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${item.color} mb-1`}>{item.label}</p>
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <LiveActivityFeed />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Citizen Engagement Flow</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {chartData.length > 0 ? `Real data — last ${chartRange === '30d' ? '30 days' : '7 days'}` : 'No data yet'}
                  </p>
                </div>
                <div className="flex bg-gray-50 dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-700">
                  {(['7d', '30d'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${chartRange === r ? 'bg-white dark:bg-slate-700 text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-cyan-500'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 opacity-50">
                  <MessageSquare size={40} className="text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400">No activity data yet</p>
                  <p className="text-xs text-slate-400 mt-1">Data will appear as users engage with the platform</p>
                </div>
              ) : (
                <div className="relative h-80 w-full min-h-[320px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f3f4f6'} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} />
                      <Tooltip
                        cursor={{ stroke: '#06b6d4', strokeWidth: 2 }}
                        contentStyle={{
                          borderRadius: '24px',
                          border: 'none',
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                          color: isDarkMode ? '#fff' : '#000',
                          padding: '16px',
                        }}
                        itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                      />
                      <Area type="monotone" dataKey="active" name="Active Users" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorActive)" />
                      <Area type="monotone" dataKey="matches" name="Matches" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorMatches)" />
                      <Area type="monotone" dataKey="newUsers" name="New Users" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorNew)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="flex items-center gap-6 mt-4 flex-wrap">
                {[
                  { color: 'bg-cyan-500', label: 'Active Users' },
                  { color: 'bg-rose-500', label: 'Matches' },
                  { color: 'bg-violet-500', label: 'New Sign-ups' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${l.color}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security Alerts</h2>
                <p className="text-xs text-rose-500 font-bold uppercase tracking-widest">
                  {stats ? `${stats.pendingReports} Pending · ${stats.bannedUsers} Banned` : 'Action Required'}
                </p>
              </div>
              <div className="flex-1 space-y-4">
                {reportsUsers.length > 0 ? reportsUsers.map((report: any) => (
                  <div key={report._id} className="group flex items-center justify-between p-5 rounded-3xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer">
                    <div className="flex items-center">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mr-4">
                          <span className="text-rose-600 font-black text-sm">{(report.reportedUser?.name || 'U')[0]}</span>
                        </div>
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-black dark:text-white">{report.reportedUser?.name || 'Unknown User'}</p>
                        <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider">{report.reason || 'Reported'}</p>
                      </div>
                    </div>
                    <AlertCircle size={18} className="text-slate-300 group-hover:text-rose-500 transition-colors" />
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 opacity-50">
                    <AlertCircle size={36} className="text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-400">No pending reports</p>
                  </div>
                )}
              </div>
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-3">
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Verified</p>
                  <p className="text-xl font-black text-amber-600">{stats ? formatNumber(stats.verifiedUsers) : '—'}</p>
                </div>
                <div className="text-center p-4 bg-rose-50 dark:bg-rose-500/5 rounded-2xl border border-rose-100 dark:border-rose-500/20">
                  <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Banned</p>
                  <p className="text-xl font-black text-rose-600">{stats ? formatNumber(stats.bannedUsers) : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardHome;
