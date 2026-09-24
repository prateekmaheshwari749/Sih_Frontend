import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wind,
  Flame,
  Compass,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import CyclonePage from './CyclonePage';
import OceanHeatPage from './OceanHeatPage';
import SeasonalPredictionPage from './SeasonalPredictionPage';

export type PredictionSubpageId = 'cyclone' | 'ocean-heat' | 'seasonal';

interface SubpageDef {
  id: PredictionSubpageId;
  pageNumber: number;
  name: string;
  shortName: string;
  badge: string;
  tagline: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  activeColor: string;
  dotColor: string;
  accentBorder: string;
  gradientBadge: string;
}

const SUBPAGES: SubpageDef[] = [
  {
    id: 'cyclone',
    pageNumber: 1,
    name: 'Cyclone Prediction',
    shortName: '1. Cyclone Prediction',
    badge: 'T+0 to T+7 Days Early Warning',
    tagline: 'Deep Neural Track & Rapid Intensification (RI) Warning with 0–1000m Subsurface OHC Coupling',
    icon: Wind,
    color: 'text-cyan-400',
    activeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]',
    dotColor: 'bg-cyan-400',
    accentBorder: 'border-cyan-500/40',
    gradientBadge: 'from-cyan-500/20 via-blue-500/10 to-transparent text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'ocean-heat',
    pageNumber: 2,
    name: 'Ocean Heat',
    shortName: '2. Ocean Heat Content',
    badge: '0–1000m TCHP & MHW Diagnostics',
    tagline: 'Multi-Depth Thermal Energy Budget, 26°C Isotherm Depth (D₂₆) & Marine Heatwave Radar',
    icon: Flame,
    color: 'text-orange-400',
    activeColor: 'bg-orange-500/20 text-orange-300 border-orange-400/40 shadow-[0_0_20px_rgba(249,115,22,0.25)]',
    dotColor: 'bg-orange-400',
    accentBorder: 'border-orange-500/40',
    gradientBadge: 'from-orange-500/20 via-rose-500/10 to-transparent text-orange-300 border-orange-500/30',
  },
  {
    id: 'seasonal',
    pageNumber: 3,
    name: 'Seasonal',
    shortName: '3. Seasonal Forecast',
    badge: '3-Month Spatiotemporal FNO',
    tagline: 'Continuous Fourier Neural Operator Multi-Scale Climate Projections & SST Climatology Anomalies',
    icon: Compass,
    color: 'text-indigo-400',
    activeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 shadow-[0_0_20px_rgba(99,102,241,0.25)]',
    dotColor: 'bg-indigo-400',
    accentBorder: 'border-indigo-500/40',
    gradientBadge: 'from-indigo-500/20 via-purple-500/10 to-transparent text-indigo-300 border-indigo-500/30',
  },
];

