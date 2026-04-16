import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, ShieldCheck, AlertCircle, Eye, ZoomIn, Loader2, RefreshCw, X } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import FaceComparison from '../components/FaceComparison';

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
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

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

  const getProfilePhoto = (req: any): string =>
    req.photos?.[0]?.url || req.photos?.[0] ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(req.name || 'U')}&size=400&background=14b8a6&color=fff`;

  const getSelfiePhoto = (req: any): string | null =>
    req.selfiePhoto || req.verificationPhoto || req.idPhoto || null;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">ID Verification</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Review selfie + profile photo to verify users</p>
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
        {/* Queue */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold mb-5 dark:text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-500" /> Verification Queue
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-teal-500" />
            </div>
          ) : verifications.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
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
                      src={getProfilePhoto(req)}
                      className="h-11 w-11 rounded-xl object-cover ring-1 ring-white dark:ring-slate-700"
                      alt=""
                    />
                    <div>
                      <p className="text-sm font-black dark:text-white">{req.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{req.email}</p>
                      {getSelfiePhoto(req) ? (
                        <p className="text-[10px] text-teal-500 font-semibold mt-0.5">Selfie submitted</p>
                      ) : (
                        <p className="text-[10px] text-amber-500 font-semibold mt-0.5">No selfie photo</p>
                      )}
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

        {/* Review panel */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          {!selectedRequest ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
              <ZoomIn size={56} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold dark:text-white">Review Workspace</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2">Select a pending submission from the queue to begin the verification review.</p>
            </div>
          ) : (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black dark:text-white">Reviewing: {selectedRequest.name}</h3>
                  <p className="text-xs text-slate-400">{selectedRequest.email}</p>
                </div>
                <span className="text-[10px] font-black px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg uppercase tracking-widest">Pending</span>
              </div>

              {/* Side-by-side photos */}
              <div className="grid grid-cols-2 gap-4">
                {/* Profile photo */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Profile Photo</p>
                  <div
                    className="relative group aspect-square cursor-pointer"
                    onClick={() => setLightboxPhoto(getProfilePhoto(selectedRequest))}
                    title="Click to view full size"
                  >
                    <img
                      src={getProfilePhoto(selectedRequest)}
                      className="w-full h-full object-cover rounded-2xl border-2 border-gray-200 dark:border-slate-700 group-hover:border-teal-400 transition-colors"
                      alt="Profile"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-2xl flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 text-white">
                        <ZoomIn size={28} className="drop-shadow-lg" />
                        <span className="text-[10px] font-black tracking-widest uppercase">Expand</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submitted selfie */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Submitted Selfie</p>
                  {getSelfiePhoto(selectedRequest) ? (
                    <div
                      className="relative group aspect-square cursor-pointer"
                      onClick={() => setLightboxPhoto(getSelfiePhoto(selectedRequest)!)}
                      title="Click to view full size"
                    >
                      <img
                        src={getSelfiePhoto(selectedRequest)!}
                        className="w-full h-full object-cover rounded-2xl border-2 border-rose-200 dark:border-rose-500/40 group-hover:border-rose-400 transition-colors"
                        alt="Submitted Selfie"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-2xl flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 text-white">
                          <ZoomIn size={28} className="drop-shadow-lg" />
                          <span className="text-[10px] font-black tracking-widest uppercase">Expand</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 flex flex-col items-center justify-center gap-2 text-amber-500">
                      <AlertCircle size={32} className="opacity-60" />
                      <p className="text-xs font-bold text-center px-4">No selfie photo submitted</p>
                    </div>
                  )}
                </div>
              </div>

              {/* All profile photos */}
              {selectedRequest.photos?.length > 1 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">All Profile Photos</p>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedRequest.photos.map((photo: any, i: number) => {
                      const url = photo?.url || (typeof photo === 'string' ? photo : null);
                      if (!url) return null;
                      return (
                        <div
                          key={i}
                          className="aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 cursor-pointer hover:border-teal-400 transition-colors group relative"
                          onClick={() => setLightboxPhoto(url)}
                        >
                          <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={`Photo ${i + 1}`} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <Eye size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Face Comparison */}
              {getSelfiePhoto(selectedRequest) && (
                <FaceComparison
                  profilePhotoUrl={getProfilePhoto(selectedRequest)}
                  selfiePhotoUrl={getSelfiePhoto(selectedRequest)!}
                  onResult={(matched, score) => {
                    if (!matched) {
                      showToast?.(`AI flagged: faces don't match (${score}% confidence). Review carefully.`, 'error');
                    }
                  }}
                />
              )}

              <div className="p-4 bg-teal-50 dark:bg-teal-500/5 rounded-2xl border border-teal-100 dark:border-teal-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-teal-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-teal-700 dark:text-teal-400 leading-relaxed">
                    <strong>Check:</strong> Facial features, bone structure, and eye shape must match between both images. Click either photo to expand for a closer look. Reject if there are signs of AI generation, spoofing, or mismatched identity.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rejection Reason (if rejecting)</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm outline-none resize-none dark:text-white focus:ring-2 focus:ring-teal-500"
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
                  Approve & Verify
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 backdrop-blur-sm animate-fadeIn"
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
            alt="Full size"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-6 text-white/50 text-xs">Click outside or press × to close</p>
        </div>
      )}
    </div>
  );
};

export default IDVerification;
