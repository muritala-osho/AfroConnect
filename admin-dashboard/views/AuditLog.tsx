import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Trash2, UserX, UserCheck, Megaphone, MessageSquare,
  Gavel, ImageOff, Settings, Search, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, Filter, Download, Clock, Shield,
  XCircle, CheckCircle, AlertTriangle, Ban,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { SkeletonList } from '../components/Skeleton';

interface AuditEntry {
  _id: string;
  action: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  adminId: string;
  adminName: string;
  adminEmail?: string;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

interface AuditStats {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: { category: string; count: number }[];
  topAdmins: { id: string; name: string; count: number }[];
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  BAN_USER:              { label: 'User Banned',            icon: <Ban size={14} />,         color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-500/10' },
  UNBAN_USER:            { label: 'Ban Lifted',             icon: <CheckCircle size={14} />,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  SUSPEND_USER:          { label: 'User Suspended',         icon: <UserX size={14} />,        color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-500/10' },
  UNSUSPEND_USER:        { label: 'Suspension Lifted',      icon: <CheckCircle size={14} />,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  DELETE_USER:           { label: 'Account Deleted',        icon: <Trash2 size={14} />,       color: 'text-red-700 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-500/10' },
  APPROVE_VERIFICATION:  { label: 'Verification Approved',  icon: <UserCheck size={14} />,    color: 'text-teal-600 dark:text-teal-400',      bg: 'bg-teal-50 dark:bg-teal-500/10' },
  REJECT_VERIFICATION:   { label: 'Verification Rejected',  icon: <XCircle size={14} />,      color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-50 dark:bg-rose-500/10' },
  RESOLVE_REPORT:        { label: 'Report Resolved',        icon: <ShieldCheck size={14} />,  color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
  APPROVE_APPEAL:        { label: 'Appeal Approved',        icon: <Gavel size={14} />,        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  REJECT_APPEAL:         { label: 'Appeal Rejected',        icon: <Gavel size={14} />,        color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-50 dark:bg-rose-500/10' },
  REMOVE_CONTENT:        { label: 'Content Removed',        icon: <ImageOff size={14} />,     color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-500/10' },
  APPROVE_CONTENT:       { label: 'Content Approved',       icon: <CheckCircle size={14} />,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  SEND_BROADCAST:        { label: 'Broadcast Sent',         icon: <Megaphone size={14} />,    color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-500/10' },
  UPDATE_SETTINGS:       { label: 'Settings Updated',       icon: <Settings size={14} />,     color: 'text-slate-600 dark:text-slate-400',    bg: 'bg-slate-50 dark:bg-slate-500/10' },
  CLOSE_TICKET:          { label: 'Ticket Closed',          icon: <MessageSquare size={14} />,color: 'text-slate-600 dark:text-slate-400',    bg: 'bg-slate-50 dark:bg-slate-500/10' },
  REPLY_TICKET:          { label: 'Ticket Reply',           icon: <MessageSquare size={14} />,color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-500/10' },
};

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      color: 'text-slate-500',              bg: 'bg-slate-100 dark:bg-slate-700' },
  medium:   { label: 'Medium',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10' },
  high:     { label: 'High',     color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  critical: { label: 'Critical', color: 'text-rose-700 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-500/10' },
};

const CATEGORIES = ['All', 'USER_MANAGEMENT', 'VERIFICATION', 'MODERATION', 'BROADCAST', 'APPEAL', 'SYSTEM', 'SUPPORT'];
const SEVERITIES = ['All', 'critical', 'high', 'medium', 'low'];

const CATEGORY_LABELS: Record<string, string> = {
  USER_MANAGEMENT: 'Users', VERIFICATION: 'Verification', MODERATION: 'Moderation',
  BROADCAST: 'Broadcasts', APPEAL: 'Appeals', SYSTEM: 'System', SUPPORT: 'Support',
};

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const params: Record<string, string | number> = { page, limit: 30 };
      if (category !== 'All') params.category = category;
      if (severity !== 'All') params.severity = severity;
      if (search) params.search = search;

      const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
      const res = await fetch(`/api/admin/audit-log?${query}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('afroconnect_token')}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        setError('Failed to load audit log.');
      }
    } catch {
      setError('Backend is unavailable or the audit log endpoint is not yet active.');
    } finally {
      setLoading(false);
    }
  }, [page, category, severity, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-log/stats', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('afroconnect_token')}`,
        },
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch { }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleFilterChange = (type: 'category' | 'severity', value: string) => {
    setPage(1);
    if (type === 'category') setCategory(value);
    else setSeverity(value);
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['Date', 'Action', 'Category', 'Severity', 'Admin', 'Target User', 'Details', 'IP'];
    const rows = logs.map(e => [
      new Date(e.createdAt).toLocaleString(),
      e.action,
      e.category,
      e.severity,
      e.adminName,
      e.targetUserName || '—',
      (e.details || '').replace(/,/g, ';'),
      e.ipAddress || '—',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `afroconnect-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActionCfg = (action: string) => ACTION_CONFIG[action] || {
    label: action.replace(/_/g, ' '),
    icon: <Shield size={14} />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
  };

  const getSeverityCfg = (sev: string) =>
    SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.medium;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mt-1">
            Complete record of every staff action — immutable, timestamped
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={!logs.length}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-bold rounded-2xl hover:bg-teal-700 transition-all text-sm shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Actions (30d)', value: stats.total, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/5', border: 'border-indigo-100 dark:border-indigo-500/20' },
            { label: 'Critical Events', value: stats.bySeverity?.critical || 0, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/5', border: 'border-rose-100 dark:border-rose-500/20' },
            { label: 'High Severity', value: stats.bySeverity?.high || 0, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/5', border: 'border-orange-100 dark:border-orange-500/20' },
            { label: 'Top Category', value: stats.byCategory?.[0]?.category ? CATEGORY_LABELS[stats.byCategory[0].category] || stats.byCategory[0].category : '—', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/5', border: 'border-teal-100 dark:border-teal-500/20' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} border ${card.border} rounded-3xl p-5`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${card.color}`}>{card.label}</p>
              <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-card overflow-hidden">
        <div className="p-5 border-b border-gray-50 dark:border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by admin, user, or action..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                />
              </div>
              <button type="submit" className="px-5 py-2.5 bg-teal-600 text-white font-bold rounded-2xl hover:bg-teal-700 transition-all text-sm">
                Search
              </button>
              {(search || category !== 'All' || severity !== 'All') && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setCategory('All'); setSeverity('All'); setPage(1); }}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 font-bold rounded-2xl hover:text-rose-500 transition-colors text-sm"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Category</span>
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => handleFilterChange('category', c)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    category === c
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-50 dark:bg-slate-800 text-slate-500 hover:text-teal-600 border border-gray-100 dark:border-slate-700'
                  }`}
                >
                  {c === 'All' ? 'All' : (CATEGORY_LABELS[c] || c)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Severity</span>
            {SEVERITIES.map(s => {
              const cfg = s === 'All' ? null : getSeverityCfg(s);
              return (
                <button
                  key={s}
                  onClick={() => handleFilterChange('severity', s)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    severity === s
                      ? 'bg-teal-600 text-white shadow-sm'
                      : `bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 ${cfg?.color || 'text-slate-500'} hover:opacity-80`
                  }`}
                >
                  {s === 'All' ? 'All' : s}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="p-5 bg-amber-50 dark:bg-amber-500/10 rounded-3xl mb-6">
              <AlertTriangle size={36} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-black dark:text-white mb-2">Audit Log Unavailable</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md font-medium">{error}</p>
            <p className="text-[11px] text-slate-400 mt-3 font-medium max-w-sm">
              Once the backend processes admin actions, entries will appear here automatically.
            </p>
            <button
              onClick={() => fetchLogs()}
              className="mt-6 px-6 py-3 bg-teal-600 text-white font-bold rounded-2xl hover:bg-teal-700 transition-all"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="p-5">
            <SkeletonList rows={8} />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 bg-gray-50 dark:bg-slate-800 rounded-3xl mb-6">
              <ShieldCheck size={36} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-black dark:text-white mb-2">No entries found</h3>
            <p className="text-sm text-gray-400 dark:text-slate-500">
              {search || category !== 'All' || severity !== 'All'
                ? 'Try adjusting your filters.'
                : 'Admin actions will be recorded here as they happen.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800/70">
            {logs.map(entry => {
              const cfg = getActionCfg(entry.action);
              const sevCfg = getSeverityCfg(entry.severity);
              return (
                <button
                  key={entry._id}
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-slate-800/30 transition-colors text-left group"
                >
                  <div className={`shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-bold text-gray-900 dark:text-white">{cfg.label}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${sevCfg.bg} ${sevCfg.color}`}>
                        {entry.severity}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-gray-50 dark:bg-slate-800 text-slate-400 rounded-lg font-bold border border-gray-100 dark:border-slate-700">
                        {CATEGORY_LABELS[entry.category] || entry.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      <span className="font-bold text-slate-500 dark:text-slate-300">{entry.adminName}</span>
                      {entry.targetUserName && (
                        <> → <span className="text-teal-600 dark:text-teal-400">{entry.targetUserName}</span></>
                      )}
                      {entry.details && <> · {entry.details}</>}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 text-right">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                        <Clock size={9} className="inline mr-1 mb-0.5" />{formatDate(entry.createdAt)}
                      </p>
                      {entry.ipAddress && (
                        <p className="text-[9px] text-slate-300 dark:text-slate-600 font-mono mt-0.5">{entry.ipAddress}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20">
            <span className="text-[11px] text-slate-400 font-bold">
              Showing {((page - 1) * 30) + 1}–{Math.min(page * 30, total)} of {total} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-slate-500 hover:text-teal-600 transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-black">{page}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 text-slate-500 hover:text-teal-600 transition-colors disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-lg animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  {(() => {
                    const cfg = getActionCfg(selectedEntry.action);
                    return (
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon}
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="text-lg font-black dark:text-white">{getActionCfg(selectedEntry.action).label}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {formatDate(selectedEntry.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Severity', value: <span className={`font-black uppercase text-xs px-2 py-1 rounded-lg ${getSeverityCfg(selectedEntry.severity).bg} ${getSeverityCfg(selectedEntry.severity).color}`}>{selectedEntry.severity}</span> },
                  { label: 'Category', value: CATEGORY_LABELS[selectedEntry.category] || selectedEntry.category },
                  { label: 'Performed by', value: `${selectedEntry.adminName}${selectedEntry.adminEmail ? ' · ' + selectedEntry.adminEmail : ''}` },
                  selectedEntry.targetUserName ? { label: 'Target user', value: `${selectedEntry.targetUserName}${selectedEntry.targetUserEmail ? ' · ' + selectedEntry.targetUserEmail : ''}` } : null,
                  selectedEntry.details ? { label: 'Details', value: selectedEntry.details } : null,
                  selectedEntry.ipAddress ? { label: 'IP Address', value: <span className="font-mono text-xs">{selectedEntry.ipAddress}</span> } : null,
                ].filter(Boolean).map((row: any) => (
                  <div key={row.label} className="flex gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 shrink-0 mt-0.5">{row.label}</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 flex-1">{row.value}</span>
                  </div>
                ))}
                {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Metadata</p>
                    <pre className="text-xs font-mono bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 overflow-auto text-slate-600 dark:text-slate-300">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
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

export default AuditLog;
