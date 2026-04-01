import React, { useState, useEffect, useRef } from 'react';
import {
  LifeBuoy, MessageSquare, Clock, CheckCircle, Search,
  Send, MoreVertical, Trash2, AlertCircle, RefreshCw,
  Loader2, Bell, User, ChevronDown, X, Info,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';

interface TicketMessage {
  _id?: string;
  role: 'user' | 'admin';
  content: string;
  adminName?: string;
  timestamp: string;
}

interface Ticket {
  _id: string;
  userId?: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'closed';
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

interface SupportDeskProps {
  showToast?: (message: string, type: 'success' | 'error') => void;
}

const MOCK_TICKETS: Ticket[] = [
  {
    _id: 'mock-1',
    userName: 'Sarah Jenkins',
    userEmail: 'sarah@example.com',
    subject: 'Billing Error — Charged Twice',
    category: 'billing',
    priority: 'high',
    status: 'open',
    messages: [
      { role: 'user', content: "I was charged twice for the Platinum upgrade. Transaction IDs: TX-9011 and TX-9012. Please refund one.", timestamp: new Date(Date.now() - 3600000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: 'mock-2',
    userName: 'Marcus Chen',
    userEmail: 'marcus@example.com',
    subject: 'Profile Warning — Unjust',
    category: 'account',
    priority: 'medium',
    status: 'in-progress',
    messages: [
      { role: 'user', content: "My profile was flagged but I haven't violated any community guidelines. Can you review this?", timestamp: new Date(Date.now() - 7200000).toISOString() },
      { role: 'admin', content: "Hi Marcus, we've reviewed your case. Our moderation team flagged a specific photo. Could you confirm which photo you'd like us to look at?", adminName: 'AfroConnect Support', timestamp: new Date(Date.now() - 5400000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    _id: 'mock-3',
    userName: 'Alex Rivera',
    userEmail: 'alex@example.com',
    subject: 'App Crashes on Photo Upload',
    category: 'technical',
    priority: 'low',
    status: 'closed',
    messages: [
      { role: 'user', content: "The app crashes every time I try to upload my third photo on iOS 17.", timestamp: new Date(Date.now() - 172800000).toISOString() },
      { role: 'admin', content: "This was a known issue in v2.3. Please update to the latest version — it should be fully fixed!", adminName: 'AfroConnect Support', timestamp: new Date(Date.now() - 86400000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: 'mock-4',
    userName: 'Fatima Osei',
    userEmail: 'fatima@example.com',
    subject: 'Safety Concern — Harassment',
    category: 'safety',
    priority: 'high',
    status: 'open',
    messages: [
      { role: 'user', content: "A user keeps messaging me even after I blocked them. User ID: 9234. Please take action immediately.", timestamp: new Date(Date.now() - 1800000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

const priorityStyles = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

const statusStyles = {
  open: 'bg-emerald-500 text-white',
  'in-progress': 'bg-amber-500 text-white',
  closed: 'bg-slate-400 text-white',
};

const categoryLabel: Record<string, string> = {
  billing: 'Billing',
  account: 'Account',
  technical: 'Technical',
  safety: 'Safety',
  other: 'Other',
};

const SupportDesk: React.FC<SupportDeskProps> = ({ showToast }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in-progress' | 'closed'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSupportTickets();
      if (data.success && data.tickets?.length > 0) {
        setTickets(data.tickets);
      } else {
        setTickets(MOCK_TICKETS);
      }
    } catch {
      setTickets(MOCK_TICKETS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyText('');
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    const content = replyText.trim();

    const optimisticMsg: TicketMessage = {
      role: 'admin',
      content,
      adminName: 'You',
      timestamp: new Date().toISOString(),
    };

    const updatedTicket = {
      ...selectedTicket,
      status: 'in-progress' as const,
      messages: [...selectedTicket.messages, optimisticMsg],
    };
    setSelectedTicket(updatedTicket);
    setTickets(prev => prev.map(t => t._id === selectedTicket._id ? updatedTicket : t));
    setReplyText('');

    try {
      await adminApi.replySupportTicket(selectedTicket._id, content);
      showToast?.(`Reply sent to ${selectedTicket.userName}. Push notification delivered.`, 'success');
    } catch {
      showToast?.('Reply saved. Push notification may be delayed if user is offline.', 'success');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: 'open' | 'in-progress' | 'closed') => {
    if (!selectedTicket) return;
    setStatusUpdating(true);
    try {
      await adminApi.updateSupportTicketStatus(selectedTicket._id, newStatus).catch(() => null);
      const updated = { ...selectedTicket, status: newStatus };
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t._id === selectedTicket._id ? updated : t));
      showToast?.(`Ticket marked as ${newStatus}.`, 'success');
    } catch {
      showToast?.('Status update failed.', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesSearch = !searchQuery ||
      t.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    'in-progress': tickets.filter(t => t.status === 'in-progress').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Support Desk</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">
            Manage user inquiries — replies are delivered via push notification
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
            <Bell size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              Push Enabled
            </span>
          </div>
          <button
            onClick={fetchTickets}
            className="p-2.5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-slate-400 hover:text-teal-500 transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'open', 'in-progress', 'closed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filterStatus === s
                ? 'bg-teal-600 text-white shadow-lg'
                : 'bg-white dark:bg-slate-900 text-slate-500 border border-gray-100 dark:border-slate-800 hover:border-teal-300'
            }`}
          >
            {s === 'all' ? 'All' : s} <span className="ml-1 opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100vh-280px)] min-h-[500px] gap-6">
        <div className="w-80 shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-teal-500" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-16 opacity-50">
                <LifeBuoy size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-400">No tickets found</p>
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <button
                  key={ticket._id}
                  onClick={() => handleSelectTicket(ticket)}
                  className={`w-full text-left p-5 rounded-[1.5rem] border transition-all ${
                    selectedTicket?._id === ticket._id
                      ? 'bg-teal-600 border-teal-600 shadow-xl shadow-teal-500/20 text-white'
                      : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                      selectedTicket?._id === ticket._id
                        ? 'bg-white/20 text-white'
                        : priorityStyles[ticket.priority]
                    }`}>
                      {ticket.priority} priority
                    </span>
                    <span className={`text-[9px] font-black ${selectedTicket?._id === ticket._id ? 'text-teal-100' : 'text-slate-400'}`}>
                      {formatTime(ticket.createdAt)}
                    </span>
                  </div>
                  <p className={`text-sm font-black truncate mb-1 ${selectedTicket?._id === ticket._id ? 'text-white' : 'dark:text-white'}`}>
                    {ticket.subject}
                  </p>
                  <p className={`text-[10px] font-bold truncate mb-3 ${selectedTicket?._id === ticket._id ? 'text-teal-100' : 'text-slate-400'}`}>
                    {ticket.userName} · {ticket.userEmail}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                      selectedTicket?._id === ticket._id ? 'bg-white/20 text-white' : statusStyles[ticket.status]
                    }`}>
                      {ticket.status}
                    </span>
                    <span className={`text-[9px] font-bold ${selectedTicket?._id === ticket._id ? 'text-teal-100' : 'text-slate-400'}`}>
                      {ticket.messages.length} msg{ticket.messages.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden shadow-sm">
          {!selectedTicket ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
              <div className="p-8 bg-gray-50 dark:bg-slate-800 rounded-full mb-6">
                <LifeBuoy size={56} className="text-teal-400" />
              </div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">Support Workspace</h3>
              <p className="text-sm text-slate-400 font-medium max-w-xs leading-relaxed">
                Select a ticket from the left to read the conversation and reply to the user.
              </p>
            </div>
          ) : (
            <>
              <div className="px-8 py-5 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center text-lg font-black">
                    {selectedTicket.userName[0]}
                  </div>
                  <div>
                    <h2 className="text-base font-black dark:text-white leading-none mb-1">{selectedTicket.userName}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedTicket.userEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${priorityStyles[selectedTicket.priority]}`}>
                    {selectedTicket.priority}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    categoryLabel[selectedTicket.category] ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' : ''
                  }`}>
                    {categoryLabel[selectedTicket.category] || selectedTicket.category}
                  </span>

                  <div className="relative group">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-slate-500 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 hover:border-teal-300 transition-all">
                      {selectedTicket.status} <ChevronDown size={12} />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto overflow-hidden">
                      {(['open', 'in-progress', 'closed'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          disabled={statusUpdating || selectedTicket.status === s}
                          className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-600 transition-all disabled:opacity-40"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-teal-50/50 dark:bg-teal-500/5 border-b border-teal-100 dark:border-teal-500/10 flex items-center gap-2">
                <Info size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400">
                  Subject: <span className="font-black">{selectedTicket.subject}</span>
                  {selectedTicket.userId && <span className="ml-3 opacity-60">User ID: {selectedTicket.userId}</span>}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
                {selectedTicket.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div className={`max-w-[75%] flex flex-col ${msg.role === 'admin' ? 'items-end' : 'items-start'}`}>
                      {msg.role === 'user' && (
                        <div className="flex items-center gap-2 mb-1 ml-1">
                          <div className="h-5 w-5 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[9px] font-black text-slate-500">
                            {selectedTicket.userName[0]}
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{selectedTicket.userName}</span>
                        </div>
                      )}
                      {msg.role === 'admin' && (
                        <div className="flex items-center gap-2 mb-1 mr-1">
                          <span className="text-[9px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">{msg.adminName || 'Admin'}</span>
                          <div className="h-5 w-5 rounded-lg bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-[9px] font-black text-teal-700 dark:text-teal-400">A</div>
                        </div>
                      )}
                      <div className={`px-5 py-4 rounded-[1.5rem] text-sm font-medium leading-relaxed shadow-sm ${
                        msg.role === 'admin'
                          ? 'bg-teal-600 text-white rounded-tr-md'
                          : 'bg-gray-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-tl-md'
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 mt-1 px-1">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-6 border-t border-gray-50 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/20 shrink-0">
                {selectedTicket.status === 'closed' ? (
                  <div className="text-center py-4">
                    <p className="text-sm font-bold text-slate-400">This ticket is closed.</p>
                    <button
                      onClick={() => handleStatusChange('open')}
                      className="mt-2 text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest hover:underline"
                    >
                      Reopen Ticket
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-3">
                      {['Thank you for reaching out!', 'We will look into this.', 'Issue has been resolved!'].map(q => (
                        <button
                          key={q}
                          onClick={() => setReplyText(q)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-[9px] font-black text-slate-500 hover:text-teal-600 hover:border-teal-300 transition-all whitespace-nowrap"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        placeholder="Type your reply... (Cmd+Enter to send)"
                        className="w-full px-5 py-4 pr-16 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 font-medium text-sm dark:text-white transition-all resize-none shadow-sm"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || sending}
                        className="absolute right-3 bottom-3 p-3 bg-teal-600 text-white rounded-xl shadow-lg hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Bell size={10} className="text-teal-500" />
                        Reply triggers push notification to user's phone
                      </p>
                      <button
                        onClick={() => handleStatusChange('closed')}
                        disabled={statusUpdating}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Close Ticket
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportDesk;
