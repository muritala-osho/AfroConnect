import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, MoreHorizontal, User, AlertCircle, Eye, Trash2, ShieldCheck, MessageCircle, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

const ReportsQueue: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [stats, setStats] = useState({ pending: 0, resolved: 0 });

  const MOCK_REPORTS = [
    { _id: 'r1', reporter: { name: 'Amara Diallo' }, reportedUser: { name: 'Marcus Chen' }, reason: 'Harassment', description: 'User sent repeated unwanted messages after being asked to stop.', status: 'pending', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { _id: 'r2', reporter: { name: 'Nia Adeyemi' }, reportedUser: { name: 'John Smith' }, reason: 'Fake Profile', description: 'Profile photos appear to be stolen from someone else. No bio matches.', status: 'pending', createdAt: new Date(Date.now() - 7200000).toISOString() },
    { _id: 'r3', reporter: { name: 'Kofi Asante' }, reportedUser: { name: 'Anonymous User' }, reason: 'Spam', description: 'User is sending promotional links to multiple people in messages.', status: 'pending', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { _id: 'r4', reporter: { name: 'Fatima Osei' }, reportedUser: { name: 'Alex Rivera' }, reason: 'Inappropriate Content', description: 'Sent unsolicited explicit photo in direct messages.', status: 'resolved', createdAt: new Date(Date.now() - 172800000).toISOString() },
  ];

  const fetchReports = async (status: string) => {
    setLoading(true);
    try {
      const data = await adminApi.getReports(status);
      if (data.success && data.reports?.length > 0) {
        setReports(data.reports);
      } else {
        const filtered = MOCK_REPORTS.filter(r => status === 'all' || r.status === status);
        setReports(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch reports — showing demo data:', err);
      const filtered = MOCK_REPORTS.filter(r => status === 'all' || r.status === status);
      setReports(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(activeFilter);
  }, [activeFilter]);

  const handleResolve = async (reportId: string, action: string) => {
    try {
      const data = await adminApi.resolveReport(reportId, action);
      if (data.success) {
        setReports(prev => prev.filter(r => r._id !== reportId));
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to resolve report:', err);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Trust & Safety Hub</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Monitoring community integrity and resolving conflicts</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-gray-100 dark:border-slate-800">
           <button 
             onClick={() => setActiveFilter('pending')}
             className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl ${activeFilter === 'pending' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400'}`}
           >
             Pending
           </button>
           <button 
             onClick={() => setActiveFilter('resolved')}
             className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl ${activeFilter === 'resolved' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400'}`}
           >
             Resolved
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Reports Loaded', val: String(reports.length), color: 'text-rose-500 bg-rose-50', icon: <ShieldAlert /> },
          { label: 'Filter', val: activeFilter.toUpperCase(), color: 'text-emerald-500 bg-emerald-50', icon: <CheckCircle2 /> },
          { label: 'Status', val: loading ? '...' : 'Ready', color: 'text-cyan-500 bg-cyan-50', icon: <AlertCircle /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 flex items-center gap-4 shadow-sm hover:translate-y-[-2px] transition-all">
            <div className={`p-4 rounded-2xl ${stat.color} dark:bg-opacity-10`}>
              {React.isValidElement(stat.icon) && React.cloneElement(stat.icon as React.ReactElement<any>, { size: 24 })}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black dark:text-white tracking-tighter">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-cyan-500" />
            <span className="ml-3 text-sm font-bold text-slate-400">Loading reports...</span>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Incident Detail</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Involved Parties</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Violation Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Flow State</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {reports.length > 0 ? reports.map((report) => (
                <tr key={report._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-5">
                    <p className="text-sm font-black dark:text-white leading-none mb-1">{report._id?.slice(-6).toUpperCase()}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-cyan-100 flex items-center justify-center text-[10px] font-black text-cyan-700">{(report.reporter?.name || 'R')[0]}</div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{report.reporter?.name || 'Unknown'}</span>
                      <span className="text-slate-300">→</span>
                      <div className="h-6 w-6 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-black text-rose-700">{(report.reportedUser?.name || 'T')[0]}</div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{report.reportedUser?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                      {report.reason || 'Other'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] ${
                      report.status === 'resolved' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700' :
                      'bg-amber-100 dark:bg-amber-500/10 text-amber-700 animate-pulse'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedReport(report)}
                        className="p-2.5 text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl hover:bg-cyan-100 transition-all shadow-sm"
                        title="View Context"
                      >
                        <Eye size={18} />
                      </button>
                      {report.status === 'pending' && (
                        <button 
                          onClick={() => handleResolve(report._id, 'dismiss')}
                          className="p-2.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"
                          title="Mark Resolved"
                        >
                          <ShieldCheck size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <p className="text-sm font-bold text-slate-400">No reports found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl border border-white/10">
            <div className="p-10">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2">Safety Incident Investigation</h3>
                  <h2 className="text-3xl font-black dark:text-white leading-tight">{selectedReport._id?.slice(-6).toUpperCase()}</h2>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl hover:bg-gray-100 transition-all"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-6">
                 <div className="flex gap-4">
                    <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Reporter</p>
                      <p className="font-bold dark:text-white">{selectedReport.reporter?.name || 'Unknown'}</p>
                    </div>
                    <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Target</p>
                      <p className="font-bold dark:text-white">{selectedReport.reportedUser?.name || 'Unknown'}</p>
                    </div>
                 </div>

                 <div className="p-8 bg-rose-50/50 dark:bg-rose-500/5 rounded-[2.5rem] border border-rose-100 dark:border-rose-500/20">
                    <div className="flex items-center gap-2 mb-4 text-rose-600">
                      <MessageCircle size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Incident Details</h4>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">
                      "{selectedReport.description || selectedReport.reason || 'No details provided'}"
                    </p>
                 </div>

                 {selectedReport.status === 'pending' && (
                   <div className="flex gap-4">
                      <button 
                        onClick={() => handleResolve(selectedReport._id, 'dismiss')}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-500/20"
                      >
                        Verify & Dismiss
                      </button>
                      <button 
                        onClick={() => handleResolve(selectedReport._id, 'ban')}
                        className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-500/20"
                      >
                        Escalate to Ban
                      </button>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsQueue;