export default function PredictionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolve active index from URL query param (?tab=cyclone | ?tab=heat | ?tab=seasonal)
  const tabParam = (searchParams.get('tab') || searchParams.get('subpage') || searchParams.get('page') || '').toLowerCase();

  const initialIndex = useMemo(() => {
    if (tabParam === '2' || tabParam === 'heat' || tabParam === 'ocean-heat' || tabParam === 'oceanheat') return 1;
    if (tabParam === '3' || tabParam === 'seasonal' || tabParam === 'season' || tabParam === 'fno') return 2;
    return 0; // Default to 1st page: cyclone
  }, [tabParam]);

  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Sync state if URL changes externally
  useEffect(() => {
    if (initialIndex !== activeIndex) {
      setSlideDirection(initialIndex > activeIndex ? 'right' : 'left');
      setActiveIndex(initialIndex);
    }
  }, [initialIndex]);

  // Handle switching subpages
  const goToSubpage = (newIndex: number) => {
    if (newIndex === activeIndex || newIndex < 0 || newIndex >= SUBPAGES.length) return;
    setSlideDirection(newIndex > activeIndex ? 'right' : 'left');
    setActiveIndex(newIndex);

    const targetTab = SUBPAGES[newIndex].id === 'ocean-heat' ? 'heat' : SUBPAGES[newIndex].id;
    setSearchParams({ tab: targetTab }, { replace: true });

    // Scroll smoothly to top of content view
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Leaflet map resize trigger so maps inside embedded pages render crisp without gray tiles
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 120);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);
  };

  const handlePrev = () => {
    if (activeIndex > 0) goToSubpage(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < SUBPAGES.length - 1) goToSubpage(activeIndex + 1);
  };

  return (
    <PageLayout>
      <div className="w-full min-h-screen flex flex-col pb-16">
        {/* ── Top Unified Predictions Header & Sliding Switcher ── */}
        <section className="border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl sticky top-[69px] z-40 transition-all shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            {/* Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-600/30 to-indigo-700/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-sm shrink-0">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight drop-shadow-sm">
                      <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                        Predictions &amp; Forecasting Suite
                      </span>
                    </h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center gap-1 font-bold shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE MULTI-MODEL PREDICTIONS
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-sky-100/90 font-medium drop-shadow-xs hidden sm:block mt-1">
                    Unified sliding intelligence center: Cyclone 7-Day Radar, 0–1000m Subsurface Ocean Heat, and Seasonal FNO
                  </p>
                </div>
              </div>

              {/* Prev / Next Page Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <div className="flex items-center text-xs font-mono font-bold text-cyan-200 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 shadow-xs">
                  <span className="text-white font-black">{activeIndex + 1}</span>
                  <span className="text-white/40 mx-1.5">/</span>
                  <span className="text-cyan-300">{SUBPAGES.length}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    disabled={activeIndex === 0}
                    className="p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white transition-all cursor-pointer shadow-xs"
                    title="Slide to Previous Subpage"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={activeIndex === SUBPAGES.length - 1}
                    className="p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white transition-all cursor-pointer shadow-xs"
                    title="Slide to Next Subpage"
                    aria-label="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sliding Subpages Tab Track */}
            <div className="relative pt-2">
              <div className="grid grid-cols-3 gap-2.5 p-2 bg-[#020d1f]/95 rounded-2xl border border-cyan-500/40 backdrop-blur-2xl shadow-2xl">
                {SUBPAGES.map((sub, idx) => {
                  const Icon = sub.icon;
                  const isActive = idx === activeIndex;

                  return (
                    <button
                      key={sub.id}
                      onClick={() => goToSubpage(idx)}
                      className={`relative flex items-center justify-center sm:justify-start gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                        isActive
                          ? 'border border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                          : 'border border-cyan-500/35 bg-slate-900/60 hover:bg-slate-800/80 hover:border-cyan-400/70'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-400 text-slate-950 shrink-0 font-black shadow-xs">
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10.5px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                            PAGE 0{sub.pageNumber}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base font-black truncate drop-shadow-sm">
                          <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                            {sub.name}
                          </span>
                        </p>
                      </div>

                      {/* Active Indicator Underline with the same blue line */}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-cyan-400 shadow-[0_0_12px_#38bdf8] rounded-b-xl" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Sliding Content Viewport ── */}
        <div ref={contentContainerRef} className="w-full relative overflow-hidden transition-all duration-300 pt-3">
          <div
            key={activeIndex}
            className={`w-full animate-in fade-in duration-300 ${
              slideDirection === 'right' ? 'slide-in-from-right-6' : 'slide-in-from-left-6'
            }`}
          >
            {activeIndex === 0 && <CyclonePage embedded={true} />}
            {activeIndex === 1 && <OceanHeatPage embedded={true} />}
            {activeIndex === 2 && <SeasonalPredictionPage embedded={true} />}
          </div>
        </div>

        {/* ── Bottom Floating Slide Switcher / Footer Action Strip ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="font-mono text-cyan-400 font-bold">PREDICTIONS NAVIGATION</span>
              <span>&bull;</span>
              <span>Click subpages or use arrow controls to slide between models</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={handlePrev}
                disabled={activeIndex === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-white transition-all cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Previous Subpage</span>
              </button>

              <div className="flex items-center gap-1.5 px-2">
                {SUBPAGES.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => goToSubpage(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === activeIndex ? `w-6 ${s.dotColor}` : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                    title={`Slide to ${s.name}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={activeIndex === SUBPAGES.length - 1}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-white transition-all cursor-pointer"
              >
                <span>Next Subpage</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
