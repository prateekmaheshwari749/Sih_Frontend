import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreeEvent } from "@react-three/fiber";
// Convert Lat/Lon (degrees) to 3D vector on a sphere of radius R
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Procedural high-detail Earth texture focusing on Indian Ocean & global land outlines
function createGlobeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean background
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGrad.addColorStop(0, '#020b18');
  oceanGrad.addColorStop(0.5, '#03192f');
  oceanGrad.addColorStop(1, '#020b18');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Oceanic coordinate grid lines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
  ctx.lineWidth = 1;

  // Latitudes (horizontal)
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = ((90 - lat) / 180) * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Longitudes (vertical)
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Equator highlight
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tropic of Cancer (23.5° N - across India/Arabian Sea)
  const cancerY = ((90 - 23.5) / 180) * canvas.height;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.2)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, cancerY);
  ctx.lineTo(canvas.width, cancerY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Helper to convert lat/lon to canvas x,y
  const toX = (lon: number) => ((lon + 180) / 360) * canvas.width;
  const toY = (lat: number) => ((90 - lat) / 180) * canvas.height;

  // Draw simplified land polygons with glowing cyan outlines
  const drawLand = (coords: [number, number][], fillColor = '#071f38', strokeColor = '#06b6d4') => {
    if (coords.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(toX(coords[0][1]), toY(coords[0][0]));
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(toX(coords[i][1]), toY(coords[i][0]));
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  // Indian Subcontinent
  drawLand([
    [32, 75], [30, 70], [25, 68], [23, 69], [21, 70], [20, 73],
    [16, 73.5], [13, 74.8], [10, 76], [8.1, 77.5], [8.5, 78.2],
    [10, 79.8], [13, 80.3], [16, 82], [19, 85], [21.5, 87],
    [22, 89], [25, 91], [27, 88], [28, 80], [32, 78]
  ], '#092947', '#22d3ee');

  // Sri Lanka
  drawLand([[9.5, 80], [8, 81.5], [6, 80.5], [8, 79.7]], '#092947', '#22d3ee');

  // Arabian Peninsula
  drawLand([
    [30, 35], [30, 48], [26, 50], [24, 55], [22, 59], [17, 54],
    [12.5, 44], [15, 42], [22, 38], [28, 35]
  ], '#071f38', '#0ea5e9');

  // Africa East Coast & Madagascar
  drawLand([
    [12, 51], [10, 43], [4, 45], [-4, 39], [-12, 40], [-25, 33],
    [-34, 18], [-20, 12], [0, 9], [15, 38]
  ], '#05182c', '#0284c7');

  drawLand([
    [-12, 49], [-16, 50], [-25, 47], [-25, 44], [-16, 44]
  ], '#05182c', '#0284c7');

  // Southeast Asia & Indonesia
  drawLand([
    [22, 92], [15, 97], [10, 99], [3, 101], [1, 104],
    [7, 105], [15, 108], [21, 108], [25, 102]
  ], '#07203b', '#0ea5e9');

  // Sumatra & Java
  drawLand([[5, 96], [0, 100], [-5, 105], [-6, 103], [0, 97]], '#07203b', '#0ea5e9');
  drawLand([[-6, 106], [-7, 114], [-8, 114], [-7, 106]], '#07203b', '#0ea5e9');

  // Australia (North Coast)
  drawLand([
    [-11, 131], [-12, 136], [-17, 140], [-20, 148], [-35, 149],
    [-38, 144], [-32, 116], [-20, 115], [-15, 124]
  ], '#05182c', '#0369a1');

  // Europe & Northern Eurasia simplified
  drawLand([
    [37, -9], [43, -9], [55, 8], [60, 25], [68, 45], [60, 70],
    [50, 80], [45, 60], [38, 55], [38, 30], [36, -5]
  ], '#05182c', '#0284c7');

  // North Indian Ocean Heat Anomaly Glow highlight (Arabian Sea & Bay of Bengal)
  const indSeaX = toX(78);
  const indSeaY = toY(12);
  const glowGrad = ctx.createRadialGradient(indSeaX, indSeaY, 10, indSeaX, indSeaY, 200);
  glowGrad.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
  glowGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.12)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(indSeaX, indSeaY, 200, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Satellite Definition
export interface SatelliteData {
  name: string;
  type: string;
  sensor: string;
  altitude: number;
  speed: number;
  inclination: number; // in radians
  color: string;
  phase: number;
}

export const SATELLITES: SatelliteData[] = [
  {
    name: 'MODIS (Terra)',
    type: 'Infrared & Optical',
    sensor: 'SST & Chlorophyll-a',
    altitude: 2.85,
    speed: 0.45,
    inclination: 0.65,
    color: '#06b6d4',
    phase: 0,
  },
  {
    name: 'Jason-3',
    type: 'Radar Altimeter',
    sensor: 'Sea Surface Height (SSH)',
    altitude: 2.98,
    speed: 0.38,
    inclination: 1.15,
    color: '#3b82f6',
    phase: 1.8,
  },
  {
    name: 'VIIRS (Suomi NPP)',
    type: 'Radiometer Imaging',
    sensor: 'High-Res SST & Ocean Fronts',
    altitude: 2.75,
    speed: 0.52,
    inclination: 0.35,
    color: '#10b981',
    phase: 3.4,
  },
  {
    name: 'Sentinel-3A',
    type: 'Multispectral Altimetry',
    sensor: 'Surface Wind & SSS Proxy',
    altitude: 2.9,
    speed: 0.4,
    inclination: -0.85,
    color: '#8b5cf6',
    phase: 4.8,
  },
];

// ARGO Float Coordinates in North Indian Ocean
export interface ArgoFloat {
  id: string;
  lat: number;
  lon: number;
  basin: string;
  sst: string;
  mld: string;
  ohc: string;
  salinity: string;
  status: string;
}

export const ARGO_FLOATS: ArgoFloat[] = [
  { id: 'ARGO-2902741', lat: 18.5, lon: 65.2, basin: 'Arabian Sea (North)', sst: '28.8°C', mld: '35m', ohc: '82.4 kJ/cm²', salinity: '36.2 PSU', status: 'CTD Cycle 142' },
  { id: 'ARGO-2902784', lat: 14.1, lon: 69.4, basin: 'Arabian Sea (Central)', sst: '29.3°C', mld: '42m', ohc: '88.1 kJ/cm²', salinity: '35.8 PSU', status: 'Ascending (180m)' },
  { id: 'ARGO-2903102', lat: 8.8, lon: 73.1, basin: 'Lakshadweep Sea', sst: '30.1°C', mld: '28m', ohc: '95.6 kJ/cm²', salinity: '34.9 PSU', status: 'Surface Transmit' },
  { id: 'ARGO-2902819', lat: 19.2, lon: 88.6, basin: 'Bay of Bengal (North)', sst: '29.9°C', mld: '22m', ohc: '102.3 kJ/cm²', salinity: '32.4 PSU', status: 'CTD Cycle 98' },
  { id: 'ARGO-2902955', lat: 13.5, lon: 84.8, basin: 'Bay of Bengal (Central)', sst: '30.4°C', mld: '30m', ohc: '97.2 kJ/cm²', salinity: '33.1 PSU', status: 'Diving (450m)' },
  { id: 'ARGO-2903011', lat: 7.2, lon: 87.5, basin: 'South Bay of Bengal', sst: '29.7°C', mld: '36m', ohc: '91.8 kJ/cm²', salinity: '34.2 PSU', status: 'Parked (1000m)' },
  { id: 'ARGO-2903240', lat: 2.5, lon: 62.0, basin: 'Equatorial Indian Ocean', sst: '29.1°C', mld: '48m', ohc: '85.9 kJ/cm²', salinity: '35.4 PSU', status: 'CTD Cycle 210' },
  { id: 'ARGO-2903333', lat: -1.0, lon: 82.5, basin: 'Central Indian Ridge', sst: '28.6°C', mld: '55m', ohc: '79.3 kJ/cm²', salinity: '35.1 PSU', status: 'Surface Transmit' },
];

export default function HolographicGlobe({
  onSelectFloat,
}: {
  onSelectFloat?: (float: ArgoFloat | null) => void;
}) {
  const globeGroupRef = useRef<THREE.Group>(null);
  const [activeFloat, setActiveFloat] = useState<ArgoFloat | null>(null);
  const [hoveredSat, setHoveredSat] = useState<SatelliteData | null>(null);

  // Procedural globe texture
  const globeTexture = useMemo(() => createGlobeTexture(), []);

  // Compute ARGO positions on radius R=2.0
  const argoPositions = useMemo(() => {
    return ARGO_FLOATS.map((f) => ({
      data: f,
      pos: latLonToVector3(f.lat, f.lon, 2.02),
    }));
  }, []);

  // Smooth rotation
  useFrame((_, delta) => {
    if (globeGroupRef.current) {
      globeGroupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={globeGroupRef} rotation={[0.2, 1.2, -0.05]}>
      {/* ── Main Earth Sphere ── */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshStandardMaterial
          map={globeTexture}
          roughness={0.65}
          metalness={0.25}
          bumpScale={0.04}
          emissive="#021a36"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* ── Luminous Coordinate Wireframe Cage ── */}
      <mesh>
        <sphereGeometry args={[2.03, 36, 18]} />
        <meshBasicMaterial
          color="#06b6d4"
          wireframe
          transparent
          opacity={0.07}
        />
      </mesh>

      {/* ── Atmospheric Fresnel Outer Glow ── */}
      <mesh>
        <sphereGeometry args={[2.18, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.09}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* ── ARGO Float Marker Buoys ── */}
      {argoPositions.map(({ data, pos }, idx) => {
        const isSelected = activeFloat?.id === data.id;

        return (
          <group key={data.id} position={pos}>
            {/* Glowing pin base */}
            <mesh
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                const next = isSelected ? null : data;
                setActiveFloat(next);
                onSelectFloat?.(next);
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
            >
              <sphereGeometry args={[isSelected ? 0.05 : 0.032, 16, 16]} />
              <meshBasicMaterial
                color={isSelected ? '#f43f5e' : idx % 2 === 0 ? '#22d3ee' : '#38bdf8'}
              />
            </mesh>

            {/* Pulsing beacon ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.04, 0.07, 24]} />
              <meshBasicMaterial
                color={isSelected ? '#f43f5e' : '#06b6d4'}
                transparent
                opacity={isSelected ? 0.8 : 0.45}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Interactive Tooltip Card */}
            {isSelected && (
              <Html distanceFactor={6} position={[0, 0.25, 0]} center>
                <div
                  className="p-3.5 rounded-xl text-left pointer-events-auto select-none backdrop-blur-md whitespace-nowrap shadow-2xl"
                  style={{
                    background: 'rgba(2, 14, 28, 0.88)',
                    border: '1px solid rgba(34, 211, 238, 0.4)',
                    boxShadow: '0 0 25px rgba(6, 182, 212, 0.35)',
                    color: '#e2e8f0',
                    fontSize: '11px',
                    minWidth: '220px',
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-cyan-500/20 pb-1.5 mb-2">
                    <span className="font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
                      {data.id}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
                      {data.status}
                    </span>
                  </div>

                  <p className="text-[10px] text-white/50 mb-1.5">{data.basin}</p>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
                    <div>
                      <span className="text-white/40 block text-[9px]">SST</span>
                      <span className="text-emerald-400 font-bold">{data.sst}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[9px]">MLD</span>
                      <span className="text-amber-400 font-bold">{data.mld}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[9px]">OHC</span>
                      <span className="text-cyan-400 font-bold">{data.ohc}</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[9px]">Salinity</span>
                      <span className="text-blue-300 font-bold">{data.salinity}</span>
                    </div>
                  </div>

                  <div className="mt-2 pt-1 border-t border-white/10 flex justify-between text-[9px] text-white/40 font-mono">
                    <span>Lat: {data.lat.toFixed(1)}°N</span>
                    <span>Lon: {data.lon.toFixed(1)}°E</span>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* ── Orbiting Satellite Constellation ── */}
      {SATELLITES.map((sat, i) => (
        <SatelliteNode
          key={sat.name}
          sat={sat}
          index={i}
          isHovered={hoveredSat?.name === sat.name}
          onHover={(s) => setHoveredSat(s)}
        />
      ))}
    </group>
  );
}

// Satellite Subcomponent with Orbit Path and Lidar Scan Cone
function SatelliteNode({
  sat,
  isHovered,
  onHover,
}: {
  sat: SatelliteData;
  index: number;
  isHovered: boolean;
  onHover: (s: SatelliteData | null) => void;
}) {
  const satMeshRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.LineSegments>(null);

  // Compute circular orbit line points
  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 96;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * sat.altitude;
      const z = Math.sin(angle) * sat.altitude;
      const vec = new THREE.Vector3(x, 0, z);
      vec.applyAxisAngle(new THREE.Vector3(1, 0, 0), sat.inclination);
      pts.push(vec);
    }
    return pts;
  }, [sat.altitude, sat.inclination]);

  // Orbit line geometry
  const orbitLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    return geo;
  }, [orbitPoints]);

  // Scan beam geometry (from satellite pos down to globe surface at R=2.0)
  const beamGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    // satellite at origin of satMeshRef, target at surface
    positions[0] = 0; positions[1] = 0; positions[2] = 0;
    positions[3] = 0; positions[4] = -(sat.altitude - 2.0); positions[5] = 0;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [sat.altitude]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * sat.speed + sat.phase;
    const x = Math.cos(t) * sat.altitude;
    const z = Math.sin(t) * sat.altitude;
    const currentPos = new THREE.Vector3(x, 0, z);
    currentPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), sat.inclination);

    if (satMeshRef.current) {
      satMeshRef.current.position.copy(currentPos);
      satMeshRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <>
      {/* Orbital Path Ring */}
      <primitive object={new THREE.Line(orbitLineGeo, new THREE.LineBasicMaterial({
        color: sat.color,
        transparent: true,
        opacity: isHovered ? 0.45 : 0.18,
      }))} />

      {/* Satellite Body & Solar Panels */}
      <group
        ref={satMeshRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(sat);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = 'default';
        }}
      >
        {/* Central bus cube */}
        <mesh>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshStandardMaterial
            color="#e2e8f0"
            metalness={0.8}
            roughness={0.2}
            emissive={sat.color}
            emissiveIntensity={0.4}
          />
        </mesh>

        {/* Solar panels Left */}
        <mesh position={[-0.09, 0, 0]}>
          <boxGeometry args={[0.1, 0.04, 0.005]} />
          <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Solar panels Right */}
        <mesh position={[0.09, 0, 0]}>
          <boxGeometry args={[0.1, 0.04, 0.005]} />
          <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Pulsing Lidar / Altimeter Scan Beam Line */}
        <primitive object={new THREE.LineSegments(beamGeometry, new THREE.LineBasicMaterial({
          color: sat.color,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
        }))} ref={beamRef} />

        {/* Downward Ground Track Radar Footprint Cone */}
        <mesh position={[0, 0, -(sat.altitude - 2.0) * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.14, sat.altitude - 2.0, 16, 1, true]} />
          <meshBasicMaterial
            color={sat.color}
            transparent
            opacity={0.06}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Ground footprint ring on ocean surface */}
        <mesh position={[0, 0, -(sat.altitude - 2.0)]}>
          <ringGeometry args={[0.12, 0.16, 24]} />
          <meshBasicMaterial
            color={sat.color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Satellite Info Tag on Hover */}
        {isHovered && (
          <Html distanceFactor={7} position={[0, 0.18, 0]} center>
            <div
              className="px-2.5 py-1.5 rounded-lg text-left backdrop-blur-md pointer-events-none whitespace-nowrap shadow-xl"
              style={{
                background: 'rgba(3, 15, 30, 0.92)',
                border: `1px solid ${sat.color}`,
                boxShadow: `0 0 16px ${sat.color}44`,
                fontSize: '10px',
                color: '#fff',
              }}
            >
              <div className="font-bold font-mono" style={{ color: sat.color }}>
                {sat.name}
              </div>
              <div className="text-[9px] text-white/70">{sat.type}</div>
              <div className="text-[8px] text-cyan-300 font-mono">Payload: {sat.sensor}</div>
            </div>
          </Html>
        )}
      </group>
    </>
  );
}