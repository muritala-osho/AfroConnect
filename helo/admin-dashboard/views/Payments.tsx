import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { CreditCard, DollarSign, Download, MoreVertical, CheckCircle, Clock, XCircle, TrendingUp, Loader2 } from 'lucide-react';
import { REVENUE_DATA } from '../constants';
import { adminApi } from '../services/adminApi';

const Payments: React.FC = () => {
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const mockSubscriptionData = {
    totalActive: 245,
    estimatedMonthlyRevenue: 3675,
    plansBreakdown: { gold: 120, platinum: 85, basic: 40 },
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await adminApi.getSubscriptionsRevenue();
        setSubscriptionData(data.success ? data.subscriptions : mockSubscriptionData);
      } catch (err) {
        console.error('Failed to fetch subscription data:', err);
        setSubscriptionData(mockSubscriptionData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const regionalRevenue = [
    { region: 'Lagos', amount: 45000 },
    { region: 'Accra', amount: 32000 },
    { region: 'London', amount: 28000 },
    { region: 'Nairobi', amount: 21000 },
    { region: 'New York', amount: 19000 },
  ];

  const plansBreakdown = subscriptionData?.plansBreakdown || {};
  const planEntries = Object.entries(plansBreakdown).map(([plan, count]) => ({
    plan: plan.charAt(0).toUpperCase() + plan.slice(1),
    count: count as number,
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Finances & Core</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Global revenue streams and settlement management</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center px-6 py-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-gray-50 transition-all">
            Filter by Region
          </button>
          <button className="flex items-center px-6 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/20">
            <Download size={16} className="mr-2" /> Financial Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-cyan-500" />
          <span className="ml-3 text-sm font-bold text-slate-400">Loading financial data...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Est. Monthly Revenue', val: subscriptionData ? `$${(subscriptionData.estimatedMonthlyRevenue || 0).toLocaleString()}` : '—', change: '+12%', icon: <DollarSign />, color: 'text-emerald-500 bg-emerald-50' },
              { label: 'Active Subs', val: subscriptionData ? (subscriptionData.totalActive || 0).toLocaleString() : '—', change: '+8%', icon: <CreditCard />, color: 'text-indigo-500 bg-indigo-50' },
              { label: 'Plan Types', val: String(Object.keys(plansBreakdown).length), change: '', icon: <TrendingUp />, color: 'text-cyan-500 bg-cyan-50' },
              { label: 'Refund Rate', val: '0.8%', change: '-12%', icon: <XCircle />, color: 'text-rose-500 bg-rose-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${stat.color} dark:bg-opacity-10 flex items-center justify-center`}>
                  {React.isValidElement(stat.icon) && React.cloneElement(stat.icon as React.ReactElement<any>, { size: 20 })}
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black dark:text-white">{stat.val}</p>
                    {stat.change && <span className={`text-[10px] font-bold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{stat.change}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold mb-8 dark:text-white">Revenue Momentum</h3>
              <div className="relative h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={REVENUE_DATA}>
                    <defs>
                      <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="date" hide />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="gold" stroke="#14b8a6" strokeWidth={4} fillOpacity={1} fill="url(#revenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold mb-8 dark:text-white">Subscriptions by Plan</h3>
              {planEntries.length > 0 ? (
                <div className="space-y-4">
                  {planEntries.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                      <span className="text-sm font-black dark:text-white">{entry.plan}</span>
                      <span className="text-sm font-black text-cyan-600">{entry.count} users</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={regionalRevenue} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="region" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                      <Tooltip />
                      <Bar dataKey="amount" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Payments;
