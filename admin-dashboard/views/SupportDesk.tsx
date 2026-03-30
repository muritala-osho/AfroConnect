import React, { useState } from 'react';
import { 
  LifeBuoy, MessageSquare, Clock, CheckCircle, Search, Filter, 
  User, Send, MoreVertical, Trash2, AlertCircle, PhoneCall
} from 'lucide-react';
import { SupportTicket } from '../types';

interface SupportDeskProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const SupportDesk: React.FC<SupportDeskProps> = ({ showToast }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([
    { id: 'TIC-1024', userId: 'u1', userName: 'Sarah Jenkins', subject: 'Billing Error', category: 'billing', status: 'open', priority: 'high', timestamp: '12m ago', message: "I was charged twice for the Platinum upgrade. Please check my transaction TX-9011." },
    { id: 'TIC-1025', userId: 'u2', userName: 'Marcus Chen', subject: 'Profile Appeal', category: 'account', status: 'in-progress', priority: 'medium', timestamp: '1h ago', message: "My profile was warned but I haven't violated any terms. Can you review my recent audit?" },
    { id: 'TIC-1026', userId: 'u3', userName: 'Alex Rivera', subject: 'Technical Glitch', category: 'technical', status: 'closed', priority: 'low', timestamp: '1d ago', message: "The app crashes when I try to upload my third photo." },
  ]);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSendReply = () => {
    if (!replyText || !selectedTicket) return;
    if (showToast) showToast(`Reply dispatched to citizen ${selectedTicket.userName}.`, 'success');
    setReplyText('');
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'in-progress' } : t));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Support Desk</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Citizen inquiry management and resolution hub</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
             <Clock size={16} className="text-brand-500" />
             <span className="text-xs font-black dark:text-white uppercase tracking-widest">Avg Response: 14m</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 sticky top-0 z-10 shadow-sm">
             <div className="relative">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input type="text" placeholder="Filter tickets..." className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none outline-none text-xs font-bold dark:text-white" />
             </div>
          </div>

          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              onClick={() => setSelectedTicket(ticket)}
              className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer group relative ${
                selectedTicket?.id === ticket.id 
                  ? 'bg-brand-500 text-white border-brand-600 shadow-xl shadow-brand-500/20' 
                  : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-brand-500 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                 <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                   selectedTicket?.id === ticket.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-slate-400'
                 }`}>
                   {ticket.id}
                 </span>
                 <span className={`text-[9px] font-black uppercase tracking-widest ${
                   ticket.priority === 'high' ? (selectedTicket?.id === ticket.id ? 'text-white' : 'text-rose-500') :
                   (selectedTicket?.id === ticket.id ? 'text-white/60' : 'text-slate-400')
                 }`}>
                   {ticket.priority} Priority
                 </span>
              </div>
              <h3 className="text-sm font-black mb-1 truncate">{ticket.subject}</h3>
              <p className={`text-xs font-medium mb-4 ${selectedTicket?.id === ticket.id ? 'text-white/80' : 'text-slate-500'}`}>
                {ticket.userName} • {ticket.timestamp}
              </p>
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                   ticket.status === 'open' ? 'bg-emerald-500 text-white' : 
                   ticket.status === 'in-progress' ? 'bg-amber-500 text-white' :
                   'bg-slate-400 text-white'
                }`}>
                   {ticket.status}
                </span>
                <MessageSquare size={16} className={selectedTicket?.id === ticket.id ? 'text-white' : 'text-slate-300'} />
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!selectedTicket ? (
            <div className="h-full bg-white dark:bg-slate-900 rounded-[3.5rem] border border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center p-20 text-center opacity-40">
              <div className="p-10 bg-gray-50 dark:bg-slate-800 rounded-full mb-8">
                <LifeBuoy size={64} className="text-brand-500" />
              </div>
              <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Support Workspace</h3>
              <p className="text-sm text-slate-400 font-medium max-w-xs mx-auto mt-4 leading-relaxed">Select a citizen inquiry from the ledger to begin resolution protocols.</p>
            </div>
          ) : (
            <div className="h-full bg-white dark:bg-slate-900 rounded-[3.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm">
               <div className="p-10 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-3xl bg-brand-500/10 text-brand-500 flex items-center justify-center text-xl font-black">
                      {selectedTicket.userName[0]}
                    </div>
                    <div>
                       <h2 className="text-xl font-black dark:text-white">{selectedTicket.userName}</h2>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{selectedTicket.subject}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                     <button className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-brand-500 transition-all">
                       <PhoneCall size={18} />
                     </button>
                     <button className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-rose-500 transition-all">
                       <Trash2 size={18} />
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                  <div className="flex items-start gap-6">
                    <div className="h-10 w-10 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <User size={18} />
                    </div>
                    <div className="max-w-2xl space-y-4">
                       <div className="p-8 bg-gray-50 dark:bg-slate-800 rounded-r-[2.5rem] rounded-bl-[2.5rem] text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed border border-gray-100 dark:border-slate-700">
                         {selectedTicket.message}
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{selectedTicket.timestamp}</p>
                    </div>
                  </div>

                  <div className="relative py-4">
                     <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-slate-800"></div></div>
                     <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-900 px-6 text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Communication Start</span></div>
                  </div>
               </div>

               <div className="p-10 border-t border-gray-50 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 shrink-0">
                  <div className="relative group">
                    <textarea 
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Compose resolution packet..."
                      className="w-full px-8 py-6 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 outline-none focus:ring-4 focus:ring-brand-500/10 font-bold text-sm dark:text-white transition-all shadow-sm resize-none"
                    />
                    <button 
                      onClick={handleSendReply}
                      disabled={!replyText}
                      className="absolute right-4 bottom-4 p-5 bg-brand-500 text-white rounded-[2rem] shadow-xl hover:bg-brand-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                  <div className="flex items-center gap-6 mt-6">
                     <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-brand-500 transition-colors flex items-center gap-2">
                       <CheckCircle size={14} /> Resolve Ticket
                     </button>
                     <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors flex items-center gap-2">
                       <AlertCircle size={14} /> Escalation
                     </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportDesk;
