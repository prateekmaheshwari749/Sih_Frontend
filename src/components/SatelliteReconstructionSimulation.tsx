import { useState, useMemo } from 'react';
import {
  Satellite,
  Radio,
  Cpu,
  Play,
  Pause,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { DEPTH_LEVELS } from '../contexts/DataContext';
import RealSatelliteEarthScene from './3d/RealSatelliteEarthScene';

interface SatelliteMission {
  id: string;
  name: string;
  agency: string;
  sensor: string;
  primaryParameter: string;
  color: string;
  orbitAlt: string;
  temporalRes: string;
  roleInModel: string;
}

const MISSIONS: SatelliteMission[] = [
  {
    id: 'sentinel3',
    name: 'Sentinel-3 / AltiKa',
    agency: 'ESA / CNES / ISRO',
    sensor: 'SRAL Synthetic Altimeter & SLSTR Infrared Radiometer',
    primaryParameter: 'Sea Surface Height (SSH/SLA) & Sea Surface Temperature (SST)',
    color: '#38bdf8',
    orbitAlt: '814 km (Polar Sun-Sync)',
    temporalRes: '27-Day Repeat Cycle · NRT Ingestion within 3h',
    roleInModel: 'Supplies high-precision Sea Level Anomaly (SLA) to locate mesoscale eddies and calculate thermocline displacement.',
  },
  {
    id: 'insat3d',
    name: 'INSAT-3DR / Oceansat-3',
    agency: 'ISRO (India)',
    sensor: '19-Channel Sounder & Ocean Colour Monitor (OCM-3)',
    primaryParameter: 'High-Frequency Thermal SST & Wind Scatterometry',
    color: '#f59e0b',
    orbitAlt: '35,786 km (Geostationary Indian Ocean Slot)',
    temporalRes: 'Continuous 15-Minute Rapid Refresh',
    roleInModel: 'Delivers rapid sub-hourly sea surface thermal evolution over Arabian Sea & Bay of Bengal, capturing diurnal heat cycles.',
  },
  {
    id: 'smap',
    name: 'SMAP / SMOS',
    agency: 'NASA / ESA',
    sensor: 'L-band (1.4 GHz) Conical-Scanning Microwave Radiometer',
    primaryParameter: 'Sea Surface Salinity (SSS)',
    color: '#10b981',
    orbitAlt: '685 km (Dawn-Dusk Orbit)',
    temporalRes: '3-Day Global Ocean Map Refresh',
    roleInModel: 'Quantifies freshwater runoff plumes from Ganges-Brahmaputra to reconstruct the salinity barrier layer that traps heat.',
  },
  {
    id: 'metop',
    name: 'MetOp-C / ASCAT',
    agency: 'EUMETSAT / NOAA',
    sensor: 'C-band Radar Fan-Beam Scatterometer',
    primaryParameter: 'Ocean Surface Winds & Stress Vectors (U/V)',
    color: '#a855f7',
    orbitAlt: '817 km (Sun-Synchronous Polar)',
    temporalRes: 'Twice-Daily Ocean Swath Coverage',
    roleInModel: 'Provides wind-stress curl driving Ekman suction, Findlater Jet coastal upwelling, and turbulent mixed layer deepening.',
  },
];

interface ScanRegion {
  id: string;
  name: string;
  latStr: string;
  lonStr: string;
  lat: number;
  lon: number;
  sst: number;
  sss: number;
  ssh: number;
  wind: number;
  regime: string;
  tagColor: string;
}

const REGIONS: ScanRegion[] = [
  {
    id: 'bob',
    name: 'Bay of Bengal (Central Basin)',
    latStr: '15.5°N',
    lonStr: '88.2°E',
    lat: 15.5,
    lon: 88.2,
    sst: 30.6,
    sss: 31.8,
    ssh: 16,
    wind: 14,
    regime: 'Warm Barrier Layer · High Cyclogenesis Potential',
    tagColor: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  {
    id: 'somali',
    name: 'Arabian Sea (Somali Upwelling)',
    latStr: '9.2°N',
    lonStr: '52.4°E',
    lat: 9.2,
    lon: 52.4,
    sst: 22.4,
    sss: 36.4,
    ssh: -16,
    wind: 24,
    regime: 'Cold Coastal Upwelling · Shoaled Thermocline',
    tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'equator',
    name: 'Equatorial Indian Ocean',
    latStr: '1.0°S',
    lonStr: '78.5°E',
    lat: -1.0,
    lon: 78.5,
    sst: 29.1,
    sss: 34.6,
    ssh: 6,
    wind: 18,
    regime: 'Eastward Wyrtki Jet · Dynamic Mixed Layer',
    tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'andaman',
    name: 'Andaman Sea Basin',
    latStr: '11.8°N',
    lonStr: '94.6°E',
    lat: 11.8,
    lon: 94.6,
    sst: 29.8,
    sss: 32.2,
    ssh: 10,
    wind: 10,
    regime: 'Tropical Thermal Reservoir · Strong Stratification',
    tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
];

export default function SatelliteReconstructionSimulation() {
  const [activeMission, setActiveMission] = useState<SatelliteMission>(MISSIONS[0]);
  const [activeRegion, setActiveRegion] = useState<ScanRegion>(REGIONS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedDepth, setSelectedDepth] = useState<number>(100);

  // Compute reconstructed vertical subsurface temperature field (0–1000m)
  const subsurfaceProfile = useMemo(() => {
    const sst = activeRegion.sst;
    const ssh = activeRegion.ssh;
    const sss = activeRegion.sss;
    const wind = activeRegion.wind;

    // Mixed Layer Depth governed by wind stress and salinity barrier effect
    const mld = Math.min(95, Math.max(16, 20 + wind * 1.7 - (35 - sss) * 2.8));

    // Thermocline depth displaced by Sea Surface Height anomaly (SSH eddy pumping)
    const thermoclineDepth = Math.min(220, Math.max(65, 95 + ssh * 2.1));

    const temps = DEPTH_LEVELS.map((depth) => {
      if (depth <= mld) {
        // Upper wind-mixed layer
        return +(sst - depth * 0.012).toFixed(1);
      } else if (depth <= 200) {
        // Sharp thermocline transition
        const frac = (depth - mld) / (200 - mld);
        const eddyOffset = (ssh / 15) * 1.8 * Math.exp(-Math.pow((depth - thermoclineDepth) / 50, 2));
        const t = sst - frac * 14.5 + eddyOffset;
        return +Math.max(12.5, t).toFixed(1);
      } else if (depth <= 500) {
        // Mesopelagic layer
        const frac = (depth - 200) / 300;
        return +(13.2 - frac * 5.4).toFixed(1);
      } else {
        // Deep ocean (towards 4°C)
        const frac = (depth - 500) / 500;
        return +(7.8 - frac * 3.4).toFixed(1);
      }
    });

    // Ocean Heat Content calculation relative to 26°C isotherm
    let ohc = 0;
    for (let i = 0; i < DEPTH_LEVELS.length - 1; i++) {
      const d1 = DEPTH_LEVELS[i];
      const d2 = DEPTH_LEVELS[i + 1];
      const tAvg = (temps[i] + temps[i + 1]) / 2;
      if (tAvg >= 26.0) {
        ohc += (tAvg - 26.0) * (d2 - d1) * 1025 * 3990 / 1e7;
      }
    }

    return {
      temps,
      mld: Math.round(mld),
      thermoclineDepth: Math.round(thermoclineDepth),
      ohc: Math.max(15, +ohc.toFixed(1)),
    };
  }, [activeRegion]);

  const triggerManualReconstruct = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
    }, 700);
  };

  const selectedIdx = DEPTH_LEVELS.indexOf(selectedDepth);
  const currentTempAtSelectedDepth = subsurfaceProfile.temps[selectedIdx] ?? 0;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-sky-200 dark:border-cyan-500/30 light-panel dark-panel shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 border-b border-sky-100 light-banner backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style={{ backgroundColor: 'rgba(248, 253, 255, 0.95)' }}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
            <span className="text-xs font-mono tracking-wider uppercase font-black" style={{ color: '#005088' }}>
              Space Remote Sensing &rarr; Subsurface AI Inversion
            </span>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border" style={{ backgroundColor: '#e0f2fe', color: '#003865', borderColor: '#7dd3fc' }}>
              Photorealistic 3D Earth &amp; Satellite
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: '#002f52' }}>
            How OCEANINTEL Works: Space Sensors to 1000m Depths
          </h2>
          <p className="text-xs sm:text-sm font-semibold max-w-2xl leading-relaxed" style={{ color: '#003355' }}>
            Satellites measure continuous 2D surface parameters (SST, SSS, SSH Altimetry, and Wind vectors). Our project&apos;s deep learning model ingests those parameters to reconstruct the complete 3D ocean temperature field (0–1000m across 15 depths).
          </p>
        </div>

        {/* Mission Selectors */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sky-50/90 border border-sky-200 text-xs font-mono">
          {MISSIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMission(m)}
              className="px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold"
              style={
                activeMission.id === m.id
                  ? { backgroundColor: '#005088', color: '#ffffff', boxShadow: '0 4px 12px rgba(0, 80, 136, 0.3)' }
                  : { backgroundColor: 'transparent', color: '#003355' }
              }
            >
              {m.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Target Regional Inspection Strip */}
      <div className="px-4 py-3 light-subpanel border-b border-sky-100 flex items-center gap-3 overflow-x-auto" style={{ backgroundColor: '#f0f9ff' }}>
        <span className="text-xs uppercase tracking-wider font-mono font-bold shrink-0 flex items-center gap-1.5" style={{ color: '#002f52' }}>
          <Radio size={13} className="text-[#005088] animate-pulse" />
          Observation Target Footprint:
        </span>
        <div className="flex items-center gap-2">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setActiveRegion(r);
                triggerManualReconstruct();
              }}
              className="px-3 py-1 rounded-xl border text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap font-bold"
              style={
                activeRegion.id === r.id
                  ? { backgroundColor: '#005088', color: '#ffffff', borderColor: '#003865', boxShadow: '0 2px 8px rgba(0, 80, 136, 0.25)' }
                  : { backgroundColor: '#ffffff', color: '#002f52', borderColor: '#bae6fd' }
              }
            >
              <span>{r.name}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${r.tagColor}`}>
                {r.latStr}, {r.lonStr}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================
          MAIN INTERACTIVE VISUAL STAGE (3D EARTH + SATELLITE)
      ==================================================== */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: 3D Photorealistic Earth & Satellite Scene (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#010613] border border-cyan-500/20 relative overflow-hidden min-h-[580px] flex flex-col justify-between shadow-2xl">
          
          {/* Top-Left Floating Mission Telemetry Card */}
          <div className="absolute top-4 left-4 z-20 p-2.5 rounded-xl bg-black/75 border border-cyan-500/30 backdrop-blur-md max-w-xs space-y-1 font-mono text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                <Satellite size={14} />
              </div>
              <div>
                <span className="font-bold text-white block">{activeMission.name}</span>
                <span className="text-[10px] text-white/50 block">{activeMission.agency}</span>
              </div>
            </div>
            <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-cyan-300">
              <span>Alt: {activeMission.orbitAlt}</span>
              <span className="text-white/40">• Active Nadir Scan</span>
            </div>
          </div>

          {/* Top-Right Floating Controls Pill */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/75 p-1.5 rounded-xl border border-white/15 text-xs backdrop-blur-md">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause Orbit' : 'Resume Orbit'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={triggerManualReconstruct}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-[10px] font-mono font-bold cursor-pointer transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Sampling...' : 'Rescan Ocean'}
            </button>
          </div>

          {/* The 3D Canvas Scene Viewport */}
          <div className="absolute inset-0 w-full h-full">
            <RealSatelliteEarthScene
              activeMissionId={activeMission.id}
              activeRegion={activeRegion}
              isPlaying={isPlaying}
            />
          </div>

          {/* Active Satellite Intelligence Dossier Card */}
          <div className="relative z-10 mt-auto p-4 m-3 rounded-2xl bg-black/85 border border-cyan-500/40 backdrop-blur-xl space-y-2.5 text-xs font-mono shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-black font-black shadow-md"
                  style={{ backgroundColor: activeMission.color }}
                >
                  <Satellite size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>{activeMission.name}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold text-black"
                      style={{ backgroundColor: activeMission.color }}
                    >
                      {activeMission.agency}
                    </span>
                  </h4>
                  <p className="text-[11px] text-cyan-200 mt-0.5">{activeMission.sensor}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-white/50 block">Orbit &amp; Altitude</span>
                <span className="text-xs text-white font-semibold">{activeMission.orbitAlt}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                <span className="text-white/40 block text-[9.5px] uppercase tracking-wider">Observed Primary Parameter</span>
                <span className="text-cyan-300 font-bold block">{activeMission.primaryParameter}</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Active Ingest: {activeMission.id === 'sentinel3' ? `SSH ${activeRegion.ssh > 0 ? `+${activeRegion.ssh}` : activeRegion.ssh} cm, SST ${activeRegion.sst.toFixed(1)}°C` : activeMission.id === 'insat3d' ? `Thermal SST ${activeRegion.sst.toFixed(1)}°C, Winds ${activeRegion.wind} m/s` : activeMission.id === 'smap' ? `Salinity ${activeRegion.sss.toFixed(1)} PSU` : `Wind Vector ${activeRegion.wind} m/s`}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                <span className="text-white/40 block text-[9.5px] uppercase tracking-wider">AI Deep Learning Role</span>
                <p className="text-sky-200 text-[10.5px] leading-relaxed">{activeMission.roleInModel}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-[10px] text-white/50">
              <span>Temporal Resolution: <strong className="text-white">{activeMission.temporalRes}</strong></span>
              <span>Target Basin: <strong className="text-cyan-300">{activeRegion.name}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Subsurface Temperature Reconstruction (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl light-panel-inner dark:bg-white/5 border border-sky-200 dark:border-white/10 p-5 space-y-4 flex flex-col justify-between min-h-[580px]">
          
          {/* Transformation Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Cpu size={16} className="text-purple-600 dark:text-purple-400 animate-pulse" />
                <h3 className="text-sm font-bold text-[#002f52] dark:text-white uppercase tracking-wider">
                  Reconstructed Subsurface Profile
                </h3>
              </div>
              <p className="text-[11px] text-sky-900/70 dark:text-white/50 font-medium">
                Satellite inputs &rarr; Deep learning embedding &rarr; 0–1000m thermal field
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30 font-semibold">
              15 Depth Slabs
            </span>
          </div>

          {/* Derived Physical Indicators */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-black/40 border border-sky-200 dark:border-white/5">
              <span className="text-sky-800 dark:text-white/40 block text-[10px] font-semibold">Mixed Layer (MLD)</span>
              <span className="text-[#005088] dark:text-cyan-300 font-black text-sm">{subsurfaceProfile.mld} m</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-black/40 border border-amber-200 dark:border-white/5">
              <span className="text-amber-900 dark:text-white/40 block text-[10px] font-semibold">Thermocline Axis</span>
              <span className="text-amber-700 dark:text-amber-300 font-black text-sm">{subsurfaceProfile.thermoclineDepth} m</span>
            </div>
            <div className="p-2.5 rounded-xl bg-red-50/80 dark:bg-black/40 border border-red-200 dark:border-white/5">
              <span className="text-red-900 dark:text-white/40 block text-[10px] font-semibold">Ocean Heat (OHC)</span>
              <span className="text-red-600 dark:text-red-400 font-black text-sm">{subsurfaceProfile.ohc} <span className="text-[9px] font-normal text-red-800/70 dark:text-white/40">kJ/cm²</span></span>
            </div>
          </div>

          {/* Interactive Depth Level Inspection */}
          <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-black/40 border border-sky-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-sky-900 dark:text-white/60 font-semibold flex items-center gap-1">
                <Sparkles size={12} className="text-[#005088] dark:text-cyan-400" />
                Inspect Depth Slab:
              </span>
              <span className="text-[#005088] dark:text-cyan-300 font-bold text-sm">{selectedDepth} Metres</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">{currentTempAtSelectedDepth.toFixed(1)} °C</span>
            </div>

            <input
              type="range"
              min={0}
              max={DEPTH_LEVELS.length - 1}
              step={1}
              value={selectedIdx}
              onChange={(e) => setSelectedDepth(DEPTH_LEVELS[+e.target.value])}
              className="w-full accent-[#005088] dark:accent-cyan-400 cursor-pointer h-1.5 bg-sky-200 dark:bg-white/10 rounded-lg appearance-none"
            />

            <div className="flex justify-between text-[9px] font-mono text-sky-800 dark:text-white/40 font-medium">
              <span>0m (Skin)</span>
              <span>100m (Thermocline)</span>
              <span>500m (Mesopelagic)</span>
              <span>1000m (Abyssal)</span>
            </div>
          </div>

          {/* Vertical Temperature Slices List */}
          <div className="space-y-1.5 pt-1 max-h-52 overflow-y-auto pr-1">
            {[
              { depth: 0, label: 'Surface Skin', color: '#ef4444' },
              { depth: 30, label: 'Mixed Layer', color: '#f97316' },
              { depth: 100, label: 'Main Thermocline', color: '#fbbf24' },
              { depth: 200, label: 'Lower Thermocline', color: '#06b6d4' },
              { depth: 500, label: 'Mesopelagic', color: '#3b82f6' },
              { depth: 1000, label: 'Abyssal Floor', color: '#6366f1' },
            ].map(({ depth, label, color }) => {
              const idx = DEPTH_LEVELS.indexOf(depth);
              const temp = subsurfaceProfile.temps[idx] ?? 0;
              const barWidth = Math.min(100, Math.max(10, ((temp - 2) / 30) * 100));
              const isSelected = selectedDepth === depth;

              return (
                <button
                  key={depth}
                  onClick={() => setSelectedDepth(depth)}
                  className={`w-full text-left flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-xs font-mono border ${
                    isSelected
                      ? 'bg-sky-100 border-[#005088] shadow-sm dark:bg-cyan-500/15 dark:border-cyan-400/50 dark:shadow-md dark:shadow-cyan-500/10'
                      : 'bg-white border-sky-100 hover:border-sky-300 dark:bg-black/40 dark:border-white/5 dark:hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-2 w-32">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[#002f52] dark:text-white/80 font-bold">{depth}m</span>
                    <span className="text-[10px] text-sky-800/70 dark:text-white/30 truncate">{label}</span>
                  </div>

                  {/* Horizontal visual bar */}
                  <div className="flex-1 mx-3 h-1.5 bg-sky-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        background: color,
                        boxShadow: `0 0 8px ${color}88`,
                      }}
                    />
                  </div>

                  <span className="font-bold font-mono shrink-0" style={{ color }}>
                    {temp.toFixed(1)} °C
                  </span>
                </button>
              );
            })}
          </div>

          {/* Model Confidence & Validation Badge */}
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/25 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-mono font-semibold">
              <CheckCircle2 size={15} />
              <span>ARGO Float RMSE: <strong>&plusmn;0.34 °C</strong></span>
            </div>
            <span className="text-[10px] font-mono text-purple-800 dark:text-white/50">
              Confidence: <strong>94.8%</strong>
            </span>
          </div>

        </div>

      </div>

      {/* Physics Workflow Footer Strip */}
      <div className="p-4 sm:p-5 light-footer dark:bg-[#010915] border-t border-sky-100 dark:border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-3 rounded-xl bg-white border border-sky-100 dark:bg-white/5 dark:border-white/10 space-y-1 shadow-sm">
          <p className="font-bold uppercase text-[11px] tracking-wider text-[#005088] dark:text-cyan-300">
            1. Space Sensor Ingestion
          </p>
          <p className="text-sky-950/80 dark:text-white/60 leading-relaxed font-normal">
            Satellites measure thermal infrared skin radiation (SST), sea surface salinity (SSS), radar altimetry (SSH), and wind scatterometry across continuous daily tracks.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white border border-sky-100 dark:bg-white/5 dark:border-white/10 space-y-1 shadow-sm">
          <p className="font-bold uppercase text-[11px] tracking-wider text-purple-700 dark:text-purple-300">
            2. Deep Learning Projection
          </p>
          <p className="text-sky-950/80 dark:text-white/60 leading-relaxed font-normal">
            Non-linear air-sea relationships are encoded into latent space representations, capturing how SSH anomalies push the thermocline up or down.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white border border-sky-100 dark:bg-white/5 dark:border-white/10 space-y-1 shadow-sm">
          <p className="font-bold uppercase text-[11px] tracking-wider text-emerald-700 dark:text-emerald-300">
            3. 3D Subsurface Synthesis
          </p>
          <p className="text-sky-950/80 dark:text-white/60 leading-relaxed font-normal">
            The decoder reconstructs complete 0–1000m vertical profiles across 15 depth slabs at 0.25° grid, powering cyclone early warning and maritime routing.
          </p>
        </div>
      </div>
    </div>
  );
}
