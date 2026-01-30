import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import { CreditCard, DollarSign, Download, MoreVertical, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import { REVENUE_DATA } from '../constants';

const Payments: React.FC = () => {
  const [transactions, setTransactions] = useState([
    { id: 'TX-9012', user: 'Marcus Chen', amount: 29.99, plan: 'Platinum', status: 'completed', date: '2 mins ago' },
    { id: 'TX-9011', user: 'Sarah Jenkins', amount: 14.99, plan: 'Gold', status: 'completed', date: '1 hour ago' },
    { id: 'TX-9010', user: 'Alex Rivera', amount: 29.99, plan: 'Platinum', status: 'pending', date: '4 hours ago' },
    { id: 'TX-9009', user: 'Jessica Wu', amount: 9.99, plan: 'Basic', status: 'failed', date: '1 day ago' },
  ]);

  const regionalRevenue = [
    { region: 'Lagos', amount: 45000 },
    { region: 'Accra', amount: 32000 },
    { region: 'London', amount: 28000 },
    { region: 'Nairobi', amount: 21000 },
    { region: 'New York', amount: 19000 },
  ];

  const handleRefund = (id: string) => {
    if (confirm("Initiate refund for transaction " + id + "?")) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'failed' } : t));
    }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Monthly Revenue', val: '$842k', change: '+12%', icon: <DollarSign />, color: 'text-emerald-500 bg-emerald-50' },
          { label: 'Avg. Order Value', val: '$24.50', change: '+2%', icon: <TrendingUp />, color: 'text-cyan-500 bg-cyan-50' },
          { label: 'Active Subs', val: '12.4k', change: '+8%', icon: <CreditCard />, color: 'text-indigo-500 bg-indigo-50' },
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
                <span className={`text-[10px] font-bold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{stat.change}</span>
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
          <h3 className="text-lg font-bold mb-8 dark:text-white">Revenue by Hub</h3>
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
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold dark:text-white">Global Ledger</h3>
          <button className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-widest hover:underline">Download CSV Audit</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction ID</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Citizen</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Amount</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorization Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-8 py-5 text-sm font-black dark:text-white">{tx.id}</td>
                  <td className="px-8 py-5 text-sm font-medium dark:text-slate-300">{tx.user}</td>
                  <td className="px-8 py-5 text-sm font-black dark:text-white">${tx.amount}</td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      tx.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700' :
                      tx.status === 'pending' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700' :
                      'bg-rose-100 dark:bg-rose-500/10 text-rose-700'
                    }`}>
                      {tx.status === 'completed' ? <CheckCircle size={10} className="mr-1" /> : 
                       tx.status === 'pending' ? <Clock size={10} className="mr-1" /> : 
                       <XCircle size={10} className="mr-1" />}
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs font-medium text-slate-400">{tx.date}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleRefund(tx.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                        title="Issue Refund"
                      >
                        <XCircle size={16} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-cyan-600 transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Payments;
