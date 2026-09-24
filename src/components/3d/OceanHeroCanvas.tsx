import { useEffect, useState, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  Globe,
  Layers,
  Waves,
  RotateCcw,
  Compass,
  Radio,
  Maximize2,
} from 'lucide-react';

import HolographicGlobe, { type ArgoFloat } from './HolographicGlobe';
import SubsurfaceColumn3D from './SubsurfaceColumn3D';
import {
  fetchOceanProfile,
  type OceanProfileResponse,
} from '../../api/oceanApi';

type ViewMode = 'globe' | 'subsurface' | 'waves';

/* ─────────────────────────────────────────────────────────────────────────────
 * 3D Dynamic Ocean Fluid Waves Mode
 * ──────────────────────────────────────────────────────────────────────────── */

function OceanWaveFluid() {
  const meshRef = useRef<THREE.Mesh>(null);
  const buoyRef = useRef<THREE.Group>(null);
  const geom = useRef<THREE.PlaneGeometry>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (geom.current) {
      const pos = geom.current.attributes.position as THREE.BufferAttribute;

      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const v = pos.getY(i);

        const z =
          Math.sin(u * 1.5 + t * 1.8) * 0.16 +
          Math.cos(v * 1.2 + t * 1.4) * 0.12 +
          Math.sin((u + v) * 0.8 + t * 2.2) * 0.08;

        pos.setZ(i, z);
      }

      pos.needsUpdate = true;
      geom.current.computeVertexNormals();
    }

    if (buoyRef.current) {
      const buoyZ =
        Math.sin(t * 1.8) * 0.16 +
        Math.cos(t * 1.4) * 0.12;

      buoyRef.current.position.y = buoyZ + 0.1;
      buoyRef.current.rotation.z = Math.sin(t * 1.6) * 0.12;
      buoyRef.current.rotation.x = Math.cos(t * 1.3) * 0.1;
    }
  });

  return (
    <group rotation={[-Math.PI / 3, 0, 0.2]}>
      {/* ── Surface Water Mesh ── */}
      <mesh ref={meshRef} receiveShadow>
        <planeGeometry
          ref={geom}
          args={[5.5, 4.5, 48, 48]}
        />

        <meshStandardMaterial
          color="#0369a1"
          roughness={0.15}
          metalness={0.7}
          transparent
          opacity={0.82}
          wireframe={false}
          emissive="#083344"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* ── Surface Wireframe Caustics Grid ── */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[5.5, 4.5, 24, 20]} />

        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.18}
        />
      </mesh>

      {/* ── Floating Oceanographic Buoy ── */}
      <group
        ref={buoyRef}
        position={[0.4, 0.2, 0]}
      >
        {/* Yellow Float Hull */}
        <mesh>
          <cylinderGeometry
            args={[0.22, 0.15, 0.14, 16]}
          />

          <meshStandardMaterial
            color="#eab308"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>

        {/* Mast */}
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry
            args={[0.015, 0.015, 0.35, 8]}
          />

          <meshStandardMaterial color="#e2e8f0" />
        </mesh>

        {/* Radar & Weather Sensors */}
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.04, 12, 12]} />

          <meshBasicMaterial color="#ef4444" />
        </mesh>

        {/* Pulsing Sonar Ring */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.05, 0]}
        >
          <ringGeometry args={[0.25, 0.38, 24]} />

          <meshBasicMaterial
            color="#22d3ee"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ── Subsurface Bathymetric Grid Bed ── */}
      <mesh position={[0, 0, -1.2]}>
        <planeGeometry args={[6.0, 5.0, 16, 16]} />

        <meshBasicMaterial
          color="#0284c7"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Component Props
 * ──────────────────────────────────────────────────────────────────────────── */

interface OceanHeroCanvasProps {
  initialMode?: ViewMode;
  lockMode?: ViewMode;
  onDepthChange?: (depth: number | null) => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Master Hero Canvas Component
 * ──────────────────────────────────────────────────────────────────────────── */

export default function OceanHeroCanvas({
  initialMode = 'globe',
  lockMode,
  onDepthChange,
}: OceanHeroCanvasProps = {}) {
  const effectiveMode = lockMode ?? initialMode;

  const [mode, setMode] =
    useState<ViewMode>(effectiveMode);

  const [autoRotate, setAutoRotate] =
    useState(true);

  const [selectedFloat, setSelectedFloat] =
    useState<ArgoFloat | null>(null);

  const [selectedDepth, setSelectedDepth] =
    useState<number | null>(null);

  const [profile, setProfile] =
    useState<OceanProfileResponse | null>(null);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileError, setProfileError] =
    useState<string | null>(null);

  const controlsRef = useRef<any>(null);

