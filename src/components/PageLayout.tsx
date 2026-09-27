import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Waves, Shield, Cpu, Activity, ArrowUpRight } from 'lucide-react';
import Navbar from './Navbar';
import WaterBackground from './WaterBackground';
import GovFooter from './GovFooter';
import { useTheme } from '../contexts/ThemeContext';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  fullHeight?: boolean;
  showFooter?: boolean;
}

export function PlatformFooter() {
  const { isLight } = useTheme();

  if (isLight) {
    return <GovFooter />;
  }

  return (
    <footer className="relative z-10 border-t border-white/10 dark:bg-[#010612]/90 backdrop-blur-xl mt-16 text-xs text-white/50">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
                <Waves size={16} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base tracking-tight text-white">OCEANINTEL</span>
                <span className="text-[10px] text-white/50 font-mono">INCOIS · MoES · SIH-2026</span>
              </div>
            </div>
            <p className="text-white/40 text-xs leading-relaxed">
              Satellite Embedding-Based Deep Learning Framework to reconstruct depth-wise subsurface ocean temperature (0–1000m at 15 standard depths) from daily surface observations at 0.25° resolution across the North Indian Ocean (5°N–30°N, 45°E–105°E).
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400/90 font-mono font-medium">NIC / INCOIS NODE ONLINE</span>
            </div>
          </div>

          <div>
            <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Activity size={13} className="text-cyan-400" />
              Observations
            </h4>
            <ul className="space-y-2 text-white/50">
              <li>
                <NavLink to="/dashboard" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  Subsurface Dashboard <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/surface" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  Surface Satellite Obs <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/worldmap" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  NIO Grid World Map <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/map" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  3D Depth Profile <ArrowUpRight size={10} />
                </NavLink>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Cpu size={13} className="text-purple-400" />
              Neural Models
            </h4>
            <ul className="space-y-2 text-white/50">
              <li>
                <NavLink to="/forecast" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  7-Day ConvGRU Forecast <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/embeddings" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  CNN vs Swin Embeddings <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/embeddings?tab=depth" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  ARGO Ground-Truth Test <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/dashboard" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  NetCDF File Pipeline <ArrowUpRight size={10} />
                </NavLink>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Shield size={13} className="text-amber-400" />
              Gov Stakeholders
            </h4>
            <ul className="space-y-2 text-white/50">
              <li>
                <NavLink to="/cyclone" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  Cyclone Risk Assessment <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/gov" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  Government NDMA Portal <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/docs" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  Platform Documentation <ArrowUpRight size={10} />
                </NavLink>
              </li>
              <li>
                <NavLink to="/login" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
                  Clearance Gateway <ArrowUpRight size={10} />
                </NavLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-white/40">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-white/60">
              🇮🇳 भारत सरकार · Government of India
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              Ministry of Earth Sciences (MoES) · INCOIS
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              Deep Ocean Mission
            </span>
          </div>
          <div className="font-mono text-cyan-300/80">
            Smart India Hackathon 2026 (SIH-2026) Official Finalist Project
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function PageLayout({
  children,
  className = '',
  fullHeight = false,
  showFooter,
}: PageLayoutProps) {
  const { isLight } = useTheme();
  const shouldShowFooter = showFooter !== undefined ? showFooter : !fullHeight;

  return (
    <div className={`${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden'} flex flex-col relative text-white ${className}`}>

      {/* Official Top Government Header & Navbar */}
      <Navbar />

      <main className={`relative z-10 flex-1 min-h-0 w-full ${fullHeight ? 'overflow-hidden flex flex-col' : 'min-h-[calc(100vh-200px)]'} ${className}`}>
        {children}
      </main>

      {shouldShowFooter && (isLight ? <GovFooter /> : <PlatformFooter />)}
    </div>
  );
}

// Standardized Page Container
export function PageContainer({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full ${className}`}>
      {children}
    </div>
  );
}

// Enhanced Unified Page Header Component
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  category?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  category,
  badge,
  actions,
  className = '',
}: PageHeaderProps) {
  const { isLight } = useTheme();

  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-4 border-b border-white/20 ${className}`}>
      <div>
        {/* Category breadcrumb / tag */}
        {(category || badge) && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {category && (
              <span className="text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-xs bg-white/15 border border-white/30 text-white backdrop-blur-md">
                {category}
              </span>
            )}
            {badge}
          </div>
        )}

        {/* Title + Icon */}
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 bg-white/15 border-2 border-cyan-400/60 text-cyan-300 backdrop-blur-md">
              {icon}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
            <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="font-medium text-xs sm:text-sm mt-1.5 max-w-3xl leading-relaxed text-white drop-shadow-sm"
            style={{ color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Right side actions */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
          {actions}
        </div>
      )}
    </div>
  );
}

// Backward compatible SectionHeader wrapper
export function SectionHeader({
  title,
  subtitle,
  icon,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return <PageHeader title={title} subtitle={subtitle} icon={icon} className={className} />;
}
