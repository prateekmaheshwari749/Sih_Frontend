import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from "@react-three/fiber";
export interface ProfilePoint {
  depth: number;
  temperature: number;
  uncertainty?: number;
}

interface SubsurfaceColumn3DProps {
  profile?: ProfilePoint[];
  latitude?: number;
  longitude?: number;
  date?: string;
  selectedDepth?: number | null;
  onSelectDepth?: (depth: number | null) => void;
}

interface DepthInfo {
  depth: number;
  temp: number; // °C climatology fallback
  salinity: number; // PSU
  pressure: number; // dbar
  zone: string;
  color: string;
  desc: string;
}

export const DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

export const DEPTH_DATA: Record<number, DepthInfo> = {
  0: { depth: 0, temp: 29.8, salinity: 34.2, pressure: 0, zone: 'Sea Surface (Epipelagic)', color: '#ef4444', desc: 'Direct satellite infrared SST observation' },
  5: { depth: 5, temp: 29.7, salinity: 34.3, pressure: 5, zone: 'Near-surface Layer', color: '#f87171', desc: 'Solar heating absorption zone' },
  10: { depth: 10, temp: 29.5, salinity: 34.4, pressure: 10, zone: 'Upper Mixed Layer', color: '#fb923c', desc: 'Wind stress turbulence mixing' },
  20: { depth: 20, temp: 29.1, salinity: 34.5, pressure: 20, zone: 'Upper Mixed Layer', color: '#f97316', desc: 'Uniform thermal layer' },
  30: { depth: 30, temp: 28.6, salinity: 34.8, pressure: 30, zone: 'Base of Mixed Layer', color: '#ea580c', desc: 'Cyclone fuel energy reservoir' },
  50: { depth: 50, temp: 26.8, salinity: 35.1, pressure: 50, zone: 'Upper Thermocline', color: '#fbbf24', desc: 'Inception of thermal gradient' },
  75: { depth: 75, temp: 23.4, salinity: 35.4, pressure: 75, zone: 'Thermocline Core', color: '#eab308', desc: 'Steepest temperature drop' },
  100: { depth: 100, temp: 20.1, salinity: 35.6, pressure: 100, zone: 'Thermocline Core', color: '#14b8a6', desc: 'Internal wave oscillation zone' },
  125: { depth: 125, temp: 17.5, salinity: 35.5, pressure: 125, zone: 'Lower Thermocline', color: '#06b6d4', desc: 'Eddy displacement boundary' },
  150: { depth: 150, temp: 15.2, salinity: 35.3, pressure: 150, zone: 'Lower Thermocline', color: '#0ea5e9', desc: 'Transition to twilight zone' },
  200: { depth: 200, temp: 13.0, salinity: 35.2, pressure: 200, zone: 'Mesopelagic (Twilight)', color: '#0284c7', desc: 'Sunlight extinction limit (<1%)' },
  300: { depth: 300, temp: 10.8, salinity: 35.0, pressure: 300, zone: 'Mesopelagic (Twilight)', color: '#2563eb', desc: 'Diel vertical migration depth' },
  500: { depth: 500, temp: 8.2, salinity: 34.9, pressure: 500, zone: 'Oxygen Minimum Zone', color: '#3b82f6', desc: 'High biological nutrient density' },
  700: { depth: 700, temp: 6.1, salinity: 34.8, pressure: 700, zone: 'Deep Ocean Transition', color: '#6366f1', desc: 'Subantarctic mode water influence' },
  1000: { depth: 1000, temp: 4.8, salinity: 34.7, pressure: 1000, zone: 'Bathypelagic (Abyss)', color: '#4338ca', desc: 'Centuries-old deep abyssal water' },
};

// Stratified spacing: each level receives 0.35 units of vertical space (total span 4.9 units)
// This guarantees zero vertical overlap between any two consecutive depth layers.
const DEPTH_INDEX_MAP: Record<number, number> = {
  0: 0,
  5: 1,
  10: 2,
  20: 3,
  30: 4,
  50: 5,
  75: 6,
  100: 7,
  125: 8,
  150: 9,
  200: 10,
  300: 11,
  500: 12,
  700: 13,
  1000: 14,
};

