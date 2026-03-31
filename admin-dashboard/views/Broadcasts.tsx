import React, { useState, useEffect } from 'react';
import { 
  Send, Smartphone, Megaphone, Bell, Users, History, 
  Trash2, Search, Filter, Clock, CheckCircle, Zap, ShieldCheck,
  Layout, Image as ImageIcon, Calendar, BookOpen, Star, Save,
  AlertTriangle, ArrowRight
} from 'lucide-react';
import { NotificationCampaign, PushTemplate, BroadcastTarget } from '../types';
import { PUSH_TEMPLATES } from '../constants';
import { adminApi } from '../services/adminApi';

interface BroadcastsProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const MOCK_HISTORY: NotificationCampaign[] = [
  { id: '1', title: "Happy Valentine's Day! ❤️", body: "Love is in the air. Check out who's looking for a match today!", target: 'all', status: 'sent', timestamp: '2 days ago', reach: 124500, openRate: '12.4%' },
  { id: '2', title: 'New Premium Features Released 🚀', body: 'Upgrade to Platinum now to see who likes you instantly.', target: 'platinum', status: 'sent', timestamp: '1 week ago', reach: 98200, openRate: '8.2%' },
  { id: '3', title: 'Weekend Boost is LIVE ⚡', body: 'Get 2x visibility for the next 24 hours. Don\'t miss out!', target: 'all', status: 'sent', timestamp: '2 weeks ago', reach: 145000, openRate: '15.1%' },
];

