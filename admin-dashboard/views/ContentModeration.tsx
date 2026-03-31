import React, { useState, useEffect } from 'react';
import {
  ImageOff, CheckCircle, XCircle, Eye, Filter,
  Loader2, AlertTriangle, RefreshCw, Shield, Image as ImageIcon,
} from 'lucide-react';
import { FlaggedContent } from '../types';
import { adminApi } from '../services/adminApi';

interface Props {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const MOCK_FLAGGED: FlaggedContent[] = [
  {
    id: 'f1',
    userId: 'u2',
    userName: 'Marcus Chen',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop',
    type: 'profile_photo',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    reason: 'Possible nudity detected',
    flaggedAt: '2 hours ago',
    status: 'pending',
    aiConfidence: 72,
  },
  {
    id: 'f2',
    userId: 'u5',
    userName: 'Amara Diallo',
    userAvatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop',
    type: 'story',
    imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop',
    reason: 'Reported by 3 users',
    flaggedAt: '4 hours ago',
    status: 'pending',
    aiConfidence: 45,
  },
  {
    id: 'f3',
    userId: 'u7',
    userName: 'Kwame Asante',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop',
    type: 'message_image',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    reason: 'Suspected spam content',
    flaggedAt: '6 hours ago',
    status: 'approved',
    aiConfidence: 30,
  },
  {
    id: 'f4',
    userId: 'u9',
    userName: 'Fatima Osei',
    userAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop',
    type: 'profile_photo',
    imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
    reason: 'Reported for explicit content',
    flaggedAt: '1 day ago',
    status: 'rejected',
    aiConfidence: 88,
  },
];

const typeLabel: Record<FlaggedContent['type'], string> = {
  profile_photo: 'Profile Photo',
  story: 'Story',
  message_image: 'Message Image',
};

const statusColors: Record<FlaggedContent['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
};

const ContentModeration: React.FC<Props> = ({ showToast }) => {
  const [items, setItems] = useState<FlaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | FlaggedContent['status']>('all');
  const [preview, setPreview] = useState<FlaggedContent | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadContent = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getFlaggedContent().catch(() => null);
      setItems(res?.content ?? MOCK_FLAGGED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContent(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action);
    try {
      await adminApi.moderateContent(id, action).catch(() => null);
      setItems(prev =>
        prev.map(item =>
          item.id === id ? { ...item, status: action === 'approve' ? 'approved' : 'rejected' } : item,
        ),
      );
      showToast?.(
        action === 'approve' ? 'Content approved and kept.' : 'Content rejected and removed.',
        'success',
      );
    } catch {
      showToast?.('Action failed. Try again.', 'error');
    } finally {
      setActionLoading(null);
      setPreview(null);
    }
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Content Moderation</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium mt-1">
            Review and action AI-flagged or user-reported uploads
          </p>
        </div>
        <button
          onClick={loadContent}
          className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 transition-all shadow-sm"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`p-5 rounded-3xl border text-left transition-all shadow-sm ${
              filter === s
                ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-500/20'
                : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-teal-300'
            }`}
          >
            <p className={`text-2xl font-black mb-1 ${filter === s ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              {counts[s]}
            </p>
            <p className={`text-xs font-bold uppercase tracking-widest capitalize ${filter === s ? 'text-teal-100' : 'text-gray-500 dark:text-slate-400'}`}>
              {s === 'all' ? 'Total Flagged' : s}
            </p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          <Loader2 size={32} className="animate-spin text-teal-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
          <Shield size={48} className="text-teal-300 mb-4" />
          <p className="text-gray-500 dark:text-slate-400 font-semibold">No content in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all group"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-slate-800">
                <img
                  src={item.imageUrl}
                  alt="flagged content"
                  className={`w-full h-full object-cover transition-all duration-300 ${item.status === 'pending' ? 'blur-sm group-hover:blur-0' : ''}`}
                />
                {item.status === 'pending' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:opacity-0 transition-opacity pointer-events-none">
                    <div className="flex flex-col items-center text-white">
                      <Eye size={24} className="mb-1" />
                      <span className="text-xs font-bold">Hover to preview</span>
                    </div>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors[item.status]}`}>
                    {item.status}
                  </span>
                </div>
                {item.aiConfidence !== undefined && (
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span className="text-[10px] font-black text-white">AI: {item.aiConfidence}%</span>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <img src={item.userAvatar} alt={item.userName} className="h-8 w-8 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.userName}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">{typeLabel[item.type]}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">{item.reason}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-4">{item.flaggedAt}</p>

                {item.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={actionLoading !== null}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                      {actionLoading === item.id + 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={actionLoading !== null}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-all disabled:opacity-50"
                    >
                      {actionLoading === item.id + 'reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                      Reject
                    </button>
                  </div>
                )}

                {item.status !== 'pending' && (
                  <div className={`text-center py-2.5 rounded-xl text-xs font-bold ${statusColors[item.status]}`}>
                    {item.status === 'approved' ? '✓ Content Approved' : '✗ Content Removed'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-teal-50 dark:bg-teal-500/5 border border-teal-100 dark:border-teal-500/20 rounded-3xl p-6 flex items-start gap-4">
        <div className="p-3 bg-teal-500/10 rounded-2xl shrink-0">
          <ImageIcon size={20} className="text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-teal-900 dark:text-teal-300 mb-1">AI-Assisted Moderation</p>
          <p className="text-xs text-teal-700 dark:text-teal-400 leading-relaxed">
            Content is automatically flagged by AI models and user reports. AI confidence scores help prioritize your review queue.
            High-confidence flags (75%+) should be addressed first.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContentModeration;
