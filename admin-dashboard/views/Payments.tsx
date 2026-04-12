import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import {
  CreditCard, DollarSign, TrendingUp, Loader2, RefreshCw,
  AlertCircle, Zap, Download,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';

const Payments: React.FC = () => {
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [revenueHistory, setRevenueHistory] = useState<any[]>([]);
  const [boostsData, setBoostsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<'revenue' | 'subscriptions'>('revenue');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [subsRes, historyRes, boostsRes] = await Promise.allSettled([
        adminApi.getSubscriptionsRevenue(),
        adminApi.getRevenueHistory(),
        adminApi.getBoostsRevenue(),
      ]);

      if (subsRes.status === 'fulfilled' && subsRes.value?.success) {
        setSubscriptionData(subsRes.value.subscriptions);
      } else {
        setError('Subscription data unavailable.');
      }
      if (historyRes.status === 'fulfilled' && historyRes.value?.success) {
        setRevenueHistory(historyRes.value.revenueHistory || []);
      }
      if (boostsRes.status === 'fulfilled' && boostsRes.value?.success) {
        setBoostsData(boostsRes.value.boosts);
      }
    } catch (err) {
      console.error('Payments fetch error:', err);
      setError('Failed to load financial data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const plansBreakdown = subscriptionData?.plansBreakdown || {};
  const planEntries = Object.entries(plansBreakdown).map(([plan, count]) => ({
    plan: plan.charAt(0).toUpperCase() + plan.slice(1),
    count: count as number,
    revenue: (count as number) * 15,
  }));

  const totalRevenue = subscriptionData?.estimatedMonthlyRevenue || 0;
  const totalActive  = subscriptionData?.totalActive || 0;

  const handleExport = () => {
    if (revenueHistory.length === 0) return;
    const csv = ['Date,Revenue,New Subscriptions', ...revenueHistory.map(r => `${r.date},${r.revenue},${r.subscriptions}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'revenue-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Finances & Core</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Live revenue streams and subscription management</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-gray-600 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition-all"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={revenueHistory.length === 0}
            className="flex items-center px-6 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
          >
            <Download size={16} className="mr-2" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-sm text-rose-700 dark:text-rose-400 font-semibold">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 size={36} className="animate-spin text-cyan-500 mb-4" />
          <span className="text-sm font-bold text-slate-400">Loading financial data...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                label: 'Est. Monthly Revenue',
                val: `$${totalRevenue.toLocaleString()}`,
                sub: 'From active subscriptions',
                icon: <DollarSign size={20} />,
                color: 'text-emerald-500',
                bg: 'bg-emerald-50 dark:bg-emerald-500/10',
              },
              {
                label: 'Active Subscriptions',
                val: totalActive.toLocaleString(),
                sub: `${Object.keys(plansBreakdown).length} plan types`,
                icon: <CreditCard size={20} />,
                color: 'text-indigo-500',
                bg: 'bg-indigo-50 dark:bg-indigo-500/10',
              },
              {
                label: 'Boosts Issued',
                val: boostsData ? boostsData.totalBoostsIssued.toLocaleString() : '—',
                sub: boostsData ? `${boostsData.usersWithBoosts} users boosted` : '',
                icon: <Zap size={20} />,
                color: 'text-amber-500',
                bg: 'bg-amber-50 dark:bg-amber-500/10',
              },
              {
                label: 'Boost Revenue Est.',
                val: boostsData ? `$${boostsData.estimatedBoostRevenue.toLocaleString()}` : '—',
                sub: 'At $5/boost',
                icon: <TrendingUp size={20} />,
                color: 'text-cyan-500',
                bg: 'bg-cyan-50 dark:bg-cyan-500/10',
              },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-xl font-black dark:text-white">{stat.val}</p>
                  {stat.sub && <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Chart + Plan Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold dark:text-white">Revenue Momentum</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {revenueHistory.length > 0 ? 'Real data — last 30 days' : 'No subscription data yet'}
                  </p>
                </div>
                <div className="flex bg-gray-50 dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-700">
                  {(['revenue', 'subscriptions'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${chartView === v ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-sm' : 'text-slate-400 hover:text-teal-500'}`}
                    >
                      {v === 'revenue' ? '$ Revenue' : '# Subs'}
                    </button>
                  ))}
                </div>
              </div>

              {revenueHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-72 opacity-50">
                  <DollarSign size={40} className="text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400">No subscription revenue recorded yet</p>
                  <p className="text-xs text-slate-400 mt-1">Revenue data will appear as users subscribe</p>
                </div>
              ) : (
                <div className="relative h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={revenueHistory} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                        interval={Math.floor(revenueHistory.length / 6)}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(v: any) => [chartView === 'revenue' ? `$${v}` : v, chartView === 'revenue' ? 'Revenue' : 'New Subs']}
                      />
                      <Area
                        type="monotone"
                        dataKey={chartView === 'revenue' ? 'revenue' : 'subscriptions'}
                        name={chartView === 'revenue' ? 'Revenue ($)' : 'New Subscriptions'}
                        stroke="#14b8a6"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#revGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold mb-6 dark:text-white">Subscriptions by Plan</h3>

              {planEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 opacity-50">
                  <CreditCard size={32} className="text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400">No active subscriptions</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {planEntries.map((entry, i) => {
                      const colors = ['bg-teal-500', 'bg-indigo-500', 'bg-amber-500', 'bg-cyan-500'];
                      const pct = totalActive > 0 ? Math.round((entry.count / totalActive) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-black dark:text-white">{entry.plan}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{entry.count} users</span>
                              <span className="text-xs font-bold text-teal-600">${entry.revenue}</span>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colors[i % colors.length]} rounded-full transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{pct}% of subscriptions</p>
                        </div>
                      );
                    })}
                  </div>

                  {planEntries.length > 1 && (
                    <div className="relative h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={planEntries} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="plan" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                          <Tooltip formatter={(v: any, name: string) => [name === 'revenue' ? `$${v}` : v, name === 'revenue' ? 'Est. Revenue' : 'Users']} />
                          <Bar dataKey="count"   name="Users"         fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar dataKey="revenue" name="Est. Revenue"  fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Boost Revenue Summary */}
          {boostsData && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/5 dark:to-yellow-500/5 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <Zap size={20} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Boost Economy</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {boostsData.totalBoostsIssued} boosts issued to {boostsData.usersWithBoosts} users — estimated $
                    {boostsData.estimatedBoostRevenue} additional revenue at $5/boost.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Payments;
