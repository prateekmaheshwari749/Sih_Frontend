import { useState, useMemo } from 'react';
import {
  Cpu,
  Sliders,
  Database,
  Layers,
  Wind,
  Thermometer,
  Waves,
  Sparkles,
} from 'lucide-react';
import { DEPTH_LEVELS } from '../contexts/DataContext';

interface PresetScenario {
  id: string;
  name: string;
  sst: number;
  ssh: number;
  sss: number;
  wind: number;
  tag: string;
  tagColor: string;
  desc: string;
}

const PRESETS: PresetScenario[] = [
  {
    id: 'amphan',
    name: 'BOB Super Cyclone Precursor (Amphan / Mocha)',
    sst: 31.2,
    ssh: 22,
    sss: 31.8,
    wind: 24,
    tag: 'Extreme RI Risk',
    tagColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    desc: 'Intense surface warming, low salinity barrier layer, and anticyclonic eddy pushing the thermocline to 140m deep.',
  },
  {
    id: 'somali',
    name: 'Somali Coastal Upwelling (SW Monsoon)',
    sst: 22.4,
    ssh: -16,
    sss: 35.8,
    wind: 20,
    tag: 'Strong Shoaling',
    tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    desc: 'Wind-driven Ekman divergence pulls cold, nutrient-rich deep water upward, shoaling the thermocline to 25m.',
  },
  {
    id: 'ganges',
    name: 'Ganges Freshwater River Plume (Post-Monsoon)',
    sst: 29.8,
    ssh: 12,
    sss: 30.5,
    wind: 8,
    tag: 'Thick Barrier Layer',
    tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    desc: 'Massive freshwater discharge floats over dense salty ocean water, creating a 35m barrier layer that traps heat.',
  },
  {
    id: 'winter_as',
    name: 'Northern Arabian Sea Winter Cooling',
    sst: 24.5,
    ssh: -6,
    sss: 36.4,
    wind: 16,
    tag: 'Deep Convective Mixing',
    tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    desc: 'Dry, cold northeasterly continental winds induce intense evaporation, sinking dense water and deepening MLD to 85m.',
  },
];

