import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, ShieldCheck, AlertCircle, Eye, ZoomIn, Loader2, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/adminApi';

interface IDVerificationProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const IDVerification: React.FC<IDVerificationProps> = ({ showToast }) => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Photos do not match or do not meet requirements');

  const fetchVerifications = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const data = await adminApi.getVerifications();
      if (data.success) {
        setVerifications(data.verifications || []);
      } else {
        setError('Failed to load verification requests.');
        setVerifications([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not reach the backend.');
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleAction = async (userId: string, approve: boolean) => {
    setActionLoading(true);
    try {
      const data = approve
        ? await adminApi.approveVerification(userId)
        : await adminApi.rejectVerification(userId, rejectionReason);
      if (data.success) {
        setVerifications(prev => prev.filter(v => (v._id || v.id) !== userId));
        setSelectedRequest(null);
        showToast?.(approve ? 'User verified successfully.' : 'Verification rejected.', approve ? 'success' : 'error');
      }
    } catch (err: any) {
      showToast?.(err?.message || 'Action failed. Try again.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getRequestId = (req: any) => req._id || req.id;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">ID Verification</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Review selfie + ID submissions to verify users</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center px-4 py-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl">
            <Clock size={15} className="text-amber-500 mr-2" />
            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
              {loading ? '...' : `${verifications.length} Pending`}
            </span>
          </div>
          <button
            onClick={() => fetchVerifications()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm font-semibold text-gray-600 dark:text-slate-300 hover:border-teal-400 hover:text-teal-600 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl text-sm text-rose-700 dark:text-rose-400">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-medium">{error}</span>
          <button onClick={() => fetchVerifications()} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold mb-5 dark:text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-500" /> Verification Queue
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-teal-500" />
            </div>
          ) : verifications.length > 0 ? (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
              {verifications.map((req) => (
                <div
                  key={getRequestId(req)}
                  onClick={() => setSelectedRequest(req)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                    selectedRequest && getRequestId(selectedRequest) === getRequestId(req)
                      ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30'
                      : 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 hover:border-teal-400/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={req.photos?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.name || 'U')}&background=14b8a6&color=fff`}
                      className="h-11 w-11 rounded-xl object-cover ring-1 ring-white dark:ring-slate-700"
                      alt=""
                    />
                    <div>
                      <p className="text-sm font-black dark:text-white">{req.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{req.email}</p>
                    </div>
                  </div>
                  <div className={`p-2 rounded-xl transition-colors ${selectedRequest && getRequestId(selectedRequest) === getRequestId(req) ? 'text-teal-500' : 'text-slate-300 group-hover:text-teal-500'}`}>
                    <Eye size={16} />
                  </div>
                </div>
              ))}
            </div>
          ) : !error ? (
            <div className="text-center py-16">
              <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-sm font-bold text-slate-400">All verifications complete!</p>
              <p className="text-xs text-slate-400 mt-1">No pending submissions right now.</p>
            </div>
          ) : null}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          {!selectedRequest ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
              <ZoomIn size={56} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold dark:text-white">Review Workspace</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2">Select a pending submission from the queue to begin the verification review.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black dark:text-white">Reviewing: {selectedRequest.name}</h3>
                <span className="text-[10px] font-black px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg uppercase tracking-widest">Pending</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Profile Photo</p>
                  <div className="relative group aspect-square">
                    <img
                      src={selectedRequest.photos?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedRequest.name)}&size=400`}
                      className="w-full h-full object-cover rounded-2xl border-2 border-gray-100 dark:border-slate-700"
                      alt="Profile"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                      <ZoomIn size={28} className="text-white" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Submitted ID / Selfie</p>
                  <div className="relative group aspect-square">
                    <img
                      src={selectedRequest.verificationPhoto || selectedRequest.idPhoto || selectedRequest.selfiePhoto || selectedRequest.photos?.[1] || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedRequest.name)}&size=400&background=f43f5e&color=fff`}
                      className="w-full h-full object-cover rounded-2xl border-2 border-rose-200 dark:border-rose-500/30"
                      alt="ID"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                      <ZoomIn size={28} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-teal-50 dark:bg-teal-500/5 rounded-2xl border border-teal-100 dark:border-teal-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-teal-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-teal-700 dark:text-teal-400 leading-relaxed">
                    <strong>Check:</strong> Facial features, bone structure, and eye shape must match between both images. Reject if there are signs of AI generation, spoofing, or mismatched identity.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rejection Reason (if rejecting)</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none resize-none dark:text-white"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleAction(getRequestId(selectedRequest), false)}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Reject
                </button>
                <button
                  onClick={() => handleAction(getRequestId(selectedRequest), true)}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-teal-700 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Approve
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IDVerification;
