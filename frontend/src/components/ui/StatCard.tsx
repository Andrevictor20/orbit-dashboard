import { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  value: string | React.ReactNode;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: CardProps) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
          <Icon className="w-6 h-6 text-brand-primary" />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-semibold text-slate-50 tracking-tight">{value}</h3>
      </div>
      
      {/* Decorative background glow */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-brand-primary/20 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
}
