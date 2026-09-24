import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Globe,
  Layers,
  Thermometer,
  Zap,
  MapPin,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import PageLayout, { PageContainer, PageHeader } from '../components/PageLayout';
import { useData, DEPTH_LEVELS } from '../contexts/DataContext';
import OceanHeroCanvas from '../components/3d/OceanHeroCanvas';

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getLatestRecord } = useData();
  const latest = getLatestRecord();

  // Selected depth state for live inspection
  const [selectedDepth, setSelectedDepth] = useState<number>(75);

  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');
  const locationLabel = latParam && lonParam
    ? `${parseFloat(latParam).toFixed(2)}°N, ${parseFloat(lonParam).toFixed(2)}°E (Custom Coordinate)`
    : latest?.location ?? 'North Indian Ocean (15.0°N, 88.0°E)';

  // Temperature lookup for standard depths
  const getTempAtDepth = (depth: number) => {
    const idx = DEPTH_LEVELS.indexOf(depth);
    if (idx !== -1 && latest?.profile.temperatures[idx] !== undefined) {
      return latest.profile.temperatures[idx].toFixed(1);
    }
    if (depth <= 10) return (29.5 - depth * 0.08).toFixed(1);
    if (depth <= 50) return (28.7 - (depth - 10) * 0.12).toFixed(1);
    if (depth <= 150) return (23.9 - (depth - 50) * 0.09).toFixed(1);
    if (depth <= 300) return (14.9 - (depth - 150) * 0.035).toFixed(1);
    if (depth <= 700) return (9.6 - (depth - 300) * 0.012).toFixed(1);
    return (4.8 - (depth - 700) * 0.004).toFixed(1);
  };

  const handleDoubleClickGrid = () => {
    const lat = latParam ? parseFloat(latParam) : latest?.lat ?? 15.0;
    const lon = lonParam ? parseFloat(lonParam) : latest?.lon ?? 88.0;
    const date = latest?.date ?? '';
    navigate(`/surface?lat=${lat}&lon=${lon}${date ? `&date=${date}` : ''}`);
  };

  return (
    <PageLayout>
      <PageContainer>
        {/* Page Header */}
        <PageHeader
          category="3D DIGITAL TWIN · SUBSURFACE PROFILE RECONSTRUCTION"
          badge={
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              15 STANDARD DEPTH LEVELS (0–1000m)
            </div>
          }
          icon={<Globe size={18} className="text-cyan-400" />}
          title="3D Ocean Subsurface Reconstruction Simulation"
          subtitle={`Interactive 3D Digital Twin reproducing depth-wise ocean temperature from surface satellite observations across the North Indian Ocean (5°N–30°N, 45°E–105°E) · ${locationLabel}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/worldmap')}
                className="btn-glass text-xs"
              >
                <MapPin size={13} className="text-cyan-400" />
                Change Grid Cell
              </button>
              <button
                onClick={handleDoubleClickGrid}
                className="btn-primary-cyan text-xs"
                title="Double click any depth level or click here to open Surface Observations"
              >
                <Thermometer size={13} />
                Surface Observations
              </button>
            </div>
          }
        />

        {/* Domain and PS specs pill banner */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { l: 'Study Domain', v: 'North Indian Ocean (5°N–30°N, 45°E–105°E)' },
            { l: 'Vertical Levels', v: '15 Depths: 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m' },
            { l: 'Spatial Res', v: '0.25° × 0.25° Daily' },
            { l: 'Target Dataset', v: 'GLORYS Global Ocean Reanalysis' },
            { l: 'In-situ Validation', v: 'INCOIS LAS Gridded ARGO' },
          ].map(({ l, v }) => (
            <div key={l} className="glass rounded-xl px-3 py-1.5 border border-cyan-500/20 text-xs">
              <span className="text-white/40">{l}: </span>
              <span className="text-cyan-400 font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* ── Main 3D Simulation Workbench (Exactly matching Homepage 3D Simulation) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 3D Canvas Box (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-3xl border border-cyan-500/30 bg-[#030d1d]/85 backdrop-blur-xl p-3 sm:p-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-2 text-xs">
                <div className="flex items-center gap-2 font-mono text-cyan-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>3D SUB-SURFACE DIGITAL TWIN SIMULATION</span>
                </div>
                <div className="text-[11px] text-white/40 hidden sm:block">
                  Rotate 360° · Scroll to Zoom · Click depth tiers to inspect temperature &amp; acoustic speed
                </div>
              </div>

              {/* The pure 3D subsurface column simulator canvas (No satellite/globe/waves) */}
              <div className="w-full">
                <OceanHeroCanvas
                  lockMode="subsurface"
                  onDepthChange={(d) => {
                    if (d !== null) setSelectedDepth(d);
                  }}
                />
              </div>
            </div>

            {/* Depth Level Quick-Selector Strip */}
            <div className="glass rounded-2xl p-4 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Layers size={14} className="text-cyan-400" />
                  Standard Depth Levels (Click to Inspect Profile)
                </span>
                <span className="text-cyan-400 font-mono text-[11px]">
                  Selected: {selectedDepth}m Level ({getTempAtDepth(selectedDepth)}°C)
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 xl:grid-cols-15 gap-1.5">
                {DEPTH_LEVELS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDepth(d)}
                    onDoubleClick={handleDoubleClickGrid}
                    title={`Click to inspect ${d}m · Double click to open Surface Observations`}
                    className={`py-1.5 px-1 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                      selectedDepth === d
                        ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(6,182,212,0.6)] scale-105'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Physical Dynamics & Reconstruction Telemetry (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Selected Layer Dynamics Card */}
            <div className="glass rounded-2xl p-5 border border-cyan-500/30 space-y-4 depth-shadow">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Sliders size={16} className="text-cyan-400" />
                  Layer Telemetry Probe
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedDepth} m Level
                </span>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 to-blue-950/20 border border-cyan-500/25 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Reconstructed Temp:</span>
                  <span className="text-3xl font-black font-mono text-cyan-300">
                    {getTempAtDepth(selectedDepth)}°C
                  </span>
                </div>
                <div className="text-[11px] text-white/50 pt-1 border-t border-white/10">
                  {selectedDepth <= 30 && 'Mixed Layer Reservoir: High kinetic coupling with surface wind stress.'}
                  {selectedDepth > 30 && selectedDepth <= 200 && 'Main Thermocline: Maximum vertical temperature drop & baroclinic eddy displacement.'}
                  {selectedDepth > 200 && selectedDepth <= 700 && 'Mesopelagic: Deep sound channel (SOFAR) minimum sound velocity axis (~1488 m/s).'}
                  {selectedDepth > 700 && 'Bathypelagic Abyss: Multi-decadal stable ocean climate memory.'}
                </div>
              </div>

              {/* Surface Satellite Boundary Conditions */}
              <div className="space-y-2 text-xs">
                <p className="text-[10px] font-mono text-white/40 uppercase font-semibold">
                  Surface Satellite Forcing (0.25° Grid):
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-white/60">Sea Surface Temp (SST)</span>
                    <span className="font-mono text-red-400 font-bold">{latest?.inputs.sst.toFixed(1) ?? '29.5'}°C</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-white/60">Sea Surface Salinity (SSS)</span>
                    <span className="font-mono text-blue-400 font-bold">{latest?.inputs.sss.toFixed(1) ?? '34.2'} PSU</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-white/60">Sea Surface Height Anomaly (SLA)</span>
                    <span className="font-mono text-cyan-400 font-bold">+{latest?.inputs.ssh.toFixed(1) ?? '12.4'} cm</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-white/60">Mixed Layer Depth (MLD)</span>
                    <span className="font-mono text-purple-400 font-bold">{latest?.mld.toFixed(0) ?? '35'} m</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                    <span className="text-white/60">Ocean Heat Content (0–300m)</span>
                    <span className="font-mono text-orange-400 font-bold">{latest?.ohc.toFixed(0) ?? '84'} kJ/cm²</span>
                  </div>
                </div>
              </div>

              {/* Navigation Action */}
              <button
                onClick={() => navigate('/cyclone')}
                className="w-full py-3 rounded-xl font-bold text-xs text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap size={14} className="text-amber-400" />
                <span>Evaluate Cyclone Rapid Intensification Risk</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
}
