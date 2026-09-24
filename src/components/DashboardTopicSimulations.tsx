import { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Volume2,
  Waves,
  Droplets,
  Layers,
  Thermometer,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Activity,
  Wind,
  Compass,
} from 'lucide-react';

// ── Mackenzie (1981) Seawater Sound Speed Formula (m/s) ──────────────────────
function getMackenzieSoundSpeed(tempC: number, salinityPsu: number, depthM: number): number {
  return +(
    1449.2 +
    4.6 * tempC -
    0.055 * Math.pow(tempC, 2) +
    0.00029 * Math.pow(tempC, 3) +
    (1.34 - 0.01 * tempC) * (salinityPsu - 35) +
    0.016 * depthM
  ).toFixed(1);
}

export type SimulationTopicId = 'ohc' | 'acoustic' | 'upwelling' | 'salinity' | 'strata' | 'heatwave';

interface Props {
  initialTopic?: SimulationTopicId;
  className?: string;
}

export default function DashboardTopicSimulations({ initialTopic = 'ohc', className = '' }: Props) {
  const [activeTopic, setActiveTopic] = useState<SimulationTopicId>(initialTopic);

  // ── 1. OHC & Cyclone Simulation State ───────────────────────────────────────
  const [ohcValue, setOhcValue] = useState<number>(88); // 40 to 120 kJ/cm²
  const [vortexSpin, setVortexSpin] = useState<boolean>(true);

  // ── 2. Acoustic SOFAR Simulation State ──────────────────────────────────────
  const [acousticTemp, setAcousticTemp] = useState<number>(29.5); // °C
  const [acousticSalinity, setAcousticSalinity] = useState<number>(34.5); // PSU
  const [acousticSourceDepth, setAcousticSourceDepth] = useState<number>(750); // meters (SOFAR axis)

  // ── 3. Upwelling & Thermocline State ────────────────────────────────────────
  const [windSpeedKts, setWindSpeedKts] = useState<number>(28); // 5 to 55 knots
  const [eddySlaCm, setEddySlaCm] = useState<number>(-12); // -25 cm (cyclonic) to +25 cm (anticyclonic)

  // ── 4. Salinity Barrier Layer State ─────────────────────────────────────────
  const [riverDischargePct, setRiverDischargePct] = useState<number>(75); // 0 to 100%
  const [netEvapMm, setNetEvapMm] = useState<number>(-4); // -10 to +10 mm/day

  // ── 5. 0–1000m Strata & ARGO Float State ────────────────────────────────────
  const [floatDepth, setFloatDepth] = useState<number>(100); // 0 to 1000m
  const [isFloatDescending, setIsFloatDescending] = useState<boolean>(false);

  // ── 6. Marine Heatwave (MHW) State ──────────────────────────────────────────
  const [mhwSstAnomaly, setMhwSstAnomaly] = useState<number>(1.8); // +0.5 to +3.5 °C
  const [mhwDurationDays, setMhwDurationDays] = useState<number>(24); // 5 to 60 days
  const [mhwThermalDepth, setMhwThermalDepth] = useState<number>(45); // 10 to 80m

  // ── Auto descent/ascent loop for ARGO Float ─────────────────────────────────
  useEffect(() => {
    let timer: number | null = null;
    if (isFloatDescending) {
      timer = window.setInterval(() => {
        setFloatDepth((prev) => {
          if (prev >= 1000) {
            setIsFloatDescending(false);
            return 1000;
          }
          return prev + 25;
        });
      }, 150);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isFloatDescending]);

  // ── Calculations for Topic 1: OHC & Cyclone ─────────────────────────────────
  const cycloneCalculations = useMemo(() => {
    const isRI = ohcValue >= 80;
    let category = 'Depression / CS';
    let windKmh = 65;
    let centralPressure = 998;
    let surgeM = 1.0;
    let riProb = Math.min(96, Math.max(10, Math.round(((ohcValue - 40) / 80) * 95)));

    if (ohcValue < 60) {
      category = 'Depression (D)';
      windKmh = Math.round(50 + (ohcValue - 40) * 1.5);
      centralPressure = Math.round(1002 - (ohcValue - 40) * 0.4);
      surgeM = +(0.8 + (ohcValue - 40) * 0.02).toFixed(1);
    } else if (ohcValue < 75) {
      category = 'Severe Cyclonic Storm (SCS)';
      windKmh = Math.round(90 + (ohcValue - 60) * 2.0);
      centralPressure = Math.round(990 - (ohcValue - 60) * 0.8);
      surgeM = +(1.5 + (ohcValue - 60) * 0.05).toFixed(1);
    } else if (ohcValue < 95) {
      category = 'Very Severe CS (VSCS)';
      windKmh = Math.round(125 + (ohcValue - 75) * 2.5);
      centralPressure = Math.round(972 - (ohcValue - 75) * 1.2);
      surgeM = +(2.8 + (ohcValue - 75) * 0.08).toFixed(1);
    } else {
      category = 'Super Cyclonic Storm (SuCS)';
      windKmh = Math.round(195 + (ohcValue - 95) * 2.6);
      centralPressure = Math.round(942 - (ohcValue - 95) * 1.5);
      surgeM = +(4.6 + (ohcValue - 95) * 0.09).toFixed(1);
    }

    return { isRI, category, windKmh, centralPressure, surgeM, riProb };
  }, [ohcValue]);

  // ── Calculations for Topic 2: Sound Velocity & SOFAR Channel ────────────────
  const acousticCalculations = useMemo(() => {
    // 15 Depth levels
    const depths = [0, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 400, 500, 750, 1000];
    const profile = depths.map((d) => {
      // Temperature decreases non-linearly with depth
      const t = d === 0 ? acousticTemp : Math.max(4.2, +(acousticTemp * Math.exp(-d / 220)).toFixed(1));
      const s = +(acousticSalinity + (d > 100 ? 0.6 : -0.2)).toFixed(1);
      const c = getMackenzieSoundSpeed(t, s, d);
      return { depth: d, temp: t, salinity: s, soundSpeed: c };
    });

    const sourceSpeed = getMackenzieSoundSpeed(
      Math.max(4.2, +(acousticTemp * Math.exp(-acousticSourceDepth / 220)).toFixed(1)),
      acousticSalinity,
      acousticSourceDepth
    );

    // Find SOFAR channel axis (minimum sound velocity depth)
    let minSpeed = Infinity;
    let sofarAxis = 750;
    profile.forEach((p) => {
      if (p.soundSpeed < minSpeed) {
        minSpeed = p.soundSpeed;
        sofarAxis = p.depth;
      }
    });

    return { profile, sourceSpeed, minSpeed, sofarAxis };
  }, [acousticTemp, acousticSalinity, acousticSourceDepth]);

  // ── Calculations for Topic 3: Upwelling & Thermocline ───────────────────────
  const upwellingCalculations = useMemo(() => {
    // Ekman pumping velocity w_E ~ curl(tau) / (rho * f)
    const ekmanVelocityMDay = +((windSpeedKts / 20) ** 1.8 * (eddySlaCm < 0 ? 3.5 : 1.2)).toFixed(1);
    const thermoclineBase = 80;
    // Cyclonic eddy (negative SLA) lifts thermocline; anticyclonic depresses it
    const thermoclineDepth = Math.max(25, Math.min(150, Math.round(thermoclineBase + eddySlaCm * 1.8 - (windSpeedKts - 15) * 0.8)));
    const sstDrop = +(Math.max(0.2, (windSpeedKts / 15) * (eddySlaCm < 0 ? 2.2 : 0.8))).toFixed(1);
    const isColdWake = sstDrop >= 2.0;

    return { ekmanVelocityMDay, thermoclineDepth, sstDrop, isColdWake };
  }, [windSpeedKts, eddySlaCm]);

  // ── Calculations for Topic 4: Salinity Barrier Layer ────────────────────────
  const salinityCalculations = useMemo(() => {
    // Freshwater plume thickness in meters
    const freshwaterLensM = Math.round(8 + (riverDischargePct / 100) * 22);
    const surfaceSalinityPsu = +(34.8 - (riverDischargePct / 100) * 5.5 + (netEvapMm / 10) * 0.8).toFixed(1);
    const isothermalLayerDepth = 55; // D26
    const mixedLayerDepth = freshwaterLensM;
    const barrierLayerThickness = Math.max(0, isothermalLayerDepth - mixedLayerDepth);
    const heatTrapIndex = Math.min(100, Math.round((barrierLayerThickness / 45) * 100));

    return { freshwaterLensM, surfaceSalinityPsu, barrierLayerThickness, heatTrapIndex };
  }, [riverDischargePct, netEvapMm]);

  // ── Calculations for Topic 5: 0–1000m Strata & Float ────────────────────────
  const strataCalculations = useMemo(() => {
    const depth = floatDepth;
    const pressureAtm = +(1 + depth / 10).toFixed(1);
    const pressurePsi = Math.round(pressureAtm * 14.696);
    // Exponential light extinction
    const lightPct = +(Math.max(0, 100 * Math.exp(-depth / 35))).toFixed(1);
    // Stratified temperature
    const tempC = +(Math.max(4.4, 29.5 * Math.exp(-depth / 260) + (depth > 600 ? 1.5 : 0))).toFixed(1);
    const soundSpeed = getMackenzieSoundSpeed(tempC, 34.6, depth);

    let zoneName = 'Epipelagic (Sunlit Skin)';
    let zoneColor = '#ef4444';
    if (depth > 30 && depth <= 80) {
      zoneName = 'Mixed Layer (Isothermal)';
      zoneColor = '#f97316';
    } else if (depth > 80 && depth <= 200) {
      zoneName = 'Thermocline (Steep Gradient)';
      zoneColor = '#fbbf24';
    } else if (depth > 200 && depth <= 700) {
      zoneName = 'Mesopelagic (Twilight Realm)';
      zoneColor = '#06b6d4';
    } else if (depth > 700) {
      zoneName = 'Bathypelagic (Abyssal Cold)';
      zoneColor = '#3b82f6';
    }

    return { pressureAtm, pressurePsi, lightPct, tempC, soundSpeed, zoneName, zoneColor };
  }, [floatDepth]);

  // ── Calculations for Topic 6: Marine Heatwave ───────────────────────────────
  const heatwaveCalculations = useMemo(() => {
    // Degree Heating Weeks (DHW) = (SST Anomaly - 1.0) * (duration / 7)
    const excessTemp = Math.max(0, mhwSstAnomaly - 1.0);
    const dhw = +(excessTemp * (mhwDurationDays / 7)).toFixed(1);

    let category = 'Category I (Moderate)';
    let color = '#facc15';
    let bleachingRisk = 'Low / Thermal Stress';

    if (dhw >= 8) {
      category = 'Category IV (Extreme)';
      color = '#ef4444';
      bleachingRisk = 'Catastrophic Mortality (>80% Coral Bleaching)';
    } else if (dhw >= 4) {
      category = 'Category III (Severe)';
      color = '#f97316';
      bleachingRisk = 'Significant Bleaching Alert (DHW >= 4)';
    } else if (dhw >= 1) {
      category = 'Category II (Strong)';
      color = '#fb923c';
      bleachingRisk = 'Bleaching Warning (Reef Pigment Loss)';
    }

    const heatEnergyTj = Math.round(mhwSstAnomaly * mhwThermalDepth * 4.184 * 10);

    return { dhw, category, color, bleachingRisk, heatEnergyTj };
  }, [mhwSstAnomaly, mhwDurationDays, mhwThermalDepth]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── Topic Selector Toolbar ── */}
      <div className="glass rounded-3xl p-5 border border-cyan-500/30 depth-shadow space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-cyan-400" />
            <h3 className="font-black text-base tracking-tight">
              <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                Interactive Oceanographic Topic Simulations
              </span>
            </h3>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 self-start sm:self-auto">
            6 Core Physical Regimes
          </span>
        </div>

        {/* 6 Topic Switcher Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {[
            { id: 'ohc', label: '1. OHC Cyclone Fuel', icon: Zap, c: 'orange', desc: 'Rapid Intensification' },
            { id: 'acoustic', label: '2. SOFAR Acoustics', icon: Volume2, c: 'cyan', desc: 'Sound Velocity Channel' },
            { id: 'upwelling', label: '3. Ekman Upwelling', icon: Waves, c: 'teal', desc: 'Thermocline & Eddy' },
            { id: 'salinity', label: '4. Barrier Layer', icon: Droplets, c: 'blue', desc: 'Monsoon Halocline' },
            { id: 'strata', label: '5. ARGO Profiler', icon: Layers, c: 'purple', desc: '0–1000m Strata' },
            { id: 'heatwave', label: '6. Marine Heatwave', icon: Thermometer, c: 'red', desc: 'Coral Bleaching DHW' },
          ].map((topic) => {
            const Icon = topic.icon;
            const isSelected = activeTopic === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(topic.id as SimulationTopicId)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-br from-cyan-500/25 via-blue-500/20 to-black/60 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                    : 'glass border-white/10 hover:border-white/20 text-white/60 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon size={16} className={isSelected ? 'text-cyan-300' : 'text-white/40'} />
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                </div>
                <div>
                  <span className={`text-xs font-bold block ${isSelected ? 'text-white' : 'text-white/80'}`}>
                    {topic.label}
                  </span>
                  <span className="text-[10px] text-white/40 block truncate">{topic.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SIMULATION 1: OCEAN HEAT CONTENT (OHC) & CYCLONE RI
      ════════════════════════════════════════════════════════════════════ */}
      {activeTopic === 'ohc' && (
        <div className="glass rounded-3xl p-6 border border-orange-500/30 depth-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-orange-400" />
                <h3 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Topic 1 Simulation: Ocean Heat Content &amp; Cyclone Rapid Intensification
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                Simulate how subsurface thermal reservoir (&gt;80 kJ/cm²) prevents cold water choke and accelerates tropical cyclone vortex
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                cycloneCalculations.isRI ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
              }`}>
                {cycloneCalculations.isRI ? '🔥 RI TRIGGER ACTIVE' : 'MODERATE INTENSITY'}
              </span>
            </div>
          </div>

          {/* Interactive Controls & Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Controls & Sliders (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Zap size={14} className="text-orange-400" />
                    Subsurface OHC (TCHP):
                  </span>
                  <span className="text-orange-400 font-black font-mono text-sm">
                    {ohcValue} kJ/cm²
                  </span>
                </div>

                <input
                  type="range"
                  min={40}
                  max={120}
                  step={1}
                  value={ohcValue}
                  onChange={(e) => setOhcValue(Number(e.target.value))}
                  className="w-full accent-orange-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between text-[10px] font-mono text-white/40">
                  <span>40 kJ (Depression)</span>
                  <span className="text-orange-400 font-bold">80 kJ (RI Threshold)</span>
                  <span>120 kJ (Cat-5 SuCS)</span>
                </div>
              </div>

              {/* Presets */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <span className="text-white/40 font-mono text-[10px] block">Historical Scenario Presets:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOhcValue(48)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-medium text-white/80 text-left border border-white/5 cursor-pointer"
                  >
                    Depression Baseline (48 kJ)
                  </button>
                  <button
                    onClick={() => setOhcValue(88)}
                    className="p-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-[11px] font-medium text-orange-200 text-left border border-orange-500/30 cursor-pointer"
                  >
                    BOB-02 Active (88 kJ)
                  </button>
                  <button
                    onClick={() => setOhcValue(104)}
                    className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium text-red-200 text-left border border-red-500/30 cursor-pointer"
                  >
                    Mocha Cat-5 (104 kJ)
                  </button>
                  <button
                    onClick={() => setOhcValue(112)}
                    className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-[11px] font-medium text-purple-200 text-left border border-purple-500/30 cursor-pointer"
                  >
                    Amphan Super Peak (112 kJ)
                  </button>
                </div>
              </div>

              {/* Physics Summary */}
              <div className="p-3.5 rounded-2xl bg-orange-950/20 border border-orange-500/30 text-xs text-orange-200/90 leading-relaxed">
                <strong>Enthalpy Equation: </strong>
                When Q_H &gt; 80 kJ/cm², the warm layer reaches beyond the cyclonic mixing depth (&gt;60m). 
                Upwelling draws warm water into the eyewall, fueling an explosive drop to <strong>{cycloneCalculations.centralPressure} hPa</strong> with winds of <strong>{cycloneCalculations.windKmh} km/h</strong>.
              </div>
            </div>

            {/* Right: Visual Simulation Display (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 flex flex-col items-center justify-center relative overflow-hidden min-h-[300px]">
                {/* Visual Vortex Graphic */}
                <div
                  className={`relative rounded-full flex items-center justify-center transition-all duration-500 ${
                    vortexSpin ? 'animate-cyclone-vortex-fast' : ''
                  }`}
                  style={{
                    width: `${Math.min(260, 140 + (ohcValue - 40) * 1.4)}px`,
                    height: `${Math.min(260, 140 + (ohcValue - 40) * 1.4)}px`,
                    background: `radial-gradient(circle, rgba(2,9,23,0.9) 30%, ${
                      cycloneCalculations.isRI ? 'rgba(239,68,68,0.35)' : 'rgba(249,115,22,0.25)'
                    } 70%, transparent 100%)`,
                    border: `2px dashed ${cycloneCalculations.isRI ? '#ef4444' : '#f97316'}`,
                    boxShadow: `0 0 ${ohcValue * 0.4}px ${cycloneCalculations.isRI ? '#ef4444' : '#f97316'}`,
                  }}
                >
                  <img
                    src="/cyclone_satellite_vortex.webp"
                    alt="Simulated Vortex"
                    className="w-full h-full object-contain opacity-80"
                  />
                  {/* Eye Core */}
                  <div className="absolute w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm text-slate-800 border-2 border-white flex items-center justify-center shadow-lg">
                    <span className="text-[9px] font-black font-mono text-yellow-400">
                      {cycloneCalculations.centralPressure}
                    </span>
                  </div>
                </div>

                {/* Floating Metrics HUD */}
                <div className="absolute top-4 left-4 text-xs space-y-1">
                  <span className="text-white/40 block text-[10px] font-mono">SIMULATED CLASS</span>
                  <span className="font-extrabold text-white text-sm block">
                    {cycloneCalculations.category}
                  </span>
                </div>

                <div className="absolute top-4 right-4 text-right text-xs space-y-1">
                  <span className="text-white/40 block text-[10px] font-mono">CORE WIND VELOCITY</span>
                  <span className="font-black font-mono text-yellow-400 text-base block">
                    {cycloneCalculations.windKmh} km/h
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 text-xs space-y-1">
                  <span className="text-white/40 block text-[10px] font-mono">COASTAL STORM SURGE</span>
                  <span className="font-black font-mono text-red-400 text-sm block">
                    +{cycloneCalculations.surgeM} Meters Inundation
                  </span>
                </div>

                <div className="absolute bottom-4 right-4 text-right text-xs space-y-1">
                  <span className="text-white/40 block text-[10px] font-mono">RI PROBABILITY</span>
                  <span className="font-black font-mono text-cyan-300 text-sm block">
                    {cycloneCalculations.riProb}%
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setVortexSpin(!vortexSpin)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-glass text-xs cursor-pointer text-white/70 hover:text-white"
                >
                  {vortexSpin ? <Pause size={13} /> : <Play size={13} />}
                  <span>{vortexSpin ? 'Pause Vortex' : 'Resume Vortex'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SIMULATION 2: SOFAR ACOUSTIC CHANNEL & SOUND VELOCITY
      ════════════════════════════════════════════════════════════════════ */}
      {activeTopic === 'acoustic' && (
        <div className="glass rounded-3xl p-6 border border-cyan-500/30 depth-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-cyan-400" />
                <h3 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Topic 2 Simulation: SOFAR Channel Acoustic Waveguide (Mackenzie 1981)
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                Simulate deep ocean sound speed refraction and sound channel axis trapping used in submarine detection &amp; marine acoustics
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              SOFAR AXIS: ~{acousticCalculations.sofarAxis}m
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Thermometer size={14} className="text-red-400" />
                    Surface Temperature (SST):
                  </span>
                  <span className="text-red-400 font-mono font-bold">{acousticTemp}°C</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={32}
                  step={0.5}
                  value={acousticTemp}
                  onChange={(e) => setAcousticTemp(Number(e.target.value))}
                  className="w-full accent-red-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Droplets size={14} className="text-blue-400" />
                    Surface Salinity (SSS):
                  </span>
                  <span className="text-blue-400 font-mono font-bold">{acousticSalinity} PSU</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={37}
                  step={0.2}
                  value={acousticSalinity}
                  onChange={(e) => setAcousticSalinity(Number(e.target.value))}
                  className="w-full accent-blue-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Compass size={14} className="text-cyan-400" />
                    Sonar Source Depth:
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">{acousticSourceDepth} meters</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={acousticSourceDepth}
                  onChange={(e) => setAcousticSourceDepth(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-white/70 leading-relaxed">
                <strong className="text-cyan-300">Acoustic Refraction Law: </strong>
                Sound waves bend toward the depth of lowest sound speed. At the surface, warm water creates high velocity. In the abyss, pressure creates high velocity.
                The minimum at <strong>~{acousticCalculations.sofarAxis}m ({acousticCalculations.minSpeed.toFixed(1)} m/s)</strong> acts as an acoustic waveguide, carrying sound pulses thousands of kilometers without surface scattering.
              </div>
            </div>

            {/* Right Acoustic Ray Canvas / Depth Visualizer (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 space-y-4">
                <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                  <span className="text-white/40 font-mono">DEPTH PROFILE (0–1000m)</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    Velocity at Source: {acousticCalculations.sourceSpeed} m/s
                  </span>
                </div>

                {/* Simulated Vertical Sound Speed Ladder */}
                <div className="space-y-1.5">
                  {acousticCalculations.profile.map((p) => {
                    const pct = ((p.soundSpeed - 1480) / 70) * 100;
                    const isMin = p.depth === acousticCalculations.sofarAxis;
                    const isSource = Math.abs(p.depth - acousticSourceDepth) < 35;
                    return (
                      <div key={p.depth} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="w-12 text-white/40 text-right">{p.depth}m</span>
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isMin ? 'bg-amber-400' : isSource ? 'bg-cyan-400' : 'bg-blue-500/60'
                            }`}
                            style={{ width: `${Math.max(10, Math.min(100, pct))}%` }}
                          />
                        </div>
                        <span className={`w-16 font-bold ${isMin ? 'text-amber-300' : isSource ? 'text-cyan-300' : 'text-white/60'}`}>
                          {p.soundSpeed} m/s
                        </span>
                        {isMin && <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">SOFAR AXIS</span>}
                        {isSource && !isMin && <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">TRANSDUCER</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SIMULATION 3: THERMOCLINE & EKMAN UPWELLING
      ════════════════════════════════════════════════════════════════════ */}
      {activeTopic === 'upwelling' && (
        <div className="glass rounded-3xl p-6 border border-teal-500/30 depth-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Waves size={18} className="text-teal-400" />
                <h3 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Topic 3 Simulation: Wind-Driven Ekman Upwelling &amp; Thermocline Displacement
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                Simulate how surface wind stress and mesoscale eddies lift or depress the 26°C isotherm, creating cold wakes
              </p>
            </div>
            <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
              upwellingCalculations.isColdWake ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              {upwellingCalculations.isColdWake ? 'COLD WAKE PRODUCED' : 'STABLE THERMOCLINE'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Wind size={14} className="text-cyan-400" />
                    Cyclonic Wind Stress:
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">{windSpeedKts} knots</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={55}
                  step={1}
                  value={windSpeedKts}
                  onChange={(e) => setWindSpeedKts(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Activity size={14} className="text-teal-400" />
                    Mesoscale Eddy Sea Level Anomaly (SLA):
                  </span>
                  <span className="text-teal-400 font-mono font-bold">{eddySlaCm > 0 ? `+${eddySlaCm}` : eddySlaCm} cm</span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  step={1}
                  value={eddySlaCm}
                  onChange={(e) => setEddySlaCm(Number(e.target.value))}
                  className="w-full accent-teal-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/40">
                  <span>-25 cm (Cyclonic Cold Core)</span>
                  <span>+25 cm (Anticyclonic Warm Core)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-950/20 border border-teal-500/30 text-xs text-white/70 leading-relaxed">
                <strong className="text-teal-300">Ekman Pumping Physics: </strong>
                Cyclonic wind divergence lifts the pycnocline at <strong>{upwellingCalculations.ekmanVelocityMDay} m/day</strong>. 
                Thermocline depth shifts to <strong>{upwellingCalculations.thermoclineDepth}m</strong>, resulting in a sea surface cooling drop of <strong>-{upwellingCalculations.sstDrop}°C</strong>.
              </div>
            </div>

            {/* Right Graphic: Water Column Cross-Section */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 flex flex-col justify-between min-h-[280px]">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-white/40 font-mono">VERTICAL TEMPERATURE STRATA (0–200m)</span>
                <span className="text-yellow-400 font-mono font-bold">
                  SST Drop: -{upwellingCalculations.sstDrop}°C
                </span>
              </div>

              {/* Water layers */}
              <div className="space-y-3 my-4">
                {/* Surface Warm Mixed Layer */}
                <div
                  className="rounded-xl p-3 bg-gradient-to-r from-red-500/30 to-orange-500/20 border border-red-500/30 transition-all duration-300"
                  style={{ height: `${Math.max(40, upwellingCalculations.thermoclineDepth * 0.8)}px` }}
                >
                  <div className="flex items-center justify-between text-xs text-red-200">
                    <span className="font-bold">Warm Upper Layer (T &gt; 28°C)</span>
                    <span className="font-mono">Thickness: {upwellingCalculations.thermoclineDepth}m</span>
                  </div>
                </div>

                {/* Thermocline Barrier */}
                <div className="h-2 bg-yellow-400/80 rounded-full shadow-[0_0_10px_#facc15] animate-pulse" />

                {/* Deep Cold Water */}
                <div className="rounded-xl p-4 bg-gradient-to-r from-blue-900/40 to-cyan-950/40 border border-cyan-500/30 flex-1">
                  <div className="flex items-center justify-between text-xs text-cyan-300">
                    <span className="font-bold">Abyssal Cold Reservoir (T &lt; 18°C)</span>
                    <span className="font-mono">Ekman Pumping: {upwellingCalculations.ekmanVelocityMDay} m/day</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/50 text-right font-mono">
                Thermocline Status: {upwellingCalculations.thermoclineDepth < 50 ? 'Shallow (Strong Upwelling)' : 'Deep (Insulated Warm Pool)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SIMULATION 4: SALINITY & MONSOON FRESHWATER BARRIER LAYER
      ════════════════════════════════════════════════════════════════════ */}
      {activeTopic === 'salinity' && (
        <div className="glass rounded-3xl p-6 border border-blue-500/30 depth-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Droplets size={18} className="text-blue-400" />
                <h3 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Topic 4 Simulation: Ganga-Brahmaputra River Plume &amp; Barrier Layer Thickness
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                Simulate how low-salinity river runoff in the northern Bay of Bengal creates a freshwater lens that traps heat in the upper 20 meters
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
              BARRIER LAYER: {salinityCalculations.barrierLayerThickness}m
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Droplets size={14} className="text-cyan-400" />
                    Monsoon River Discharge Influx:
                  </span>
                  <span className="text-cyan-400 font-mono font-bold">{riverDischargePct}% Peak</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={riverDischargePct}
                  onChange={(e) => setRiverDischargePct(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Wind size={14} className="text-blue-400" />
                    Net Precipitation - Evaporation:
                  </span>
                  <span className="text-blue-400 font-mono font-bold">{netEvapMm} mm/day</span>
                </div>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={1}
                  value={netEvapMm}
                  onChange={(e) => setNetEvapMm(Number(e.target.value))}
                  className="w-full accent-blue-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-slate-700 border border-blue-500/30 text-xs text-white/70 leading-relaxed">
                <strong className="text-blue-300">Barrier Layer Trapping Physics: </strong>
                Freshwater lens thickness is <strong>{salinityCalculations.freshwaterLensM}m</strong> with surface salinity at <strong>{salinityCalculations.surfaceSalinityPsu} PSU</strong>. 
                The halocline sits higher than the thermocline, creating a <strong>{salinityCalculations.barrierLayerThickness}m Barrier Layer</strong> with a Heat Trapping Index of <strong>{salinityCalculations.heatTrapIndex}%</strong>.
              </div>
            </div>

            {/* Right Graphic */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 flex flex-col justify-between min-h-[280px]">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-white/40 font-mono">SALINITY STRATIFICATION (BAY OF BENGAL)</span>
                <span className="text-cyan-400 font-mono font-bold">
                  Surface Salinity: {salinityCalculations.surfaceSalinityPsu} PSU
                </span>
              </div>

              <div className="space-y-3 my-4">
                {/* Freshwater Plume */}
                <div
                  className="rounded-xl p-3 bg-gradient-to-r from-emerald-500/30 to-cyan-500/20 border border-emerald-500/40"
                  style={{ height: `${Math.max(35, salinityCalculations.freshwaterLensM * 2.2)}px` }}
                >
                  <div className="flex items-center justify-between text-xs text-emerald-200">
                    <span className="font-bold">Freshwater Lens (Low Salinity &lt; 32 PSU)</span>
                    <span className="font-mono">{salinityCalculations.freshwaterLensM}m Depth</span>
                  </div>
                </div>

                {/* Barrier Layer */}
                <div
                  className="rounded-xl p-3 bg-gradient-to-r from-amber-500/30 to-orange-500/20 border border-amber-500/40"
                  style={{ height: `${Math.max(35, salinityCalculations.barrierLayerThickness * 1.8)}px` }}
                >
                  <div className="flex items-center justify-between text-xs text-amber-200">
                    <span className="font-bold">Barrier Layer (Thermal Trapping Zone)</span>
                    <span className="font-mono">{salinityCalculations.barrierLayerThickness}m Thickness</span>
                  </div>
                </div>

                {/* Ambient Deep Ocean */}
                <div className="rounded-xl p-3 bg-gradient-to-r from-blue-950/40 to-slate-900/40 border border-blue-500/20">
                  <div className="flex items-center justify-between text-xs text-blue-300">
                    <span className="font-bold">High Salinity Oceanic Water (~35.2 PSU)</span>
                    <span className="font-mono">Deep Ocean</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-white/50 text-right font-mono">
                Impact: Suppresses vertical mixing &amp; superheats pre-cyclone SST
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SIMULATION 5: 0–1000M STRATA & ARGO PROFILING FLOAT
      ════════════════════════════════════════════════════════════════════ */}
      {activeTopic === 'strata' && (
        <div className="glass rounded-3xl p-6 border border-purple-500/30 depth-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-purple-400" />
                <h3 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Topic 5 Simulation: 0–1000m Ocean Strata &amp; Autonomous ARGO Profiler
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                Simulate CTD float descent through 5 distinct ocean regimes, calculating hydrostatic pressure, light extinction, and sound velocity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFloatDescending(!isFloatDescending)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                {isFloatDescending ? <Pause size={13} /> : <Play size={13} />}
                <span>{isFloatDescending ? 'Pause Float' : 'Auto Dive Float'}</span>
              </button>
              <button
                onClick={() => { setIsFloatDescending(false); setFloatDepth(0); }}
                className="p-1.5 rounded-xl btn-glass cursor-pointer text-white/60 hover:text-white"
                title="Surface Float"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Compass size={14} className="text-purple-400" />
                    Float Depth Scrubber:
                  </span>
                  <span className="text-purple-400 font-mono font-bold text-sm">{floatDepth} meters</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={10}
                  value={floatDepth}
                  onChange={(e) => {
                    setIsFloatDescending(false);
                    setFloatDepth(Number(e.target.value));
                  }}
                  className="w-full accent-purple-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                {/* 5 Strata Preset Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2">
                  {[
                    { l: 'Surface Skin', d: 0 },
                    { l: 'Mixed Layer', d: 45 },
                    { l: 'Thermocline', d: 125 },
                    { l: 'Mesopelagic', d: 400 },
                    { l: 'SOFAR Axis', d: 750 },
                    { l: 'Abyssal 1000m', d: 1000 },
                  ].map((preset) => (
                    <button
                      key={preset.l}
                      onClick={() => {
                        setIsFloatDescending(false);
                        setFloatDepth(preset.d);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-white/70 text-left cursor-pointer border border-white/5"
                    >
                      {preset.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Float CTD Telemetry Card */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white/5">
                  <span className="text-white/40 block text-[10px] uppercase font-mono">Hydrostatic Pressure</span>
                  <span className="text-base font-black font-mono text-purple-400">{strataCalculations.pressureAtm} atm</span>
                  <span className="text-[10px] text-white/40 block">~{strataCalculations.pressurePsi} psi</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5">
                  <span className="text-white/40 block text-[10px] uppercase font-mono">Temperature</span>
                  <span className="text-base font-black font-mono text-red-400">{strataCalculations.tempC}°C</span>
                  <span className="text-[10px] text-white/40 block">Reconstructed In-situ</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5">
                  <span className="text-white/40 block text-[10px] uppercase font-mono">Sunlight Penetration</span>
                  <span className="text-base font-black font-mono text-yellow-400">{strataCalculations.lightPct}%</span>
                  <span className="text-[10px] text-white/40 block">Beer-Lambert Extinction</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5">
                  <span className="text-white/40 block text-[10px] uppercase font-mono">Sound Speed</span>
                  <span className="text-base font-black font-mono text-cyan-400">{strataCalculations.soundSpeed} m/s</span>
                  <span className="text-[10px] text-white/40 block">Mackenzie (1981)</span>
                </div>
              </div>
            </div>

            {/* Right Graphic: Illuminated Water Column with ARGO Float */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 flex flex-col justify-between relative min-h-[320px] overflow-hidden">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2 z-10">
                <span className="text-white/40 font-mono">CURRENT STRATUM:</span>
                <span className="font-extrabold text-sm" style={{ color: strataCalculations.zoneColor }}>
                  {strataCalculations.zoneName}
                </span>
              </div>

              {/* Water Gradient Column with Moving Float */}
              <div className="relative flex-1 my-3 rounded-2xl border border-white/10 overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #0ea5e9 0%, #0369a1 20%, #1e3a8a 50%, #0f172a 80%, #020617 100%)',
                }}
              >
                {/* Horizontal Depth Markers */}
                <div className="absolute top-[0%] left-2 text-[9px] font-mono text-white/60">0m (Surface)</div>
                <div className="absolute top-[20%] left-2 text-[9px] font-mono text-white/40">200m (Epipelagic base)</div>
                <div className="absolute top-[50%] left-2 text-[9px] font-mono text-white/40">500m</div>
                <div className="absolute top-[75%] left-2 text-[9px] font-mono text-amber-300/70">750m (SOFAR Axis)</div>
                <div className="absolute top-[90%] left-2 text-[9px] font-mono text-white/40">1000m (Abyss)</div>

                {/* Animated ARGO Float Icon */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 transition-all duration-300 flex flex-col items-center pointer-events-none"
                  style={{ top: `${Math.min(90, Math.max(5, (floatDepth / 1000) * 88))}%` }}
                >
                  <div className="w-6 h-10 rounded-lg bg-yellow-400 border-2 border-white shadow-lg flex items-center justify-center">
                    <span className="text-[7px] font-black text-black">ARGO</span>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-black/80 text-[8px] font-mono text-cyan-300 mt-1 whitespace-nowrap">
                    {floatDepth}m • {strataCalculations.tempC}°C
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SIMULATION 6: MARINE HEATWAVE & CORAL BLEACHING
      ════════════════════════════════════════════════════════════════════ */}
      {activeTopic === 'heatwave' && (
        <div className="glass rounded-3xl p-6 border border-red-500/30 depth-shadow space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Thermometer size={18} className="text-red-400" />
                <h3 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Topic 6 Simulation: Marine Heatwave (MHW) &amp; Coral Bleaching Stress
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                Simulate cumulative thermal stress, Degree Heating Weeks (DHW), and ecological bleaching thresholds in Indian Ocean coral atolls
              </p>
            </div>
            <span
              className="text-xs font-mono font-bold px-3 py-1 rounded-full border"
              style={{
                backgroundColor: `${heatwaveCalculations.color}20`,
                borderColor: `${heatwaveCalculations.color}50`,
                color: heatwaveCalculations.color,
              }}
            >
              {heatwaveCalculations.category}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Thermometer size={14} className="text-red-400" />
                    SST Thermal Anomaly:
                  </span>
                  <span className="text-red-400 font-mono font-bold">+{mhwSstAnomaly}°C above MMM</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.5}
                  step={0.1}
                  value={mhwSstAnomaly}
                  onChange={(e) => setMhwSstAnomaly(Number(e.target.value))}
                  className="w-full accent-red-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Activity size={14} className="text-orange-400" />
                    Event Persistence Duration:
                  </span>
                  <span className="text-orange-400 font-mono font-bold">{mhwDurationDays} days</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={mhwDurationDays}
                  onChange={(e) => setMhwDurationDays(Number(e.target.value))}
                  className="w-full accent-orange-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                <div className="flex justify-between items-center text-xs pt-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Layers size={14} className="text-yellow-400" />
                    Subsurface Thermal Penetration:
                  </span>
                  <span className="text-yellow-400 font-mono font-bold">{mhwThermalDepth} meters</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={mhwThermalDepth}
                  onChange={(e) => setMhwThermalDepth(Number(e.target.value))}
                  className="w-full accent-yellow-400 h-2 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-red-950/20 border border-red-500/30 text-xs text-white/70 leading-relaxed">
                <strong className="text-red-300">Degree Heating Weeks (NOAA Coral Reef Watch): </strong>
                Cumulative thermal stress equals <strong>{heatwaveCalculations.dhw} °C-weeks</strong> with <strong>{heatwaveCalculations.heatEnergyTj} TeraJoules</strong> stored. 
                Ecological condition: <strong>{heatwaveCalculations.bleachingRisk}</strong>.
              </div>
            </div>

            {/* Right Graphic: Coral Reef Health Status */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-slate-800 border border-white/10 flex flex-col justify-between min-h-[280px]">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-white/40 font-mono">ECOSYSTEM BLEACHING RESPONSE</span>
                <span className="font-bold font-mono text-sm" style={{ color: heatwaveCalculations.color }}>
                  DHW: {heatwaveCalculations.dhw} °C-weeks
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase block">Severity Category</span>
                  <span className="font-bold text-sm block" style={{ color: heatwaveCalculations.color }}>
                    {heatwaveCalculations.category}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase block">Bleaching Risk</span>
                  <span className="font-bold text-xs text-white block">
                    {heatwaveCalculations.dhw >= 4 ? 'Widespread' : 'Low / Watch'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                  <span className="text-[10px] font-mono text-white/40 uppercase block">Heat Penetration</span>
                  <span className="font-bold text-sm text-yellow-400 font-mono block">
                    {mhwThermalDepth}m Depth
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
                <strong className="text-white">Impact Zone: </strong>
                Lakshadweep Atolls, Gulf of Mannar Biosphere Reserve, and Andaman Coral Fringes.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
