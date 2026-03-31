import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, ShieldCheck, AlertCircle, Eye, ZoomIn, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

const IDVerification: React.FC = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const MOCK_VERIFICATIONS = [
    { _id: 'v1', name: 'James Okafor', email: 'james.okafor@example.com', photos: [`https://ui-avatars.com/api/?name=James+Okafor&background=14b8a6&color=fff&size=400`], verificationPhoto: `https://ui-avatars.com/api/?name=JO+ID&background=f43f5e&color=fff&size=400` },
    { _id: 'v2', name: 'Sofia Mensah', email: 'sofia.mensah@example.com', photos: [`https://ui-avatars.com/api/?name=Sofia+Mensah&background=6366f1&color=fff&size=400`], verificationPhoto: `https://ui-avatars.com/api/?name=SM+ID&background=f43f5e&color=fff&size=400` },
    { _id: 'v3', name: 'Kofi Asante', email: 'kofi.asante@example.com', photos: [`https://ui-avatars.com/api/?name=Kofi+Asante&background=06b6d4&color=fff&size=400`], verificationPhoto: `https://ui-avatars.com/api/?name=KA+ID&background=f43f5e&color=fff&size=400` },
  ];

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getVerifications();
      if (data.success && data.verifications?.length > 0) {
        setVerifications(data.verifications);
      } else {
        setVerifications(MOCK_VERIFICATIONS);
      }
    } catch (err) {
      console.error('Failed to fetch verifications — showing demo data:', err);
      setVerifications(MOCK_VERIFICATIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const handleAction = async (userId: string, approve: boolean) => {
    setActionLoading(true);
    try {
      if (approve) {
        const data = await adminApi.approveVerification(userId);
        if (data.success) {
          setVerifications(prev => prev.filter(v => (v._id || v.id) !== userId));
          setSelectedRequest(null);
        }
      } else {
        const data = await adminApi.rejectVerification(userId, 'Photos do not meet requirements');
        if (data.success) {
          setVerifications(prev => prev.filter(v => (v._id || v.id) !== userId));
          setSelectedRequest(null);
        }
      }
    } catch (err) {
      console.error('Verification action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getRequestId = (req: any) => req._id || req.id;

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Identity Verification</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Authenticating citizens for platform trust and safety</p>
        </div>
        <div className="flex items-center px-4 py-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 rounded-xl">
          <Clock size={16} className="text-amber-500 mr-2" />
          <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{verifications.length} Pending Review</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-500" /> Validation Queue
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-cyan-500" />
              <span className="ml-3 text-sm font-bold text-slate-400">Loading...</span>
            </div>
          ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {verifications.length > 0 ? verifications.map((req) => (
              <div 
                key={getRequestId(req)} 
                onClick={() => setSelectedRequest(req)}
                className={`p-5 rounded-[2rem] border transition-all cursor-pointer group flex items-center justify-between ${
                  selectedRequest && getRequestId(selectedRequest) === getRequestId(req) 
                    ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30' 
                    : 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <img src={req.photos?.[0] || `https://ui-avatars.com/api/?name=${req.name}&background=14b8a6&color=fff`} className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-700" alt="" />
                  <div>
                    <p className="text-sm font-black dark:text-white">{req.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{req.email}</p>
                  </div>
                </div>
                <div className="p-2 bg-white dark:bg-slate-700 rounded-xl text-slate-300 group-hover:text-cyan-500 transition-colors shadow-sm">
                  <Eye size={18} />
                </div>
              </div>
            )) : (
              <div className="text-center p-12 opacity-50">
                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                <p className="text-sm font-bold text-slate-400">All citizens verified.</p>
              </div>
            )}
          </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-sm">
          {!selectedRequest ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-50">
              <ZoomIn size={64} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold dark:text-white">Review Portal</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2">Select a citizen from the queue to start the visual validation process.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black dark:text-white">Validation Workspace</h3>
                <span className="text-[10px] font-black px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 rounded-lg uppercase tracking-widest">{selectedRequest.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Profile Photo</p>
                    <div className="relative group">
                      <img src={selectedRequest.photos?.[0] || `https://ui-avatars.com/api/?name=${selectedRequest.name}&size=400`} className="w-full aspect-square rounded-[2rem] object-cover shadow-xl border-4 border-white dark:border-slate-800" alt="" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] flex items-center justify-center">
                        <ZoomIn size={32} className="text-white" />
                      </div>
                    </div>
                 </div>
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Submitted ID/Selfie</p>
                    <div className="relative group">
                      <img src={selectedRequest.verificationPhoto || selectedRequest.idPhoto || selectedRequest.selfiePhoto || selectedRequest.photos?.[1] || `https://ui-avatars.com/api/?name=${selectedRequest.name}&size=400&background=f43f5e&color=fff`} className="w-full aspect-square rounded-[2rem] object-cover shadow-xl border-4 border-rose-500/20" alt="" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] flex items-center justify-center">
                        <ZoomIn size={32} className="text-white" />
                      </div>
                    </div>
                 </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle size={18} className="text-cyan-500 mt-1" />
                  <div>
                    <h4 className="text-xs font-black dark:text-white uppercase tracking-widest">Protocol Check</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Ensure physical features, bone structure, and eyes match between both images. Check for artifacts of AI generation or spoofing.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => handleAction(getRequestId(selectedRequest), false)}
                  disabled={actionLoading}
                  className="flex-1 py-5 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <XCircle size={18} /> Reject Identity
                </button>
                <button 
                  onClick={() => handleAction(getRequestId(selectedRequest), true)}
                  disabled={actionLoading}
                  className="flex-1 py-5 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Approve Citizen
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
