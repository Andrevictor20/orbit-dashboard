import React from 'react';

interface CardProps {
  title: string;
  value: string | React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  subText?: string;
  icon?: React.ElementType; // Optional small icon for the subText
}

export function StatCard({ title, value, trend, trendUp, subText, icon: Icon }: CardProps) {
  return (
    <div className="shad-card p-6 flex flex-col gap-2">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-secondary">{title}</h3>
        {trend && (
          <div className="flex items-center px-2 py-0.5 rounded-full bg-accent border shad-border text-[11px] font-medium text-secondary">
            <span className="mr-1">{trendUp ? '↗' : '↘'}</span>
            {trend}
          </div>
        )}
      </div>
      
      <div className="text-3xl font-bold tracking-tight text-primary">
        {value}
      </div>
      
      {subText && (
        <div className="flex items-center gap-1.5 mt-1 text-sm text-secondary">
          <span className={trendUp ? 'text-primary' : ''}>{subText}</span>
          {Icon && <Icon className="w-3.5 h-3.5" />}
        </div>
      )}
    </div>
  );
}
