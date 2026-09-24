import { useMemo } from 'react';
import {
  Wind,
  Layers,
  AlertTriangle,
  Radio,
  Activity,
  Shield,
  Zap,
} from 'lucide-react';
import type { CycloneWaypoint, CycloneScenario } from './IndiaCycloneRadarMap';

interface Props {
  scenario: CycloneScenario;
  activeWaypoint: CycloneWaypoint;
}

export default function CycloneCockpitSimulator({ scenario, activeWaypoint }: Props) {
  const { windSpeedKmh, centralPressure, surgeMeters, category, categoryName, ohc } = activeWaypoint;

  // Anemometer needle angle: 0 km/h = -120 deg, 300 km/h = +120 deg
  const needleDeg = useMemo(() => {
    const clamped = Math.min(300, Math.max(0, windSpeedKmh));
    return -120 + (clamped / 300) * 240;
  }, [windSpeedKmh]);

  // Barometer height: 1010 hPa = 15%, 900 hPa = 90% (lower pressure = higher severity)
  const pressureSeverityPct = useMemo(() => {
    const clamped = Math.min(1010, Math.max(900, centralPressure));
    return Math.round(((1010 - clamped) / 110) * 100);
  }, [centralPressure]);

  // Wave height percentage (0m = 20%, 6m = 85%)
  const waveHeightPct = useMemo(() => {
    const clamped = Math.min(6, Math.max(0.5, surgeMeters));
    return Math.round(20 + (clamped / 6) * 65);
  }, [surgeMeters]);

  const isSevere = windSpeedKmh >= 130;
  const isExtreme = windSpeedKmh >= 165;
  const isSuper = windSpeedKmh >= 220;

  return (
    <div className={`mt-6 rounded-3xl p-5 sm:p-6 border transition-all depth-shadow ${
      isExtreme
        ? 'glass-dark border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.25)] animate-red-alert'
        : 'glass-dark border-cyan-500/30'
    }`}>
      {/* Cockpit Title & Emergency Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/30 via-orange-500/20 to-cyan-500/20 border border-red-500/40 flex items-center justify-center shadow-lg">
            <Radio size={20} className="text-red-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base tracking-tight">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                  IMD Multi-Hazard Atmospheric Cockpit &amp; Wave-Tank
                </span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono font-bold">
                REAL-TIME TELEMETRY
              </span>
            </div>
            <p className="text-xs text-sky-100/90 font-medium">
              Coupled physical indicators: Anemometer wind force · Microbarograph pressure drop · Coastal storm surge wave simulator
            </p>
          </div>
        </div>

        {/* Severity Banner */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs font-mono">
          <AlertTriangle size={14} className="text-red-400 animate-pulse" />
          <span className="font-bold text-red-300">
            {isSuper ? 'CAT-5 SUPER CYCLONE ALERT' : isExtreme ? 'EXTREME SURGE & WIND WARNING' : isSevere ? `${categoryName.toUpperCase()} WARNING` : `${categoryName.toUpperCase()} SURVEILLANCE`}
          </span>
        </div>
      </div>

      {/* ── Cockpit Grid: 3 Interactive Gauges ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Gauge 1: Animated Anemometer Dial */}
        <div className="glass-panel p-5 rounded-2xl border border-yellow-500/30 flex flex-col items-center justify-between relative overflow-hidden">
          <div className="w-full flex items-center justify-between text-xs text-white/60 mb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Wind size={14} className="text-yellow-400" />
              Sustained Wind Dial
            </span>
            <span className="font-mono text-[11px] text-yellow-400 font-bold">{category}</span>
          </div>

          {/* SVG Circular Dial */}
          <div className="relative w-44 h-44 flex items-center justify-center my-2">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Outer Gauge Ring */}
              <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
              {/* Colored Arcs: Green (0-60), Yellow (60-120), Orange (120-180), Red (180-300) */}
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="#10b981"
                strokeWidth="12"
                strokeDasharray="90 534"
                strokeDashoffset="60"
              />
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="#facc15"
                strokeWidth="12"
                strokeDasharray="90 534"
                strokeDashoffset="-30"
              />
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="#f97316"
                strokeWidth="12"
                strokeDasharray="90 534"
                strokeDashoffset="-120"
              />
              <circle
                cx="100"
                cy="100"
                r="85"
                fill="none"
                stroke="#dc2626"
                strokeWidth="12"
                strokeDasharray="140 534"
                strokeDashoffset="-210"
              />

              {/* Dial Tick Labels */}
              <text x="38" y="165" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">0</text>
              <text x="35" y="85" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">60</text>
              <text x="92" y="32" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">150</text>
              <text x="155" y="85" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">220</text>
              <text x="145" y="165" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">300</text>

              {/* Rotating Anemometer Needle */}
              <g
                style={
                  {
                    transformOrigin: '100px 100px',
                    '--needle-deg': `${needleDeg}deg`,
                    transform: `rotate(${needleDeg}deg)`,
                    transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  } as React.CSSProperties
                }
                className="animate-needle"
              >
                <polygon points="97,100 103,100 101,22 99,22" fill="#ef4444" filter="drop-shadow(0 0 6px #ef4444)" />
                <circle cx="100" cy="100" r="9" fill="#ffffff" />
                <circle cx="100" cy="100" r="4" fill="#020917" />
              </g>
            </svg>

            {/* Center Speed Readout */}
            <div className="absolute bottom-3 text-center">
              <p className="text-2xl font-black text-white leading-none font-mono">
                {windSpeedKmh}
              </p>
              <p className="text-[10px] text-yellow-400 font-mono font-bold">KM/H · {Math.round(windSpeedKmh * 0.539957)} KT</p>
            </div>
          </div>

          <div className="w-full text-center pt-2 border-t border-white/5">
            <span className="text-[11px] font-mono text-white/70">
              Gust Hazard: <strong className="text-red-400">{Math.round(windSpeedKmh * 1.25)} km/h</strong>
            </span>
          </div>
        </div>

        {/* Gauge 2: Digital Atmospheric Barometer Chamber */}
        <div className="glass-panel p-5 rounded-2xl border border-blue-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-white/60 mb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Layers size={14} className="text-blue-400" />
              Central Barometer
            </span>
            <span className="font-mono text-[11px] text-blue-300 font-bold">{centralPressure} hPa</span>
          </div>

          {/* Vertical Glass Tube with Rising Mercury */}
          <div className="flex items-center justify-center gap-6 my-2">
            <div className="relative w-12 h-44 bg-white/5 rounded-full p-1.5 border border-white/20 shadow-inner flex flex-col justify-end">
              {/* Tick Mark Lines */}
              <div className="absolute inset-y-3 right-1 w-2 flex flex-col justify-between text-[8px] font-mono text-white/30 select-none pointer-events-none">
                <span>900</span>
                <span>940</span>
                <span>970</span>
                <span>1000</span>
              </div>

              {/* Dynamic Fluid Column */}
              <div
                style={{ height: `${pressureSeverityPct}%` }}
                className="w-full rounded-full bg-gradient-to-t from-blue-600 via-cyan-400 to-red-500 transition-all duration-700 shadow-[0_0_20px_rgba(6,182,212,0.8)] relative overflow-hidden"
              >
                {/* Mercury Liquid Bubbles Effect */}
                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.8),transparent)]" />
              </div>
            </div>

            <div className="flex-1 space-y-2.5 text-xs font-mono">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/40 block">Eye Core Pressure</span>
                <span className="text-xl font-black text-blue-300 font-mono">{centralPressure} <span className="text-xs text-white/50 font-normal">hPa</span></span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/40 block">Deepening Trend</span>
                <span className="text-xs font-bold text-red-400 font-mono">-14 hPa / 12h (Rapid RI)</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/40 block">Ocean Heat Engine</span>
                <span className="text-xs font-bold text-orange-400 font-mono">{ohc} kJ/cm² Fuel</span>
              </div>
            </div>
          </div>

          <div className="w-full text-center pt-2 border-t border-white/5">
            <span className="text-[11px] font-mono text-cyan-300">
              {centralPressure < 950 ? 'Severe Atmospheric Vortex Eye' : 'Deepening Depression Vortex'}
            </span>
          </div>
        </div>

        {/* Gauge 3: Animated Coastal Wave-Tank & Storm Surge Simulator */}
        <div className="glass-panel p-5 rounded-2xl border border-red-500/30 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-white/60 mb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Activity size={14} className="text-red-400" />
              Coastal Storm Surge Wave-Tank
            </span>
            <span className="font-mono text-[11px] text-red-300 font-bold">+{surgeMeters}m MSL</span>
          </div>

          {/* Cross-Section Wave Tank */}
          <div className="relative w-full h-44 rounded-xl bg-gradient-to-b from-[#020917] to-[#04162e] border border-white/15 overflow-hidden my-2 flex flex-col justify-end">
            {/* Sea-Wall Cross-Section on the Right */}
            <div className="absolute right-0 bottom-0 top-10 w-14 bg-stone-700/80 border-l-2 border-t-2 border-stone-500/60 z-20 flex flex-col items-center justify-start pt-2">
              <span className="text-[8px] font-mono font-bold text-amber-300 rotate-90 whitespace-nowrap mt-4">
                COASTAL DYKE
              </span>
            </div>

            {/* Sea Level Height Mark Grid */}
            <div className="absolute inset-y-2 left-2 flex flex-col justify-between text-[8px] font-mono text-white/30 z-20">
              <span>+6.0m</span>
              <span>+4.0m</span>
              <span>+2.0m</span>
              <span>0.0m</span>
            </div>

            {/* Target Surge Inundation Indicator Line */}
            <div
              style={{ bottom: `${waveHeightPct}%` }}
              className="absolute left-0 right-14 border-t-2 border-dashed border-red-400/90 z-20 transition-all duration-700 flex items-center justify-end pr-2"
            >
              <span className="text-[9px] font-mono bg-red-500 text-white font-black px-1 rounded shadow">
                +{surgeMeters}m
              </span>
            </div>

            {/* Layer 1: Primary Animated Wave Swell */}
            <div
              style={{ height: `${waveHeightPct}%` }}
              className="w-[200%] absolute bottom-0 left-0 bg-cyan-500/30 transition-all duration-700 animate-wave-swell z-10"
            >
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-8 -mt-6">
                <path
                  d="M0,0 C150,90 350,-40 500,45 C650,110 900,-30 1200,30 L1200,120 L0,120 Z"
                  fill="rgba(6, 182, 212, 0.45)"
                />
              </svg>
            </div>

            {/* Layer 2: Secondary Dark Blue Crest Wave Swell */}
            <div
              style={{ height: `${waveHeightPct - 8}%` }}
              className="w-[200%] absolute bottom-0 left-0 bg-gradient-to-t from-blue-900 to-cyan-600 transition-all duration-700 animate-wave-secondary z-10"
            >
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-8 -mt-6">
                <path
                  d="M0,40 C200,-30 400,80 600,10 C800,-40 1000,70 1200,20 L1200,120 L0,120 Z"
                  fill="rgba(3, 105, 161, 0.85)"
                />
              </svg>
            </div>

            {/* Crashing Water Spray Foam (Visible when surge is high) */}
            {surgeMeters >= 3.5 && (
              <div className="absolute right-14 top-14 w-6 h-6 z-30 flex items-center justify-center animate-ping text-white text-xs">
                🌊
              </div>
            )}
          </div>

          <div className="w-full text-center pt-2 border-t border-white/5">
            <span className="text-[11px] font-mono text-red-300 font-bold">
              {surgeMeters >= 4.0 ? 'CRITICAL: Inundation Overtopping Projected' : 'Moderate Coastal Wave Action'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Emergency Directive Feed ── */}
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-amber-400 shrink-0" />
          <span className="text-white/70">
            Target Landfall: <strong className="text-white">{scenario.targetLandfall.name} ({scenario.targetLandfall.state})</strong> · High-Risk Coastal Districts: <strong className="text-amber-300">{scenario.targetLandfall.highRiskDistricts.join(', ')}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Zap size={14} className="text-yellow-400 animate-pulse" />
          <span className="font-mono text-cyan-300 text-[11px] font-bold">NDRF &amp; COAST GUARD NOTIFIED</span>
        </div>
      </div>
    </div>
  );
}
