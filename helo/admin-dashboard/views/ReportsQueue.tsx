import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, MoreHorizontal, User, AlertCircle, Eye, Trash2, ShieldCheck, MessageCircle } from 'lucide-react';

const ReportsQueue: React.FC = () => {
  const [reports, setReports] = useState([
    { id: 'REP-001', reporter: 'Sarah Jenkins', target: 'Marcus Chen', reason: 'Harassment', status: 'pending', date: '10m ago', text: 'Used inappropriate language during chat and made me feel very uncomfortable after I declined a meeting.' },
    { id: 'REP-002', reporter: 'Alex Rivera', target: 'John Doe', reason: 'Fake Profile', status: 'pending', date: '1h ago', text: 'This user is using stolen photos from an Instagram influencer I follow. He is clearly not who he says he is.' },
    { id: 'REP-003', reporter: 'Jessica Wu', target: 'Sam Smith', reason: 'Scam', status: 'resolved', date: '5h ago', text: 'Asked for money repeatedly for "emergency medical bills" after only matching for two days.' },
  ]);

  const [selectedReport, setSelectedReport] = useState<typeof reports[0] | null>(null);

  const handleStatusChange = (id: string, newStatus: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
    if (selectedReport?.id === id) {
      setSelectedReport(prev => prev ? { ...prev, status: newStatus as any } : null);
    }
  };

  const handleRemove = (id: string) => {
    if (confirm("Delete this report record?")) {
      setReports(prev => prev.filter(r => r.id !== id));
      setSelectedReport(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Trust & Safety Hub</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Monitoring community integrity and resolving conflicts</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-gray-100 dark:border-slate-800">
           <button className="px-4 py-2 text-[10px] font-black uppercase bg-teal-600 text-white rounded-xl shadow-lg">Pending (12)</button>
           <button className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">Escalated (4)</button>
           <button className="px-4 py-2 text-[10px] font-black uppercase text-slate-400">Resolved (142)</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Critical Incident', val: '12', color: 'text-rose-500 bg-rose-50', icon: <ShieldAlert /> },
          { label: 'Resolution Rate', val: '94.2%', color: 'text-emerald-500 bg-emerald-50', icon: <CheckCircle2 /> },
          { label: 'Avg. S.L.A.', val: '14m', color: 'text-cyan-500 bg-cyan-50', icon: <AlertCircle /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 flex items-center gap-4 shadow-sm hover:translate-y-[-2px] transition-all">
            <div className={`p-4 rounded-2xl ${stat.color} dark:bg-opacity-10`}>
              {/* Fix: Cast icon to React.ReactElement<any> to resolve the "size does not exist" type error and add validation check */}
              {React.isValidElement(stat.icon) && React.cloneElement(stat.icon as React.ReactElement<any>, { size: 24 })}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black dark:text-white tracking-tighter">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Incident Detail</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Involved Parties</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Violation Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Flow State</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-5">
                    <p className="text-sm font-black dark:text-white leading-none mb-1">{report.id}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{report.date}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-cyan-100 flex items-center justify-center text-[10px] font-black text-cyan-700">{report.reporter[0]}</div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{report.reporter}</span>
                      <span className="text-slate-300">→</span>
                      <div className="h-6 w-6 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-black text-rose-700">{report.target[0]}</div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{report.target}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider">
                      {report.reason}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] ${
                      report.status === 'resolved' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700' :
                      'bg-amber-100 dark:bg-amber-500/10 text-amber-700 animate-pulse'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedReport(report)}
                        className="p-2.5 text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl hover:bg-cyan-100 transition-all shadow-sm"
                        title="View Context"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleStatusChange(report.id, 'resolved')}
                        className="p-2.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"
                        title="Mark Resolved"
                      >
                        <ShieldCheck size={18} />
                      </button>
                      <button 
                        onClick={() => handleRemove(report.id)}
                        className="p-2.5 text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 transition-all shadow-sm"
                        title="Archive Record"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Context Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl border border-white/10">
            <div className="p-10">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-2">Safety Incident Investigation</h3>
                  <h2 className="text-3xl font-black dark:text-white leading-tight">{selectedReport.id}</h2>
                </div>
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl hover:bg-gray-100 transition-all"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-6">
                 <div className="flex gap-4">
                    <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Reporter</p>
                      <p className="font-bold dark:text-white">{selectedReport.reporter}</p>
                    </div>
                    <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Target</p>
                      <p className="font-bold dark:text-white">{selectedReport.target}</p>
                    </div>
                 </div>

                 <div className="p-8 bg-rose-50/50 dark:bg-rose-500/5 rounded-[2.5rem] border border-rose-100 dark:border-rose-500/20">
                    <div className="flex items-center gap-2 mb-4 text-rose-600">
                      <MessageCircle size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Incident Testimony</h4>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed italic">
                      "{selectedReport.text}"
                    </p>
                 </div>

                 <div className="flex gap-4">
                    <button 
                      onClick={() => { handleStatusChange(selectedReport.id, 'resolved'); setSelectedReport(null); }}
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-500/20"
                    >
                      Verify & Dismiss
                    </button>
                    <button className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-500/20">
                      Escalate to Ban
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsQueue;
