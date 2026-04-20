import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, UserX, AlertTriangle, Eye, CheckCircle2, X,
  MapPin, Calendar, History, ShieldAlert, Award, Heart,
  Briefcase, GraduationCap, Camera, Tag, Cigarette, Wine,
  Loader2, RefreshCw, Download, ChevronLeft, ChevronRight,
  Trash2, PauseCircle, PlayCircle, AlertCircle,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';
import PermissionGuard from '../components/PermissionGuard';
import { SkeletonTableRow } from '../components/Skeleton';

interface UserManagementProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const PAGE_SIZE = 25;

const UserManagement: React.FC<UserManagementProps> = ({ showToast }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'bio' | 'activity' | 'safety'>('bio');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned' | 'warned'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ user: any; type: 'ban' | 'unban' | 'delete' | 'suspend' | 'unsuspend' } | null>(null);
  const [suspendDays, setSuspendDays] = useState(7);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await adminApi.getUsers(params);
      if (data.success) {
        setUsers(data.users || []);
        if (data.pagination) {
          setTotalPages(data.pagination.pages || 1);
          setTotalUsers(data.pagination.total || 0);
        }
      } else {
        setError('Failed to load users from server.');
        setUsers([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to reach the backend. Check your API URL.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const mapUserStatus = (user: any) => {
    if (user.banned) return 'banned';
    if (user.suspended) return 'suspended';
    if (user.warnings && user.warnings > 0) return 'warned';
    return 'active';
  };

  const formatLocationName = (location: any) => {
    if (!location) return '';
    if (typeof location === 'string') return location;
    return location.name || [location.city, location.country].filter(Boolean).join(', ') || location.address || '';
  };

  const getLoveLocations = (user: any) => {
    const locations: string[] = [];
    const passport = formatLocationName(user.passportLocation);
    if (passport) locations.push(`Passport: ${passport}`);
    (user.additionalLocations || []).forEach((location: any) => {
      const name = formatLocationName(location);
      if (name) locations.push(name);
    });
    return locations;
  };

  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setActiveProfileTab('bio');
  };

  const handleBanToggle = async (user: any, ban: boolean) => {
    setActionLoading(user._id + (ban ? 'ban' : 'unban'));
    try {
      const data = await adminApi.banUser(user._id, ban, ban ? 'Banned by admin' : undefined);
      if (data.success) {
        const updated = { ...user, banned: ban };
        setUsers(prev => prev.map(u => u._id === user._id ? updated : u));
        if (selectedUser?._id === user._id) setSelectedUser(updated);
        showToast?.(ban ? `${user.name} has been banned.` : `${user.name}'s access has been restored.`, ban ? 'error' : 'success');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Action failed. Try again.', 'error');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleSuspendToggle = async (user: any, suspend: boolean) => {
    setActionLoading(user._id + (suspend ? 'suspend' : 'unsuspend'));
    try {
      const data = await adminApi.suspendUser(user._id, suspend, suspend ? suspendDays : undefined);
      if (data.success) {
        const updated = { ...user, suspended: suspend };
        setUsers(prev => prev.map(u => u._id === user._id ? updated : u));
        if (selectedUser?._id === user._id) setSelectedUser(updated);
        showToast?.(suspend ? `${user.name} suspended for ${suspendDays} days.` : `${user.name}'s suspension lifted.`, 'success');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Action failed. Try again.', 'error');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleDelete = async (user: any) => {
    setActionLoading(user._id + 'delete');
    try {
      const data = await adminApi.deleteUser(user._id);
      if (data.success) {
        setUsers(prev => prev.filter(u => u._id !== user._id));
        if (selectedUser?._id === user._id) { setIsModalOpen(false); setSelectedUser(null); }
        showToast?.(`${user.name}'s account has been permanently deleted.`, 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Delete failed. Try again.', 'error');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    const { user, type } = confirmModal;
    if (type === 'ban') await handleBanToggle(user, true);
    else if (type === 'unban') await handleBanToggle(user, false);
    else if (type === 'suspend') await handleSuspendToggle(user, true);
    else if (type === 'unsuspend') await handleSuspendToggle(user, false);
    else if (type === 'delete') await handleDelete(user);
  };

  const exportCSV = () => {
    if (users.length === 0) return;
    const headers = ['Name', 'Email', 'Status', 'Verified', 'Location', 'Joined'];
    const rows = users.map(u => [
      u.name || '',
      u.email || '',
      mapUserStatus(u),
      u.verified ? 'Yes' : 'No',
      u.location?.city || u.location?.country || u.livingIn || '',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-page${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.(`Exported ${users.length} users to CSV.`, 'success');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      warned: 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400',
      suspended: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
      banned: 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400',
    };
    return map[status] || map.active;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">User Management</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">
            {loading ? 'Loading...' : `${totalUsers.toLocaleString()} total users`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none w-56 text-sm dark:text-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" size={14} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none appearance-none cursor-pointer dark:text-slate-300 font-medium"
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="warned">Warned</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
          <button
            onClick={() => fetchUsers()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={users.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-all disabled:opacity-40"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle size={18} className="shrink-0" />
          <span className="font-medium">{error}</span>
          <button onClick={() => fetchUsers()} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                <tr>
                  {['User', 'Location', 'Status', 'Verified', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {[1,2,3,4,5,6,7,8].map(i => <SkeletonTableRow key={i} cols={6} />)}
              </tbody>
            </table>
          </div>
        ) : users.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Location</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Verified</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Joined</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {users.map((user) => {
                    const status = mapUserStatus(user);
                    return (
                      <tr key={user._id} className="hover:bg-teal-50/30 dark:hover:bg-teal-500/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.photos?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=14b8a6&color=fff`}
                              className="h-10 w-10 rounded-xl object-cover ring-1 ring-gray-100 dark:ring-slate-700 group-hover:scale-105 transition-transform"
                              alt={user.name}
                            />
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                          {user.location?.city || user.location?.country || user.livingIn || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${statusBadge(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.verified ? (
                            <CheckCircle2 size={16} className="text-teal-500" />
                          ) : (
                            <AlertTriangle size={16} className="text-amber-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400 dark:text-slate-500">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUserClick(user)}
                              className="p-2 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-all"
                              title="View profile"
                            >
                              <Eye size={15} />
                            </button>
                            {user.suspended ? (
                              <button
                                onClick={() => setConfirmModal({ user, type: 'unsuspend' })}
                                disabled={actionLoading !== null}
                                className="p-2 text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-lg hover:bg-amber-100 transition-all disabled:opacity-40"
                                title="Lift suspension"
                              >
                                <PlayCircle size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmModal({ user, type: 'suspend' })}
                                disabled={user.banned || actionLoading !== null}
                                className="p-2 text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-lg hover:bg-amber-100 transition-all disabled:opacity-40"
                                title="Suspend user"
                              >
                                <PauseCircle size={15} />
                              </button>
                            )}
                            {user.banned ? (
                              <button
                                onClick={() => setConfirmModal({ user, type: 'unban' })}
                                disabled={actionLoading !== null}
                                className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-40"
                                title="Restore access"
                              >
                                {actionLoading === user._id + 'unban' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmModal({ user, type: 'ban' })}
                                disabled={actionLoading !== null}
                                className="p-2 text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:bg-rose-100 transition-all disabled:opacity-40"
                                title="Ban user"
                              >
                                {actionLoading === user._id + 'ban' ? <Loader2 size={15} className="animate-spin" /> : <UserX size={15} />}
                              </button>
                            )}
                            <PermissionGuard action="delete_user" lockLabel="Super Admin only">
                              <button
                                onClick={() => setConfirmModal({ user, type: 'delete' })}
                                disabled={actionLoading !== null}
                                className="p-2 text-gray-400 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-all disabled:opacity-40"
                                title="Delete account"
                              >
                                {actionLoading === user._id + 'delete' ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                              </button>
                            </PermissionGuard>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Page {page} of {totalPages} · {totalUsers.toLocaleString()} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 hover:border-teal-400 transition-all disabled:opacity-40"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const pageNum = start + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${pageNum === page ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 hover:border-teal-400 transition-all disabled:opacity-40"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        ) : !error ? (
          <div className="p-16 text-center">
            <div className="bg-gray-50 dark:bg-slate-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
              <X size={22} className="text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">No users found</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Try adjusting your search or filter.</p>
          </div>
        ) : null}
      </div>

      {/* User detail modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-xl animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/10 flex flex-col">
            {/* Modal header bar */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <h2 className="text-lg font-black dark:text-white">User Profile</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-2.5 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col md:flex-row items-start gap-6 mt-6 mb-8">
                <div
                  className="p-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl ring-1 ring-black/5 shrink-0 cursor-pointer hover:ring-teal-400 transition-all"
                  onClick={() => { const url = selectedUser.photos?.[0]?.url; if (url) setLightboxPhoto(url); }}
                  title="Click to enlarge"
                >
                  <img
                    src={selectedUser.photos?.[0]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name || 'U')}&background=14b8a6&color=fff&size=200`}
                    className="h-36 w-36 rounded-xl object-cover"
                    alt={selectedUser.name}
                  />
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">{selectedUser.name}</h2>
                    {selectedUser.verified && (
                      <span className="bg-teal-500 text-white px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 uppercase tracking-widest">
                        <Award size={12} /> VERIFIED
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusBadge(mapUserStatus(selectedUser))}`}>
                      {mapUserStatus(selectedUser)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-gray-500 dark:text-slate-400 text-sm">
                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-teal-500" /> {selectedUser.location?.city || selectedUser.location?.country || selectedUser.livingIn || 'Not set'}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-teal-500" /> {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Unknown'}</span>
                    {selectedUser.age && <span className="flex items-center gap-1.5"><span className="text-teal-500 text-xs font-bold">Age</span> {selectedUser.age}</span>}
                    {selectedUser.email && <span className="text-xs text-gray-400">{selectedUser.email}</span>}
                  </div>
                </div>
                <div className="flex gap-2 pb-2 flex-wrap">
                  {selectedUser.suspended ? (
                    <button
                      onClick={() => setConfirmModal({ user: selectedUser, type: 'unsuspend' })}
                      className="px-5 py-2.5 bg-amber-500 text-white text-xs font-black rounded-xl hover:bg-amber-600 transition-all flex items-center gap-2"
                    >
                      <PlayCircle size={15} /> Lift Suspension
                    </button>
                  ) : !selectedUser.banned && (
                    <button
                      onClick={() => setConfirmModal({ user: selectedUser, type: 'suspend' })}
                      className="px-5 py-2.5 bg-amber-500 text-white text-xs font-black rounded-xl hover:bg-amber-600 transition-all flex items-center gap-2"
                    >
                      <PauseCircle size={15} /> Suspend
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmModal({ user: selectedUser, type: selectedUser.banned ? 'unban' : 'ban' })}
                    className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center gap-2 ${selectedUser.banned ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
                  >
                    {selectedUser.banned ? <><CheckCircle2 size={15} /> Restore Access</> : <><UserX size={15} /> Ban User</>}
                  </button>
                  <PermissionGuard action="delete_user" lockLabel="Super Admin only">
                    <button
                      onClick={() => setConfirmModal({ user: selectedUser, type: 'delete' })}
                      className="px-5 py-2.5 bg-gray-700 text-white text-xs font-black rounded-xl hover:bg-gray-800 transition-all flex items-center gap-2"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </PermissionGuard>
                </div>
              </div>

              <div className="flex border-b border-gray-100 dark:border-slate-800 mb-6 sticky top-0 bg-white dark:bg-slate-900 z-10">
                {[
                  { id: 'bio', label: 'Profile', icon: <Eye size={14} /> },
                  { id: 'activity', label: 'Activity', icon: <History size={14} /> },
                  { id: 'safety', label: 'Safety', icon: <ShieldAlert size={14} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveProfileTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeProfileTab === tab.id ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="pb-10">
                {activeProfileTab === 'bio' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* All photos - clickable */}
                    {selectedUser.photos?.length > 0 && (
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Camera size={12} /> Photos ({selectedUser.photos.length})</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {selectedUser.photos.map((photo: any, i: number) => {
                            const url = photo?.url || (typeof photo === 'string' ? photo : null);
                            if (!url) return null;
                            return (
                              <div
                                key={i}
                                className="aspect-square rounded-xl overflow-hidden border-2 border-gray-100 dark:border-slate-700 cursor-pointer hover:border-teal-400 transition-all group relative"
                                onClick={() => setLightboxPhoto(url)}
                              >
                                <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={`Photo ${i + 1}`} />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                  <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                                {photo?.privacy && (
                                  <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">{photo.privacy}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bio */}
                    {selectedUser.bio && (
                      <div className="p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bio</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">"{selectedUser.bio}"</p>
                      </div>
                    )}

                    {/* Core details */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Job / Title', value: selectedUser.jobTitle, icon: <Briefcase size={10} /> },
                        { label: 'Education', value: selectedUser.education, icon: <GraduationCap size={10} /> },
                        { label: 'Relationship Goal', value: selectedUser.relationshipGoal, icon: <Heart size={10} /> },
                        { label: 'Ethnicity', value: selectedUser.ethnicity, icon: null },
                        { label: 'Religion', value: selectedUser.religion, icon: null },
                        { label: 'Height', value: selectedUser.height ? `${selectedUser.height} cm` : null, icon: null },
                        { label: 'Drinking', value: selectedUser.lifestyle?.drinking, icon: <Wine size={10} /> },
                        { label: 'Smoking', value: selectedUser.lifestyle?.smoking, icon: <Cigarette size={10} /> },
                        { label: 'Has Kids', value: selectedUser.hasKids != null ? (selectedUser.hasKids ? 'Yes' : 'No') : null, icon: null },
                        { label: 'Wants Kids', value: selectedUser.wantsKids, icon: null },
                        { label: 'Language', value: Array.isArray(selectedUser.languages) ? selectedUser.languages.join(', ') : selectedUser.language, icon: null },
                        { label: 'Zodiac', value: selectedUser.zodiac, icon: null },
                        { label: 'Hometown', value: selectedUser.hometown, icon: <MapPin size={10} /> },
                        { label: 'Phone', value: selectedUser.phone, icon: null },
                        { label: 'Gender', value: selectedUser.gender, icon: null },
                        { label: 'Sexual Orientation', value: selectedUser.sexualOrientation, icon: null },
                      ].map(item => item.value ? (
                        <div key={item.label} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">{item.icon} {item.label}</p>
                          <p className="text-sm font-semibold dark:text-white">{item.value}</p>
                        </div>
                      ) : null)}
                    </div>

                    {getLoveLocations(selectedUser).length > 0 && (
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Heart size={12} /> Love Locations</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {getLoveLocations(selectedUser).map((location, i) => (
                            <div key={i} className="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20">
                              <p className="text-sm font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                                <MapPin size={13} /> {location}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interests */}
                    {selectedUser.interests?.length > 0 && (
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Tag size={12} /> Interests</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedUser.interests.map((interest: string, i: number) => (
                            <span key={i} className="px-3 py-1.5 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 rounded-lg text-xs font-bold">
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompts */}
                    {selectedUser.prompts?.length > 0 && (
                      <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Prompts</p>
                        <div className="space-y-2">
                          {selectedUser.prompts.map((p: any, i: number) => (
                            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                              <p className="text-[10px] font-black text-slate-400 mb-1">{p.question}</p>
                              <p className="text-sm dark:text-white">{p.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeProfileTab === 'activity' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Last Active', value: selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleString() : '—' },
                        { label: 'Joined', value: selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—' },
                        { label: 'Premium', value: selectedUser.premium?.isActive ? 'Active' : 'Free' },
                        { label: 'Online Now', value: selectedUser.online ? 'Yes' : 'No' },
                      ].map(item => (
                        <div key={item.label} className="p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                          <p className="text-sm font-bold dark:text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User ID</p>
                      <p className="text-xs font-mono text-slate-500 break-all">{selectedUser._id}</p>
                    </div>
                  </div>
                )}
                {activeProfileTab === 'safety' && (
                  <div className="space-y-4 animate-fadeIn">
                    {[
                      { label: 'Account Status', value: mapUserStatus(selectedUser).toUpperCase(), color: mapUserStatus(selectedUser) === 'active' ? 'text-emerald-600' : 'text-rose-600' },
                      { label: 'Warnings', value: String(selectedUser.warnings || 0), color: 'text-amber-600' },
                      { label: 'Ban Reason', value: selectedUser.banReason || '—', color: 'dark:text-white' },
                      { label: 'Banned At', value: selectedUser.bannedAt ? new Date(selectedUser.bannedAt).toLocaleString() : '—', color: 'dark:text-white' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                        <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                    <div className="p-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Cigarette size={14} className="text-amber-500" />
                        <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Lifestyle Flags</p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Smoking: {selectedUser.lifestyle?.smoking || 'N/A'} · Drinking: {selectedUser.lifestyle?.drinking || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fadeIn"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-all z-10"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxPhoto}
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            alt="Full size photo"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-white/10 p-8">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
              confirmModal.type === 'delete' ? 'bg-rose-100 dark:bg-rose-500/10' :
              confirmModal.type === 'ban' ? 'bg-rose-100 dark:bg-rose-500/10' :
              confirmModal.type === 'suspend' ? 'bg-amber-100 dark:bg-amber-500/10' :
              'bg-emerald-100 dark:bg-emerald-500/10'
            }`}>
              {confirmModal.type === 'delete' ? <Trash2 size={24} className="text-rose-500" /> :
               confirmModal.type === 'ban' ? <UserX size={24} className="text-rose-500" /> :
               confirmModal.type === 'suspend' ? <PauseCircle size={24} className="text-amber-500" /> :
               <CheckCircle2 size={24} className="text-emerald-500" />}
            </div>
            <h3 className="text-lg font-black text-center dark:text-white mb-2">
              {confirmModal.type === 'delete' ? 'Delete Account' :
               confirmModal.type === 'ban' ? 'Ban User' :
               confirmModal.type === 'unban' ? 'Restore Access' :
               confirmModal.type === 'suspend' ? 'Suspend User' :
               'Lift Suspension'}
            </h3>
            <p className="text-sm text-center text-gray-500 dark:text-slate-400 mb-6">
              {confirmModal.type === 'delete' ? `Permanently delete ${confirmModal.user.name}'s account? This cannot be undone.` :
               confirmModal.type === 'ban' ? `Ban ${confirmModal.user.name} from the platform?` :
               confirmModal.type === 'unban' ? `Restore full access for ${confirmModal.user.name}?` :
               confirmModal.type === 'suspend' ? `Suspend ${confirmModal.user.name} for how many days?` :
               `Remove ${confirmModal.user.name}'s suspension?`}
            </p>
            {confirmModal.type === 'suspend' && (
              <div className="mb-6">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Suspension Duration</label>
                <select
                  value={suspendDays}
                  onChange={e => setSuspendDays(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none dark:text-white"
                >
                  {[1, 3, 7, 14, 30, 90].map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading !== null}
                className={`flex-1 py-3 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  confirmModal.type === 'delete' || confirmModal.type === 'ban' ? 'bg-rose-500 hover:bg-rose-600' :
                  confirmModal.type === 'suspend' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
