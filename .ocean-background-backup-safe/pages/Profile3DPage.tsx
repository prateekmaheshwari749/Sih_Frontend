  import { useEffect, useMemo, useState } from 'react';
  import Navbar from '../components/Navbar';
  import { Canvas } from '@react-three/fiber';
  import { Grid, OrbitControls } from '@react-three/drei';
  import {
    fetchOceanDiagnostics,
    fetchOceanProfile,
    type OceanDiagnosticsResponse,
    type OceanProfileResponse,
  } from '../api/oceanApi';

  import SubsurfaceColumn3D from '../components/3d/SubsurfaceColumn3D';

  interface ProfilePoint {
    depth: number;
    temperature: number;
    uncertainty?: number;
  }

  export default function Profile3DPage() {
    const [date, setDate] = useState('2024-06-15');
    const [latitude, setLatitude] = useState(15.5);
    const [longitude, setLongitude] = useState(88);

    const [profile, setProfile] =
      useState<OceanProfileResponse | null>(null);
    const [diagnostics, setDiagnostics] =
      useState<OceanDiagnosticsResponse | null>(null);
    const [selectedDepth, setSelectedDepth] =
      useState<number | null>(100);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const profileData = await fetchOceanProfile(
            date,
            latitude,
            longitude
          );

          setProfile(profileData);

          if (profileData.depths_m.length > 0) {
            const defaultDepth = profileData.depths_m.includes(100)
              ? 100
              : profileData.depths_m[0];

            setSelectedDepth(defaultDepth);
          }

          // Diagnostics are supplementary.
          // They must not block the profile viewer.
          try {
            const diagnosticData = await fetchOceanDiagnostics(
              date,
              latitude,
              longitude
            );

            setDiagnostics(diagnosticData);
          } catch (diagnosticError) {
            console.warn(
              '[Profile3DPage] Diagnostics unavailable:',
              diagnosticError
            );

            setDiagnostics(null);
          }

        if (profileData.depths_m.length > 0) {
          const defaultDepth =
            profileData.depths_m.includes(100)
              ? 100
              : profileData.depths_m[0];
          setSelectedDepth(defaultDepth);
        }
      } catch (err) {
        console.error(
          '[Profile3DPage] Failed to load ocean profile:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load ocean profile.'
        );
      } finally {
        setLoading(false);
      }
    }
    const profilePoints = useMemo<ProfilePoint[]>(() => {
      if (!profile) return [];

      return profile.depths_m.map((depth, index) => ({
        depth,
        temperature: profile.temperature_C[index] ?? NaN,
      }));
    }, [profile]);

    const selectedPoint = useMemo(() => {
      if (selectedDepth === null || profilePoints.length === 0) {
        return null;
      }

      return (
        profilePoints.find(
          point => point.depth === selectedDepth
        ) ?? null
      );
    }, [selectedDepth, profilePoints]);

    const validProfile = Boolean(profile && !loading);

    return (
      <>
      <Navbar />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          {/* Breadcrumb + title */}
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>Home</span>
              <span className="text-slate-300">›</span>
              <span>3D Subsurface Profile</span>
              <span className="text-slate-300">›</span>
              <span>15 Standard Levels (0–1000m)</span>
            </div>

            <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    National 3D Ocean Subsurface Depth Profiler
                  </h1>

                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#005088]">
                    MoES · INCOIS WebGL
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Interactive model-predicted temperature profile across
                  the North Indian Ocean.
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Grid: 0.25° · 15 standard depth levels · 0–1000 m
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    min="2018-01-01"
                    max="2025-12-31"
                    onChange={event => setDate(event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-[#005088] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Latitude
                  </label>
                  <input
                    type="number"
                    value={latitude}
                    min={5}
                    max={30}
                    step={0.25}
                    onChange={event =>
                      setLatitude(Number(event.target.value))
                    }
                    className="h-10 w-28 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-[#005088] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                    Longitude
                  </label>
                  <input
                    type="number"
                    value={longitude}
                    min={45}
                    max={105}
                    step={0.25}
                    onChange={event =>
                      setLongitude(Number(event.target.value))
                    }
                    className="h-10 w-28 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-[#005088] focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  onClick={loadProfile}
                  disabled={loading}
                  className="h-10 rounded-lg bg-[#005088] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#003d66] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load Profile'}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              <span className="font-semibold">Backend error:</span>{' '}
              {error}
            </div>
          )}

          {/* KPI strip */}
          <section className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-xs">
              <Metric
                label="Surface"
                value={
                  diagnostics
                    ? `${diagnostics.surface_temperature_C.toFixed(1)}°C`
                    : '--'
                }
                valueClass="text-red-600"
              />
              <Metric
                label="D26 Depth"
                value={
                  diagnostics?.d26
                    ? `${diagnostics.d26.d26_depth_m.toFixed(0)}m`
                    : '--'
                }
                valueClass="text-teal-700"
              />
              <Metric
                label="OHC 0–700m"
                value={
                  diagnostics?.ohc_0_700
                    ? `${diagnostics.ohc_0_700.ohc_0_700_GJ_m2.toFixed(2)} GJ/m²`
                    : '--'
                }
                valueClass="text-amber-700"
              />
              <Metric
                label="TCHP"
                value={
                  diagnostics?.tchp
                    ? `${diagnostics.tchp.tchp_kJ_cm2.toFixed(2)} kJ/cm²`
                    : '--'
                }
                valueClass="text-orange-700"
              />

              <div className="ml-auto text-right text-[11px] text-slate-400">
                {profile
                  ? `Forecast: ${profile.forecast_date}`
                  : 'Production model profile'}
              </div>
            </div>
          </section>

          {/* Main workbench */}
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* 3D visualization */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    3D Volumetric Subsurface Profile
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Click or select a depth layer to inspect the predicted
                    temperature.
                  </p>
                </div>

                <div className="hidden rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500 sm:block">
                  LIVE MODEL OUTPUT
                </div>
              </div>

<div className="h-[560px] w-full bg-[#071827]">
  <Canvas
    camera={{
      position: [5, 3, 6],
      fov: 45,
      near: 0.1,
      far: 100,
    }}
    gl={{
      antialias: true,
    }}
  >
    {/* Dark navy simulation environment */}
    <color attach="background" args={['#071827']} />

    {/* Soft atmospheric lighting */}
    <ambientLight intensity={0.9} />

    <directionalLight
      position={[5, 8, 5]}
      intensity={2}
    />

    <directionalLight
      position={[-4, 2, -4]}
      intensity={1}
    />

    {/* Technical 3D floor grid */}
    <Grid
      position={[0, -3.2, 0]}
      args={[20, 20]}
      cellSize={0.5}
      cellThickness={0.7}
      cellColor="#24445c"
      sectionSize={2.5}
      sectionThickness={1.2}
      sectionColor="#42657c"
      fadeDistance={25}
      fadeStrength={1}
      infiniteGrid
    />

    {/* Ocean subsurface prediction */}
    {profile && (
      <SubsurfaceColumn3D
        profile={profilePoints}
        latitude={profile.nearest_grid_location.latitude}
        longitude={profile.nearest_grid_location.longitude}
        date={date}
        onSelectDepth={setSelectedDepth}
      />
    )}

    {/* Mouse / touch camera controls */}
    <OrbitControls
      enableRotate={true}
      enableZoom={true}
      enablePan={true}
      minDistance={3}
      maxDistance={12}
      target={[0, 0, 0]}
      rotateSpeed={0.8}
      zoomSpeed={0.8}
      panSpeed={0.8}
    />
  </Canvas>
</div>
</div>

            {/* Information rail */}
            <aside className="space-y-4">
              <InfoCard title="Grid Location">
                <div className="grid grid-cols-2 gap-4">
                  <ValueBlock
                    label="Latitude"
                    value={
                      profile
                        ? `${profile.nearest_grid_location.latitude.toFixed(2)}°`
                        : '--'
                    }
                  />
                  <ValueBlock
                    label="Longitude"
                    value={
                      profile
                        ? `${profile.nearest_grid_location.longitude.toFixed(2)}°`
                        : '--'
                    }
                  />
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  Requested point: {latitude.toFixed(2)}°,{' '}
                  {longitude.toFixed(2)}°
                </div>
              </InfoCard>

              <InfoCard
                title={`Depth Layers (${profile?.depths_m.length ?? 15})`}
                subtitle="Click to focus"
              >
                <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                  {profilePoints.length > 0 ? (
                    profilePoints.map(point => {
                      const selected = point.depth === selectedDepth;

                      return (
                        <button
                          key={point.depth}
                          type="button"
                          onClick={() => setSelectedDepth(point.depth)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                            selected
                              ? 'bg-blue-50 ring-1 ring-blue-200'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-sm ${
                                selected
                                  ? 'bg-[#005088]'
                                  : 'bg-slate-300'
                              }`}
                            />
                            <span
                              className={
                                selected
                                  ? 'font-bold text-[#005088]'
                                  : 'font-medium text-slate-600'
                              }
                            >
                              {point.depth} m
                            </span>
                          </span>

                          <span
                            className={
                              selected
                                ? 'font-bold text-[#005088]'
                                : 'font-semibold text-slate-500'
                            }
                          >
                            {Number.isFinite(point.temperature)
                              ? `${point.temperature.toFixed(1)}°C`
                              : '--'}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="py-5 text-center text-xs text-slate-400">
                      Depth data unavailable.
                    </p>
                  )}
                </div>
              </InfoCard>

              <InfoCard title="Selected Depth">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {selectedDepth ?? '--'}
                      <span className="ml-1 text-sm font-medium text-slate-400">
                        m
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Model-predicted temperature
                    </p>
                  </div>

                  <p className="text-2xl font-bold text-[#005088]">
                    {selectedPoint &&
                    Number.isFinite(selectedPoint.temperature)
                      ? `${selectedPoint.temperature.toFixed(2)}°C`
                      : '--'}
                  </p>
                </div>
              </InfoCard>

              <InfoCard title="Ocean Diagnostics">
                <div className="space-y-3">
                  <DiagnosticRow
                    label="D26 Depth"
                    value={
                      diagnostics?.d26
                        ? `${diagnostics.d26.d26_depth_m.toFixed(1)} m`
                        : '--'
                    }
                  />
                  <DiagnosticRow
                    label="Surface Temperature"
                    value={
                      diagnostics
                        ? `${diagnostics.surface_temperature_C.toFixed(2)} °C`
                        : '--'
                    }
                  />
                  <DiagnosticRow
                    label="OHC 0–700 m"
                    value={
                      diagnostics?.ohc_0_700
                        ? `${diagnostics.ohc_0_700.ohc_0_700_GJ_m2.toFixed(2)} GJ/m²`
                        : '--'
                    }
                  />
                  <DiagnosticRow
                    label="TCHP"
                    value={
                      diagnostics?.tchp
                        ? `${diagnostics.tchp.tchp_kJ_cm2.toFixed(2)} kJ/cm²`
                        : '--'
                    }
                  />
                </div>
              </InfoCard>

              <InfoCard title="Production Model">
                <p className="text-xs font-semibold leading-5 text-slate-700">
                  {profile?.model ?? '--'}
                </p>

                {profile && (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <div>
                      Input date:{' '}
                      <span className="font-semibold text-slate-700">
                        {profile.date}
                      </span>
                    </div>
                    <div className="mt-1">
                      Forecast date:{' '}
                      <span className="font-semibold text-slate-700">
                        {profile.forecast_date}
                      </span>
                    </div>
                  </div>
                )}
              </InfoCard>
            </aside>
          </section>

          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-slate-600">
            <span className="font-semibold text-[#005088]">
              Profile interpretation:
            </span>{' '}
            Values shown are production model predictions at the nearest
            available ocean grid location. Use the depth layers to inspect
            the full 0–1000 m temperature structure.
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
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">{label}:</span>
        <span className={`font-bold ${valueClass}`}>{value}</span>
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
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
            {title}
          </h3>
          {subtitle && (
            <span className="text-[10px] text-slate-400">
              {subtitle}
            </span>
          )}
        </div>
        {children}
      </section>
    );
  }

  function ValueBlock({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div>
        <p className="text-[11px] font-medium text-slate-400">
          {label}
        </p>
        <p className="mt-1 font-mono text-base font-bold text-slate-800">
          {value}
        </p>
      </div>
    );
  }

  function DiagnosticRow({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-right font-mono text-xs font-semibold text-slate-700">
          {value}
        </span>
      </div>
    );
  }
