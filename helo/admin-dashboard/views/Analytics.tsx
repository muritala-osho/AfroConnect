import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { MapPin, Search, Sparkles, ExternalLink, Globe, TrendingUp, Info } from 'lucide-react';
import { ANALYTICS_DATA } from '../constants';
import { getLocationIntel } from '../services/geminiServices';

const Analytics: React.FC = () => {
  const [mapQuery, setMapQuery] = useState('');
  const [mapResult, setMapResult] = useState<{ text: string, groundingChunks: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const COLORS = ['#06b6d4', '#14b8a6', '#f43f5e', '#6366f1'];

  const handleMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapQuery.trim()) return;

    setIsLoading(true);
    let coords: { latitude: number, longitude: number } | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {
      console.log("Geolocation not available");
    }

    const res = await getLocationIntel(mapQuery, coords);
    setMapResult(res);
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Intelligence Node</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Global behavioral trends and geospatial intelligence</p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          {['24h', '7d', '30d', '1y'].map(t => (
            <button key={t} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${t === '30d' ? 'bg-brand-500 text-white shadow-lg' : 'text-slate-400 hover:text-brand-500'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Maps Section */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-cyan-50 dark:bg-cyan-500/10 rounded-3xl text-cyan-600">
                <Globe size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black dark:text-white">Regional Intelligence</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Real-Time Google Maps Grounding</p>
              </div>
            </div>
            <div className="group relative">
              <Info size={20} className="text-slate-300 cursor-help" />
              <div className="absolute right-0 top-full mt-4 w-72 p-6 bg-slate-900 text-white text-[10px] rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all z-30 pointer-events-none shadow-2xl leading-relaxed font-bold uppercase tracking-widest">
                Analyze hotspots, safe zones, and competitor density using up-to-the-minute geographical data.
              </div>
            </div>
          </div>

          <form onSubmit={handleMapSearch} className="relative mb-8">
            <input 
              type="text"
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              placeholder="e.g. 'Safety report on nightlife venues in Lagos Island...'"
              className="w-full pl-8 pr-40 py-6 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[2rem] focus:ring-4 focus:ring-brand-500/10 outline-none text-sm font-black dark:text-white transition-all"
            />
            <button 
              type="submit"
              disabled={isLoading}
              className="absolute right-3 top-3 bottom-3 px-8 bg-brand-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-600 transition-all disabled:opacity-50 flex items-center shadow-lg"
            >
              {isLoading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <><Sparkles size={16} className="mr-2"/> Audit Hub</>}
            </button>
          </form>

          <div className="flex-1 min-h-[400px] relative overflow-hidden rounded-[2rem] bg-slate-50 dark:bg-slate-800/30 p-8 border border-slate-100 dark:border-slate-800/50">
            {!mapResult && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 opacity-50">
                <div className="p-8 bg-white dark:bg-slate-800 rounded-full mb-6 shadow-sm">
                  <MapPin size={56} className="text-brand-300" />
                </div>
                <p className="text-lg font-black text-slate-400 uppercase tracking-widest">Geospatial Sync Pending</p>
                <p className="text-xs text-slate-400 max-w-xs mt-3 font-medium italic">Enter regional audit parameters above to bridge real-world data.</p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-white dark:bg-slate-800 rounded-full w-2/3"></div>
                <div className="h-32 bg-white dark:bg-slate-800 rounded-[2.5rem] w-full"></div>
                <div className="flex gap-4">
                  <div className="h-12 bg-white dark:bg-slate-800 rounded-2xl w-1/3"></div>
                  <div className="h-12 bg-white dark:bg-slate-800 rounded-2xl w-1/3"></div>
                </div>
              </div>
            )}

            {mapResult && (
              <div className="space-y-8 animate-fadeIn">
                <div className="p-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2.5rem] border border-brand-100 dark:border-brand-500/10 shadow-sm">
                  <p className="text-base text-gray-700 dark:text-slate-200 leading-relaxed font-bold">
                    {mapResult.text}
                  </p>
                </div>

                {mapResult.groundingChunks.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                       <div className="h-1 w-8 bg-brand-500 rounded-full"></div> GEO-VERIFIED ENTITIES
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {mapResult.groundingChunks.map((chunk: any, i: number) => (
                        chunk.maps?.uri && (
                          <a 
                            key={i} 
                            href={chunk.maps.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[2rem] hover:border-brand-500 hover:shadow-xl hover:translate-y-[-2px] transition-all group shadow-sm"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-2xl text-brand-600">
                                <MapPin size={18} />
                              </div>
                              <span className="text-xs font-black dark:text-white truncate max-w-[180px] uppercase tracking-wider">{chunk.maps.title || "Identity Unknown"}</span>
                            </div>
                            <ExternalLink size={16} className="text-slate-300 group-hover:text-brand-500 transition-colors" />
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-black mb-8 dark:text-white flex items-center gap-3">
              <TrendingUp size={24} className="text-teal-500" /> Platform Velocity
            </h3>
            <div className="relative h-56 w-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={ANALYTICS_DATA}>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="active" stroke="#14b8a6" strokeWidth={5} dot={false} />
                  <Line type="monotone" dataKey="messages" stroke="#06b6d4" strokeWidth={5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div className="p-5 bg-emerald-50 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100 dark:border-emerald-500/10">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Stability</p>
                <p className="text-2xl font-black dark:text-white">99.8%</p>
              </div>
              <div className="p-5 bg-cyan-50 dark:bg-cyan-500/5 rounded-3xl border border-cyan-100 dark:border-cyan-500/10">
                <p className="text-[9px] font-black text-cyan-600 uppercase tracking-widest mb-1">Latency</p>
                <p className="text-2xl font-black dark:text-white">42ms</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-black mb-8 dark:text-white">Demographic Split</h3>
            <div className="relative h-56 w-full min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Male', value: 48 },
                      { name: 'Female', value: 45 },
                      { name: 'Non-Binary', value: 7 },
                    ]}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {[0, 1, 2].map((index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-6">
               <span className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3 h-3 rounded-full bg-cyan-500"></div> MALE</span>
               <span className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3 h-3 rounded-full bg-teal-500"></div> FEMALE</span>
               <span className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400"><div className="w-3 h-3 rounded-full bg-rose-500"></div> OTHER</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
