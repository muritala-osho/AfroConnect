import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Search, MoreVertical, User, Phone, Video, 
  Smile, Paperclip, Check, CheckCheck, Sparkles, 
  AlertCircle, ShieldCheck, BadgeCheck, Clock, X,
  MessagesSquare
} from 'lucide-react';
import { MOCK_USERS } from '../constants';
import { GoogleGenAI } from "@google/genai";

interface Message {
  id: string;
  role: 'user' | 'admin';
  content: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

const SupportInbox: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState<typeof MOCK_USERS[0] | null>(MOCK_USERS[0]);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'user', content: "Hi, I'm having trouble with my Gold subscription. It shows as active but I can't see who likes me.", timestamp: '10:42 AM', status: 'read' },
    { id: '2', role: 'admin', content: "Hello! I can certainly look into that for you. Could you please confirm if you've updated the app to the latest version?", timestamp: '10:45 AM', status: 'read' },
    { id: '3', role: 'user', content: "Yes, I updated it this morning but the issue persists. My transaction ID is TX-8921.", timestamp: '10:47 AM', status: 'read' },
  ]);
  const [input, setInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'admin',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  const generateAiSuggestion = async () => {
    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as a helpful Support Agent for AfroConnect dating app. 
                   The user said: "${lastUserMsg}"
                   Context: User is having subscription issues.
                   Suggest a polite, concise response.`,
      });
      if (response.text) {
        setInput(response.text.trim().replace(/"/g, ''));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="h-[calc(100vh-160px)] flex bg-white dark:bg-slate-900 rounded-[3rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-2xl animate-fadeIn">

      {/* Sidebar: Conversations */}
      <div className="w-80 border-r border-gray-50 dark:border-slate-800 flex flex-col shrink-0">
        <div className="p-8 border-b border-gray-50 dark:border-slate-800">
           <h2 className="text-xl font-black dark:text-white mb-6">Support Threads</h2>
           <div className="relative">
             <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl outline-none text-xs font-bold dark:text-white border border-transparent focus:border-brand-500/30 transition-all"
             />
           </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {MOCK_USERS.map((user) => (
            <div 
              key={user.id}
              onClick={() => setSelectedChat(user)}
              className={`p-6 flex items-center gap-4 cursor-pointer transition-all border-l-4 ${
                selectedChat?.id === user.id 
                  ? 'bg-brand-50/50 dark:bg-brand-500/5 border-brand-500' 
                  : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="relative">
                <img src={user.avatar} className="h-12 w-12 rounded-2xl object-cover shadow-sm" alt="" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center justify-between mb-1">
                   <p className="text-sm font-black dark:text-white truncate">{user.name}</p>
                   <span className="text-[9px] font-black text-slate-400 uppercase">10:47 AM</span>
                 </div>
                 <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">My transaction ID is TX-8921...</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30 dark:bg-slate-950/20">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-24 px-8 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-500">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
                      {selectedChat.name}
                      <ShieldCheck size={16} className="text-brand-500" />
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Presence</span>
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <button className="p-3 text-slate-400 hover:text-brand-500 transition-all"><Phone size={18} /></button>
                  <button className="p-3 text-slate-400 hover:text-brand-500 transition-all"><Video size={18} /></button>
                  <button className="p-3 text-slate-400 hover:text-brand-500 transition-all"><MoreVertical size={18} /></button>
               </div>
            </div>

            {/* Chat History */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar"
            >
               <div className="flex justify-center mb-10">
                 <span className="px-4 py-1.5 bg-white dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-gray-100 dark:border-slate-700 shadow-sm">Identity Linked: {selectedChat.id}</span>
               </div>

               {messages.map((msg) => (
                 <div key={msg.id} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                   <div className={`max-w-[70%] group ${msg.role === 'admin' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-6 py-4 rounded-[2rem] text-sm font-medium shadow-sm transition-all hover:shadow-md ${
                        msg.role === 'admin' 
                          ? 'bg-brand-500 text-white rounded-tr-lg' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-tl-lg'
                      }`}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 mt-2 px-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase">{msg.timestamp}</span>
                        {msg.role === 'admin' && (
                          msg.status === 'read' ? <CheckCheck size={12} className="text-brand-500" /> : <Check size={12} className="text-slate-300" />
                        )}
                      </div>
                   </div>
                 </div>
               ))}
            </div>

            {/* Input Bar */}
            <div className="p-8 bg-white dark:bg-slate-900 border-t border-gray-50 dark:border-slate-800">
               <div className="flex flex-col gap-4">
                  {/* AI Suggestion Tooltip */}
                  <div className="flex items-center justify-between">
                     <div className="flex gap-2">
                        {['Greeting', 'Escalation', 'Resolved', 'Verify ID'].map((tag) => (
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
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
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
                        disabled={!input.trim()}
                        className="p-3 bg-brand-500 text-white rounded-xl shadow-lg hover:bg-brand-600 transition-all disabled:opacity-50 active:scale-95"
                       >
                         <Send size={18} />
                       </button>
                    </div>
                  </div>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-40">
             <div className="p-10 bg-gray-50 dark:bg-slate-800 rounded-full mb-8">
                {/* Fix: Added missing MessagesSquare icon from lucide-react */}
                <MessagesSquare size={64} className="text-brand-500" />
             </div>
             <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Support Inbox Null</h3>
             <p className="text-sm text-slate-500 font-medium max-w-xs mt-4">Select an active conversation thread from the left panel to begin transmission.</p>
          </div>
        )}
      </div>

      {/* Right Sidebar: Context */}
      {selectedChat && (
        <div className="w-80 border-l border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 p-8 space-y-10 overflow-y-auto custom-scrollbar">
           <div className="text-center">
              <img src={selectedChat.avatar} className="h-24 w-24 rounded-[2rem] object-cover mx-auto mb-6 ring-4 ring-brand-500/10 shadow-xl" alt="" />
              <h4 className="text-lg font-black dark:text-white mb-1">{selectedChat.name}</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedChat.location}</p>

              <div className="flex justify-center gap-2 mt-6">
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 text-[9px] font-black uppercase rounded-lg border border-emerald-200 dark:border-emerald-500/20">Verified</span>
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 text-[9px] font-black uppercase rounded-lg border border-indigo-200 dark:border-indigo-500/20">Gold User</span>
              </div>
           </div>

           <div className="space-y-6">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-gray-50 dark:border-slate-800 pb-3 flex items-center justify-between">
                 Context Audit <Clock size={12} />
              </h5>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Account Age</span>
                    <span className="text-xs font-black dark:text-white">1.4 Years</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Risk Level</span>
                    <span className="text-xs font-black text-emerald-500">Nominal (5%)</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Last Match</span>
                    <span className="text-xs font-black dark:text-white">2h ago</span>
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
