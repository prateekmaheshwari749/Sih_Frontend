import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Wind,
  Shield,
  Zap,
  Activity,
  ArrowRight,
  TrendingUp,
  Thermometer,
  Radio,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

export default function DisasterMitigationHub() {
  const navigate = useNavigate();
  const [ohcLevel, setOhcLevel] = useState<number>(88); // Default 88 kJ/cm2 (BOB-02)

  // Derived disaster physics based on Subsurface Ocean Heat Content (OHC)
  const getDisasterMetrics = (ohc: number) => {
    if (ohc < 55) {
      return {
        category: 'Depression / Cyclonic Storm',
        windSpeed: '65 km/h (35 kt)',
        riRisk: '12% · Low Probability',
        riskLevel: 'GREEN',
        riskColor: '#10b981',
        surgeEstimate: '0.8 – 1.2 m',
        ndmaAction: 'Routine Fishermen Advisory · Coastal monitoring active',
        thermalCoreStatus: 'Shallow warm layer; ocean upwelling will cool storm core',
      };
    } else if (ohc < 75) {
      return {
        category: 'Severe Cyclonic Storm (SCS)',
        windSpeed: '105 km/h (57 kt)',
        riRisk: '48% · Moderate Probability',
        riskLevel: 'YELLOW',
        riskColor: '#f59e0b',
        surgeEstimate: '1.8 – 2.5 m',
        ndmaAction: 'State Disaster Management Authorities (SDMA) alerted · Port warning signal 3',
        thermalCoreStatus: 'Moderate 40m mixed layer depth; sustained intensification expected',
      };
    } else if (ohc < 90) {
      return {
        category: 'Very Severe Cyclonic Storm (VSCS)',
        windSpeed: '155 km/h (84 kt)',
        riRisk: '76% · High Rapid Intensification (RI)',
        riskLevel: 'ORANGE',
        riskColor: '#f97316',
        surgeEstimate: '3.2 – 4.2 m',
        ndmaAction: 'NDRF 12 Battalions prepositioned · Coastal low-lying evacuations ordered',
        thermalCoreStatus: 'Deep warm reservoir (0–125m); rapid thermal extraction powering vortex',
      };
    } else {
      return {
        category: 'Super Cyclonic Storm (SuCS)',
        windSpeed: '240 km/h (130 kt)',
        riRisk: '94% · Catastrophic Rapid Intensification',
        riskLevel: 'RED ALERT',
        riskColor: '#ef4444',
        surgeEstimate: '5.5 – 6.8 m Inundation',
        ndmaAction: 'Full-scale mass evacuation (Phase 1 & 2) · Armed Forces humanitarian alert',
        thermalCoreStatus: 'Deep 1000m thermal column anomaly; non-stop intensification fuel',
      };
    }
  };

  const metrics = getDisasterMetrics(ohcLevel);

  return (
    <section className="relative py-16 px-4 sm:px-6 lg:px-8 border-y border-amber-500/20 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(2,9,24,0.98) 0%, rgba(12,24,48,0.92) 50%, rgba(2,9,24,0.98) 100%)',
      }}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, rgba(245,158,11,0.2) 0%, rgba(6,182,212,0.1) 50%, transparent 80%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono bg-gradient-to-r from-amber-500/15 via-red-500/15 to-orange-500/15 border border-amber-500/35 text-amber-200 shadow-lg">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-bold tracking-wider uppercase">DOMAIN: DISASTER MANAGEMENT</span>
            <span className="text-white/30">•</span>
            <span className="text-cyan-300 font-semibold">MINISTRY OF EARTH SCIENCES (MoES)</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-sm">
            <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
              Subsurface Thermal Core &amp; Cyclone Early Warning Hub
            </span>
          </h2>

          <p className="text-sky-100/90 font-medium text-sm sm:text-base leading-relaxed">
            Tropical cyclones do not feed on surface water alone. When satellites detect a warm surface,
            the hidden disaster variable is <strong className="text-cyan-200 font-bold">Ocean Heat Content (0–300m)</strong>.
            OCEANINTEL reconstructs this subsurface fuel to eliminate sudden forecast surprises for IMD &amp; NDMA.
          </p>
        </div>

        {/* ──────────────────────────────────────────────────────────
            INTERACTIVE DISASTER SIMULATOR & OHC RISK GAUGE
        ────────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-white/10 bg-black/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  INTERACTIVE EXPERIMENT: SUBSURFACE HEAT STRESS TEST
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                How Subsurface Temperature Fuels Rapid Intensification
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5">
                Drag the slider below to simulate Ocean Heat Content (0–1000m) and observe the automated MoES / NDMA disaster alert shift.
              </p>
            </div>

            {/* Current OHC Live Value Badge */}
            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start px-5 py-3 rounded-2xl bg-white/5 border border-white/10 shrink-0">
              <div className="text-left">
                <span className="text-[10px] font-mono text-white/50 block">RECONSTRUCTED OHC</span>
                <span className="text-2xl font-black font-mono text-white">
                  {ohcLevel} <span className="text-xs text-amber-400 font-normal">kJ/cm²</span>
                </span>
              </div>
              <div
                className="px-3 py-1 rounded-xl text-xs font-mono font-bold border"
                style={{
                  background: `${metrics.riskColor}22`,
                  borderColor: `${metrics.riskColor}66`,
                  color: metrics.riskColor,
                }}
              >
                {metrics.riskLevel}
              </div>
            </div>
          </div>

          {/* Slider & Presets */}
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-white/60">
                <span>Shallow Stratification (40 kJ/cm²)</span>
                <span className="text-cyan-400 font-bold">OHC Level: {ohcLevel} kJ/cm²</span>
                <span>Extreme Marine Heat Reservoir (110 kJ/cm²)</span>
              </div>
              <input
                type="range"
                min="40"
                max="110"
                value={ohcLevel}
                onChange={e => setOhcLevel(Number(e.target.value))}
                className="w-full h-2.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-white/15"
              />
            </div>

            {/* Quick Benchmark Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-white/40">HISTORICAL BENCHMARK PRESETS:</span>
              {[
                { label: 'BOB-02 (Current System)', val: 88 },
                { label: 'Cyclone Fani (2019)', val: 98 },
                { label: 'Super Cyclone Amphan (2020)', val: 110 },
                { label: 'Winter Baseline (Dec)', val: 48 },
              ].map(({ label, val }) => (
                <button
                  key={label}
                  onClick={() => setOhcLevel(val)}
                  className={`btn-3d px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    ohcLevel === val
                      ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300 font-bold shadow-sm'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Disaster Impact Response Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/10">
            {/* Metric 1 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1 stat-card-3d">
              <span className="text-[10px] font-mono text-white/50 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400" />
                PROJECTED IMD CATEGORY
              </span>
              <p className="text-base font-bold text-white">{metrics.category}</p>
              <p className="text-xs text-white/60 font-mono">Max Wind: {metrics.windSpeed}</p>
            </div>

            {/* Metric 2 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1 stat-card-3d">
              <span className="text-[10px] font-mono text-white/50 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                RAPID INTENSIFICATION (RI)
              </span>
              <p className="text-base font-bold" style={{ color: metrics.riskColor }}>
                {metrics.riRisk}
              </p>
              <p className="text-xs text-white/60 font-mono">24h Pressure Fall &gt; 24 hPa</p>
            </div>

            {/* Metric 3 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1 stat-card-3d">
              <span className="text-[10px] font-mono text-white/50 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                COASTAL STORM SURGE
              </span>
              <p className="text-base font-bold text-white">{metrics.surgeEstimate}</p>
              <p className="text-xs text-white/60 font-mono">Inundation Risk Model</p>
            </div>

            {/* Metric 4 */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1 stat-card-3d">
              <span className="text-[10px] font-mono text-white/50 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                NDMA RESPONSE DIRECTIVE
              </span>
              <p className="text-xs text-emerald-300 font-medium leading-relaxed">
                {metrics.ndmaAction}
              </p>
            </div>
          </div>

          {/* Physical Mechanism Subsurface Explanation */}
          <div className="mt-6 p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-xs text-white/80">
                <strong className="text-cyan-300">MoES Physical Insight: </strong>
                {metrics.thermalCoreStatus}
              </p>
            </div>

            <button
              onClick={() => navigate('/cyclone')}
              className="btn-3d shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>Inspect Live Cyclone Tracking</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            THREE KEY MOES DISASTER MISSION PILLARS
        ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="view-card rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-black/60 p-6 space-y-3 stat-card-3d">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Cyclone Rapid Intensification</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              When warm water extends deeper than 50 meters, cyclones extract massive enthalpy without cooling the sea surface. OCEANINTEL detects this hidden heat to give 48h early warning.
            </p>
            <ul className="space-y-1.5 text-xs text-white/70 pt-2 border-t border-white/10">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>0–1000m thermal column mapping</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Integration with IMD Cyclone Warning Division</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2 */}
          <div className="view-card rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-black/60 p-6 space-y-3 stat-card-3d">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Thermometer className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Marine Heatwave Early Warning</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Subsurface heat accumulation causes severe marine heatwaves (MHWs), devastating coral ecosystems in Lakshadweep and triggering widespread fisheries displacement.
            </p>
            <ul className="space-y-1.5 text-xs text-white/70 pt-2 border-t border-white/10">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>3D thermal anomaly tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>INCOIS Potential Fishing Zone (PFZ) advisory</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3 */}
          <div className="view-card rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-950/20 to-black/60 p-6 space-y-3 stat-card-3d">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">NDMA Coastal Command Link</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Automated high-tier threat directives route directly to the National Disaster Management Authority (NDMA) to mobilize NDRF battalions and execute coastal evacuations.
            </p>
            <ul className="space-y-1.5 text-xs text-white/70 pt-2 border-t border-white/10">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>State SDMA dispatch (Odisha, WB, TN, AP)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>NIC SMS gateway and emergency webhooks</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