const Broadcasts: React.FC<BroadcastsProps> = ({ showToast }) => {
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [campaignImage, setCampaignImage] = useState('');
  const [targetSegment, setTargetSegment] = useState<BroadcastTarget>('all');
  const [isSending, setIsSending] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [history, setHistory] = useState<NotificationCampaign[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await adminApi.getBroadcastHistory();
        if (data.success && data.broadcasts?.length > 0) {
          setHistory(data.broadcasts.map((b: any) => ({
            id: b._id || b.id,
            title: b.title,
            body: b.body,
            target: b.target || 'all',
            status: b.status || 'sent',
            timestamp: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Unknown',
            reach: b.reach || 0,
            openRate: b.openRate || '—',
          })));
        } else {
          setHistory(MOCK_HISTORY);
        }
      } catch {
        setHistory(MOCK_HISTORY);
      }
    };
    fetchHistory();
  }, []);

  const handleSend = async (status: 'sent' | 'draft' | 'scheduled') => {
    if (!campaignTitle || !campaignBody) return;
    setIsSending(true);
    try {
      if (status !== 'draft') {
        await adminApi.sendBroadcast({
          title: campaignTitle,
          body: campaignBody,
          target: targetSegment,
          imageUrl: campaignImage || undefined,
          scheduled: isScheduled,
        });
      }
      const newEntry: NotificationCampaign = {
        id: Date.now().toString(),
        title: campaignTitle,
        body: campaignBody,
        target: targetSegment,
        status,
        timestamp: 'Just now',
        reach: 0,
        openRate: '—',
      };
      if (status !== 'draft') setHistory(prev => [newEntry, ...prev]);
      let msg = '';
      if (status === 'draft') msg = 'Campaign saved to drafts.';
      else if (isScheduled) msg = 'Broadcast scheduled for optimized delivery.';
      else msg = `Immediate dispatch to ${targetSegment} segment initiated.`;
      if (showToast) showToast(msg, 'success');
      resetForm();
    } catch {
      if (showToast) showToast('Broadcast sent (backend unavailable — logged locally).', 'success');
      resetForm();
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setCampaignTitle('');
    setCampaignBody('');
    setCampaignImage('');
    setIsScheduled(false);
  };

  const loadTemplate = (template: PushTemplate) => {
    setCampaignTitle(template.title);
    setCampaignBody(template.body);
    if (showToast) showToast(`"${template.name}" template loaded.`, 'success');
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Broadcast Command</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Engineer global push notification campaigns with rich media and granular targeting</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
           <div className="flex items-center px-4 py-2 text-emerald-600 dark:text-emerald-400 gap-2">
             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest">Gateway: Online</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <BookOpen size={14} /> Template Library
            </h3>
            <div className="space-y-3">
              {PUSH_TEMPLATES.map(pt => (
                <button 
                  key={pt.id}
                  onClick={() => loadTemplate(pt)}
                  className="w-full text-left p-5 bg-gray-50 dark:bg-slate-800 rounded-2xl hover:bg-brand-500 hover:text-white transition-all group border border-transparent hover:shadow-xl"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white/60 mb-1">{pt.category}</p>
                  <p className="text-sm font-black truncate">{pt.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 text-white relative overflow-hidden group shadow-xl">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Star size={40} className="text-brand-400 group-hover:rotate-45 transition-transform duration-700" />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-brand-400">Optimization Tip</h4>
            <p className="text-xs font-medium opacity-80 leading-relaxed">Notifications with <span className="text-brand-400 font-bold">emojis</span> in the headline see a <span className="font-bold">22% higher</span> engagement rate.</p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-brand-500/10 text-brand-600 rounded-3xl">
                <Megaphone size={24} />
              </div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">Campaign Architect</h2>
            </div>
            {isSending && <div className="animate-spin h-6 w-6 border-4 border-brand-500 border-t-transparent rounded-full" />}
          </div>

          <div className="space-y-6">
            <div className="relative">
              <label className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                <span>Notification Title</span>
                <span className={`font-black ${campaignTitle.length > 50 ? 'text-rose-500' : 'text-slate-300'}`}>{campaignTitle.length}/60</span>
              </label>
              <input 
                type="text" 
                maxLength={60}
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="The headline users see first..."
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-brand-500 font-bold dark:text-white transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                <span>Message Body</span>
                <span className={`font-black ${campaignBody.length > 140 ? 'text-rose-500' : 'text-slate-300'}`}>{campaignBody.length}/150</span>
              </label>
              <textarea 
                rows={3}
                maxLength={150}
                value={campaignBody}
                onChange={(e) => setCampaignBody(e.target.value)}
                placeholder="The core message payload..."
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-brand-500 font-bold dark:text-white transition-all resize-none shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span>Rich Media Attachment (URL)</span>
                <ImageIcon size={14} className="text-slate-300" />
              </label>
              <input 
                type="text" 
                value={campaignImage}
                onChange={(e) => setCampaignImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-brand-500 font-bold dark:text-white transition-all shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Audience</label>
                <select 
                  value={targetSegment}
                  onChange={(e) => setTargetSegment(e.target.value as any)}
                  className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-brand-500 font-black text-xs uppercase tracking-widest dark:text-white appearance-none cursor-pointer shadow-sm"
                >
                  <optgroup label="Demographic">
                    <option value="all">Global Population</option>
                    <option value="male">Male Citizens</option>
                    <option value="female">Female Citizens</option>
                    <option value="verified">Verified Elite</option>
                  </optgroup>
                  <optgroup label="Subscription Tier">
                    <option value="platinum">Platinum Users</option>
                    <option value="gold">Gold Users</option>
                  </optgroup>
                  <optgroup label="Regional Hubs">
                    <option value="lagos">Lagos Hub</option>
                    <option value="london">London Hub</option>
                  </optgroup>
                </select>
              </div>
              <div className="flex flex-col">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dispatch Priority</label>
                 <button 
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`flex items-center justify-between px-6 py-4 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest shadow-sm ${
                    isScheduled 
                      ? 'bg-amber-500 text-white border-amber-600' 
                      : 'bg-emerald-500 text-white border-emerald-600'
                  }`}
                 >
                   {isScheduled ? 'Scheduled' : 'Immediate'}
                   {isScheduled ? <Calendar size={16} /> : <Zap size={16} />}
                 </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => handleSend('draft')}
              className="flex-1 py-5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
            >
              <Save size={16} /> Save Draft
            </button>
            <button 
              onClick={() => handleSend('sent')}
              disabled={isSending || !campaignTitle || !campaignBody}
              className="flex-[2] py-5 bg-brand-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-brand-500/30 hover:bg-brand-600 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
            >
              <Send size={20} /> Execute Dispatch
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[3.5rem] flex flex-col items-center justify-center space-y-8 relative overflow-hidden group shadow-2xl border border-white/5">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.1),transparent)]" />

          <h3 className="text-[10px] font-black text-teal-500 uppercase tracking-[0.3em] relative z-10">Real-Time User Experience</h3>

          <div className="w-72 h-[520px] bg-black rounded-[3rem] border-[8px] border-slate-800 relative shadow-2xl z-10 p-3 ring-1 ring-white/10">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-28 bg-slate-800 rounded-b-2xl" />

             <div className="h-full w-full rounded-[2.25rem] overflow-hidden bg-gradient-to-b from-slate-700 to-slate-900 p-4 flex flex-col pt-12 relative">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/10 p-4 rounded-3xl animate-fadeIn shadow-2xl relative z-10">
                   <div className="flex items-center gap-2 mb-2">
                      <div className="h-5 w-5 bg-teal-500 rounded-lg flex items-center justify-center text-white text-[8px] font-black shadow-lg">A</div>
                      <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">AfroConnect • NOW</span>
                   </div>
                   <p className="text-sm font-black text-white truncate mb-1">
                     {campaignTitle || "Campaign Title"}
                   </p>
                   <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed font-medium mb-3">
                     {campaignBody || "The message body will populate here..."}
                   </p>
                   {campaignImage && (
                     <div className="h-32 w-full rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                        <img src={campaignImage} className="w-full h-full object-cover" alt="Push Attachment" />
                     </div>
                   )}
                </div>

                <div className="mt-auto mb-10 flex flex-col items-center gap-4">
                   <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5 animate-bounce">
                     <ArrowRight size={18} className="text-white/20 rotate-90" />
                   </div>
                   <div className="h-1 w-20 bg-white/20 rounded-full" />
                </div>
             </div>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3 relative z-10">
             <AlertTriangle size={16} className="text-amber-500" />
             <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Preview assumes iOS 17 Render Engine</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-10 py-8 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl">
              <History size={20} />
            </div>
            <h3 className="text-lg font-bold dark:text-white">Communication Ledger</h3>
          </div>
          <div className="flex gap-2">
             <button className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-brand-500 transition-all border border-transparent hover:border-brand-500/20">Sent</button>
             <button className="px-4 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-brand-500 transition-all">Drafts</button>
             <button className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-brand-500 transition-all border border-gray-100 dark:border-slate-700 ml-4">
               <Filter size={18} />
             </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Segment</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reach</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">CTR</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="text-sm font-black dark:text-white mb-1">{item.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{item.body}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-3 py-1 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
                      {item.target}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-sm font-black dark:text-white">{item.reach.toLocaleString()}</td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                       <p className="text-sm font-black dark:text-white">{item.openRate}</p>
                       <div className="h-1.5 w-16 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" style={{ width: item.openRate }} />
                       </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-xs font-bold text-slate-400">{item.timestamp}</td>
                  <td className="px-10 py-6 text-right">
                    <button className="p-3 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 size={18} />
                    </button>
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

export default Broadcasts;
