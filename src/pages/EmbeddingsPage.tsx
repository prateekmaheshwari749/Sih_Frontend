import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BrainCircuit,
  Target,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  GitCompare,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import ModelComparisonPage from './ModelComparisonPage';
import ValidationPage from './ValidationPage';

export type EmbeddingSubpageId = 'compare' | 'validation';

interface SubpageDef {
  id: EmbeddingSubpageId;
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
    id: 'compare',
    pageNumber: 1,
    name: 'Model Comparison & Embeddings',
    shortName: '1. Model Comparison & Embeddings',
    badge: 'Latent Space & Copernicus GLORYS12',
    tagline: 'Multi-model latent space embeddings, Swin-ConvGRU vs CNN vs UNet benchmark, and depthwise error curves',
    icon: GitCompare,
    color: 'text-cyan-400',
    activeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]',
    dotColor: 'bg-cyan-400',
    accentBorder: 'border-cyan-500/40',
    gradientBadge: 'from-cyan-500/20 via-blue-500/10 to-transparent text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'validation',
    pageNumber: 2,
    name: 'ARGO Float In-Situ Validation',
    shortName: '2. ARGO Float In-Situ Validation',
    badge: '15 Depths (0–1000m) Ground Truth',
    tagline: 'Real observational match-ups from INCOIS and international ARGO floats with per-depth RMSE, MAE, bias, and correlation',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    activeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    dotColor: 'bg-emerald-400',
    accentBorder: 'border-emerald-500/40',
    gradientBadge: 'from-emerald-500/20 via-teal-500/10 to-transparent text-emerald-300 border-emerald-500/30',
  },
];

export default function EmbeddingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolve active index from URL query param (?tab=compare | ?tab=validation | ?tab=embedding | etc.)
  const tabParam = (searchParams.get('tab') || searchParams.get('subpage') || searchParams.get('page') || '').toLowerCase();

  const initialIndex = useMemo(() => {
    if (tabParam === '2' || tabParam === 'validation' || tabParam === 'argo' || tabParam === 'in-situ' || tabParam === 'insitu') {
      return 1;
    }
    return 0; // Default to 1st tab: Model Comparison & Embeddings
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

    const targetTab = SUBPAGES[newIndex].id;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', targetTab);
      return next;
    }, { replace: true });

    // Scroll smoothly to top of content view
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 120);
  };

  const handlePrev = () => {
    if (activeIndex > 0) goToSubpage(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < SUBPAGES.length - 1) goToSubpage(activeIndex + 1);
  };

  const activeSubpage = SUBPAGES[activeIndex];

  return (
    <PageLayout>
      <div className="embeddings-page w-full min-h-screen flex flex-col pb-16">
        {/* Top Unified Header & Sliding Switcher */}
        <section className="border-b border-sky-100 bg-white/90 backdrop-blur-2xl sticky top-[69px] z-40 transition-all shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            {/* Title Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 border border-sky-300 flex items-center justify-center text-[#005088] shadow-sm shrink-0">
                  <BrainCircuit size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-[#003865]">
                      Embeddings &amp; Model Validation Suite
                    </h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 flex items-center gap-1 font-bold shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                      LATENT SPACE &amp; IN-SITU BENCHMARK
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:block mt-1">
                    Unified intelligence center: Multi-Model Latent Embeddings, Copernicus GLORYS12 Comparison, and ARGO Float In-Situ Ground Truth
                  </p>
                </div>
              </div>

              {/* Prev / Next Page Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <div className="flex items-center text-xs font-mono font-bold bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 shadow-xs">
                  <span className="text-[#003865] font-black">{activeIndex + 1}</span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-[#0284c7]">{SUBPAGES.length}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    disabled={activeIndex === 0}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-slate-700 transition-all cursor-pointer shadow-xs"
                    title="Slide to Previous Section"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={activeIndex === SUBPAGES.length - 1}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-slate-700 transition-all cursor-pointer shadow-xs"
                    title="Slide to Next Section"
                    aria-label="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Sliding Subpages Tab Track */}
            <div className="relative pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2 bg-sky-50/70 rounded-2xl border border-sky-200/80 backdrop-blur-2xl shadow-sm">
                {SUBPAGES.map((sub, idx) => {
                  const Icon = sub.icon;
                  const isActive = idx === activeIndex;

                  return (
                    <button
                      key={sub.id}
                      onClick={() => goToSubpage(idx)}
                      className={`relative flex items-center justify-start gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                        isActive
                          ? 'border-2 border-[#005088] bg-white shadow-md'
                          : 'border border-slate-200 bg-white/70 hover:bg-white hover:border-sky-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black shadow-xs ${
                        isActive ? 'bg-[#005088] text-white' : 'bg-sky-100 text-[#005088]'
                      }`}>
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10.5px] font-mono font-bold uppercase tracking-wider ${
                            isActive ? 'text-[#0284c7]' : 'text-slate-500'
                          }`}>
                            SECTION 0{sub.pageNumber}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#005088] animate-pulse" />
                          )}
                        </div>
                        <div className={`text-sm font-extrabold truncate ${
                          isActive ? 'text-[#002f52]' : 'text-slate-700'
                        }`}>
                          {sub.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate hidden md:block">
                          {sub.badge}
                        </div>
                      </div>

                      {/* Active Indicator Underline */}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-[#005088]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Content Container */}
        <div ref={contentContainerRef} className="w-full relative transition-all duration-300 pt-2">
          {activeIndex === 0 && (
            <div className="animate-in fade-in duration-200">
              <ModelComparisonPage />
            </div>
          )}

          {activeIndex === 1 && (
            <div className="animate-in fade-in duration-200">
              <ValidationPage />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
