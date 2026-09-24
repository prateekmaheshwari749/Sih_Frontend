import type { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: 'cyan' | 'blue' | 'purple' | 'red' | 'none';
  onClick?: () => void;
}

export default function GlassCard({ children, className = '', glow = 'none', onClick }: GlassCardProps) {
  const { isLight } = useTheme();

  const glowClass = {
    cyan: isLight ? 'shadow-[0_4px_20px_rgba(6,182,212,0.12)]' : 'glow-cyan',
    blue: isLight ? 'shadow-[0_4px_20px_rgba(59,130,246,0.12)]' : 'glow-blue',
    purple: isLight ? 'shadow-[0_4px_20px_rgba(168,85,247,0.12)]' : 'glow-purple',
    red: isLight ? 'shadow-[0_4px_20px_rgba(239,68,68,0.12)]' : 'glow-red',
    none: '',
  }[glow];

  return (
    <div
      className={`rounded-xl p-6 transition-all ${
        isLight
          ? 'bg-white border border-slate-200 shadow-xs text-slate-800'
          : 'glass text-white'
      } ${glowClass} ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}
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
  const { isLight } = useTheme();

  const darkColorMap = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20 text-green-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 text-yellow-400',
  };

  const lightColorMap = {
    cyan: 'bg-white border-slate-200 text-cyan-700 shadow-xs border-t-4 border-t-cyan-600',
    blue: 'bg-white border-slate-200 text-[#005088] shadow-xs border-t-4 border-t-[#005088]',
    purple: 'bg-white border-slate-200 text-purple-700 shadow-xs border-t-4 border-t-purple-600',
    green: 'bg-white border-slate-200 text-emerald-700 shadow-xs border-t-4 border-t-emerald-600',
    red: 'bg-white border-slate-200 text-red-700 shadow-xs border-t-4 border-t-red-600',
    yellow: 'bg-white border-slate-200 text-amber-700 shadow-xs border-t-4 border-t-amber-500',
  };

  const trendColor = trend === 'up'
    ? (isLight ? 'text-emerald-700 font-bold' : 'text-green-400')
    : trend === 'down'
      ? (isLight ? 'text-red-700 font-bold' : 'text-red-400')
      : (isLight ? 'text-slate-500' : 'text-white/50');

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className={`rounded-xl p-5 border transition-transform duration-200 ${
      isLight
        ? `${lightColorMap[color]} hover:shadow-md`
        : `glass bg-gradient-to-br ${darkColorMap[color]} hover:scale-[1.02]`
    } ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
          isLight
            ? 'bg-slate-50 border-slate-200 text-[#005088]'
            : `bg-gradient-to-br ${darkColorMap[color]}`
        }`}>
          {icon}
        </div>
        {trend && trendValue && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            isLight ? 'bg-slate-100 border border-slate-200' : ''
          } ${trendColor}`}>
            {trendArrow} {trendValue}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className={`text-xs uppercase tracking-wider font-bold ${
          isLight ? 'text-slate-500' : 'text-white/50'
        }`}>{label}</p>
        <p className={`text-2xl font-black ${
          isLight ? 'text-slate-900' : 'text-white'
        }`}>
          {value}
          {unit && <span className={`text-sm font-normal ml-1 ${
            isLight ? 'text-slate-500' : 'text-white/50'
          }`}>{unit}</span>}
        </p>
      </div>
    </div>
  );
}
