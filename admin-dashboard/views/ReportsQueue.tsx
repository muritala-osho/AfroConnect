import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, CheckCircle2, Eye, ShieldCheck, MessageCircle,
  Loader2, RefreshCw, AlertCircle, X, UserX,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';

interface ReportsQueueProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const ReportsQueue: React.FC<ReportsQueueProps> = ({ showToast }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const data = await adminApi.getReports(activeFilter);
      if (data.success) {
        setReports(data.reports || []);
      } else {
        setError('Failed to load reports.');
        setReports([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not reach the backend.');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResolve = async (reportId: string, action: 'dismiss' | 'ban') => {
    setActionLoading(reportId + action);
    try {
      const data = await adminApi.resolveReport(reportId, action);
      if (data.success) {
        setReports(prev => prev.filter(r => r._id !== reportId));
        setSelectedReport(null);
        showToast?.(action === 'ban' ? 'User banned and report resolved.' : 'Report dismissed.', 'success');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Failed to resolve report.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const stats = [
    { label: 'Reports Loaded', value: reports.length, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/5', border: 'border-rose-100 dark:border-rose-500/20', icon: <ShieldAlert size={20} /> },
    { label: 'Pending', value: activeFilter === 'pending' ? reports.length : '—', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/5', border: 'border-amber-100 dark:border-amber-500/20', icon: <AlertCircle size={20} /> },
    { label: 'View', value: activeFilter.toUpperCase(), color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/5', border: 'border-emerald-100 dark:border-emerald-500/20', icon: <CheckCircle2 size={20} /> },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Reports Queue</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Trust & safety incident management</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-gray-100 dark:border-slate-800">
            {['pending', 'resolved', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeFilter === f ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchReports()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm font-semibold text-gray-600 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className={`${stat.bg} border ${stat.border} rounded-2xl p-5 flex items-center gap-4`}>
            <div className={stat.color}>{stat.icon}</div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-medium">{error}</span>
          <button onClick={() => fetchReports()} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-teal-500" />
            <span className="ml-3 text-sm font-medium text-slate-400">Loading reports...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parties</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {reports.length > 0 ? reports.map((report) => (
                  <tr key={report._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black dark:text-white">{report._id?.slice(-6).toUpperCase()}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{report.reporter?.name || 'Unknown'}</span>
                        <span className="text-slate-300">→</span>
                        <span className="font-bold text-slate-600 dark:text-slate-300">{report.reportedUser?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                        {report.reason || 'Other'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                        report.status === 'resolved'
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700'
                          : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="p-2 text-teal-600 bg-teal-50 dark:bg-teal-500/10 rounded-lg hover:bg-teal-100 transition-all"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleResolve(report._id, 'dismiss')}
                              disabled={actionLoading !== null}
                              className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-40"
                              title="Dismiss"
                            >
                              {actionLoading === report._id + 'dismiss' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                            </button>
                            <button
                              onClick={() => handleResolve(report._id, 'ban')}
                              disabled={actionLoading !== null}
                              className="p-2 text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:bg-rose-100 transition-all disabled:opacity-40"
                              title="Escalate to ban"
                            >
                              {actionLoading === report._id + 'ban' ? <Loader2 size={15} className="animate-spin" /> : <UserX size={15} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <CheckCircle2 size={36} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-400">No {activeFilter} reports found</p>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden">
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Report #{selectedReport._id?.slice(-6).toUpperCase()}</p>
                  <h2 className="text-2xl font-black dark:text-white">{selectedReport.reason || 'Incident Report'}</h2>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reporter</p>
                  <p className="font-bold dark:text-white text-sm">{selectedReport.reporter?.name || 'Unknown'}</p>
                  {selectedReport.reporter?.email && <p className="text-xs text-slate-400">{selectedReport.reporter.email}</p>}
                </div>
                <div className="p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reported User</p>
                  <p className="font-bold dark:text-white text-sm">{selectedReport.reportedUser?.name || 'Unknown'}</p>
                  {selectedReport.reportedUser?.email && <p className="text-xs text-slate-400">{selectedReport.reportedUser.email}</p>}
                </div>
              </div>

              <div className="p-6 bg-rose-50/50 dark:bg-rose-500/5 rounded-2xl border border-rose-100 dark:border-rose-500/20 mb-6">
                <div className="flex items-center gap-2 mb-3 text-rose-600">
                  <MessageCircle size={16} />
                  <p className="text-xs font-black uppercase tracking-widest">Incident Description</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedReport.description || selectedReport.reason || 'No additional details provided.'}
                </p>
              </div>

              {selectedReport.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleResolve(selectedReport._id, 'dismiss')}
                    disabled={actionLoading !== null}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === selectedReport._id + 'dismiss' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleResolve(selectedReport._id, 'ban')}
                    disabled={actionLoading !== null}
                    className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === selectedReport._id + 'ban' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                    Ban User
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsQueue;
