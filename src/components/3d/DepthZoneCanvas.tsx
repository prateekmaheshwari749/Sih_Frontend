import React, { useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DepthZoneCanvasProps {
  zoneId: string;
  color: string;
  className?: string;
}

// ── Error Boundary for Safe WebGL Handling ───────────────────────────────────
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[DepthZoneCanvas] WebGL render fallback activated:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ── 1. Surface Zone 3D Visualizer ─────────────────────────────────────────────
function SurfaceScene({ color }: { color: string }) {
  const waveGeom = useRef<THREE.PlaneGeometry>(null);
  const buoyGroup = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (waveGeom.current) {
      const pos = waveGeom.current.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const v = pos.getY(i);
        const z =
          Math.sin(u * 2 + t * 2.2) * 0.12 +
          Math.cos(v * 1.6 + t * 1.8) * 0.09;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
      waveGeom.current.computeVertexNormals();
    }

    if (buoyGroup.current) {
      buoyGroup.current.position.y = Math.sin(t * 2.2) * 0.1 + 0.15;
      buoyGroup.current.rotation.z = Math.sin(t * 2.0) * 0.15;
    }

    if (beamRef.current) {
      beamRef.current.position.x = Math.sin(t * 0.8) * 1.2;
    }
  });

  return (
    <group rotation={[-Math.PI / 3.2, 0, 0]}>
      {/* Dynamic Sea Surface */}
      <mesh receiveShadow>
        <planeGeometry ref={waveGeom} args={[4.2, 3.2, 32, 28]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.6}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Surface Wireframe */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[4.2, 3.2, 16, 14]} />
        <meshBasicMaterial color="#fff" wireframe transparent opacity={0.15} />
      </mesh>

      {/* Rocking ARGO Surface Buoy */}
      <group ref={buoyGroup} position={[0, 0.1, 0]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.1, 0.12, 16]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.28, 8]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Sonar Beacon Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[0.2, 0.32, 20]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Sweeping Satellite Laser Scan */}
      <mesh ref={beamRef} position={[0, 1.2, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.35, 2.4, 16, 1, true]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ── 2. Mixed Layer Zone 3D Visualizer (Wind-driven Vortex & Eddies) ───────────
function MixedLayerScene({ color }: { color: string }) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);
  const eddyGroup = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ring1.current) ring1.current.rotation.z = t * 0.8;
    if (ring2.current) ring2.current.rotation.z = -t * 1.1;
    if (ring3.current) ring3.current.rotation.z = t * 1.4;
    if (eddyGroup.current) {
      eddyGroup.current.rotation.y = t * 0.4;
      eddyGroup.current.position.y = Math.sin(t * 1.5) * 0.08;
    }
  });

  return (
    <group rotation={[-Math.PI / 4, 0, 0]}>
      {/* Upper Boundary Grid */}
      <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 2.8, 14, 10]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
      </mesh>

      {/* Turbulent Kinetic Eddies (Concentric Swirling Toruses) */}
      <group ref={eddyGroup} position={[0, 0, 0]}>
        <mesh ref={ring1}>
          <torusGeometry args={[0.9, 0.04, 16, 40]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh ref={ring2} rotation={[0.4, 0.2, 0]}>
          <torusGeometry args={[0.65, 0.035, 16, 32]} />
          <meshStandardMaterial color="#f97316" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh ref={ring3} rotation={[-0.3, -0.4, 0]}>
          <torusGeometry args={[0.4, 0.03, 16, 24]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.8} />
        </mesh>
      </group>

      {/* Lower Boundary (Base of Mixed Layer) */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 2.8, 14, 10]} />
        <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// ── 3. Thermocline Zone 3D Visualizer (Steep Thermal Gradient Layers) ─────────