  /* ─────────────────────────────────────────────────────────────────────────
   * Real production profile request
   *
   * This calls:
   * /api/ocean/profile/2025-12-31/15/75
   *
   * No synthetic temperature data is created here.
   * ───────────────────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (mode !== 'subsurface') {
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);

      try {
        const date = '2025-12-31';
        const latitude = 15;
        const longitude = 75;

        const response =
          await fetchOceanProfile(
            date,
            latitude,
            longitude
          );

        if (cancelled) {
          return;
        }

        if (
          !response ||
          response.success !== true
        ) {
          throw new Error(
            'Production ocean profile was unavailable.'
          );
        }

        if (
          !Array.isArray(response.depths_m) ||
          !Array.isArray(response.temperature_C)
        ) {
          throw new Error(
            'Production ocean profile returned an invalid depth/temperature structure.'
          );
        }

        setProfile(response);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load the production ocean profile.';

        setProfile(null);
        setProfileError(message);
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Depth selection
   * ───────────────────────────────────────────────────────────────────────── */

  const handleDepthSelect = (
    depth: number | null
  ) => {
    setSelectedDepth(depth);
    onDepthChange?.(depth);
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * Camera reset
   * ───────────────────────────────────────────────────────────────────────── */

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * Convert backend profile into SubsurfaceColumn3D format
   *
   * Backend:
   *   depths_m
   *   temperature_C
   *
   * SubsurfaceColumn3D:
   *   depth
   *   temperature
   *
   * Only finite real backend values are passed through.
   * ───────────────────────────────────────────────────────────────────────── */

  const profilePoints =
    profile &&
    Array.isArray(profile.depths_m) &&
    Array.isArray(profile.temperature_C)
      ? profile.depths_m
          .map((depth, index) => {
            const temperature =
              profile.temperature_C[index];

            if (
              temperature === null ||
              temperature === undefined ||
              !Number.isFinite(Number(depth)) ||
              !Number.isFinite(Number(temperature))
            ) {
              return null;
            }

            return {
              depth: Number(depth),
              temperature: Number(temperature),
            };
          })
          .filter(
            (
              point
            ): point is {
              depth: number;
              temperature: number;
            } => point !== null
          )
      : [];

  return (
    <div className="ocean-hero-canvas-frame relative w-full h-[540px] sm:h-[620px] lg:h-[680px] rounded-3xl overflow-hidden border border-cyan-500/20 bg-gradient-to-b from-[#020d1c]/90 via-[#010915] to-[#01060f] shadow-[0_0_50px_rgba(6,182,212,0.12)]">

      {/* ── Canvas Background Nebula Glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.14), rgba(3, 105, 161, 0.05) 50%, transparent 75%)',
        }}
      />

      {/* ── Top Bar HUD ── */}
      <div className="absolute top-4 inset-x-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">

        {/* Left: Mode Buttons */}
        {!lockMode ? (
          <div className="ocean-canvas-hud flex items-center gap-1 p-1 rounded-2xl bg-[#021327]/80 backdrop-blur-xl border border-cyan-500/25 pointer-events-auto shadow-xl">

            <button
              onClick={() => setMode('globe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'globe'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe
                size={14}
                className={
                  mode === 'globe'
                    ? 'animate-spin-slow'
                    : ''
                }
              />

              <span>
                Satellite & Globe
              </span>
            </button>

            <button
              onClick={() =>
                setMode('subsurface')
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'subsurface'
                  ? 'bg-gradient-to-r from-amber-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers size={14} />

              <span>
                15 Depth Layers
              </span>
            </button>

            <button
              onClick={() => setMode('waves')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'waves'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Waves size={14} />

              <span>
                Ocean Fluid
              </span>
            </button>
          </div>
        ) : (
          <div className="ocean-canvas-hud flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#021327]/85 backdrop-blur-xl border border-cyan-500/30 text-xs font-mono text-cyan-300 pointer-events-auto shadow-xl">

            <Layers
              size={14}
              className="text-cyan-400"
            />

            <span className="font-bold">
              3D SUBSURFACE TEMPERATURE COLUMN
              (0–1000m)
            </span>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">

          {/* Live Ping */}
          <div className="ocean-canvas-hud hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#021429]/70 backdrop-blur-md border border-cyan-500/20 text-[11px] font-mono text-cyan-300 shadow-md">

            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />

            <span>
              LIVE 3D TWIN
            </span>
          </div>

          {/* Auto Rotate */}
          <button
            onClick={() =>
              setAutoRotate(!autoRotate)
            }
            title={
              autoRotate
                ? 'Pause Rotation'
                : 'Enable Auto-Rotation'
            }
            className={`ocean-canvas-ctrl p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
              autoRotate
                ? 'bg-cyan-950/60 border-cyan-400/40 text-cyan-300'
                : 'bg-black/40 border-white/10 text-white/50 hover:text-white'
            }`}
          >
            <Compass
              size={14}
              className={
                autoRotate
                  ? 'animate-spin-slow'
                  : ''
              }
            />
          </button>

          {/* Reset Camera */}
          <button
            onClick={resetCamera}
            title="Reset Camera View"
            className="ocean-canvas-ctrl p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ── Bottom HUD ── */}
      <div className="absolute bottom-4 inset-x-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">

        {/* Left: Mode Context */}
        <div className="ocean-canvas-hud p-2.5 px-3.5 rounded-2xl bg-[#021327]/85 backdrop-blur-md border border-cyan-500/20 pointer-events-auto max-w-sm text-left shadow-xl">

          {mode === 'globe' && (
            <div className="space-y-0.5">

              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">

                <Radio
                  size={12}
                  className="text-cyan-400 animate-pulse"
                />

                <span>
                  North Indian Ocean Constellation
                </span>
              </div>

              <p className="text-[10px] text-white/60 leading-tight">
                4 Satellites beaming IR SST & SSH
                altimetry. Click glowing ARGO buoys
                to inspect subsurface profiles.
              </p>
            </div>
          )}

          {mode === 'subsurface' && (
            <div className="space-y-0.5">

              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">

                <Layers
                  size={12}
                  className="text-amber-400"
                />

                <span>
                  15 Depth Levels (0m → 1000m)
                </span>
              </div>

              <p className="text-[10px] text-white/60 leading-tight">
                Real production OceanEmbed
                temperature profile from the
                FastAPI inference backend.
              </p>
            </div>
          )}

          {mode === 'waves' && (
            <div className="space-y-0.5">

              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">

                <Waves
                  size={12}
                  className="text-blue-400"
                />

                <span>
                  Dynamic Ocean Fluid Simulation
                </span>
              </div>

              <p className="text-[10px] text-white/60 leading-tight">
                Procedural surface wave mesh with
                mooring buoy telemetry and bottom
                bathymetry contouring.
              </p>
            </div>
          )}
        </div>

        {/* Right: Quick Telemetry */}
        <div className="ocean-canvas-hud hidden md:flex items-center gap-3 p-2 px-3 rounded-2xl bg-[#021327]/85 backdrop-blur-md border border-cyan-500/20 pointer-events-auto text-[10px] font-mono text-white/70 shadow-xl">

          <div className="flex items-center gap-1.5">
            <span className="text-white/40">
              SATELLITES:
            </span>

            <span className="text-cyan-400 font-bold">
              4 ACTIVE
            </span>
          </div>

          <span className="text-white/20">
            |
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-white/40">
              ARGO:
            </span>

            <span className="text-emerald-400 font-bold">
              {selectedFloat
                ? selectedFloat.id
                : '8 TRANSMITTING'}
            </span>
          </div>

          <span className="text-white/20">
            |
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-white/40">
              DEPTH:
            </span>

            <span className="text-amber-300 font-bold">
              {selectedDepth !== null
                ? `${selectedDepth}m SELECTED`
                : '0–1000m'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Subsurface Loading / Error Status ── */}
      {mode === 'subsurface' &&
        profileLoading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-[#021327]/90 backdrop-blur-md border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-xl pointer-events-none">
            Loading real production temperature
            profile...
          </div>
        )}

      {mode === 'subsurface' &&
        !profileLoading &&
        profileError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md px-4 py-2 rounded-xl bg-red-950/80 backdrop-blur-md border border-red-500/30 text-xs font-mono text-red-300 shadow-xl pointer-events-none text-center">
            {profileError}
          </div>
        )}

      {/* ── Interactive Hint ── */}
      <div className="ocean-canvas-hint absolute bottom-16 right-4 z-10 hidden sm:flex items-center gap-1.5 text-[10px] text-white/35 font-mono pointer-events-none">
        <Maximize2 size={11} />

        <span>
          Drag to rotate · Scroll to zoom
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
       * Three.js WebGL Canvas
       * ──────────────────────────────────────────────────────────────────── */}

      <Canvas
        camera={{
          position: [0, 0.8, 5.0],
          fov: 46,
        }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
        }}
      >
        <ambientLight intensity={0.7} />

        <directionalLight
          position={[6, 8, 4]}
          intensity={1.4}
          color="#f0f9ff"
        />

        <directionalLight
          position={[-6, -4, -4]}
          intensity={0.5}
          color="#0284c7"
        />

        <pointLight
          position={[0, 4, 2]}
          intensity={0.8}
          color="#38bdf8"
        />

        {/* Starfield */}
        <Stars
          radius={40}
          depth={30}
          count={1200}
          factor={3}
          saturation={0.5}
          fade
          speed={1}
        />

        <Suspense fallback={null}>

          {/* Globe Mode */}
          {mode === 'globe' && (
            <HolographicGlobe
              onSelectFloat={(float) =>
                setSelectedFloat(float)
              }
            />
          )}

          {/* ─────────────────────────────────────────────────────────────
           * REAL SUBSURFACE PROFILE
           *
           * Required props:
           *   profile
           *   latitude
           *   longitude
           *   date
           *   onSelectDepth
           * ─────────────────────────────────────────────────────────── */}

          {mode === 'subsurface' &&
            profile &&
            profilePoints.length > 0 && (
              <SubsurfaceColumn3D
                profile={profilePoints}
                latitude={
                  profile.nearest_grid_location
                    .latitude
                }
                longitude={
                  profile.nearest_grid_location
                    .longitude
                }
                date={profile.date}
                onSelectDepth={
                  handleDepthSelect
                }
              />
            )}

          {/* Waves Mode */}
          {mode === 'waves' && (
            <OceanWaveFluid />
          )}
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom
          minDistance={3.2}
          maxDistance={8.5}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
          dampingFactor={0.06}
        />
      </Canvas>
    </div>
  );
}