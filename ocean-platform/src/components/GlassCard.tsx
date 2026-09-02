import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: 'cyan' | 'blue' | 'purple' | 'red' | 'none';
  onClick?: () => void;
}

export default function GlassCard({ children, className = '', glow = 'none', onClick }: GlassCardProps) {
  const glowClass = {
    cyan: 'glow-cyan',
    blue: 'glow-blue',
    purple: 'glow-purple',
    red: 'glow-red',
    none: '',
  }[glow];

  return (
    <div
      className={`glass rounded-2xl p-6 ${glowClass} ${onClick ? 'cursor-pointer hover:bg-white/10 transition-all' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Metric card for dashboard stats
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'cyan' | 'blue' | 'purple' | 'green' | 'red' | 'yellow';
  className?: string;
}

export function MetricCard({
  label, value, unit, icon, trend, trendValue, color = 'cyan', className = ''
}: MetricCardProps) {
  const colorMap = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20 text-green-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 text-yellow-400',
  };

  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white/50';
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className={`glass rounded-2xl p-5 bg-gradient-to-br ${colorMap[color]} border hover:scale-[1.02] transition-transform duration-200 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center border`}>
          {icon}
        </div>
        {trend && trendValue && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendArrow} {trendValue}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-white/50 text-xs uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white">
          {value}
          {unit && <span className="text-sm text-white/50 ml-1">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
