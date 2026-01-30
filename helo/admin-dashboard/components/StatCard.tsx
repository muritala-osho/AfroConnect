import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-start justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div>
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">{title}</p>
        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{value}</h3>
        {change !== undefined && (
          <div className={`flex items-center mt-3 text-xs font-bold ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            <span className={`flex items-center rounded-full px-1.5 py-0.5 ${change >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              {change >= 0 ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
              {Math.abs(change)}%
            </span>
            <span className="text-gray-400 dark:text-slate-600 ml-2 font-medium">this month</span>
          </div>
        )}
      </div>
      <div className={`p-4 rounded-2xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
        {/* Fix: Cast icon to React.ReactElement<any> to resolve the "className does not exist" type error */}
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { 
          className: color.replace('bg-', 'text-'), 
          size: 24 
        })}
      </div>
    </div>
  );
};

export default StatCard;
