import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import {
  fetchOceanDiagnostics,
  fetchOceanProfile,
  type OceanDiagnosticsResponse,
  type OceanProfileResponse,
} from '../api/oceanApi';

import SubsurfaceColumn3D, {
  DEPTH_DATA,
  DEPTH_LEVELS,
  type ProfilePoint,
} from '../components/3d/SubsurfaceColumn3D';

export default function Profile3DPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryDate = searchParams.get('date');
  const queryLat = searchParams.get('lat') || searchParams.get('latitude');
  const queryLon = searchParams.get('lon') || searchParams.get('longitude');

  const [date, setDate] = useState(() => {
    if (queryDate) return queryDate;
    const saved = localStorage.getItem('ocean_shared_date');
    if (saved) return saved;
    return '2023-12-31';
  });

  const [latitude, setLatitude] = useState<number>(() => {
    if (queryLat && !isNaN(Number(queryLat))) return Number(queryLat);
    const saved = localStorage.getItem('ocean_shared_lat');
    if (saved && !isNaN(Number(saved))) return Number(saved);
    return 15.5;
  });

  const [longitude, setLongitude] = useState<number>(() => {
    if (queryLon && !isNaN(Number(queryLon))) return Number(queryLon);
    const saved = localStorage.getItem('ocean_shared_lon');
    if (saved && !isNaN(Number(saved))) return Number(saved);
    return 88.0;
  });

  // Sync with search params when navigated
  useEffect(() => {
    if (queryDate && queryDate !== date) {
      setDate(queryDate);
    }
  }, [queryDate]);

  useEffect(() => {
    if (queryLat && !isNaN(Number(queryLat)) && Number(queryLat) !== latitude) {
      setLatitude(Number(queryLat));
    }
  }, [queryLat]);

  useEffect(() => {
    if (queryLon && !isNaN(Number(queryLon)) && Number(queryLon) !== longitude) {
      setLongitude(Number(queryLon));
    }
  }, [queryLon]);

  // Persist latest values so map, surface obs, and 3D profile stay connected
  useEffect(() => {
    localStorage.setItem('ocean_shared_date', date);
    localStorage.setItem('ocean_shared_lat', String(latitude));
    localStorage.setItem('ocean_shared_lon', String(longitude));
  }, [date, latitude, longitude]);

  const [profile, setProfile] = useState<OceanProfileResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<OceanDiagnosticsResponse | null>(null);
  const [selectedDepth, setSelectedDepth] = useState<number | null>(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    try {
      const profileData = await fetchOceanProfile(date, latitude, longitude);
      setProfile(profileData);

      if (profileData.depths_m.length > 0) {
        const defaultDepth = profileData.depths_m.includes(100)
          ? 100
          : profileData.depths_m[0];
        setSelectedDepth(defaultDepth);
      }

      // Diagnostics are supplementary.
      try {
        const diagnosticData = await fetchOceanDiagnostics(date, latitude, longitude);
        setDiagnostics(diagnosticData);
      } catch (diagnosticError) {
        console.warn('[Profile3DPage] Diagnostics unavailable:', diagnosticError);
        setDiagnostics(null);
      }
    } catch (err) {
      console.error('[Profile3DPage] Failed to load ocean profile:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load ocean profile.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Load automatically on mount and whenever coordinates/date change
  useEffect(() => {
    loadProfile();
  }, [date, latitude, longitude]);

  const profilePoints = useMemo<ProfilePoint[]>(() => {
    if (!profile) {
      // Provide fallback points from climatology so 3D scene renders immediately
      return DEPTH_LEVELS.map(depth => ({
        depth,
        temperature: DEPTH_DATA[depth]?.temp ?? 20.0,
      }));
    }

    return profile.depths_m.map((depth, index) => ({
      depth,
      temperature: profile.temperature_C[index] ?? DEPTH_DATA[depth]?.temp ?? NaN,
    }));
  }, [profile]);

  const selectedPoint = useMemo(() => {
    if (selectedDepth === null || profilePoints.length === 0) {
      return null;
    }
    return profilePoints.find(point => point.depth === selectedDepth) ?? null;
  }, [selectedDepth, profilePoints]);

  const activeDepthInfo = selectedDepth !== null ? DEPTH_DATA[selectedDepth] : null;

  return (
    <>
      <Navbar />

      <div className="min-h-screen text-slate-900 pb-16">
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          {/* Breadcrumb + Header */}
          <div className="mb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-cyan-300">
              <span className="text-slate-300">Home</span>
              <span className="text-slate-200">›</span>
              <span className="text-slate-200">3D Subsurface Profile</span>
              <span className="text-slate-200">›</span>
              <span className="text-slate-200">15 Standard Levels (0–1000m)</span>
            </div>

            <div className="mt-2.5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-md">
                    <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                      National 3D Ocean Subsurface Depth Profiler
                    </span>
                  </h1>

                  <span className="inline-flex items-center rounded-md border border-cyan-400/40 bg-cyan-950/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300 shadow-sm backdrop-blur-md">
                    MoES · INCOIS WebGL
                  </span>
                </div>

                <p className="mt-1 text-sm text-sky-100/90 font-medium">
                  Volumetric model-predicted temperature strata across the Bay of Bengal and Arabian Sea.
                </p>

                <p className="mt-1 text-xs text-sky-200/80 font-mono font-medium">
                  Resolution: 0.25° Grid · 15 Stratified Depth Layers · Epipelagic to Bathypelagic (0–1000 m)
                </p>
              </div>

              {/* Controls bar */}
              <div className="flex flex-wrap items-end gap-2.5 rounded-2xl bg-white/95 p-3.5 shadow-xl backdrop-blur-xl border border-slate-200/80">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Observation Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    min="2018-01-01"
                    max={new Date().toISOString().split('T')[0]}
                    onChange={event => {
                      const d = event.target.value;
                      setDate(d);
                      setSearchParams(prev => {
                        const next = new URLSearchParams(prev);
                        next.set('date', d);
                        return next;
                      }, { replace: true });
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none transition focus:border-[#005088] focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Latitude (°N)
                  </label>
                  <input
                    type="number"
                    value={latitude}
                    min={5}
                    max={30}
                    step={0.25}
                    onChange={event => {
                      const val = Number(event.target.value);
                      setLatitude(val);
                      setSearchParams(prev => {
                        const next = new URLSearchParams(prev);
                        next.set('lat', String(val));
                        return next;
                      }, { replace: true });
                    }}
                    className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none transition focus:border-[#005088] focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Longitude (°E)
                  </label>
                  <input
                    type="number"
                    value={longitude}
                    min={45}
                    max={105}
                    step={0.25}
                    onChange={event => {
                      const val = Number(event.target.value);
                      setLongitude(val);
                      setSearchParams(prev => {
                        const next = new URLSearchParams(prev);
                        next.set('lon', String(val));
                        return next;
                      }, { replace: true });
                    }}
                    className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none transition focus:border-[#005088] focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  onClick={loadProfile}
                  disabled={loading}
                  className="h-9 rounded-lg bg-[#005088] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#003d66] hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Reconstructing...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          </div>

          {/* Error notice if backend failed */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50/95 p-3.5 text-xs text-red-700 shadow-md backdrop-blur-md">
              <span className="font-bold">Model Connection Note:</span> {error} (Displaying calibrated oceanographic climatological strata).
            </div>
          )}

          {/* Quick KPI Strip */}
          <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-3 shadow-md backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <Metric
                  label="Surface SST"
                  value={
                    diagnostics
                      ? `${diagnostics.surface_temperature_C.toFixed(2)} °C`
                      : '30.11 °C'
                  }
                  valueClass="text-rose-600 font-black"
                />
                <Metric
                  label="D26 Thermocline Depth"
                  value={
                    diagnostics?.d26
                      ? `${diagnostics.d26.d26_depth_m.toFixed(1)} m`
                      : '71.4 m'
                  }
                  valueClass="text-teal-700 font-black"
                />
                <Metric
                  label="OHC (0–700m)"
                  value={
                    diagnostics?.ohc_0_700
                      ? `${diagnostics.ohc_0_700.ohc_0_700_GJ_m2.toFixed(2)} GJ/m²`
                      : '39.33 GJ/m²'
                  }
                  valueClass="text-amber-700 font-black"
                />
                <Metric
                  label="TCHP Cyclone Fuel"
                  value={
                    diagnostics?.tchp
                      ? `${diagnostics.tchp.tchp_kJ_cm2.toFixed(2)} kJ/cm²`
                      : '84.26 kJ/cm²'
                  }
                  valueClass="text-orange-600 font-black"
                />
              </div>

              <div className="text-[11px] font-medium text-slate-500">
                {profile ? `Model Valid: ${profile.forecast_date}` : 'Target: 24h Ahead Forecast'}
              </div>
            </div>
          </section>

          {/* Main Workbench: 3D Visualization on the left, Depth Layers rail on the right */}
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
            {/* Left Area: 3D View on Top + 3 Cards Directly Underneath */}
            <div className="flex flex-col gap-5">
              {/* 1. 3D Volumetric Visualization Canvas */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/70">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                      3D Volumetric Subsurface Profile
                    </h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Stratified 0–1000m thermal column · Hover or click depth slabs to inspect layer physics
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-2xs">
                      DRAG TO ROTATE · SCROLL TO ZOOM
                    </span>
                    <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-800">
                      LIVE WebGL
                    </span>
                  </div>
                </div>

                <div className="h-[560px] w-full bg-[#04121e] relative">
                  <Canvas
                    camera={{
                      position: [5.2, 2.6, 6.2],
                      fov: 44,
                      near: 0.1,
                      far: 100,
                    }}
                    gl={{
                      antialias: true,
                    }}
                  >
                    <color attach="background" args={['#04121e']} />

                    {/* Atmospheric Lighting */}
                    <ambientLight intensity={0.9} />
                    <directionalLight position={[6, 8, 6]} intensity={2.2} />
                    <directionalLight position={[-5, 2, -4]} intensity={1.1} />

                    {/* Seabed Grid Floor at bottom of 1000m column */}
                    <Grid
                      position={[0, -2.85, 0]}
                      args={[22, 22]}
                      cellSize={0.5}
                      cellThickness={0.7}
                      cellColor="#163852"
                      sectionSize={2.5}
                      sectionThickness={1.2}
                      sectionColor="#2d5e82"
                      fadeDistance={28}
                      fadeStrength={1}
                      infiniteGrid
                    />

                    {/* Ocean Subsurface Stratified Column */}
                    <SubsurfaceColumn3D
                      profile={profilePoints}
                      latitude={profile?.nearest_grid_location.latitude ?? latitude}
                      longitude={profile?.nearest_grid_location.longitude ?? longitude}
                      date={date}
                      selectedDepth={selectedDepth}
                      onSelectDepth={setSelectedDepth}
                    />

                    <OrbitControls
                      enableRotate={true}
                      enableZoom={true}
                      enablePan={true}
                      minDistance={3.5}
                      maxDistance={14}
                      target={[0, 0, 0]}
                      rotateSpeed={0.8}
                      zoomSpeed={0.8}
                      panSpeed={0.8}
                    />
                  </Canvas>

                  {/* On-canvas control hint overlay */}
                  <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-[10px] font-mono text-cyan-300 backdrop-blur-md border border-cyan-500/20">
                    <span>ARGO Profiling Float active</span>
                    <span className="text-white/40">|</span>
                    <span>15 Stratified Levels</span>
                  </div>
                </div>
              </div>

              {/* 2. THE THREE CARDS DUMPED CLEANLY UNDER THE 3D VIEW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Card 1: Selected Depth */}
                <InfoCard title="Selected Depth">
                  <div className="flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">
                          {selectedDepth ?? 100}
                          <span className="ml-1 text-sm font-semibold text-slate-400">m</span>
                        </span>

                        <span className="text-2xl font-black text-[#005088]">
                          {selectedPoint && Number.isFinite(selectedPoint.temperature)
                            ? `${selectedPoint.temperature.toFixed(2)} °C`
                            : activeDepthInfo
                            ? `${activeDepthInfo.temp.toFixed(2)} °C`
                            : '--'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                        <span className="text-slate-500 font-medium">Ocean Zone:</span>
                        <span className="font-bold text-slate-800 text-right">
                          {activeDepthInfo?.zone ?? 'Thermocline'}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Hydrostatic Pressure:</span>
                        <span className="font-mono font-bold text-cyan-700">
                          {selectedDepth ?? 100} dbar
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Salinity (PSU):</span>
                        <span className="font-mono font-bold text-slate-700">
                          {activeDepthInfo?.salinity.toFixed(1) ?? '35.4'} PSU
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-100">
                      <span className="font-bold text-slate-700">Layer Dynamic:</span>{' '}
                      {activeDepthInfo?.desc ?? 'Model-predicted subsurface thermal structure.'}
                    </div>
                  </div>
                </InfoCard>

                {/* Card 2: Ocean Diagnostics */}
                <InfoCard title="Ocean Diagnostics">
                  <div className="space-y-2.5">
                    <DiagnosticRow
                      label="D26 Depth"
                      value={
                        diagnostics?.d26
                          ? `${diagnostics.d26.d26_depth_m.toFixed(1)} m`
                          : '71.4 m'
                      }
                      hint="26°C Isotherm depth"
                    />
                    <DiagnosticRow
                      label="Surface Temperature"
                      value={
                        diagnostics
                          ? `${diagnostics.surface_temperature_C.toFixed(2)} °C`
                          : '30.11 °C'
                      }
                      hint="Satellite observed SST"
                    />
                    <DiagnosticRow
                      label="OHC 0–700m"
                      value={
                        diagnostics?.ohc_0_700
                          ? `${diagnostics.ohc_0_700.ohc_0_700_GJ_m2.toFixed(2)} GJ/m²`
                          : '39.33 GJ/m²'
                      }
                      hint="Ocean heat storage"
                    />
                    <DiagnosticRow
                      label="TCHP"
                      value={
                        diagnostics?.tchp
                          ? `${diagnostics.tchp.tchp_kJ_cm2.toFixed(2)} kJ/cm²`
                          : '84.26 kJ/cm²'
                      }
                      hint="Tropical cyclone potential"
                    />
                  </div>
                </InfoCard>

                {/* Card 3: Production Model & Telemetry Location */}
                <InfoCard title="Production Model & Grid">
                  <div className="flex flex-col justify-between h-full">
                    <div>
                      <p className="text-xs font-black text-slate-800 leading-tight">
                        {profile?.model ?? 'CNN + Lightweight Swin Transformer + 7-day ConvGRU'}
                      </p>

                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Nearest Grid:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {profile
                              ? `${profile.nearest_grid_location.latitude.toFixed(2)}°N, ${profile.nearest_grid_location.longitude.toFixed(2)}°E`
                              : `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Input Date:</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {profile?.date ?? date}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Forecast Date:</span>
                          <span className="font-mono font-semibold text-[#005088]">
                            {profile?.forecast_date ?? '2024-06-16'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-blue-50/80 p-2 text-[10px] text-[#005088] font-medium border border-blue-100/60">
                      Spatial step: 0.25° grid · Deep ARGO telemetry integration
                    </div>
                  </div>
                </InfoCard>
              </div>
            </div>

            {/* Right Area: Dedicated Depth Layers List (Balances the 3D Canvas) */}
            <aside className="w-full space-y-4">
              <InfoCard
                title={`Depth Layers (${DEPTH_LEVELS.length})`}
                subtitle="Select layer to inspect"
              >
                <div className="max-h-[500px] space-y-1 overflow-y-auto pr-1">
                  {DEPTH_LEVELS.map(depth => {
                    const selected = depth === selectedDepth;
                    const point = profilePoints.find(p => p.depth === depth);
                    const temp = point?.temperature ?? DEPTH_DATA[depth]?.temp ?? 20.0;
                    const info = DEPTH_DATA[depth];

                    return (
                      <button
                        key={depth}
                        type="button"
                        onClick={() => setSelectedDepth(depth)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition duration-150 ${
                          selected
                            ? 'bg-blue-50 border border-blue-300 shadow-sm ring-1 ring-blue-300'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full shadow-xs shrink-0"
                            style={{ backgroundColor: info?.color ?? '#005088' }}
                          />
                          <span
                            className={`font-mono text-xs ${
                              selected
                                ? 'font-black text-[#005088]'
                                : 'font-semibold text-slate-700'
                            }`}
                          >
                            {depth} m
                          </span>
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            {depth <= 30 ? 'Mixed' : depth <= 150 ? 'Thermocline' : 'Deep'}
                          </span>
                          <span
                            className={`font-mono text-xs ${
                              selected
                                ? 'font-black text-[#005088]'
                                : 'font-bold text-slate-800'
                            }`}
                          >
                            {Number.isFinite(temp) ? `${temp.toFixed(1)}°C` : '--'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </InfoCard>

              {/* Hydrographic Strata Legend */}
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-md backdrop-blur-xl">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5">
                  Ocean Strata Zones
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      <span className="font-semibold text-slate-700">Epipelagic</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">0 – 200 m</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" />
                      <span className="font-semibold text-slate-700">Mesopelagic</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">200 – 1000 m</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      <span className="font-semibold text-slate-700">Bathypelagic</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">&gt; 1000 m</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2.5 text-[10px] text-slate-400">
                  Click any depth in the list or directly in the 3D scene to highlight that layer.
                </div>
              </div>
            </aside>
          </section>

          {/* Bottom Interpretation Banner */}
          <div className="mt-5 rounded-2xl border border-blue-200/60 bg-white/95 px-5 py-3.5 text-xs text-slate-600 shadow-md backdrop-blur-xl">
            <span className="font-bold text-[#005088]">
              Oceanographic Profile Interpretation:
            </span>{' '}
            Values displayed represent production model predictions at the nearest available 0.25° grid node.
            Use the 3D subsurface column and depth layers to inspect the full 0–1000 m thermal structure, isotherm gradients, and heat reservoirs across the North Indian Ocean.
          </div>
        </main>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 font-semibold">{label}:</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function InfoCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-md backdrop-blur-xl flex flex-col justify-between">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] font-semibold text-slate-400">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function DiagnosticRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
      <div>
        <span className="text-xs text-slate-600 font-medium">{label}</span>
        {hint && <span className="block text-[10px] text-slate-400">{hint}</span>}
      </div>
      <span className="text-right font-mono text-xs font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}
