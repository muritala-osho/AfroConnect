import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Search, MoreVertical, User, Phone, Video, 
  Smile, Paperclip, Check, CheckCheck, Sparkles, 
  AlertCircle, ShieldCheck, Clock, X,
  MessagesSquare, Loader2, RefreshCw
} from 'lucide-react';
import { SupportTicket, TicketMessage } from '../types';
import { adminApi } from '../services/adminApi';

const priorityColor: Record<string, string> = {
  high: 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  medium: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const SupportInbox: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [input, setInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await adminApi.getAllSupportTickets();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const selectTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    try {
      const data = await adminApi.getSupportTicket(ticket._id);
      if (data.success && data.ticket?.messages) {
        setMessages(data.ticket.messages);
      } else {
        setMessages(ticket.messages || []);
      }
    } catch {
      setMessages(ticket.messages || []);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedTicket) return;
    setIsSending(true);
    const optimistic: TicketMessage = {
      role: 'admin',
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    try {
      await adminApi.replySupportUnified(selectedTicket._id, optimistic.content);
    } catch {
    } finally {
      setIsSending(false);
    }
  };

  const generateAiSuggestion = async () => {
    setIsAiGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      const suggestions = [
        "Thank you for reaching out! I've reviewed your account and can confirm your subscription is active. Could you please try logging out and back in to refresh your session?",
        "I completely understand your frustration. Let me escalate this to our billing team right away. You should receive a resolution within 24 hours.",
        "I've looked into your account and I can see the issue. I'll apply a complimentary extension to your subscription while we resolve this for you.",
      ];
      setInput(suggestions[Math.floor(Math.random() * suggestions.length)]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.userName?.toLowerCase().includes(search.toLowerCase()) ||
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.userEmail?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-160px)] flex bg-white dark:bg-slate-900 rounded-[3rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-2xl animate-fadeIn">

      <div className="w-80 border-r border-gray-50 dark:border-slate-800 flex flex-col shrink-0">
        <div className="p-8 border-b border-gray-50 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black dark:text-white">Support Threads</h2>
            <button onClick={fetchTickets} className="p-2 text-slate-400 hover:text-brand-500 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl outline-none text-xs font-bold dark:text-white border border-transparent focus:border-brand-500/30 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-50">
              <Loader2 size={28} className="animate-spin text-brand-500 mb-3" />
              <p className="text-xs font-bold text-slate-400">Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40 px-6 text-center">
              <MessagesSquare size={36} className="text-slate-300 mb-3" />
              <p className="text-sm font-black dark:text-white">No tickets found</p>
              <p className="text-xs text-slate-500 font-medium mt-2">Support threads will appear here as users submit requests.</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <div
                key={ticket._id}
                onClick={() => selectTicket(ticket)}
                className={`p-6 flex items-center gap-4 cursor-pointer transition-all border-l-4 ${
                  selectedTicket?._id === ticket._id
                    ? 'bg-brand-50/50 dark:bg-brand-500/5 border-brand-500'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-lg">
                    {(ticket.userName || 'U')[0].toUpperCase()}
                  </div>
                  {ticket.status === 'open' && (
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-black dark:text-white truncate">{ticket.userName || 'Unknown User'}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${priorityColor[ticket.priority] || priorityColor.low}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{ticket.subject}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30 dark:bg-slate-950/20">
        {selectedTicket ? (
          <>
            <div className="h-24 px-8 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-500">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
                    {selectedTicket.userName}
                    <ShieldCheck size={16} className="text-brand-500" />
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${selectedTicket.status === 'open' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedTicket.subject}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-3 text-slate-400 hover:text-brand-500 transition-all"><Phone size={18} /></button>
                <button className="p-3 text-slate-400 hover:text-brand-500 transition-all"><Video size={18} /></button>
                <button className="p-3 text-slate-400 hover:text-brand-500 transition-all"><MoreVertical size={18} /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
              <div className="flex justify-center mb-10">
                <span className="px-4 py-1.5 bg-white dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-gray-100 dark:border-slate-700 shadow-sm">
                  Ticket #{selectedTicket._id.slice(-8).toUpperCase()} · {selectedTicket.category}
                </span>
              </div>

              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-brand-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 text-center">
                  <MessagesSquare size={40} className="text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400">No messages yet</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={msg._id || idx} className={`flex ${msg.role !== 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div className={`max-w-[70%] group ${msg.role !== 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-6 py-4 rounded-[2rem] text-sm font-medium shadow-sm transition-all hover:shadow-md ${
                        msg.role !== 'user'
                          ? 'bg-brand-500 text-white rounded-tr-lg'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-tl-lg'
                      }`}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 mt-2 px-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">{formatTime(msg.timestamp)}</span>
                        {msg.role !== 'user' && <CheckCheck size={12} className="text-brand-500" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 border-t border-gray-50 dark:border-slate-800">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {['Greeting', 'Escalation', 'Resolved', 'Verify ID'].map(tag => (
                      <button key={tag} className="px-3 py-1 bg-gray-50 dark:bg-slate-800 hover:bg-brand-500 hover:text-white rounded-lg text-[9px] font-black uppercase text-slate-500 transition-all border border-gray-100 dark:border-slate-700">{tag}</button>
                    ))}
                  </div>
                  <button
                    onClick={generateAiSuggestion}
                    disabled={isAiGenerating}
                    className="flex items-center gap-2 text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest hover:underline disabled:opacity-50"
                  >
                    <Sparkles size={14} className={isAiGenerating ? 'animate-pulse' : ''} />
                    {isAiGenerating ? 'Synthesizing...' : 'Suggest Neural Response'}
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Type a secure message..."
                    className="w-full pl-12 pr-24 py-5 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[1.5rem] outline-none focus:ring-4 focus:ring-brand-500/10 font-bold text-sm dark:text-white transition-all resize-none shadow-inner"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button className="text-slate-400 hover:text-brand-500 transition-colors"><Smile size={20} /></button>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    <button className="text-slate-400 hover:text-brand-500 transition-colors"><Paperclip size={20} /></button>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isSending}
                      className="p-3 bg-brand-500 text-white rounded-xl shadow-lg hover:bg-brand-600 transition-all disabled:opacity-50 active:scale-95"
                    >
                      {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-40">
            <div className="p-10 bg-gray-50 dark:bg-slate-800 rounded-full mb-8">
              <MessagesSquare size={64} className="text-brand-500" />
            </div>
            <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Support Inbox</h3>
            <p className="text-sm text-slate-500 font-medium max-w-xs mt-4">Select an active conversation thread from the left panel to begin transmission.</p>
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="w-80 border-l border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 p-8 space-y-10 overflow-y-auto custom-scrollbar">
          <div className="text-center">
            <div className="h-24 w-24 rounded-[2rem] bg-brand-500/10 flex items-center justify-center mx-auto mb-6 ring-4 ring-brand-500/10 shadow-xl text-brand-600 dark:text-brand-400 text-4xl font-black">
              {(selectedTicket.userName || 'U')[0].toUpperCase()}
            </div>
            <h4 className="text-lg font-black dark:text-white mb-1">{selectedTicket.userName}</h4>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedTicket.userEmail}</p>

            <div className="flex justify-center gap-2 mt-6">
              <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border ${priorityColor[selectedTicket.priority] || priorityColor.low}`}>
                {selectedTicket.priority} priority
              </span>
              <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 text-[9px] font-black uppercase rounded-lg border border-indigo-200 dark:border-indigo-500/20 capitalize">
                {selectedTicket.category}
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-gray-50 dark:border-slate-800 pb-3 flex items-center justify-between">
              Context Audit <Clock size={12} />
            </h5>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                <span className="text-xs font-black dark:text-white capitalize">{selectedTicket.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Messages</span>
                <span className="text-xs font-black dark:text-white">{messages.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned</span>
                <span className="text-xs font-black dark:text-white">{selectedTicket.assignedTo?.name || 'Unassigned'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Created</span>
                <span className="text-xs font-black dark:text-white">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-10 border-t border-gray-50 dark:border-slate-800">
            <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center justify-between">
              Critical Tools <AlertCircle size={12} />
            </h5>
            <div className="grid grid-cols-1 gap-3">
              <button className="w-full py-4 bg-rose-50 dark:bg-rose-500/5 text-rose-600 hover:bg-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Freeze Account</button>
              <button className="w-full py-4 bg-gray-50 dark:bg-slate-800 text-slate-500 hover:text-brand-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Request Video ID</button>
              <button className="w-full py-4 bg-gray-50 dark:bg-slate-800 text-slate-500 hover:text-brand-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportInbox;
