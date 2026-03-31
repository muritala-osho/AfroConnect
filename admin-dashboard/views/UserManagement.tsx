import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, UserX, AlertTriangle, Eye, Sparkles, CheckCircle2, X, 
  MapPin, Calendar, Mail, MessageSquare, History, ShieldAlert, Award, Heart,
  Briefcase, GraduationCap, Info, Camera, Tag, Cigarette, Wine, HandMetal, Loader2
} from 'lucide-react';
import { analyzeUserContent, ModerationResult } from '../services/geminiServices';
import { adminApi } from '../services/adminApi';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<'bio' | 'activity' | 'safety'>('bio');
  const [aiAnalysis, setAiAnalysis] = useState<ModerationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned' | 'warned'>('all');

  const MOCK_USERS = [
    { _id: 'm1', name: 'Amara Diallo', email: 'amara.diallo@example.com', location: { country: 'Ghana' }, banned: false, suspended: false, isVerified: true, createdAt: '2024-01-15', photos: [] },
    { _id: 'm2', name: 'Kwame Asante', email: 'kwame.asante@example.com', location: { country: 'Nigeria' }, banned: false, suspended: false, isVerified: false, createdAt: '2024-02-20', photos: [] },
    { _id: 'm3', name: 'Fatima Osei', email: 'fatima.osei@example.com', location: { country: 'Kenya' }, banned: true, suspended: false, isVerified: true, createdAt: '2024-03-10', photos: [] },
    { _id: 'm4', name: 'Marcus Mensah', email: 'marcus.mensah@example.com', location: { country: 'South Africa' }, banned: false, suspended: true, isVerified: false, createdAt: '2024-03-25', photos: [] },
    { _id: 'm5', name: 'Nia Adeyemi', email: 'nia.adeyemi@example.com', location: { country: 'Senegal' }, banned: false, suspended: false, isVerified: true, createdAt: '2024-04-02', photos: [] },
    { _id: 'm6', name: 'Kofi Boateng', email: 'kofi.boateng@example.com', location: { country: 'Ghana' }, banned: false, suspended: false, isVerified: true, createdAt: '2024-04-10', photos: [] },
    { _id: 'm7', name: 'Zara Kamara', email: 'zara.kamara@example.com', location: { country: 'Sierra Leone' }, banned: false, suspended: false, isVerified: false, createdAt: '2024-04-15', photos: [] },
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await adminApi.getUsers(params);
      if (data.success && data.users?.length > 0) {
        setUsers(data.users);
      } else {
        setUsers(MOCK_USERS);
      }
    } catch (err) {
      console.error('Failed to fetch users — showing demo data:', err);
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const mapUserStatus = (user: any) => {
    if (user.banned) return 'banned';
    if (user.suspended) return 'suspended';
    return 'active';
  };

  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setAiAnalysis(null);
    setActiveProfileTab('bio');
  };

  const runAiModeration = async () => {
    if (!selectedUser) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeUserContent(selectedUser.bio || '', ['Citizen behavior audit']);
      setAiAnalysis(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleBan = async () => {
    if (!selectedUser) return;
    const isBanned = selectedUser.banned;
    try {
      const data = await adminApi.banUser(selectedUser._id, !isBanned, 'Admin action from dashboard');
      if (data.success) {
        const updated = { ...selectedUser, banned: !isBanned };
        setSelectedUser(updated);
        setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
      }
    } catch (err) {
      console.error('Ban toggle failed:', err);
    }
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm("Are you sure you want to permanently ban this account?")) {
      try {
        await adminApi.banUser(userId, true, 'Permanently banned by admin');
        setUsers(prev => prev.filter(u => u._id !== userId));
        setIsModalOpen(false);
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Citizen Management</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Overseeing {users.length} platform identities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-cyan-500 outline-none w-full md:w-72 shadow-sm transition-all text-sm font-medium dark:text-white"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" size={16} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="pl-10 pr-6 py-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 shadow-sm transition-all font-bold text-sm outline-none appearance-none cursor-pointer dark:text-slate-300"
            >
              <option value="all">All Citizens</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-cyan-500" />
            <span className="ml-3 text-sm font-bold text-slate-400">Loading citizens...</span>
          </div>
        ) : users.length > 0 ? (
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Full Identity</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Origin</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Account State</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Integrity Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {users.map((user) => {
                const status = mapUserStatus(user);
                return (
                <tr 
                  key={user._id} 
                  className="hover:bg-cyan-50/30 dark:hover:bg-cyan-500/5 transition-colors group cursor-pointer"
                  onClick={() => handleUserClick(user)}
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center">
                      <img src={user.photos?.[0] || `https://ui-avatars.com/api/?name=${user.name}&background=14b8a6&color=fff`} className="h-12 w-12 rounded-2xl object-cover mr-4 ring-2 ring-gray-100 dark:ring-slate-800 group-hover:scale-105 transition-transform" alt={user.name} />
                      <div>
                        <div className="text-sm font-black text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500 font-medium">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-gray-600 dark:text-slate-400">{user.location?.city || user.location?.country || '—'}</td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                      status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 
                      status === 'suspended' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 
                      'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    }`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center text-xs font-bold">
                      {user.verified ? (
                        <CheckCircle2 size={16} className="text-cyan-500 mr-2" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-500 mr-2" />
                      )}
                      <span className={user.verified ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}>
                        {user.verified ? 'VERIFIED' : 'UNVERIFIED'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleUserClick(user)}
                        className="p-2.5 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-all shadow-sm"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(user._id)}
                        className="p-2.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all shadow-sm"
                      >
                        <UserX size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-20 text-center">
            <div className="bg-gray-50 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <X size={24} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Citizen record not found</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Expand your search criteria or reset filters.</p>
          </div>
        )}
      </div>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-xl animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/10 flex flex-col">

            <div className="relative h-80 bg-slate-900 shrink-0">
               <div className="absolute inset-0 opacity-40 overflow-hidden">
                 <img 
                    src={selectedUser.photos?.[0] || `https://ui-avatars.com/api/?name=${selectedUser.name}&background=14b8a6&color=fff`} 
                    className="w-full h-full object-cover brightness-50" 
                    alt="" 
                 />
               </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent"></div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-8 right-8 text-white bg-black/40 hover:bg-black/60 p-3 rounded-2xl backdrop-blur-md transition-all z-20 border border-white/10"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-12 relative flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-10 -mt-32 mb-10 relative z-10">
                <div className="relative shrink-0">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl ring-1 ring-black/5">
                    <img 
                      src={selectedUser.photos?.[0] || `https://ui-avatars.com/api/?name=${selectedUser.name}&background=14b8a6&color=fff&size=200`} 
                      className="h-52 w-52 rounded-[3rem] object-cover" 
                      alt={selectedUser.name} 
                    />
                  </div>
                  <div className={`absolute bottom-6 right-6 h-7 w-7 rounded-full border-4 border-white dark:border-slate-900 shadow-lg ${!selectedUser.banned ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                </div>

                <div className="flex-1 pb-4 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-3">
                    <h2 className="text-4xl font-black text-white drop-shadow-2xl">{selectedUser.name}{selectedUser.age ? `, ${selectedUser.age}` : ''}</h2>
                    {selectedUser.verified && (
                      <span className="bg-cyan-500 text-white px-5 py-2 rounded-full text-[10px] font-black flex items-center gap-1.5 uppercase tracking-widest shadow-lg shadow-cyan-500/30">
                        <Award size={14} /> VERIFIED CITIZEN
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-8 text-slate-100 font-bold text-sm">
                    <span className="flex items-center gap-2 drop-shadow-md"><MapPin size={18} className="text-cyan-400" /> {selectedUser.location?.city || selectedUser.location?.country || 'Unknown'}</span>
                    <span className="flex items-center gap-2 drop-shadow-md"><Calendar size={18} className="text-cyan-400" /> {selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </div>

                <div className="flex gap-3 pb-4">
                  <button 
                    onClick={handleToggleBan}
                    className={`px-10 py-5 text-xs font-black rounded-[2rem] transition-all uppercase tracking-widest shadow-2xl flex items-center gap-3 active:scale-95 ${
                      selectedUser.banned 
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' 
                        : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'
                    }`}
                  >
                    {selectedUser.banned ? <CheckCircle2 size={18}/> : <UserX size={18}/>}
                    {selectedUser.banned ? 'Restore Access' : 'Suspend Access'}
                  </button>
                </div>
              </div>

              <div className="flex border-b border-gray-100 dark:border-slate-800 mb-8 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2">
                {[
                  { id: 'bio', label: 'Identity Profile', icon: <Eye size={16} /> },
                  { id: 'activity', label: 'Audit Trail', icon: <History size={16} /> },
                  { id: 'safety', label: 'Safety Index', icon: <ShieldAlert size={16} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveProfileTab(tab.id as any)}
                    className={`flex items-center gap-2 px-8 py-5 text-xs font-black uppercase tracking-widest transition-all border-b-4 ${
                      activeProfileTab === tab.id 
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <div className="pb-12">
                {activeProfileTab === 'bio' && (
                  <div className="space-y-12 animate-fadeIn">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                      <div className="lg:col-span-2 space-y-10">
                        <div className="space-y-6">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Camera size={14} /> Registered Media Gallery
                           </h3>
                           <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                             {(selectedUser.photos || []).map((photo: string, i: number) => (
                               <div key={i} className="aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm hover:scale-[1.03] transition-transform group cursor-zoom-in">
                                 <img src={photo} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt={`Gallery ${i}`} />
                               </div>
                             ))}
                           </div>
                        </div>

                        <div className="p-10 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-gray-100 dark:border-slate-800/50">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Official Bio</h3>
                          <p className="text-xl font-medium text-slate-700 dark:text-slate-200 leading-relaxed italic">
                            "{selectedUser.bio || 'No bio provided'}"
                          </p>
                        </div>

                        <div className="space-y-6">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Tag size={14} /> Personality Nodes
                           </h3>
                           <div className="flex flex-wrap gap-3">
                             {(selectedUser.interests || []).map((interest: string, i: number) => (
                               <span key={i} className="px-6 py-3 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-100 dark:border-slate-700 shadow-sm">
                                 {interest}
                               </span>
                             ))}
                           </div>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="p-10 bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-8">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Platform Verification</h3>
                           <div className="space-y-6">
                             <div className="flex items-center gap-5">
                               <div className="p-4 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500 rounded-2xl">
                                 <Briefcase size={22} />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Professional Rank</p>
                                 <p className="text-base font-black dark:text-white leading-tight">{selectedUser.jobTitle || 'Unverified'}</p>
                               </div>
                             </div>
                             <div className="flex items-center gap-5">
                               <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl">
                                 <GraduationCap size={22} />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Academic Record</p>
                                 <p className="text-base font-black dark:text-white leading-tight">{selectedUser.education || 'Unverified'}</p>
                               </div>
                             </div>
                           </div>
                        </div>

                        <div className="p-10 bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-8">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Lifestyle Artifacts</h3>
                           <div className="space-y-6">
                             <div className="flex items-center justify-between group">
                               <div className="flex items-center gap-4">
                                 <Cigarette size={20} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                                 <span className="text-xs font-black uppercase tracking-widest text-slate-500">Smoking</span>
                               </div>
                               <span className="text-sm font-black dark:text-white">{selectedUser.lifestyle?.smoking || 'N/A'}</span>
                             </div>
                             <div className="flex items-center justify-between group">
                               <div className="flex items-center gap-4">
                                 <Wine size={20} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                                 <span className="text-xs font-black uppercase tracking-widest text-slate-500">Drinking</span>
                               </div>
                               <span className="text-sm font-black dark:text-white">{selectedUser.lifestyle?.drinking || 'N/A'}</span>
                             </div>
                             <div className="flex items-center justify-between group">
                               <div className="flex items-center gap-4">
                                 <HandMetal size={20} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                                 <span className="text-xs font-black uppercase tracking-widest text-slate-500">Religion</span>
                               </div>
                               <span className="text-sm font-black dark:text-white">{selectedUser.lifestyle?.religion || 'N/A'}</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeProfileTab === 'activity' && (
                  <div className="space-y-8 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-10 bg-indigo-50 dark:bg-indigo-500/5 rounded-[3rem] border border-indigo-100 dark:border-indigo-500/20">
                        <div className="flex items-center gap-4 mb-3 text-indigo-600">
                          <MessageSquare size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Gender</span>
                        </div>
                        <p className="text-4xl font-black dark:text-white capitalize">{selectedUser.gender || '—'}</p>
                      </div>
                      <div className="p-10 bg-rose-50 dark:bg-rose-500/5 rounded-[3rem] border border-rose-100 dark:border-rose-500/20">
                        <div className="flex items-center gap-4 mb-3 text-rose-600">
                          <Heart size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Looking For</span>
                        </div>
                        <p className="text-4xl font-black dark:text-white capitalize">{selectedUser.lookingFor || '—'}</p>
                      </div>
                      <div className="p-10 bg-teal-50 dark:bg-teal-500/5 rounded-[3rem] border border-teal-100 dark:border-teal-500/20">
                        <div className="flex items-center gap-4 mb-3 text-teal-600">
                          <History size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Joined</span>
                        </div>
                        <p className="text-2xl font-black dark:text-white">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeProfileTab === 'safety' && (
                  <div className="space-y-10 animate-fadeIn">
                    <div className="flex flex-col md:flex-row items-center justify-between p-10 bg-brand-50 dark:bg-brand-500/5 rounded-[3rem] border border-brand-100 dark:border-brand-500/20 gap-8">
                      <div>
                        <h4 className="text-lg font-black dark:text-white mb-2">Neural Integrity Audit</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xl">Deep analysis of behavioral artifacts, communication patterns, and semantic risk markers.</p>
                      </div>
                      {!aiAnalysis && !isAnalyzing && (
                        <button 
                          onClick={runAiModeration}
                          className="px-10 py-5 bg-brand-500 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-brand-600 transition-all flex items-center gap-3 active:scale-95"
                        >
                          <Sparkles size={18} /> Initiate Scan
                        </button>
                      )}
                    </div>

                    {isAnalyzing ? (
                      <div className="p-20 text-center space-y-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-[6px] border-brand-500 border-t-transparent mx-auto"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Synchronizing Weights...</p>
                      </div>
                    ) : aiAnalysis && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="p-10 bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                          <div className="flex items-center justify-between mb-8">
                             <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Coefficient</h5>
                             <span className={`px-6 py-2 rounded-2xl text-xs font-black ${aiAnalysis.riskScore > 50 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}>
                               {aiAnalysis.riskScore}%
                             </span>
                          </div>
                          <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-8">
                             <div 
                               className={`h-full transition-all duration-1000 ${aiAnalysis.riskScore > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                               style={{ width: `${aiAnalysis.riskScore}%` }}
                             ></div>
                          </div>
                          <div className="p-8 bg-slate-50 dark:bg-slate-900 rounded-[2rem] text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed border border-gray-100 dark:border-slate-800">
                            {aiAnalysis.reasoning}
                          </div>
                        </div>
                        <div className="p-10 bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Detected Anomalies</h5>
                          {aiAnalysis.flaggedContent.length > 0 ? (
                            <div className="space-y-4">
                              {aiAnalysis.flaggedContent.map((content, i) => (
                                <div key={i} className="flex items-center gap-4 p-5 bg-rose-500/5 text-rose-600 rounded-2xl text-sm font-bold border border-rose-500/10">
                                  <AlertTriangle size={18} /> {content}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                              <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                              <p className="text-xs font-black uppercase tracking-widest">Clear Integrity Status</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="p-10 bg-white dark:bg-slate-800 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Status</p>
                             <p className="text-5xl font-black text-rose-500 leading-none">{selectedUser.banned ? 'BANNED' : selectedUser.warnings || 0}</p>
                          </div>
                          <ShieldAlert size={48} className="text-rose-500 opacity-20" />
                       </div>
                       <button 
                         onClick={() => handleDelete(selectedUser._id)}
                         className="p-10 bg-rose-500/5 hover:bg-rose-500/10 rounded-[3rem] border border-rose-500/20 text-rose-600 flex items-center justify-between transition-all group"
                       >
                         <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2">Management Tier</p>
                            <p className="text-2xl font-black group-hover:translate-x-1 transition-transform">Purge Citizen Node</p>
                         </div>
                         <UserX size={48} className="opacity-30 group-hover:scale-110 transition-transform" />
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