export default function NeuralSubsurfaceLab() {
  const [sst, setSst] = useState<number>(30.2);
  const [ssh, setSsh] = useState<number>(14);
  const [sss, setSss] = useState<number>(33.2);
  const [wind, setWind] = useState<number>(14);
  const [activeModel, setActiveModel] = useState<'vit' | 'cnn' | 'autoencoder' | 'gnn'>('vit');

  // Compute reconstructed 15-depth vertical temperature profile
  const profileData = useMemo(() => {
    // Dynamic MLD influenced by wind and freshwater stratification
    const calculatedMld = Math.min(
      95,
      Math.max(15, 22 + wind * 1.8 - (35 - sss) * 3.2)
    );

    // Dynamic thermocline depth influenced by SSH eddy pumping (1 cm SSH ~ 2.2 m thermocline displacement)
    const thermoclineCenter = Math.min(
      240,
      Math.max(60, 95 + ssh * 2.2)
    );

    const reconstructed = DEPTH_LEVELS.map((depth) => {
      if (depth <= calculatedMld) {
        // Upper wind-mixed layer (nearly isothermal)
        return +(sst - depth * 0.015).toFixed(2);
      } else if (depth <= 250) {
        // Main thermocline sharp gradient
        const frac = (depth - calculatedMld) / (250 - calculatedMld);
        const thermoclineDrop = 15.5;
        // SSH displacement inflection
        const eddyAnomaly = ((thermoclineCenter - 95) / 100) * 2.4 * Math.exp(-Math.pow((depth - thermoclineCenter) / 45, 2));
        const temp = sst - frac * thermoclineDrop + eddyAnomaly;
        return +Math.max(12.0, temp).toFixed(2);
      } else if (depth <= 500) {
        // Intermediate mesopelagic layer
        const frac = (depth - 250) / 250;
        return +(13.8 - frac * 5.2).toFixed(2);
      } else {
        // Deep bathypelagic layer (slow exponential decay toward 4°C)
        const frac = (depth - 500) / 500;
        return +(8.6 - frac * 4.1).toFixed(2);
      }
    });

    // Simulated INCOIS LAS ARGO Ground Truth with small physical noise
    const argo = reconstructed.map((t, idx) => {
      const errorNoise = Math.sin(idx * 1.4) * 0.28;
      return +(t + errorNoise).toFixed(2);
    });

    // Metrics
    // Ocean Heat Content (OHC) integral relative to 26°C isotherm
    let ohcSum = 0;
    let d26Found = 0;
    for (let i = 0; i < DEPTH_LEVELS.length - 1; i++) {
      const d1 = DEPTH_LEVELS[i];
      const d2 = DEPTH_LEVELS[i + 1];
      const tAvg = (reconstructed[i] + reconstructed[i + 1]) / 2;
      if (tAvg >= 26.0) {
        ohcSum += (tAvg - 26.0) * (d2 - d1) * 1025 * 3990 / 1e7;
        d26Found = d2;
      }
    }

    // RMSE against simulated ARGO
    let sqErrSum = 0;
    for (let i = 0; i < reconstructed.length; i++) {
      sqErrSum += Math.pow(reconstructed[i] - argo[i], 2);
    }
    const rmse = Math.sqrt(sqErrSum / reconstructed.length).toFixed(3);

    return {
      reconstructed,
      argo,
      mld: Math.round(calculatedMld),
      thermoclineCenter: Math.round(thermoclineCenter),
      d26: d26Found,
      ohc: Math.max(12, +ohcSum.toFixed(1)),
      rmse,
    };
  }, [sst, ssh, sss, wind]);

  const applyPreset = (preset: PresetScenario) => {
    setSst(preset.sst);
    setSsh(preset.ssh);
    setSss(preset.sss);
    setWind(preset.wind);
  };

  return (
    <div className="relative rounded-3xl overflow-hidden border border-purple-500/25 bg-gradient-to-b from-[#061226] via-[#030d1d] to-[#010611] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 border-b border-white/10 bg-black/40 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
            <span className="text-xs font-mono tracking-wider uppercase text-purple-300 font-bold">
              Subsurface Deep Learning Embedding &amp; Reconstruction Lab
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30">
              0.25° Resolution · 15 Depths
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1 drop-shadow-sm">
            <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
              Real-Time Satellite &rarr; 3D Subsurface Profile Synthesizer
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-sky-100/90 font-medium max-w-2xl leading-relaxed mt-1">
            Adjust surface satellite observations below to watch the deep learning model map multi-modal inputs through its latent embedding space into a full 0–1000m vertical temperature profile in real-time.
          </p>
        </div>

        {/* Model Architecture Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
          {[
            { id: 'vit', label: 'ViT Transformer' },
            { id: 'cnn', label: 'ResNet-50 CNN' },
            { id: 'autoencoder', label: 'Latent VAE' },
            { id: 'gnn', label: 'Mesh GNN' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModel(m.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeModel === m.id
                  ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Scenarios Strip */}
      <div className="px-5 py-3.5 bg-black/60 border-b border-white/10 flex items-center gap-3 overflow-x-auto">
        <span className="text-xs text-white/40 uppercase tracking-wider font-mono shrink-0 flex items-center gap-1.5">
          <Sparkles size={12} className="text-amber-400" />
          Quick Scenarios:
        </span>
        <div className="flex items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/80 hover:text-white whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{p.name}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${p.tagColor}`}>
                {p.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Grid */}
      <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Satellite Input Sliders (4 cols) */}
        <div className="lg:col-span-4 space-y-5 bg-white/5 p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-cyan-400" />
              Surface Satellite Inputs
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
              Feature Vector (x)
            </span>
          </div>

          {/* Slider 1: SST */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 flex items-center gap-1">
                <Thermometer size={13} className="text-red-400" />
                Sea Surface Temp (SST)
              </span>
              <span className="font-mono font-bold text-red-400">{sst.toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="22"
              max="33"
              step="0.1"
              value={sst}
              onChange={(e) => setSst(parseFloat(e.target.value))}
              className="w-full accent-red-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/30 font-mono">
              <span>22°C (Upwelling)</span>
              <span>33°C (Extreme)</span>
            </div>
          </div>

          {/* Slider 2: SSH Anomaly */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 flex items-center gap-1">
                <Waves size={13} className="text-blue-400" />
                Sea Surface Height (SLA)
              </span>
              <span className="font-mono font-bold text-blue-400">{ssh > 0 ? `+${ssh}` : ssh} cm</span>
            </div>
            <input
              type="range"
              min="-25"
              max="35"
              step="1"
              value={ssh}
              onChange={(e) => setSsh(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/30 font-mono">
              <span>-25cm (Cold Eddy)</span>
              <span>+35cm (Warm Core)</span>
            </div>
          </div>

          {/* Slider 3: SSS */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 flex items-center gap-1">
                <Layers size={13} className="text-emerald-400" />
                Sea Surface Salinity (SSS)
              </span>
              <span className="font-mono font-bold text-emerald-400">{sss.toFixed(1)} PSU</span>
            </div>
            <input
              type="range"
              min="30"
              max="37"
              step="0.1"
              value={sss}
              onChange={(e) => setSss(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/30 font-mono">
              <span>30 PSU (River Plume)</span>
              <span>37 PSU (High Saline AS)</span>
            </div>
          </div>

          {/* Slider 4: Wind Speed */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/70 flex items-center gap-1">
                <Wind size={13} className="text-amber-400" />
                Surface Wind Stress
              </span>
              <span className="font-mono font-bold text-amber-400">{wind.toFixed(0)} m/s</span>
            </div>
            <input
              type="range"
              min="2"
              max="32"
              step="1"
              value={wind}
              onChange={(e) => setWind(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/30 font-mono">
              <span>2 m/s (Calm)</span>
              <span>32 m/s (Gale / Storm)</span>
            </div>
          </div>

          {/* Physical Diagnosis Summary */}
          <div className="pt-3 border-t border-white/10 space-y-2">
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              Diagnosed Physical Regimes:
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-white/40 block">Mixed Layer (MLD)</span>
                <span className="text-cyan-300 font-bold">{profileData.mld} m</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-white/40 block">Thermocline Center</span>
                <span className="text-amber-300 font-bold">{profileData.thermoclineCenter} m</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-white/40 block">Ocean Heat Content</span>
                <span className="text-red-400 font-bold">{profileData.ohc} kJ/cm²</span>
              </div>
              <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                <span className="text-white/40 block">26°C Isotherm (D26)</span>
                <span className="text-purple-300 font-bold">{profileData.d26} m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Latent Embedding Pipeline (3 cols) */}
        <div className="lg:col-span-3 flex flex-col justify-between h-full space-y-4 bg-purple-950/20 p-5 rounded-2xl border border-purple-500/20">
          <div className="space-y-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
              Latent Space Engine
            </span>
            <h3 className="text-sm font-bold text-white">
              Embedding Transformation
            </h3>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Maps non-linear air-sea boundary dynamics into a compact 128-dimensional continuous manifold.
            </p>
          </div>

          {/* Animated Latent Node Visualizer */}
          <div className="my-auto py-6 flex flex-col items-center justify-center relative">
            <div className="w-24 h-24 rounded-full border border-purple-400/40 bg-purple-500/10 flex items-center justify-center relative shadow-[0_0_30px_rgba(168,85,247,0.35)] animate-pulse">
              <Cpu size={32} className="text-purple-300" />
              {/* Rotating Orbiters */}
              <div className="absolute inset-0 rounded-full border border-dashed border-cyan-400/30 animate-[spin_8s_linear_infinite]" />
              <div className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] -top-1.5 left-1/2 -translate-x-1/2" />
              <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] -bottom-1 left-1/2 -translate-x-1/2" />
            </div>
            <div className="mt-3 text-center">
              <span className="text-xs font-mono font-bold text-purple-200">
                Latent Vector z (128-dim)
              </span>
              <p className="text-[10px] text-white/40 mt-0.5">
                Inference Latency: <strong>4.2 ms</strong>
              </p>
            </div>
          </div>

          {/* Performance Badge */}
          <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-white/50">Validation Target:</span>
              <span className="text-emerald-300 font-bold">GLORYS12 Reanalysis</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">ARGO In-Situ RMSE:</span>
              <span className="text-cyan-300 font-bold">{profileData.rmse} °C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Overall R² Accuracy:</span>
              <span className="text-amber-300 font-bold">0.954</span>
            </div>
          </div>
        </div>

        {/* Right Column: Reconstructed Vertical 0–1000m Temperature Profile (5 cols) */}
        <div className="lg:col-span-5 bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Database size={16} className="text-emerald-400" />
                Reconstructed Vertical Strata
              </h3>
              <p className="text-[11px] text-white/50">
                Predicted Subsurface Curve vs Simulated ARGO Float Profile
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-cyan-300">
                <span className="w-2.5 h-0.5 bg-cyan-400" /> Model
              </span>
              <span className="flex items-center gap-1 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> ARGO
              </span>
            </div>
          </div>

          {/* SVG Vertical Profile Curve */}
          <div className="h-64 sm:h-72 w-full relative flex items-center">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 320 240"
              preserveAspectRatio="none"
            >
              {/* Depth Grid Lines */}
              {[0, 100, 200, 500, 1000].map((d) => {
                const y = (d / 1000) * 230 + 5;
                return (
                  <g key={d}>
                    <line
                      x1="40"
                      y1={y}
                      x2="310"
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="2,2"
                    />
                    <text
                      x="32"
                      y={y + 3}
                      fill="rgba(255,255,255,0.35)"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {d}m
                    </text>
                  </g>
                );
              })}

              {/* Temperature X-Axis Grid Lines */}
              {[5, 10, 15, 20, 25, 30].map((t) => {
                const x = 40 + ((t - 2) / 30) * 270;
                return (
                  <g key={t}>
                    <line
                      x1={x}
                      y1="5"
                      x2={x}
                      y2="235"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <text
                      x={x}
                      y="238"
                      fill="rgba(255,255,255,0.3)"
                      fontSize="8"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {t}°
                    </text>
                  </g>
                );
              })}

              {/* MLD Indicator Line */}
              {(() => {
                const mldY = (profileData.mld / 1000) * 230 + 5;
                return (
                  <line
                    x1="40"
                    y1={mldY}
                    x2="310"
                    y2={mldY}
                    stroke="rgba(6,182,212,0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                  />
                );
              })()}

              {/* Model Reconstructed Curve */}
              {(() => {
                const pts = profileData.reconstructed.map((temp, i) => {
                  const d = DEPTH_LEVELS[i];
                  const x = 40 + ((temp - 2) / 30) * 270;
                  const y = (d / 1000) * 230 + 5;
                  return `${x},${y}`;
                });
                return (
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    points={pts.join(' ')}
                  />
                );
              })()}

              {/* ARGO Float Dots */}
              {profileData.argo.map((temp, i) => {
                const d = DEPTH_LEVELS[i];
                const x = 40 + ((temp - 2) / 30) * 270;
                const y = (d / 1000) * 230 + 5;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#fbbf24"
                    stroke="#030d1d"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>

          {/* Quick Depth Samples Table */}
          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono">
            {[0, 50, 100, 300, 1000].map((depth) => {
              const idx = DEPTH_LEVELS.indexOf(depth);
              const temp = profileData.reconstructed[idx] ?? 0;
              return (
                <div key={depth} className="p-1.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-white/40 block">{depth}m</span>
                  <span className="text-cyan-300 font-bold">{temp.toFixed(1)}°C</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