function depthToY(depth: number): number {
  const idx = DEPTH_INDEX_MAP[depth];
  if (idx !== undefined) {
    return 2.45 - idx * 0.35;
  }
  return 2.45 - (depth / 1000) * 4.9;
}

export default function SubsurfaceColumn3D({
  profile,
  selectedDepth,
  onSelectDepth,
}: SubsurfaceColumn3DProps) {
  const [internalHovered, setInternalHovered] = useState<number | null>(100);
  const activeDepth = selectedDepth !== undefined && selectedDepth !== null ? selectedDepth : internalHovered;

  const floatRef = useRef<THREE.Group>(null);
  const surfaceWaveRef = useRef<THREE.Mesh>(null);

  // Sync internal hover when selectedDepth changes externally
  useEffect(() => {
    if (selectedDepth !== undefined && selectedDepth !== null) {
      setInternalHovered(selectedDepth);
    }
  }, [selectedDepth]);

  // Compute temperatures mapping from backend profile or fallback
  const temperatures = useMemo(() => {
    const map = new Map<number, number>();
    if (profile && profile.length > 0) {
      profile.forEach(p => {
        if (Number.isFinite(p.temperature)) {
          map.set(p.depth, p.temperature);
        }
      });
    }
    return map;
  }, [profile]);

  // Animate surface waves and drifting ARGO CTD float
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Gentle surface wave displacement
    if (surfaceWaveRef.current) {
      surfaceWaveRef.current.rotation.z = Math.sin(t * 0.8) * 0.02;
    }

    // ARGO profiling float ascending & descending cycle
    if (floatRef.current) {
      const cycle = (Math.sin(t * 0.22) + 1) / 2; // 0 to 1
      const y = -2.45 + cycle * 4.9; // traverses the full 1000m to 0m column
      floatRef.current.position.y = y;
      floatRef.current.rotation.y += 0.015;
    }
  });

  return (
    <group rotation={[0.12, -0.32, 0]}>
      {/* ── Top Sea Surface Wave Mesh ── */}
      <group position={[0, 2.62, 0]}>
        <mesh ref={surfaceWaveRef} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.8, 2.8, 24, 24]} />
          <meshStandardMaterial
            color="#0284c7"
            roughness={0.1}
            metalness={0.8}
            transparent
            opacity={0.65}
          />
        </mesh>

        {/* Sea Surface Wireframe Grid */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[3.8, 2.8, 12, 8]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.3} />
        </mesh>
      </group>

      {/* ── Depth Column Backbone Guide Rails ── */}
      {[-1.85, 1.85].map((x) =>
        [-1.35, 1.35].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0, z]}>
            <cylinderGeometry args={[0.008, 0.008, 5.2, 8]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} />
          </mesh>
        ))
      )}

      {/* ── 15 Stratified Depth Level Slabs ── */}
      {DEPTH_LEVELS.map((depth, idx) => {
        const info = DEPTH_DATA[depth];
        const y = depthToY(depth);
        const isActive = activeDepth === depth;
        const currentTemp = temperatures.get(depth) ?? info.temp;
        const slabThickness = isActive ? 0.12 : 0.07;

        // Alternating slight Z stagger so depth badges never crowd
        const badgeZ = idx % 2 === 0 ? 0.35 : -0.35;

        return (
          <group key={depth} position={[0, y, 0]}>
            {/* Slab Mesh */}
            <mesh
              scale={isActive ? [1.05, 1.2, 1.05] : [1, 1, 1]}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                setInternalHovered(depth);
                onSelectDepth?.(depth);
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setInternalHovered(depth);
                onSelectDepth?.(depth);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
            >
              <boxGeometry args={[3.4, slabThickness, 2.4]} />
              <meshStandardMaterial
                color={info.color}
                roughness={0.25}
                metalness={0.4}
                transparent
                opacity={isActive ? 0.85 : 0.42}
                emissive={info.color}
                emissiveIntensity={isActive ? 0.7 : 0.18}
              />
            </mesh>

            {/* Glowing boundary line */}
            <mesh scale={isActive ? [1.06, 1, 1.06] : [1.01, 1, 1.01]}>
              <boxGeometry args={[3.42, slabThickness + 0.01, 2.42]} />
              <meshBasicMaterial
                color={info.color}
                wireframe
                transparent
                opacity={isActive ? 0.95 : 0.3}
              />
            </mesh>

            {/* Thin connector line to the badge */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([1.7, 0, badgeZ, 2.05, 0, badgeZ]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={info.color}
                transparent
                opacity={isActive ? 0.9 : 0.45}
                linewidth={1}
              />
            </line>

            {/* Interactive Depth & Temperature Badge */}
            <Html distanceFactor={5.6} position={[2.15, 0, badgeZ]} center>
              <button
                type="button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  setInternalHovered(depth);
                  onSelectDepth?.(depth);
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'ring-2 ring-white/90 scale-110 z-30 font-black shadow-lg shadow-cyan-500/50'
                    : 'hover:scale-105 opacity-85 hover:opacity-100 hover:border-white/60'
                }`}
                style={{
                  background: isActive ? info.color : 'rgba(2, 14, 28, 0.92)',
                  color: isActive ? '#000000' : '#ffffff',
                  borderColor: info.color,
                  boxShadow: isActive ? `0 0 16px ${info.color}` : '0 2px 6px rgba(0,0,0,0.6)',
                }}
              >
                <span className="font-bold" style={{ color: isActive ? '#000' : info.color }}>
                  {depth}m
                </span>
                <span className={isActive ? 'text-black/50' : 'text-white/40'}>·</span>
                <span className="font-extrabold tracking-tight">
                  {currentTemp.toFixed(1)}°C
                </span>
              </button>
            </Html>

            {/* Compact hover/active details tooltip on the left side */}
            {isActive && (
              <Html distanceFactor={5.6} position={[-2.35, 0, 0]} center>
                <div
                  className="px-3 py-2 rounded-xl text-left pointer-events-none backdrop-blur-md whitespace-nowrap shadow-2xl border"
                  style={{
                    background: 'rgba(2, 15, 30, 0.94)',
                    borderColor: info.color,
                    boxShadow: `0 0 20px ${info.color}44`,
                    color: '#e2e8f0',
                    fontSize: '11px',
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1 mb-1 font-mono">
                    <span className="font-bold text-xs" style={{ color: info.color }}>
                      {depth} m · {currentTemp.toFixed(2)}°C
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/80">
                      {info.pressure} dbar
                    </span>
                  </div>
                  <p className="text-[10px] text-white/70 font-medium">{info.zone}</p>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* ── Thermocline Barrier Plane (at 100m) ── */}
      <group position={[0, depthToY(100), 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.0, 3.0]} />
          <meshBasicMaterial color="#eab308" transparent opacity={0.07} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ── Autonomous Robotic ARGO CTD Profiling Float (Drifting on the left side) ── */}
      <group ref={floatRef} position={[-1.25, 0, 0.6]}>
        {/* Float body cylinder */}
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.35, 16]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* CTD Sensor Ring Cap */}
        <mesh position={[0, 0.19, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>

        {/* Satellite Antenna */}
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* Pulsing Sonar Pings */}
        <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.15, 0.22, 24]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>

        {/* Float Label */}
        <Html distanceFactor={5.6} position={[0, -0.32, 0]} center>
          <div className="px-2 py-0.5 rounded bg-amber-500/90 text-black font-black text-[9px] whitespace-nowrap shadow-lg">
            ARGO PROFILER (0–1000m)
          </div>
        </Html>
      </group>

      {/* ── Ambient Volumetric Current Particles (Marine Snow / Eddies) ── */}
      <VolumetricCurrentParticles />
    </group>
  );
}

// Particle field flowing down through the water column
function VolumetricCurrentParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 180;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 3.4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4.9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;

      // Color from warm surface (y > 0) to cold deep (y < 0)
      const normY = (pos[i * 3 + 1] + 2.45) / 4.9; // 0 to 1
      cols[i * 3] = THREE.MathUtils.lerp(0.1, 0.95, normY);
      cols[i * 3 + 1] = THREE.MathUtils.lerp(0.4, 0.6, normY);
      cols[i * 3 + 2] = THREE.MathUtils.lerp(0.95, 0.2, normY);
    }

    return [pos, cols];
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      // Gentle eddy swirl
      array[i * 3] += Math.sin(array[i * 3 + 1] * 2 + delta) * 0.003;
      array[i * 3 + 1] -= delta * 0.14; // slow downward current
      if (array[i * 3 + 1] < -2.45) {
        array[i * 3 + 1] = 2.45;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}