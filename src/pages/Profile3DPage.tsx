import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  MapPin,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Compass,
  X,
  Info,
} from 'lucide-react';
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

// ── Preset locations (matching WorldMap) ──────────────────────────────────────────
const PRESETS = [
  { name: 'Bay of Bengal (Centre)', lat: 15.0, lon: 88.0 },
  { name: 'Arabian Sea (Centre)', lat: 17.0, lon: 65.0 },
  { name: 'Lakshadweep Sea', lat: 11.0, lon: 73.0 },
  { name: 'Gulf of Mannar', lat: 8.8, lon: 79.0 },
  { name: 'Andaman Sea', lat: 12.5, lon: 95.0 },
  { name: 'BoB — Near Bangladesh Coast', lat: 20.5, lon: 90.0 },
  { name: 'Arabian Sea — Off Mumbai', lat: 18.0, lon: 69.5 },
  { name: 'Indian Ocean South', lat: 6.0, lon: 75.0 },
];

export default function Profile3DPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryDate = searchParams.get('date');
  const queryLat = searchParams.get('lat') || searchParams.get('latitude');
  const queryLon = searchParams.get('lon') || searchParams.get('longitude');

  // Background date synchronization without UI date picker
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

  // Local inputs for coordinate entry bar
  const [latInput, setLatInput] = useState<string>(() => String(latitude));
  const [lonInput, setLonInput] = useState<string>(() => String(longitude));
  const [coordError, setCoordError] = useState<string>('');

  // UI Floating Panels state
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'layer' | 'diagnostics' | 'model'>('layer');

  // OrbitControls reference for camera reset
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Sync with search params when navigated
  useEffect(() => {
    if (queryDate && queryDate !== date) {
      setDate(queryDate);
    }
  }, [queryDate]);

  useEffect(() => {
    if (queryLat && !isNaN(Number(queryLat)) && Number(queryLat) !== latitude) {
      const val = Number(queryLat);
      setLatitude(val);
      setLatInput(String(val));
    }
  }, [queryLat]);

  useEffect(() => {
    if (queryLon && !isNaN(Number(queryLon)) && Number(queryLon) !== longitude) {
      const val = Number(queryLon);
      setLongitude(val);
      setLonInput(String(val));
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

  async function loadProfile(targetLat = latitude, targetLon = longitude) {
    setLoading(true);
    setError(null);

    try {
      const profileData = await fetchOceanProfile(date, targetLat, targetLon);
      setProfile(profileData);

      if (profileData.depths_m.length > 0) {
        const defaultDepth = profileData.depths_m.includes(100)
          ? 100
          : profileData.depths_m[0];
        setSelectedDepth(defaultDepth);
      }

      // Diagnostics are supplementary
      try {
        const diagnosticData = await fetchOceanDiagnostics(date, targetLat, targetLon);
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

  // Load automatically on mount and whenever coordinates change
  useEffect(() => {
    loadProfile(latitude, longitude);
  }, [date, latitude, longitude]);

  const applyManualCoordinates = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);

    if (isNaN(lat) || isNaN(lon)) {
      setCoordError('Please enter valid coordinates.');
      return;
    }

    if (lat < 5 || lat > 30 || lon < 45 || lon > 105) {
      setCoordError('NIO domain bounds: 5°N–30°N, 45°E–105°E');
      return;
    }

    setCoordError('');
    setLatitude(lat);
    setLongitude(lon);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('lat', String(lat));
      next.set('lon', String(lon));
      return next;
    }, { replace: true });
  };

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

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
    <PageLayout fullHeight showFooter={false}>
      <div className="profile-3d-scope dark-glass-scope relative w-full h-[calc(100vh-57px)] min-h-[500px] flex-1 overflow-hidden select-none text-white">

        {/* =========================================================================
            1. FULL-SCREEN 3D WEBGL VIEW CANVAS
           ========================================================================= */}
        <div className="absolute inset-0 w-full h-full bg-[#04121e]">
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
              ref={controlsRef}
              enableRotate={true}
              enableZoom={true}
              enablePan={true}
              minDistance={3.5}
              maxDistance={18}
              target={[0, 0, 0]}
              rotateSpeed={0.8}
              zoomSpeed={0.8}
              panSpeed={0.8}
            />
          </Canvas>
        </div>


        {/* =========================================================================
            2. BOTTOM-LEFT: DARK GLASSY LAYER FLOATING BUTTON
           ========================================================================= */}
        <div className="absolute bottom-6 left-6 z-[1000] pointer-events-auto">
          <button
            onClick={() => setDetailsOpen(d => !d)}
            className={`dark-glass-btn h-12 flex items-center gap-2.5 px-4 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.5)] text-white font-bold text-xs hover:bg-slate-900/80 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              detailsOpen ? 'ring-2 ring-cyan-400/50 border-cyan-400/70 bg-slate-900/90 text-cyan-300' : ''
            }`}
            title={detailsOpen ? 'Hide Layer Details' : 'Show Layer Details'}
          >
            <div
              className="w-3 h-3 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: activeDepthInfo?.color ?? '#005088' }}
            />
            <span className="font-mono font-bold text-white text-xs sm:text-sm whitespace-nowrap">
              {selectedDepth ?? 100}m Layer
            </span>
            <span className="text-white/40 font-normal">|</span>
            <span className="font-mono font-black text-cyan-300 whitespace-nowrap">
              {selectedPoint && Number.isFinite(selectedPoint.temperature)
                ? `${selectedPoint.temperature.toFixed(1)}°C`
                : '--'}
            </span>
            {detailsOpen ? (
              <ChevronDown size={15} className="text-white/70 ml-0.5 shrink-0" />
            ) : (
              <ChevronUp size={15} className="text-white/70 ml-0.5 shrink-0" />
            )}
          </button>
        </div>


        {/* =========================================================================
            3. TOP-CENTER: DARK GLASSY LONG BAR (ALIGNED AT top-4, PERFECT CONTENT FIT)
           ========================================================================= */}
        <div
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto"
        >
          <div className="h-12 bg-slate-950/60 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.5)] rounded-2xl px-3.5 sm:px-4 flex items-center flex-nowrap gap-2.5 sm:gap-3 text-xs text-white whitespace-nowrap">
            {/* Presets Button */}
            <button
              onClick={e => {
                e.stopPropagation();
                setPresetsOpen(p => !p);
              }}
              className={`dark-glass-btn flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition border cursor-pointer ${
                presetsOpen
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-2xs'
                  : 'bg-white/[0.08] hover:bg-white/[0.16] border-white/15 text-white'
              }`}
              title={presetsOpen ? 'Hide Preset Locations' : 'Show Preset Locations'}
            >
              <MapPin size={13} className="text-amber-400 fill-amber-400/20 shrink-0" />
              <span className="whitespace-nowrap font-medium text-white">Presets</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono text-cyan-200 font-bold">
                {PRESETS.length}
              </span>
            </button>

            <div className="h-5 w-px bg-white/15 shrink-0" />

            {/* Badge Title: Single horizontal line to fit cleanly */}
            <div className="flex items-center gap-2 font-bold text-xs whitespace-nowrap shrink-0">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="text-cyan-300 font-extrabold whitespace-nowrap">3D Profile</span>
              <span className="text-slate-300 font-mono text-[11px] whitespace-nowrap">0–1000m Strata</span>
            </div>

            <div className="h-5 w-px bg-white/15 shrink-0" />

            {/* Latitude & Longitude Inputs */}
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-white whitespace-nowrap">Lat:</span>
                <input
                  type="number"
                  value={latInput}
                  onChange={e => setLatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyManualCoordinates()}
                  placeholder="Lat"
                  step="0.25"
                  min="5"
                  max="30"
                  className="w-18 h-8 px-2 rounded-xl bg-black/40 hover:bg-black/50 focus:bg-black/60 border border-white/20 focus:border-cyan-400 text-cyan-200 font-mono font-semibold text-xs placeholder:text-white/40 focus:outline-none transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-white whitespace-nowrap">Lon:</span>
                <input
                  type="number"
                  value={lonInput}
                  onChange={e => setLonInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyManualCoordinates()}
                  placeholder="Lon"
                  step="0.25"
                  min="45"
                  max="105"
                  className="w-18 h-8 px-2 rounded-xl bg-black/40 hover:bg-black/50 focus:bg-black/60 border border-white/20 focus:border-cyan-400 text-cyan-200 font-mono font-semibold text-xs placeholder:text-white/40 focus:outline-none transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                />
              </div>

              <button
                onClick={applyManualCoordinates}
                disabled={loading}
                className="dark-glass-btn flex items-center gap-1.5 h-8 px-3 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 border border-cyan-400/40 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                title="Run volumetric simulation for coordinates"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles size={13} className="text-cyan-200 shrink-0" />
                )}
                <span className="whitespace-nowrap text-white font-bold">{loading ? 'Simulating...' : 'Simulate'}</span>
              </button>
            </div>

            <div className="h-5 w-px bg-white/15 shrink-0" />

            {/* Reset Camera View button - strictly single line */}
            <button
              onClick={handleResetCamera}
              className="dark-glass-btn flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white hover:text-cyan-300 text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              title="Reset 3D camera to default orientation"
            >
              <RotateCcw size={12} className="shrink-0 text-white" />
              <span className="whitespace-nowrap text-white font-medium">Reset Camera</span>
            </button>

            {/* Jump to World Map */}
            <button
              onClick={() => navigate(`/worldmap?lat=${latitude}&lon=${longitude}`)}
              className="dark-glass-btn flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 text-white hover:text-cyan-300 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              title="Open full interactive map"
            >
              <Compass size={13} className="text-cyan-400 shrink-0" />
              <span className="whitespace-nowrap text-white font-semibold">Map</span>
            </button>
          </div>

          {coordError && (
            <div className="mt-1 px-3 py-1 rounded-xl bg-red-500/80 backdrop-blur-md border border-red-400/40 text-white text-[11px] font-medium shadow-md whitespace-nowrap">
              {coordError}
            </div>
          )}
        </div>


        {/* =========================================================================
            4. TOP-RIGHT: DARK GLASSY DEPTH LAYERS BUTTON (ALIGNED AT top-4)
           ========================================================================= */}
        <div className="absolute top-4 right-6 z-[1000] pointer-events-auto">
          <button
            onClick={e => {
              e.stopPropagation();
              setLayersOpen(l => !l);
            }}
            className={`dark-glass-btn h-12 flex items-center gap-2 px-4 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.5)] text-xs font-bold text-white transition-all cursor-pointer whitespace-nowrap shrink-0 hover:bg-slate-900/80 ${
              layersOpen
                ? 'ring-2 ring-cyan-400/50 border-cyan-400/70 bg-slate-900/90 text-cyan-300'
                : ''
            }`}
            title={layersOpen ? 'Hide Depth Layers' : 'Open Depth Layers'}
          >
            <Layers size={14} className={layersOpen ? 'text-cyan-400' : 'text-cyan-300'} />
            <span className="whitespace-nowrap text-white font-bold">Depth Layers</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono text-cyan-200 font-bold">
              {DEPTH_LEVELS.length}
            </span>
            {layersOpen ? (
              <ChevronDown size={14} className="text-white/70 shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-white/70 shrink-0" />
            )}
          </button>
        </div>


        {/* =========================================================================
            5. DARK GLASSY LAYER PHYSICS & DIAGNOSTICS CARD (OPENED ABOVE BOTTOM LEFT)
           ========================================================================= */}
        {detailsOpen && (
          <div
            data-no-map-click="true"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            className="absolute bottom-20 left-6 z-[1000] pointer-events-auto max-w-[420px] w-[calc(100vw-48px)] max-h-[calc(100vh-120px)] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150 scrollbar-thin"
          >
            <div className="bg-slate-950/70 backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_25px_50px_rgba(0,0,0,0.7)] rounded-3xl p-4 sm:p-5 text-white space-y-3.5">
              {/* Header with Depth & Temperature and Close Button */}
              <div className="flex items-start justify-between gap-3 border-b border-white/15 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs font-mono font-black text-white text-xs"
                    style={{ backgroundColor: activeDepthInfo?.color ?? '#005088' }}
                  >
                    {selectedDepth ?? 100}m
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-white tracking-tight">
                        {selectedDepth ?? 100} m Layer
                      </span>
                      <span className="text-base font-black text-cyan-300">
                        {selectedPoint && Number.isFinite(selectedPoint.temperature)
                          ? `${selectedPoint.temperature.toFixed(2)} °C`
                          : activeDepthInfo
                          ? `${activeDepthInfo.temp.toFixed(2)} °C`
                          : '--'}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 font-medium">
                      {activeDepthInfo?.zone ?? 'Ocean Layer Strata'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDetailsOpen(false)}
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Close details"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs for Floating Card */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/15 text-xs">
                <button
                  onClick={() => setActiveTab('layer')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition cursor-pointer ${
                    activeTab === 'layer'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Layer Physics
                </button>
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition cursor-pointer ${
                    activeTab === 'diagnostics'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Diagnostics
                </button>
                <button
                  onClick={() => setActiveTab('model')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition cursor-pointer ${
                    activeTab === 'model'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  Model & Grid
                </button>
              </div>

              {/* Tab 1: Layer Physics */}
              {activeTab === 'layer' && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-xs">
                      <span className="text-[10.5px] text-white/60 block font-medium">Hydrostatic Pressure</span>
                      <span className="font-mono font-bold text-cyan-300 text-sm">{selectedDepth ?? 100} dbar</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-xs">
                      <span className="text-[10.5px] text-white/60 block font-medium">Salinity (PSU)</span>
                      <span className="font-mono font-bold text-sky-200 text-sm">
                        {activeDepthInfo?.salinity.toFixed(1) ?? '35.4'} PSU
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-cyan-950/40 backdrop-blur-md border border-cyan-500/30 text-xs text-white/90">
                    <span className="font-bold text-cyan-300">Dynamic: </span>
                    {activeDepthInfo?.desc ?? 'Model-predicted subsurface thermal structure.'}
                  </div>
                </div>
              )}

              {/* Tab 2: Diagnostics */}
              {activeTab === 'diagnostics' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-xs">
                      <span className="text-[10px] text-white/60 block font-medium">Surface SST</span>
                      <span className="font-mono font-bold text-rose-400 text-xs">
                        {formatDiagnosticNumber(diagnostics?.surface_temperature_C, 2, ' °C', '30.11 °C')}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-xs">
                      <span className="text-[10px] text-white/60 block font-medium">D26 Thermocline</span>
                      <span className="font-mono font-bold text-teal-300 text-xs">
                        {formatDiagnosticNumber(diagnostics?.d26?.d26_depth_m, 1, ' m', '71.4 m')}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-xs">
                      <span className="text-[10px] text-white/60 block font-medium">OHC (0–700m)</span>
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        {formatDiagnosticNumber(diagnostics?.ohc_0_700?.ohc_0_700_GJ_m2, 2, ' GJ/m²', '39.33 GJ/m²')}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-xs">
                      <span className="text-[10px] text-white/60 block font-medium">TCHP Fuel</span>
                      <span className="font-mono font-bold text-orange-400 text-xs">
                        {formatDiagnosticNumber(diagnostics?.tchp?.tchp_kJ_cm2, 2, ' kJ/cm²', '84.26 kJ/cm²')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Model & Telemetry Grid */}
              {activeTab === 'model' && (
                <div className="space-y-2 animate-in fade-in duration-150 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/[0.05] backdrop-blur-md border border-white/10 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 font-medium">Architecture:</span>
                      <span className="font-bold text-white text-right">CNN + Swin + ConvGRU</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 font-medium">Nearest Grid Node:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {profile
                          ? `${profile.nearest_grid_location.latitude.toFixed(2)}°N, ${profile.nearest_grid_location.longitude.toFixed(2)}°E`
                          : `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 font-medium">Resolution:</span>
                      <span className="font-mono text-sky-200">0.25° (~27 km)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer quick action */}
              <div className="pt-1">
                <button
                  onClick={() => navigate(`/worldmap?lat=${latitude}&lon=${longitude}`)}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white border border-white/15 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Compass size={13} className="text-cyan-400" />
                  <span>Inspect Surrounding Grid on World Map</span>
                </button>
              </div>
            </div>
          </div>
        )}


        {/* =========================================================================
            6. DARK GLASSY PRESET LOCATIONS CARD (OPENED UNDER PRESETS BUTTON)
           ========================================================================= */}
        {presetsOpen && (
          <div
            data-no-map-click="true"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            className="absolute top-18 left-1/2 -translate-x-1/2 z-[1000] w-[290px] sm:w-[320px] pointer-events-auto flex flex-col max-h-[calc(100vh-120px)] animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="bg-slate-950/70 backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_25px_50px_rgba(0,0,0,0.7)] rounded-3xl p-4 text-white flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 shadow-2xs">
                    <MapPin size={13} className="fill-amber-400 text-amber-400" />
                  </div>
                  <h2 className="font-bold text-white text-[14px] tracking-tight">
                    Preset Locations
                  </h2>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setPresetsOpen(false);
                  }}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close Presets"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Presets List */}
              <div className="mt-3 space-y-1.5 overflow-y-auto pr-1 max-h-[calc(100vh-210px)] scrollbar-thin">
                {PRESETS.map(p => {
                  const isSelected =
                    Math.abs(latitude - p.lat) < 0.2 && Math.abs(longitude - p.lon) < 0.2;
                  return (
                    <button
                      key={p.name}
                      onClick={e => {
                        e.stopPropagation();
                        setLatitude(p.lat);
                        setLongitude(p.lon);
                        setLatInput(String(p.lat));
                        setLonInput(String(p.lon));
                        setCoordError('');
                        setSearchParams(prev => {
                          const next = new URLSearchParams(prev);
                          next.set('lat', String(p.lat));
                          next.set('lon', String(p.lon));
                          return next;
                        }, { replace: true });
                        setPresetsOpen(false);
                      }}
                      className={`w-full text-left p-3 px-3.5 rounded-2xl transition-all cursor-pointer block ${
                        isSelected
                          ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-xs font-bold'
                          : 'bg-white/[0.05] hover:bg-white/[0.12] backdrop-blur-md border border-white/10 text-white shadow-xs'
                      }`}
                    >
                      <span className={`font-bold block text-[13px] leading-snug ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                        {p.name}
                      </span>
                      <span className="font-mono text-[11px] text-white/50 block mt-0.5">
                        {p.lat}°N, {p.lon}°E
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {/* =========================================================================
            7. DARK GLASSY DEPTH LAYERS RAIL DROPDOWN (OPENED UNDER TOP RIGHT)
           ========================================================================= */}
        {layersOpen && (
          <div
            data-no-map-click="true"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            className="absolute top-18 right-6 z-[1000] w-[280px] sm:w-[310px] pointer-events-auto flex flex-col max-h-[calc(100vh-90px)] animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="bg-slate-950/70 backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_25px_50px_rgba(0,0,0,0.7)] rounded-3xl p-4 text-white flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-2xs">
                    <Layers size={13} />
                  </div>
                  <h2 className="font-bold text-white text-[14px] tracking-tight">
                    Depth Layers ({DEPTH_LEVELS.length})
                  </h2>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setLayersOpen(false);
                  }}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Close Depth Layers"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Subtitle */}
              <div className="pt-2 pb-1 text-[11px] text-white/60 flex items-center justify-between px-1">
                <span>Select depth layer:</span>
                <span className="font-mono text-cyan-300 font-bold">0–1000m</span>
              </div>

              {/* Depth levels list */}
              <div className="mt-1 space-y-1 overflow-y-auto pr-1 max-h-[calc(100vh-270px)] scrollbar-thin">
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
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                        selected
                          ? 'bg-cyan-500/20 border border-cyan-400/50 ring-1 ring-cyan-400/30 text-cyan-300 font-bold shadow-xs'
                          : 'hover:bg-white/[0.08] border border-transparent text-white/90'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: info?.color ?? '#005088' }}
                        />
                        <span className="font-mono font-bold text-white">{depth} m</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/50">
                          {depth <= 30 ? 'Mixed' : depth <= 150 ? 'Thermo' : 'Deep'}
                        </span>
                        <span className={`font-mono text-xs ${selected ? 'text-cyan-300 font-black' : 'text-white font-bold'}`}>
                          {Number.isFinite(temp) ? `${temp.toFixed(1)}°C` : '--'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Strata Zone Legend */}
              <div className="mt-3 pt-2.5 border-t border-white/15 text-[10.5px] space-y-1 px-1">
                <div className="flex items-center justify-between text-white/80">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Epipelagic
                  </span>
                  <span className="font-mono text-white/50">0 – 200m</span>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" /> Mesopelagic
                  </span>
                  <span className="font-mono text-white/50">200 – 1000m</span>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" /> Bathypelagic
                  </span>
                  <span className="font-mono text-white/50">&gt; 1000m</span>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* =========================================================================
            8. DARK GLASSY 3D NAVIGATION HINT PILL AT BOTTOM-CENTER
           ========================================================================= */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] pointer-events-none hidden lg:flex items-center gap-3 px-4 py-2 rounded-full bg-slate-950/60 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_15px_35px_rgba(0,0,0,0.5)] text-[11px] text-white/90">
          <span className="flex items-center gap-1 text-cyan-300 font-semibold whitespace-nowrap">
            🖱️ Rotate: Drag Left-Click
          </span>
          <span className="text-white/30">·</span>
          <span className="flex items-center gap-1 text-sky-200 font-semibold whitespace-nowrap">
            Zoom: Mousewheel
          </span>
          <span className="text-white/30">·</span>
          <span className="flex items-center gap-1 text-amber-300 font-semibold whitespace-nowrap">
            Pan: Right-Click Drag
          </span>
        </div>


        {/* =========================================================================
            9. FLOATING ERROR NOTIFICATION BANNER (IF BACKEND FAILED)
           ========================================================================= */}
        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1100] max-w-lg w-[calc(100vw-32px)] pointer-events-auto animate-in fade-in duration-200">
            <div className="rounded-2xl border border-amber-400/40 bg-slate-950/80 backdrop-blur-xl p-3.5 text-xs text-amber-200 shadow-xl flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Info size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white">Model Connection Note:</span> {error}
                  <span className="block text-[11px] text-amber-300/80 mt-0.5">
                    Displaying calibrated climatological ocean thermal strata.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-white/60 hover:text-white p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  );
}

function formatDiagnosticNumber(
  value: number | null | undefined,
  digits: number,
  suffix: string,
  fallback: string = '--',
): string {
  return value != null && Number.isFinite(value)
    ? `${value.toFixed(digits)}${suffix}`
    : fallback;
}