function ThermoclineScene({ color }: { color: string }) {
  const layerGroup = useRef<THREE.Group>(null);
  const probeMesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (layerGroup.current) {
      layerGroup.current.rotation.y = Math.sin(t * 0.3) * 0.15;
    }
    if (probeMesh.current) {
      probeMesh.current.position.y = Math.sin(t * 1.8) * 0.6;
    }
  });

  return (
    <group rotation={[-Math.PI / 5, 0, 0]}>
      {/* 5 Stacked Thermal Gradient Stratification Sheets */}
      <group ref={layerGroup}>
        {[-0.8, -0.4, 0, 0.4, 0.8].map((yOffset, i) => {
          const layerOpacity = 0.55 - i * 0.08;
          return (
            <mesh key={yOffset} position={[0, yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.4, 2.4, 16, 12]} />
              <meshStandardMaterial
                color={i === 2 ? '#eab308' : i < 2 ? '#ef4444' : '#0284c7'}
                roughness={0.2}
                transparent
                opacity={layerOpacity}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
      </group>

      {/* Descending ARGO Temperature Sensor Probe */}
      <mesh ref={probeMesh} position={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.08, 0.24, 8, 16]} />
        <meshStandardMaterial color="#22d3ee" roughness={0.1} metalness={0.9} emissive="#06b6d4" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// ── 4. Mesopelagic Twilight Zone (Light Attenuation & SOFAR Channel) ──────────
function MesopelagicScene({ color }: { color: string }) {
  const particlesRef = useRef<THREE.Points>(null);
  const waveSoundRef = useRef<THREE.Mesh>(null);

  const particleCount = 120;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 4;
    positions[i + 1] = (Math.random() - 0.5) * 2.5;
    positions[i + 2] = (Math.random() - 0.5) * 2;
  }

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.05;
    }
    if (waveSoundRef.current) {
      waveSoundRef.current.scale.x = 1 + Math.sin(t * 2.5) * 0.15;
      waveSoundRef.current.scale.y = 1 + Math.cos(t * 2.5) * 0.15;
    }
  });

  return (
    <group rotation={[-Math.PI / 6, 0, 0]}>
      {/* Marine Snow Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.04} color="#94a3b8" transparent opacity={0.6} />
      </points>

      {/* Acoustic SOFAR Axis Low-Frequency Sound Waveguide */}
      <mesh ref={waveSoundRef} position={[0, 0, 0]}>
        <torusGeometry args={[1.1, 0.06, 16, 48]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

// ── 5. Deep Ocean Abyssal Zone (High Hydrostatic Pressure & Bathymetry) ─────────
function DeepOceanScene({ color }: { color: string }) {
  const bathyGridRef = useRef<THREE.Mesh>(null);
  const sonarRingRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (bathyGridRef.current) {
      bathyGridRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;
    }
    if (sonarRingRef.current) {
      const scale = (t % 2.5) / 2.5;
      sonarRingRef.current.scale.set(scale * 2.2, scale * 2.2, scale * 2.2);
      (sonarRingRef.current.material as THREE.Material).opacity = Math.max(0, 1 - scale);
    }
  });

  return (
    <group rotation={[-Math.PI / 3.5, 0, 0]}>
      {/* Deep Bathymetric Seafloor Grid */}
      <mesh ref={bathyGridRef} position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 3.2, 20, 16]} />
        <meshStandardMaterial
          color="#0f172a"
          wireframe
          roughness={0.8}
          emissive="#1e3a8a"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Sonar Acoustic Ping Ring */}
      <mesh ref={sonarRingRef} position={[0, 0, -0.1]}>
        <ringGeometry args={[0.3, 0.35, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Deep-Sea Lander Sensor Node */}
      <group position={[0, 0, 0]}>
        <mesh>
          <octahedronGeometry args={[0.18, 0]} />
          <meshStandardMaterial color="#38bdf8" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.25]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>
    </group>
  );
}

// ── Fallback 2D Animated Wave Component ───────────────────────────────────────
function DepthZoneFallback({ zoneId, color }: DepthZoneCanvasProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="w-16 h-16 rounded-full border-2 border-cyan-400/40 flex items-center justify-center mb-3 shadow-lg" style={{ borderColor: color }}>
        <div className="w-8 h-8 rounded-full animate-ping" style={{ backgroundColor: color }} />
      </div>
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">
        Stratum Layer: {zoneId}
      </p>
      <p className="text-[11px] text-slate-400 mt-1 font-mono">
        3D Ocean Depth Simulator Active
      </p>
    </div>
  );
}

// ── Main DepthZoneCanvas Export ────────────────────────────────────────────────
export default function DepthZoneCanvas({ zoneId, color, className }: DepthZoneCanvasProps) {
  return (
    <div className={`relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#020b17] via-[#021327] to-[#010814] shadow-xl ${className || ''}`}>
      {/* Backdrop Ambient Light */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}15, transparent 70%)`,
        }}
      />

      <CanvasErrorBoundary fallback={<DepthZoneFallback zoneId={zoneId} color={color} />}>
        <Canvas
          camera={{ position: [0, 0.35, 4.8], fov: 38 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[4, 5, 3]} intensity={1.2} color="#fff" />
          <directionalLight position={[-4, -3, -2]} intensity={0.4} color={color} />

          {zoneId === 'surface' && <SurfaceScene color={color} />}
          {zoneId === 'mixed' && <MixedLayerScene color={color} />}
          {zoneId === 'thermocline' && <ThermoclineScene color={color} />}
          {zoneId === 'meso' && <MesopelagicScene color={color} />}
          {zoneId === 'deep' && <DeepOceanScene color={color} />}
        </Canvas>
      </CanvasErrorBoundary>

      {/* Interactive Floating Badge */}
      <div className="absolute bottom-2.5 right-2.5 z-10 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/50 pointer-events-none flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: color }} />
        <span>3D SIMULATION</span>
      </div>
    </div>
  );
}
