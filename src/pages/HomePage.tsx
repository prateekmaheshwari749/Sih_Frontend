import React, { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Waves,
  MessageSquare,
  LayoutDashboard,
  Wind,
  ArrowRight,
  Layers,
  Database,
  Calendar,
  GitCompare,
  Zap,
  Eye,
  Cpu,
  Compass,
  CheckCircle2,
  Satellite,
  Thermometer,
  Droplets,
  Flame,
  Globe2,
  Layers3,
  BrainCircuit,
} from 'lucide-react';

import {
  fetchHealth,
  fetchModelInfo,
  fetchMetricsSummary,
} from '../api/oceanApi';

import Navbar from '../components/Navbar';
import SatelliteReconstructionSimulation from '../components/SatelliteReconstructionSimulation';
import MonsoonFlowSimulation from '../components/MonsoonFlowSimulation';
import GovFooter from '../components/GovFooter';
import DepthZoneCanvas from '../components/3d/DepthZoneCanvas';
import IndiaFlag from '../components/IndiaFlag';

function AestheticWhiteCard({
  children,
  className = '',
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-white/[0.95] backdrop-blur-2xl border border-white/90 shadow-[0_16px_40px_rgba(0,10,30,0.22)] text-[#002f52] transition-all duration-300 ${hover
        ? 'hover:shadow-[0_24px_50px_rgba(255,255,255,0.20)] hover:-translate-y-1 hover:border-white'
        : ''
        } ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 opacity-90" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ============================================================
   DEPTH LAYERS CONFIGURATION (15 STANDARD DEPTHS TO 1000M)
============================================================ */

interface DepthLayer {
  depth: number;
  label: string;
  temp: number;
  zoneId: 'surface' | 'mixed' | 'thermocline' | 'meso' | 'deep';
  color: string;
  desc: string;
}

const DEPTH_LAYERS: DepthLayer[] = [
  { depth: 0, label: 'Surface', temp: 30.1, zoneId: 'surface', color: '#ef4444', desc: 'Satellite-observed surface thermal boundary layer' },
  { depth: 5, label: 'Near Surface', temp: 30.1, zoneId: 'surface', color: '#ef4444', desc: 'Upper mixed layer influenced by diurnal solar cycle' },
  { depth: 10, label: 'Upper Mixed Layer', temp: 30.0, zoneId: 'surface', color: '#ef4444', desc: 'Active wind-stirred thermal boundary' },
  { depth: 20, label: 'Mid Mixed Layer', temp: 29.9, zoneId: 'mixed', color: '#f97316', desc: 'Isothermal layer maintaining warm reservoir' },
  { depth: 30, label: 'Mixed Layer Base (MLD)', temp: 29.7, zoneId: 'mixed', color: '#f97316', desc: 'Base of uniform temperature zone' },
  { depth: 50, label: 'Upper Thermocline', temp: 28.3, zoneId: 'thermocline', color: '#eab308', desc: 'Onset of sharp vertical temperature decline' },
  { depth: 75, label: 'D26 Isotherm Region', temp: 25.6, zoneId: 'thermocline', color: '#eab308', desc: 'Critical 26°C isotherm controlling cyclone OHC' },
  { depth: 100, label: 'Thermocline Core', temp: 22.2, zoneId: 'thermocline', color: '#eab308', desc: 'Maximum vertical temperature gradient (dT/dz)' },
  { depth: 125, label: 'Mid Thermocline', temp: 18.9, zoneId: 'thermocline', color: '#eab308', desc: 'Subsurface thermal gradient transition' },
  { depth: 150, label: 'Lower Thermocline', temp: 16.3, zoneId: 'thermocline', color: '#eab308', desc: 'Transition into intermediate ocean layers' },
  { depth: 200, label: 'Upper Mesopelagic', temp: 13.5, zoneId: 'meso', color: '#3b82f6', desc: 'Twilight zone with minimal solar penetration' },
  { depth: 300, label: 'Mesopelagic Strata', temp: 11.4, zoneId: 'meso', color: '#3b82f6', desc: 'Intermediate ocean stability layer' },
  { depth: 500, label: 'Mid Mesopelagic', temp: 9.8, zoneId: 'meso', color: '#3b82f6', desc: 'Deep intermediate water circulation' },
  { depth: 700, label: 'Lower Mesopelagic', temp: 8.4, zoneId: 'deep', color: '#6366f1', desc: 'Cold deep ocean transition zone' },
  { depth: 1000, label: 'Deep Ocean Abyssal', temp: 6.6, zoneId: 'deep', color: '#6366f1', desc: 'Cold abyssal reference layer extending to 1000m' },
];

/* ============================================================
   5 SATELLITE INPUT VARIABLES DATA
============================================================ */

const SATELLITE_INPUTS = [
  {
    key: 'SST',
    title: 'Sea Surface Temperature',
    symbol: 'SST',
    sensor: 'MODIS / VIIRS / Oceansat-3',
    range: '24°C – 32°C',
    role: 'Surface thermal boundary & heat source',
    desc: 'Provides the thermal boundary condition at the ocean-atmosphere interface.',
    icon: Thermometer,
    color: '#0284c7',
  },
  {
    key: 'SSS',
    title: 'Sea Surface Salinity',
    symbol: 'SSS',
    sensor: 'SMAP / SMOS Microwave',
    range: '30.0 – 36.8 PSU',
    role: 'Controls density & barrier layer formation',
    desc: 'Governs stratification, halocline strength, and freshwater cap dynamics.',
    icon: Droplets,
    color: '#0891b2',
  },
  {
    key: 'SSH',
    title: 'Sea Surface Height (SLA)',
    symbol: 'SLA',
    sensor: 'Sentinel-3 / AltiKa Altimeter',
    range: '-30 cm to +35 cm',
    role: 'Indicates thermocline depth & eddy pumping',
    desc: 'Integrates vertical density structure; high SLA indicates depressed thermocline.',
    icon: Globe2,
    color: '#2563eb',
  },
  {
    key: 'CURRENTS',
    title: 'Ocean Surface Currents',
    symbol: 'U, V',
    sensor: 'Geostrophic Altimetry + Ekman Drift',
    range: '0.1 – 1.8 m/s',
    role: 'Horizontal heat & salinity advection',
    desc: 'Captures dynamic boundary currents like Somali Current and seasonal gyres.',
    icon: Compass,
    color: '#4f46e5',
  },
  {
    key: 'WIND',
    title: 'ASCAT Surface Wind Vectors',
    symbol: 'τx, τy',
    sensor: 'MetOp-C / ASCAT Scatterometer',
    range: '2 – 28 m/s',
    role: 'Wind stress curl & Ekman upwelling',
    desc: 'Drives surface mechanical mixing, MLD deepening, and coastal upwelling.',
    icon: Wind,
    color: '#0d9488',
  },
];

/* ============================================================
   DEEP LEARNING PIPELINE STEPS (01 - 04)
============================================================ */

const PIPELINE_STEPS = [
  {
    step: '01',
    title: 'Multi-Satellite Sensor Fusion',
    subtitle: 'Continuous 0.25° Grid Ingestion',
    desc: 'Ingests real-time SST, SSS, SLA altimetry, and ASCAT wind fields on a uniform 0.25° grid across the North Indian Ocean basin.',
    icon: Satellite,
    tag: 'Surface Telemetry',
  },
  {
    step: '02',
    title: 'Spatial-Temporal Neural Encoder',
    subtitle: 'Vision Transformers & ConvLSTM',
    desc: 'Extracts multi-scale spatial gradients and mesoscale eddy textures while ConvLSTM captures thermal memory across seasonal monsoon cycles.',
    icon: Cpu,
    tag: 'Deep Features',
  },
  {
    step: '03',
    title: 'Physics-Informed Latent Space',
    subtitle: 'Conservation Laws & Hydrostaticity',
    desc: '128-dimensional continuous latent space regularized with hydrostatic equilibrium, upper ocean heat conservation, and stability constraints.',
    icon: Zap,
    tag: 'PINN Regularized',
  },
  {
    step: '04',
    title: '3D Volumetric Field Synthesis',
    subtitle: '15 Standard Depths to 1,000m',
    desc: 'Super-resolution decoder predicts 3D subsurface temperature fields at 15 depths, validated against INCOIS and ARGO float measurements.',
    icon: Database,
    tag: 'In-Situ Verified',
  },
];

/* ============================================================
   8 PLATFORM INTELLIGENCE MODULES
============================================================ */

const MODULES = [
  {
    title: '7-Day Subsurface Forecast',
    desc: 'Project vertical strata & MLD evolution across the upcoming week.',
    to: '/forecast',
    icon: Calendar,
    tag: 'Operational',
  },
  {
    title: '3D Ocean Profile Explorer',
    desc: 'Interactive 3D depth-level slab, volumetric voxels & horizontal slices.',
    to: '/profile-3d',
    icon: Layers,
    tag: 'Interactive 3D',
  },
  {
    title: 'Cyclone Intelligence & OHC',
    desc: 'Tropical Cyclone Heat Potential (TCHP) & past cyclone track analysis.',
    to: '/cyclone',
    icon: Wind,
    tag: 'Early Warning',
  },
  {
    title: 'Ocean Heat & Barrier Layer',
    desc: 'Subsurface thermal energy maps & salinity barrier layer thickness.',
    to: '/ocean-heat',
    icon: Flame,
    tag: 'Climatology',
  },
  {
    title: 'GLORYS12 Reanalysis Compare',
    desc: 'Validate AI reconstruction against Copernicus GLORYS12 reanalysis.',
    to: '/embeddings?tab=comparison',
    icon: GitCompare,
    tag: 'Benchmarking',
  },
  {
    title: 'ARGO Float Validation Hub',
    desc: 'In-situ match-up metrics with per-depth RMSE, bias, and correlation.',
    to: '/embeddings?tab=depth',
    icon: CheckCircle2,
    tag: 'Precision',
  },
  {
    title: 'Live Satellite Observations',
    desc: 'High-res SST, SSS, SSH Altimetry, and surface wind vector heatmaps.',
    to: '/surface',
    icon: Eye,
    tag: 'Telemetry',
  },
  {
    title: 'Embeddings',
    desc: '466 neural representation vectors across 5 ocean domains, PCA/t-SNE/UMAP projections & live sync.',
    to: '/embeddings',
    icon: BrainCircuit,
    tag: 'Latent Space',
  },
  {
    title: 'Ask X AI Assistant',
    desc: 'Natural language oceanographic chat, depth queries & anomaly analysis.',
    to: '/chat',
    icon: MessageSquare,
    tag: 'AI Intelligence',
  },
];

/* ============================================================
   MAIN HOMEPAGE (AESTHETIC WHITE WITH DARK BLUE ANIMATED BG)
============================================================ */

export default function HomePage() {
  const navigate = useNavigate();

  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [modelInfo, setModelInfo] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [selectedDepth, setSelectedDepth] = useState<number>(50);
  const [activeHeroBtn, setActiveHeroBtn] = useState<'depth' | 'sat' | 'monsoon' | 'dashboard' | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBackendStatus = async () => {
      try {
        const [healthResult, modelResult, metricsResult] = await Promise.allSettled([
          fetchHealth(),
          fetchModelInfo(),
          fetchMetricsSummary(),
        ]);

        if (cancelled) return;

        setBackendConnected(healthResult.status === 'fulfilled');

        if (modelResult.status === 'fulfilled') {
          setModelInfo(modelResult.value as Record<string, unknown>);
        }

        if (metricsResult.status === 'fulfilled') {
          setMetrics(metricsResult.value as unknown as Record<string, unknown>);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[HomePage] Backend status check failed:', error);
          setBackendConnected(false);
        }
      }
    };

    loadBackendStatus();
    const intervalId = window.setInterval(loadBackendStatus, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedLayer = useMemo(() => {
    let active = DEPTH_LAYERS[0];
    for (const layer of DEPTH_LAYERS) {
      if (layer.depth <= selectedDepth) {
        active = layer;
      } else {
        break;
      }
    }
    return active;
  }, [selectedDepth]);

  const getNumber = (...keys: string[]): number | null => {
    const sources = [metrics, modelInfo].filter(Boolean) as Record<string, unknown>[];
    for (const source of sources) {
      for (const key of keys) {
        const value = source[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
    return null;
  };

  const getString = (...keys: string[]): string | null => {
    const sources = [modelInfo, metrics].filter(Boolean) as Record<string, unknown>[];
    for (const source of sources) {
      for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) return value;
      }
    }
    return null;
  };

  const liveDepthCount = getNumber('output_depths', 'depth_count', 'num_depths');
  const liveModelName = getString('model', 'model_name', 'name', 'architecture');

  return (
    <div className="min-h-screen text-slate-900 overflow-x-hidden selection:bg-sky-500/30 relative">
      {/* Common Ocean Background is mounted globally in App.tsx */}


      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content (Aesthetic White on Dark Blue Ocean) */}
      <main className="relative z-10 pt-8 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-16 sm:space-y-24">

        {/* ====================================================
            HERO SHOWCASE SECTION
        ==================================================== */}
        <section className="relative pt-4 pb-4 space-y-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">

            {/* Sovereign & SIH Floating Glass Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 text-[#005088] border border-white shadow-[0_8px_25px_rgba(0,0,0,0.2)] text-xs font-mono backdrop-blur-xl">
              <IndiaFlag className="w-5 h-3.5" />
              <span className="text-[#005088] font-black">SIH 2026</span>
              <span className="text-cyan-600 font-bold">•</span>
              <span className="text-sky-950 font-bold">MoES &amp; INCOIS Aligned</span>
              <span className="text-cyan-600 font-bold">•</span>
              <span className="text-emerald-700 font-semibold">NORTH INDIAN OCEAN BASIN</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl xl:text-7xl font-black leading-[1.08] tracking-tight drop-shadow-[0_4px_30px_rgba(255,255,255,0.22)]">
              <span className="block bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                Space-to-Subsurface
              </span>
              <span className="block bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                AI Ocean Temperature Reconstruction
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sky-100 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto drop-shadow-sm font-medium">
              Direct in-situ temperature floats remain sparse. OCEANINTEL ingests multi-mission satellite parameters (SST, Salinity, Altimetry SLA, Wind) and applies physics-guided deep learning to predict the complete 3D subsurface temperature field from surface down to 1,000 meters across 15 standard depth layers.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setActiveHeroBtn('depth');
                  const el = document.getElementById('depth-explorer-root');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${activeHeroBtn === 'depth'
                  ? 'bg-[#005088] text-white border border-cyan-300 shadow-[0_0_25px_rgba(0,180,255,0.5)]'
                  : 'bg-white text-[#005088] hover:bg-sky-50 border border-white'
                  }`}
              >
                <Layers3 size={17} className={activeHeroBtn === 'depth' ? 'text-cyan-300' : 'text-[#005088]'} />
                Explore 3D Depths
              </button>

              <button
                onClick={() => {
                  setActiveHeroBtn('sat');
                  const el = document.getElementById('satellite-sim-root');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${activeHeroBtn === 'sat'
                  ? 'bg-[#005088] text-white border border-cyan-300 shadow-[0_0_25px_rgba(0,180,255,0.5)]'
                  : 'bg-white text-[#005088] hover:bg-sky-50 border border-white'
                  }`}
              >
                <Satellite size={17} className={activeHeroBtn === 'sat' ? 'text-cyan-300' : 'text-[#005088]'} />
                Satellite Telemetry Sim
              </button>

              <button
                onClick={() => {
                  setActiveHeroBtn('monsoon');
                  const el = document.getElementById('monsoon-simulation');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${activeHeroBtn === 'monsoon'
                  ? 'bg-[#005088] text-white border border-cyan-300 shadow-[0_0_25px_rgba(0,180,255,0.5)]'
                  : 'bg-white text-[#005088] hover:bg-sky-50 border border-white'
                  }`}
              >
                <Compass size={17} className={activeHeroBtn === 'monsoon' ? 'text-cyan-300' : 'text-[#005088]'} />
                Monsoon Currents
              </button>

              <button
                onClick={() => {
                  setActiveHeroBtn('dashboard');
                  navigate('/dashboard');
                }}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${activeHeroBtn === 'dashboard'
                  ? 'bg-[#005088] text-white border border-cyan-300 shadow-[0_0_25px_rgba(0,180,255,0.5)]'
                  : 'bg-white text-[#005088] hover:bg-sky-50 border border-white'
                  }`}
              >
                <LayoutDashboard size={17} className={activeHeroBtn === 'dashboard' ? 'text-cyan-300' : 'text-[#005088]'} />
                Open 3D Dashboard
              </button>
            </div>

            {/* 3 Floating White Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-3xl mx-auto">
              {[
                { label: 'Spatial Resolution', value: '0.25° × 0.25°', tag: 'High-Res Grid' },
                {
                  label: 'Vertical Strata',
                  value: liveDepthCount ? `${liveDepthCount} Depths` : '15 Depths',
                  tag: '0 to 1,000m',
                },
                { label: 'Max Subsurface Depth', value: '1,000 Metres', tag: 'Abyssal Reference' },
              ].map(({ label, value, tag }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/95 border border-white shadow-[0_12px_32px_rgba(0,10,30,0.22)] p-4 text-center hover:scale-105 transition-transform backdrop-blur-xl"
                >
                  <p className="text-lg sm:text-xl font-black font-mono text-[#005088]">
                    {value}
                  </p>
                  <p className="text-sky-950 font-bold text-xs mt-0.5">{label}</p>
                  <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    {tag}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-xs font-mono text-cyan-100/90">
              <span>
                API STATUS:{' '}
                <span className={backendConnected === true ? 'text-emerald-300 font-bold' : backendConnected === false ? 'text-red-300 font-bold' : 'text-amber-300'}>
                  {backendConnected === true ? 'OPERATIONAL' : backendConnected === false ? 'OFFLINE' : 'CHECKING'}
                </span>
              </span>
              {liveModelName && (
                <>
                  <span className="text-cyan-400/60">•</span>
                  <span>
                    ACTIVE ARCHITECTURE: <span className="text-white font-bold">{liveModelName}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ====================================================
            SECTION 1: 3D SUBSURFACE DEPTH STRATUM EXPLORER
        ==================================================== */}
        <section id="depth-explorer-root" className="space-y-4 pt-4">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/30 text-xs font-mono text-white backdrop-blur-md">
              <Layers size={13} className="text-cyan-300" />
              PHYSICAL STRATIFICATION 01
            </div>
            <h2 className="text-3xl sm:text-4xl font-black drop-shadow-md">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                Interactive 3D Subsurface Depth Stratum Explorer
              </span>
            </h2>
            <p className="text-sm sm:text-base text-sky-100/90 leading-relaxed font-medium">
              Explore how temperature drops dynamically across the 15 predicted depth layers from the warm surface down through the thermocline into the 1,000m abyss.
            </p>
          </div>

          <AestheticWhiteCard className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row items-stretch gap-6">

              {/* Left Column: Extended Depth Level Selector List */}
              <div className="w-full lg:w-5/12 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                  <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Depth Level (0–1000m)</span>
                  <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Predicted Temp</span>
                </div>

                <div className="space-y-1.5 overflow-y-auto max-h-[560px] pr-1.5">
                  {DEPTH_LAYERS.map((layer) => {
                    const isSelected = selectedLayer.depth === layer.depth;
                    return (
                      <button
                        key={layer.depth}
                        onClick={() => setSelectedDepth(layer.depth)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all duration-200 cursor-pointer text-left ${isSelected
                          ? 'bg-[#005088] text-white border-cyan-400 shadow-lg ring-1 ring-cyan-400/50'
                          : 'bg-white border-sky-100 text-[#002f52] hover:bg-sky-50/80 hover:border-sky-200'
                          }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform ${isSelected ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] scale-110' : ''
                              }`}
                            style={{ backgroundColor: isSelected ? '#ffffff' : layer.color }}
                          />
                          <span className={`text-xs ${isSelected ? 'text-white font-bold' : 'text-[#002f52] font-semibold'}`}>
                            {layer.depth} m ({layer.label})
                          </span>
                        </div>
                        <span className={`font-black text-xs ${isSelected ? 'text-white' : 'text-[#005088]'}`}>
                          {layer.temp.toFixed(1)}°C
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Clean, Sensible Depth Zone Simulation */}
              <div className="w-full lg:w-7/12 flex flex-col space-y-3">
                {/* Top Telemetry Header */}
                <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold block">
                      Active Subsurface Layer
                    </span>
                    <div className="text-xl font-black text-[#005088]">
                      {selectedLayer.depth} m ({selectedLayer.label})
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-sky-600 block">Predicted Temp</span>
                      <span className="text-lg font-black text-emerald-600">{selectedLayer.temp.toFixed(1)}°C</span>
                    </div>
                    <div className="text-right pl-3 border-l border-sky-200">
                      <span className="text-[10px] uppercase tracking-wider text-sky-600 block">Ocean Zone</span>
                      <span className="text-xs font-bold text-[#005088] uppercase block">
                        {selectedLayer.zoneId === 'surface'
                          ? 'Epipelagic Surface'
                          : selectedLayer.zoneId === 'mixed'
                            ? 'Mixed Layer'
                            : selectedLayer.zoneId === 'thermocline'
                              ? 'Thermocline Gradient'
                              : selectedLayer.zoneId === 'meso'
                                ? 'Mesopelagic Strata'
                                : 'Abyssal Reference'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3D Depth Zone Simulation Viewport (Sensible & Framed) */}
                <div className="relative rounded-2xl overflow-hidden border border-sky-200 bg-[#021324] h-[340px] shadow-md">
                  <DepthZoneCanvas
                    zoneId={selectedLayer.zoneId}
                    color={selectedLayer.color}
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-300 pointer-events-none flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>3D Strata View · {selectedLayer.depth}m Depth</span>
                  </div>
                </div>

                {/* Bottom Stratum Explanation */}
                <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#002f52]">
                    <Layers3 size={16} className="text-[#005088]" />
                    <span>{selectedLayer.depth} m ({selectedLayer.label}) Stratum Dynamics</span>
                  </div>
                  <p className="text-xs text-sky-950/85 leading-relaxed">
                    {selectedLayer.desc}. In the North Indian Ocean basin, this layer plays a critical role in thermal stratification, vertical heat transport, and cyclone intensity modulation.
                  </p>
                </div>
              </div>

            </div>
          </AestheticWhiteCard>
        </section>

        {/* ====================================================
            SECTION 2: SATELLITE TELEMETRY REMOTE SENSING SIMULATION
        ==================================================== */}
        <section id="satellite-sim-root" className="space-y-4 pt-4">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/30 text-xs font-mono text-white backdrop-blur-md">
              <Satellite size={13} className="text-cyan-300" />
              SPACE REMOTE SENSING TELEMETRY 02
            </div>
            <h2 className="text-3xl sm:text-4xl font-black drop-shadow-md">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                Interactive Satellite-to-Subsurface 3D Simulation
              </span>
            </h2>
            <p className="text-sm sm:text-base text-sky-100/90 leading-relaxed font-medium">
              Experience the photorealistic 3D Earth and real-time satellite telemetry ingestion from Sentinel-3, INSAT-3DR, SMAP, and MetOp-C scatterometers.
            </p>
          </div>

          <AestheticWhiteCard className="p-4 sm:p-6">
            <SatelliteReconstructionSimulation />
          </AestheticWhiteCard>
        </section>

        {/* ====================================================
            SECTION 3: 5 SATELLITE INPUT OBSERVATION PARAMETERS
        ==================================================== */}
        <section className="space-y-6 pt-4">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/30 text-xs font-mono text-white backdrop-blur-md">
              <Database size={13} className="text-cyan-300" />
              SATELLITE OBSERVATION SUITE 03
            </div>
            <h2 className="text-3xl sm:text-4xl font-black drop-shadow-md">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                The 5 Primary Satellite Input Parameters
              </span>
            </h2>
            <p className="text-sm sm:text-base text-sky-100/90 leading-relaxed font-medium">
              Multi-sensor satellite fusion converts surface microwave, infrared, radar, and altimetry observables into 3D subsurface temperature intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {SATELLITE_INPUTS.map((item) => {
              const Icon = item.icon;
              return (
                <AestheticWhiteCard key={item.key} className="p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#005088]">
                        <Icon size={20} />
                      </div>
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                        {item.symbol}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[#002f52] leading-snug">{item.title}</h3>
                      <p className="text-[10px] font-mono text-[#005088] font-bold mt-0.5">{item.sensor}</p>
                    </div>

                    <p className="text-xs text-sky-950/80 leading-relaxed">{item.desc}</p>
                  </div>

                  <div className="pt-2 border-t border-sky-100 flex items-center justify-between text-[11px]">
                    <span className="text-sky-600 font-mono font-medium">Range: {item.range}</span>
                    <span className="text-[#005088] font-semibold">{item.role.split('&')[0]}</span>
                  </div>
                </AestheticWhiteCard>
              );
            })}
          </div>
        </section>

        {/* ====================================================
            SECTION 4: END-TO-END DEEP LEARNING ARCHITECTURE
        ==================================================== */}
        <section className="space-y-6 pt-4">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/30 text-xs font-mono text-white backdrop-blur-md">
              <Cpu size={13} className="text-cyan-300" />
              NEURAL INVERSION ARCHITECTURE 04
            </div>
            <h2 className="text-3xl sm:text-4xl font-black drop-shadow-md">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                Physics-Guided Deep Learning Pipeline
              </span>
            </h2>
            <p className="text-sm sm:text-base text-sky-100/90 leading-relaxed font-medium">
              Bridging surface satellite telemetry with deep 1,000m thermal stratification using physics-informed neural network inversion.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <AestheticWhiteCard key={step.step} className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black font-mono text-sky-300 font-extrabold">
                      {step.step}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#005088]">
                      <Icon size={18} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-[#002f52] leading-snug">{step.title}</h4>
                    <p className="text-[11px] font-mono text-[#005088] font-bold mt-0.5">{step.subtitle}</p>
                  </div>

                  <p className="text-xs text-sky-950/80 leading-relaxed">{step.desc}</p>

                  <div className="pt-2 border-t border-sky-100">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 font-semibold">
                      {step.tag}
                    </span>
                  </div>
                </AestheticWhiteCard>
              );
            })}
          </div>
        </section>

        {/* ====================================================
            SECTION 5: MONSOON FLOW SIMULATION
        ==================================================== */}
        <section id="monsoon-simulation" className="space-y-4 pt-4">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/30 text-xs font-mono text-white backdrop-blur-md">
              <Waves size={13} className="text-cyan-300" />
              DYNAMIC OCEAN CIRCULATION 05
            </div>
            <h2 className="text-3xl sm:text-4xl font-black drop-shadow-md">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                Seasonal Monsoon Current Reversals &amp; Gyres
              </span>
            </h2>
            <p className="text-sm sm:text-base text-sky-100/90 leading-relaxed font-medium">
              The North Indian Ocean is the only basin where boundary currents completely reverse direction twice a year under the influence of the monsoons.
            </p>
          </div>

          <AestheticWhiteCard className="p-4 sm:p-6">
            <MonsoonFlowSimulation />
          </AestheticWhiteCard>
        </section>

        {/* ====================================================
            SECTION 6: PLATFORM INTELLIGENCE MODULES
        ==================================================== */}
        <section className="space-y-6 pt-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/30 text-xs font-mono text-white backdrop-blur-md mb-2">
              <LayoutDashboard size={13} className="text-cyan-300" />
              OPERATIONAL PORTAL 06
            </div>
            <h2 className="text-2xl sm:text-3xl font-black drop-shadow-md">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                Platform Intelligence Modules
              </span>
            </h2>
            <p className="text-sm text-sky-100/90 font-medium">
              Direct access to specialized operational ocean intelligence tools
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map(({ title, desc, to, icon: Icon, tag }) => (
              <button
                key={title}
                onClick={() => navigate(to)}
                className="text-left group cursor-pointer transition-all"
              >
                <AestheticWhiteCard className="p-5 h-full space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#005088] transition-transform group-hover:scale-110">
                      <Icon size={19} />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold">
                      {tag}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#002f52] group-hover:text-[#005088] transition-colors flex items-center justify-between">
                    <span>{title}</span>
                    <ArrowRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#005088]"
                    />
                  </h4>
                  <p className="text-xs text-sky-950/80 leading-relaxed">{desc}</p>
                </AestheticWhiteCard>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Sovereign MoES Government of India Footer */}
      <GovFooter className="mt-8" />
    </div>
  );
}