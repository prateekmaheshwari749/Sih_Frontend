import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';

// NASA / three.js public CDN textures (no auth, widely used in WebGL demos)
const EARTH_DAY_MAP =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_NORMAL_MAP =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg';
const EARTH_SPECULAR_MAP =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg';
const EARTH_CLOUDS_MAP =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png';

// ── GLSL Atmosphere Shader (Fresnel / rim glow) ───────────────────────────────
const ATM_VERT = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ATM_FRAG = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float fresnel = pow(rim, 3.5);
    float dayFactor = max(dot(vNormal, normalize(vec3(0.6, 0.4, 0.5))), 0.0);
    vec3 atmColor = mix(vec3(0.15, 0.50, 0.90), vec3(0.35, 0.72, 1.0), dayFactor);
    float alpha = fresnel * 0.65 * (0.4 + dayFactor * 0.6);
    gl_FragColor = vec4(atmColor, alpha);
  }
`;

function Atmosphere() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ATM_VERT,
    fragmentShader: ATM_FRAG,
    uniforms: { sunDirection: { value: new THREE.Vector3(10, 6, 8).normalize() } },
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);
  return <mesh material={mat}><sphereGeometry args={[2.22, 64, 64]} /></mesh>;
}

function AtmosphereInner() {
  return (
    <mesh>
      <sphereGeometry args={[2.07, 48, 48]} />
      <meshBasicMaterial color="#60c8ff" transparent opacity={0.06}
        side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

// ── NASA-textured Earth globe (loaded via Suspense) ───────────────────────────
function TexturedEarthGlobe({
  isPlaying, activeRegion,
}: {
  isPlaying: boolean;
  activeRegion: { lat: number; lon: number; name: string };
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const [dayMap, normalMap, specularMap, cloudsMap] = useLoader(TextureLoader, [
    EARTH_DAY_MAP, EARTH_NORMAL_MAP, EARTH_SPECULAR_MAP, EARTH_CLOUDS_MAP,
  ]);

  useFrame((_, delta) => {
    if (!isPlaying) return;
    if (earthGroupRef.current) earthGroupRef.current.rotation.y += delta * 0.04;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.055;
  });

  return (
    <group ref={earthGroupRef} rotation={[0.25, 1.4, -0.05]}>
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[2.0, 80, 80]} />
        <meshPhongMaterial
          map={dayMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          specularMap={specularMap}
          specular={new THREE.Color('#88bbdd')}
          shininess={18}
        />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.028, 64, 64]} />
        <meshStandardMaterial map={cloudsMap} transparent opacity={0.42}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Atmosphere />
      <AtmosphereInner />
      <RegionTargetMarker lat={activeRegion.lat} lon={activeRegion.lon} name={activeRegion.name} />
    </group>
  );
}

// Coordinate converter: Lat/Lon (degrees) to 3D Cartesian Vector on Sphere
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTOREALISTIC PROCEDURAL EARTH TEXTURE (High-Res 2048 x 1024)
// Features accurate North Indian Ocean bathymetry, coastlines & topography
// ─────────────────────────────────────────────────────────────────────────────
function createDetailedEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep oceanic gradient with realistic oceanic trenches & pelagic zones
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGrad.addColorStop(0, '#031124'); // Arctic
  oceanGrad.addColorStop(0.25, '#051b3b'); // Northern temperate
  oceanGrad.addColorStop(0.5, '#072b54'); // Tropical Indian Ocean / Equator
  oceanGrad.addColorStop(0.75, '#041d3d'); // Southern ocean
  oceanGrad.addColorStop(1, '#020d1c'); // Antarctic
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const toX = (lon: number) => ((lon + 180) / 360) * canvas.width;
  const toY = (lat: number) => ((90 - lat) / 180) * canvas.height;

  // 2. Continental Shelf / Shallow Turquoise Coral Waters around Indian Ocean
  const drawShelf = (coords: [number, number][], blur = 14) => {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.beginPath();
    ctx.moveTo(toX(coords[0][1]), toY(coords[0][0]));
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(toX(coords[i][1]), toY(coords[i][0]));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
    ctx.fill();
    ctx.restore();
  };

  // Shallow shelf buffers
  drawShelf([[35, 65], [20, 68], [8, 75], [8, 82], [22, 92], [28, 85]]);
  drawShelf([[15, 42], [25, 58], [12, 53], [10, 43]]);
  drawShelf([[15, 95], [5, 100], [-8, 115], [-5, 105]]);

  // 3. Landmasses with realistic terrain shading (vegetation & coastal margins)
  const drawDetailedLand = (
    coords: [number, number][],
    fillColor = '#1e382b',
    coastColor = '#38bdf8'
  ) => {
    if (coords.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(toX(coords[0][1]), toY(coords[0][0]));
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(toX(coords[i][1]), toY(coords[i][0]));
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Subtle coastal rim highlight
    ctx.strokeStyle = coastColor;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  };

  // Indian Subcontinent (High-fidelity polygon with peninsula, Gujarat, Sundarbans)
  drawDetailedLand(
    [
      [35, 75], [33, 72], [30, 69], [25, 67], [23, 69], [21.5, 70.5],
      [20.5, 72.8], [18.9, 72.8], [15.5, 73.8], [12.9, 74.8], [9.9, 76.2],
      [8.08, 77.55], // Kanyakumari (Cape Comorin)
      [8.5, 78.2], [10.2, 79.8], [13.1, 80.3], [16.5, 82.2], [19.8, 85.8],
      [21.6, 87.5], [22.4, 89.6], [24.8, 91.5], [26.8, 89.2], [27.5, 85.5],
      [28.8, 80.2], [32.5, 76.5]
    ],
    '#254b34',
    '#22d3ee'
  );

  // Sri Lanka
  drawDetailedLand(
    [[9.8, 80.2], [8.5, 81.6], [6.2, 81.2], [5.9, 80.5], [7.5, 79.8]],
    '#2d5a3c',
    '#38bdf8'
  );

  // Arabian Peninsula (Saudi Arabia, Oman, Yemen, UAE)
  drawDetailedLand(
    [
      [31, 35], [30, 48], [26, 50], [24, 54], [25.5, 56.5], [22.5, 59.8],
      [17, 54.5], [12.8, 45], [14.5, 43], [20, 40], [28, 35]
    ],
    '#4a3f2b', // Arid desert terrain
    '#0ea5e9'
  );

  // Horn of Africa & East African Coast
  drawDetailedLand(
    [
      [12, 51.2], [10.5, 43.5], [4.5, 46], [-2, 41], [-11, 40.5],
      [-24, 34], [-34, 18], [-30, 15], [-15, 12], [0, 9], [12, 33], [15, 39]
    ],
    '#38482f',
    '#0284c7'
  );

  // Madagascar
  drawDetailedLand(
    [[-12, 49.3], [-16, 49.8], [-25.5, 47], [-25, 44], [-16, 44.2]],
    '#2c5438',
    '#0284c7'
  );

  // Southeast Asia (Myanmar, Thailand, Malaysia, Indochina)
  drawDetailedLand(
    [
      [22, 92], [16, 94.5], [12, 98.5], [5, 100.5], [1.3, 103.8],
      [4, 104], [8, 103], [14, 101], [18, 106], [22, 108], [25, 100]
    ],
    '#1e472e',
    '#38bdf8'
  );

  // Indonesian Archipelago (Sumatra, Java)
  drawDetailedLand([[5.5, 95.3], [0, 100], [-5.8, 105.8], [-5.5, 103], [0, 97.5]], '#205032', '#0ea5e9');
  drawDetailedLand([[-6.2, 106], [-7.5, 112], [-8.5, 114.5], [-7.8, 108]], '#205032', '#0ea5e9');

  // Northern Australia
  drawDetailedLand(
    [
      [-11, 131], [-12, 136], [-17, 140], [-22, 149], [-34, 151],
      [-38, 144], [-32, 116], [-20, 115], [-14, 126]
    ],
    '#4d3826',
    '#0284c7'
  );

  // Eurasia simplified backdrop
  drawDetailedLand(
    [
      [36, -6], [44, -1], [54, 10], [60, 28], [68, 55], [60, 80],
      [48, 85], [42, 60], [38, 52], [36, 30]
    ],
    '#2f4433',
    '#0284c7'
  );

  // 4. North Indian Ocean Thermal Warm Pool Overlay (Bay of Bengal >30°C pool)
  const bobX = toX(88);
  const bobY = toY(15);
  const bobPoolGrad = ctx.createRadialGradient(bobX, bobY, 15, bobX, bobY, 180);
  bobPoolGrad.addColorStop(0, 'rgba(239, 68, 68, 0.28)'); // Warm core
  bobPoolGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.16)');
  bobPoolGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = bobPoolGrad;
  ctx.beginPath();
  ctx.arc(bobX, bobY, 180, 0, Math.PI * 2);
  ctx.fill();

  // 5. Somali Upwelling Cold Plume Overlay (Cold upwelling <22°C)
  const somaliX = toX(53);
  const somaliY = toY(10);
  const somaliGrad = ctx.createRadialGradient(somaliX, somaliY, 10, somaliX, somaliY, 140);
  somaliGrad.addColorStop(0, 'rgba(6, 182, 212, 0.40)'); // Cold upwelling
  somaliGrad.addColorStop(0.6, 'rgba(14, 165, 233, 0.15)');
  somaliGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = somaliGrad;
  ctx.beginPath();
  ctx.arc(somaliX, somaliY, 140, 0, Math.PI * 2);
  ctx.fill();

  // 6. Navigation Coordinate Graticule (Subtle Lat/Lon Grid lines)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = toY(lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = toX(lon);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Equator & Tropic of Cancer
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, toY(0));
  ctx.lineTo(canvas.width, toY(0));
  ctx.stroke();

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, toY(23.5));
  ctx.lineTo(canvas.width, toY(23.5));
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL CLOUDS TEXTURE (Alpha transparent wisps)
// ─────────────────────────────────────────────────────────────────────────────
function createCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw tropical cloud bands & vortex swirls
  const drawCloudPuff = (x: number, y: number, r: number, opacity = 0.25) => {
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    grad.addColorStop(0.6, `rgba(240, 248, 255, ${opacity * 0.5})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Intertropical Convergence Zone (ITCZ) cloud bands
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * canvas.width;
    const y = canvas.height * 0.45 + (Math.random() - 0.5) * 80;
    const r = 25 + Math.random() * 45;
    drawCloudPuff(x, y, r, 0.28);
  }

  // Mid-latitude storm spirals
  for (let i = 0; i < 35; i++) {
    const x = Math.random() * canvas.width;
    const y = (Math.random() > 0.5 ? 0.2 : 0.75) * canvas.height + (Math.random() - 0.5) * 60;
    const r = 30 + Math.random() * 50;
    drawCloudPuff(x, y, r, 0.22);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// REALISTIC 3D SATELLITE CRAFT WITH SOLAR WINGS & VOLUMETRIC SCAN RADAR BEAM
// ─────────────────────────────────────────────────────────────────────────────
function RealisticSatellite({
  orbitRadius = 3.1,
  orbitInclination = 0.55,
  orbitSpeed = 0.4,
  isPlaying = true,
  missionColor = '#38bdf8',
  onPositionUpdate,
}: {
  orbitRadius: number;
  orbitInclination: number;
  orbitSpeed: number;
  isPlaying: boolean;
  missionColor: string;
  onPositionUpdate?: (pos: THREE.Vector3) => void;
}) {
  const satGroupRef = useRef<THREE.Group>(null);
  const beamConeRef = useRef<THREE.Mesh>(null);
  const surfaceDiscRef = useRef<THREE.Mesh>(null);

  // Compute circular orbit trajectory line
  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 120;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * orbitRadius;
      const z = Math.sin(angle) * orbitRadius;
      const vec = new THREE.Vector3(x, 0, z);
      vec.applyAxisAngle(new THREE.Vector3(1, 0, 0), orbitInclination);
      pts.push(vec);
    }
    return pts;
  }, [orbitRadius, orbitInclination]);

  const orbitLineGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(orbitPoints);
  }, [orbitPoints]);

  useFrame((state, delta) => {
    if (!satGroupRef.current) return;

    if (isPlaying) {
      const t = state.clock.getElapsedTime() * orbitSpeed;
      const x = Math.cos(t) * orbitRadius;
      const z = Math.sin(t) * orbitRadius;
      const currentPos = new THREE.Vector3(x, 0, z);
      currentPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), orbitInclination);

      satGroupRef.current.position.copy(currentPos);
      // Look at Earth center (0, 0, 0)
      satGroupRef.current.lookAt(0, 0, 0);

      onPositionUpdate?.(currentPos);
    }

    // Pulse scanning cone opacity
    if (beamConeRef.current) {
      const pulse = 0.35 + Math.sin(state.clock.getElapsedTime() * 4) * 0.15;
      (beamConeRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }

    // Rotate surface radar footprint
    if (surfaceDiscRef.current) {
      surfaceDiscRef.current.rotation.z += delta * 2;
    }
  });

  const beamHeight = orbitRadius - 2.0; // Distance from satellite to Earth surface (R=2.0)

  return (
    <>
      {/* Orbital Trajectory Ring */}
      <primitive
        object={
          new THREE.Line(
            orbitLineGeo,
            new THREE.LineBasicMaterial({
              color: missionColor,
              transparent: true,
              opacity: 0.35,
            })
          )
        }
      />

      {/* Satellite Craft Group */}
      <group ref={satGroupRef} position={[orbitRadius, 0, 0]}>
        {/* ── 1. MAIN SATELLITE BUS (Gold Multi-Layer Insulation Foil) ── */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.14, 0.22]} />
          <meshStandardMaterial
            color="#eab308"
            roughness={0.25}
            metalness={0.9}
            emissive="#713f12"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Top Avionics Equipment Deck */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.14, 0.03, 0.18]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* ── 2. DOWNWARD EARTH-OBSERVING SENSOR SUITE (Nadir Port) ── */}
        {/* Thermal Infrared & Microwave Radiometer Lens */}
        <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.05, 0.06, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Sensor Optical Aperture Glow */}
        <mesh position={[0, 0, 0.155]}>
          <circleGeometry args={[0.038, 24]} />
          <meshBasicMaterial color={missionColor} />
        </mesh>

        {/* Radar Altimeter Parabolic Dish Antenna */}
        <mesh position={[0.06, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.04, 0.03, 16, 1, true]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>

        {/* High-Gain Telemetry Feed Horn Antenna (Space-to-Ground Downlink) */}
        <mesh position={[-0.06, 0.09, -0.06]} rotation={[-0.3, 0.2, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.08, 8]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.9} />
        </mesh>

        {/* ── 3. EXTENDED SOLAR PANEL ARRAYS (Twin Wings) ── */}
        {/* Left Solar Panel Truss Boom */}
        <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.14, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>
        {/* Left Solar Wing (Deep Photovoltaic Blue with Gold Bezel) */}
        <group position={[-0.48, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.14, 0.012]} />
            <meshStandardMaterial
              color="#0f2b5c" // Dark photovoltaic blue
              roughness={0.15}
              metalness={0.85}
            />
          </mesh>
          {/* Gold Mounting Frame */}
          <mesh>
            <boxGeometry args={[0.43, 0.15, 0.008]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>

        {/* Right Solar Panel Truss Boom */}
        <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.14, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>
        {/* Right Solar Wing */}
        <group position={[0.48, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.14, 0.012]} />
            <meshStandardMaterial
              color="#0f2b5c"
              roughness={0.15}
              metalness={0.85}
            />
          </mesh>
          {/* Gold Mounting Frame */}
          <mesh>
            <boxGeometry args={[0.43, 0.15, 0.008]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>

        {/* ── 4. VOLUMETRIC RADAR / MICROWAVE SCANNING BEAM CONE ── */}
        {/* Cone points from satellite nadir (z=0.15) down along +Z towards Earth (z=beamHeight) */}
        <group position={[0, 0, 0.15 + beamHeight / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh ref={beamConeRef}>
            <coneGeometry args={[0.32, beamHeight, 32, 1, true]} />
            <meshBasicMaterial
              color={missionColor}
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* ── 5. OCEAN SURFACE SCANNING FOOTPRINT DISC ── */}
        <group position={[0, 0, 0.15 + beamHeight]}>
          {/* Concentric scan ring */}
          <mesh ref={surfaceDiscRef}>
            <ringGeometry args={[0.24, 0.32, 32]} />
            <meshBasicMaterial
              color={missionColor}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Center pinpoint focus dot */}
          <mesh>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NORTH INDIAN OCEAN TARGET HOTSPOT MARKER ON EARTH
// ─────────────────────────────────────────────────────────────────────────────
function RegionTargetMarker({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
  name?: string;
}) {
  const markerPos = useMemo(() => latLonToVector3(lat, lon, 2.03), [lat, lon]);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(state.clock.getElapsedTime() * 4) * 0.25;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={markerPos}>
      {/* Glowing pinpoint sphere */}
      <mesh>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#f43f5e" />
      </mesh>
      {/* Animated target ring */}
      <mesh ref={ringRef} lookAt={() => new THREE.Vector3(0, 0, 0)}>
        <ringGeometry args={[0.06, 0.085, 24]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROTATING EARTH GLOBE COMPONENT WITH ATMOSPHERE & CLOUD COVER
// ─────────────────────────────────────────────────────────────────────────────
// ── Procedural fallback Earth (shown while CDN textures load) ────────────────
function ProceduralEarth({
  isPlaying, activeRegion,
}: {
  isPlaying: boolean;
  activeRegion: { lat: number; lon: number; name: string };
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const earthTexture = useMemo(() => createDetailedEarthTexture(), []);
  const cloudsTexture = useMemo(() => createCloudTexture(), []);

  useFrame((_, delta) => {
    if (!isPlaying) return;
    if (earthGroupRef.current) earthGroupRef.current.rotation.y += delta * 0.04;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.055;
  });

  return (
    <group ref={earthGroupRef} rotation={[0.25, 1.4, -0.05]}>
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshStandardMaterial map={earthTexture} roughness={0.4} metalness={0.2} emissive="#02142b" emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.025, 48, 48]} />
        <meshStandardMaterial map={cloudsTexture} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Atmosphere />
      <AtmosphereInner />
      <RegionTargetMarker lat={activeRegion.lat} lon={activeRegion.lon} name={activeRegion.name} />
    </group>
  );
}

// ── PhotorealisticEarth: tries NASA CDN textures, shows procedural while loading
function PhotorealisticEarth({
  isPlaying, activeRegion,
}: {
  isPlaying: boolean;
  activeRegion: { lat: number; lon: number; name: string };
}) {
  return (
    <Suspense fallback={<ProceduralEarth isPlaying={isPlaying} activeRegion={activeRegion} />}>
      <TexturedEarthGlobe isPlaying={isPlaying} activeRegion={activeRegion} />
    </Suspense>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED MAIN 3D REAL SATELLITE & EARTH CANVAS SCENE
// ─────────────────────────────────────────────────────────────────────────────
export default function RealSatelliteEarthScene({
  activeMissionId,
  activeRegion,
  isPlaying,
}: {
  activeMissionId: string;
  activeRegion: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    sst: number;
    sss: number;
    ssh: number;
    wind: number;
  };
  isPlaying: boolean;
}) {
  // Mission orbital configuration presets
  const missionConfig = useMemo(() => {
    switch (activeMissionId) {
      case 'insat3d':
        return {
          orbitRadius: 3.4,
          orbitInclination: 0.15,
          orbitSpeed: 0.25,
          color: '#f59e0b',
        };
      case 'smap':
        return {
          orbitRadius: 2.95,
          orbitInclination: 1.1,
          orbitSpeed: 0.5,
          color: '#10b981',
        };
      case 'metop':
        return {
          orbitRadius: 3.05,
          orbitInclination: -0.95,
          orbitSpeed: 0.42,
          color: '#a855f7',
        };
      case 'sentinel3':
      default:
        return {
          orbitRadius: 3.1,
          orbitInclination: 0.65,
          orbitSpeed: 0.38,
          color: '#38bdf8',
        };
    }
  }, [activeMissionId]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#01050e]" style={{ touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, 1.8, 5.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.75]}
      >
        {/* Deep Space Starfield */}
        <Stars radius={100} depth={50} count={2400} factor={4} saturation={0.5} fade speed={1} />

        {/* Ambient — dark side stays subtly lit, not pitch black */}
        <ambientLight intensity={0.18} color="#c8e8ff" />

        {/* Primary sun — strong directional from upper-right creates sharp day/night terminator */}
        <directionalLight position={[10, 6, 8]} intensity={3.5} color="#fff8f0" castShadow />

        {/* Blue earthshine fill on night hemisphere */}
        <directionalLight position={[-8, -4, -6]} intensity={0.3} color="#1a6fa8" />

        {/* Warm horizon accent */}
        <pointLight position={[6, -2, 4]} intensity={0.6} color="#ff8844" distance={20} />

        {/* Photorealistic 3D Earth (NASA textures + GLSL atmosphere) */}
        <PhotorealisticEarth isPlaying={isPlaying} activeRegion={activeRegion} />

        {/* Realistic Orbiting Satellite with Solar Arrays & Volumetric Radar Swath */}
        <RealisticSatellite
          orbitRadius={missionConfig.orbitRadius}
          orbitInclination={missionConfig.orbitInclination}
          orbitSpeed={missionConfig.orbitSpeed}
          isPlaying={isPlaying}
          missionColor={missionConfig.color}
        />

        {/* Interactive Camera Orbit Controls */}
        <OrbitControls
          makeDefault
          enableRotate
          enableZoom
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.65}
          zoomSpeed={0.8}
          minDistance={3.6}
          maxDistance={7.5}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI - 0.15}
        />
      </Canvas>

      {/* Floating 3D Navigation Hint */}
      <div className="absolute bottom-3 left-3 pointer-events-none z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-white/15 text-[10px] font-mono text-white/75 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span>Drag to rotate · Scroll or pinch to zoom</span>
      </div>
    </div>
  );
}
