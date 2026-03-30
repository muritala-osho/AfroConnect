import React from 'react';
import { UserCircle, Camera, Save, RefreshCw, Shield, Mail, BadgeCheck, Upload, Lock } from 'lucide-react';
import { AuthState } from '../types';

interface AdminProfileProps {
  auth: AuthState;
  onUpdate: (updatedUser: any) => void;
}

const AdminProfile: React.FC<AdminProfileProps> = ({ auth, onUpdate }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [formData, setFormData] = React.useState({
    name: auth.user?.name || '',
    email: auth.user?.email || '',
    role: auth.user?.role || '',
    avatar: auth.user?.avatar || `https://ui-avatars.com/api/?name=${auth.user?.name}&background=14b8a6&color=fff&bold=true`
  });

  const [isSaving, setIsSaving] = React.useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      onUpdate({ ...auth.user, ...formData });
      setIsSaving(false);
      alert("Admin profile synchronization successful. Core identity updated.");
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Identity Hub</h1>
        <p className="text-gray-500 dark:text-slate-400 font-medium">Manage your administrative persona and digital credentials</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm text-center relative overflow-hidden group/card">
              <div className="relative inline-block mb-6">
                <div className="h-32 w-32 rounded-[2.5rem] overflow-hidden ring-4 ring-cyan-500/20 shadow-2xl relative">
                  <img 
                    src={formData.avatar} 
                    className="h-full w-full object-cover transition-transform group-hover/card:scale-110 duration-500" 
                    alt="Admin Avatar"
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Upload size={24} className="text-white" />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-3 bg-cyan-600 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all z-10"
                >
                  <Camera size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
              </div>
              <h2 className="text-xl font-black dark:text-white leading-tight mb-1">{formData.name}</h2>
              <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">{formData.role}</p>

              <div className="mt-8 flex justify-center gap-2">
                 <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center gap-1">
                   <BadgeCheck size={12} /> Live Status
                 </div>
                 <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center gap-1">
                   <Shield size={12} /> Authorized
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-teal-600 to-cyan-500 p-8 rounded-[3rem] text-white shadow-xl shadow-teal-500/20">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4">Security Protocol</h3>
              <p className="text-xs font-medium opacity-90 leading-relaxed">Your avatar is used across internal communication logs and platform audits. Ensure it meets professional standards.</p>
           </div>
        </div>

        <div className="md:col-span-2">
           <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <UserCircle size={14} className="text-cyan-500" /> Display Name
                    </label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold text-sm dark:text-white"
                      placeholder="e.g. Dominic Adotei"
                      required
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Mail size={14} className="text-cyan-500" /> Work Email
                    </label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold text-sm dark:text-white"
                      placeholder="admin@afroconnect.ai"
                      required
                    />
                 </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Lock size={14} className="text-cyan-500" /> Admin Security Role
                </label>
                <div className="p-6 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <p className="text-sm font-black dark:text-white uppercase tracking-widest">{formData.role}</p>
                  <Shield size={18} className="text-teal-500" />
                </div>
                <p className="mt-3 text-[10px] text-slate-400 font-medium italic">Administrative roles can only be updated by the Root Authority.</p>
              </div>

              <div className="pt-6 border-t border-gray-50 dark:border-slate-800 flex justify-end">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-10 py-4 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-teal-700 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-50 flex items-center gap-3 active:scale-95"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  Sync Identity
                </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
