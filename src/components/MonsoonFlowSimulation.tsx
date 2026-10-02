import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Compass,
  Play,
  Pause,
  Wind,
  Waves,
  Info,
  Sparkles,
} from 'lucide-react';

export type MonsoonSeason = 'sw' | 'ne' | 'transition';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  size: number;
}

export interface Eddy {
  x: number;
  y: number;
  radius: number;
  strength: number; // positive = anticyclonic (clockwise), negative = cyclonic
  label: string;
}

export default function MonsoonFlowSimulation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [season, setSeason] = useState<MonsoonSeason>('sw');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showEddies, setShowEddies] = useState(true);
  const [showSSTHeatmap, setShowSSTHeatmap] = useState(true);
  const [showVectorGrid, setShowVectorGrid] = useState(false);
  const [selectedRegionInfo, setSelectedRegionInfo] = useState<string | null>(null);

  // Coastline & Basin reference points (normalized 0..1 coordinates)
  // Domain: ~40°E to 105°E (lon), 0°N to 30°N (lat)
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Define season-specific circulation parameters
  const seasonConfig = {
    sw: {
      name: 'Southwest Summer Monsoon (June – Sept)',
      badge: 'Peak Upwelling & Wyrtki Jets',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      description:
        'Intense southwesterly winds drive the famous Somali Current northeastward (>2.5 m/s), creating massive cold upwelling off Somalia & Oman. Strong eastward equatorial Wyrtki Jets transport warm water into the Bay of Bengal.',
      somaliSpeed: 2.6,
      wyrtkiDirection: 1, // Eastward
      eiccDirection: -1, // Southward along East India
      upwellingCold: true,
      eddies: [
        { x: 0.22, y: 0.62, radius: 45, strength: 1.4, label: 'Great Whirl (Anticyclonic)' },
        { x: 0.26, y: 0.48, radius: 36, strength: 1.1, label: 'Socotra Eddy' },
        { x: 0.68, y: 0.46, radius: 40, strength: -1.2, label: 'BoB Cyclonic Gyre' },
        { x: 0.46, y: 0.78, radius: 42, strength: 0.8, label: 'Equatorial Wyrtki Jet' },
      ],
      sstHighlight: 'Cool Somali Coast (19–22°C) · Warm BoB Pool (29–31°C)',
    },
    ne: {
      name: 'Northeast Winter Monsoon (Nov – Feb)',
      badge: 'Current Reversal & Convective Cooling',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      description:
        'Winds reverse from the northeast. The Somali Current completely reverses direction, flowing southwestward toward the equator. The East India Coastal Current (EICC) flows northward. Winter cooling creates deep convective mixing in the northern Arabian Sea.',
      somaliSpeed: -1.8,
      wyrtkiDirection: -1, // Westward
      eiccDirection: 1, // Northward along East India
      upwellingCold: false,
      eddies: [
        { x: 0.24, y: 0.60, radius: 38, strength: -1.0, label: 'Reversed Somali Jet' },
        { x: 0.72, y: 0.42, radius: 38, strength: 1.1, label: 'BoB Anticyclonic Gyre' },
        { x: 0.38, y: 0.32, radius: 40, strength: -0.9, label: 'Northern AS Convective Gyre' },
      ],
      sstHighlight: 'Cool Northern AS (23–25°C) · Warm Equatorial Band (28–29°C)',
    },
    transition: {
      name: 'Pre-Cyclone Transition (May / Oct–Nov)',
      badge: 'High OHC & Thermal Stratification',
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
      description:
        'Inter-monsoon transition with slackening wind stress. High solar insolation builds a deep, stratified upper ocean heat pool (OHC > 95 kJ/cm²) across the Bay of Bengal & Arabian Sea, establishing prime conditions for rapid cyclone intensification.',
      somaliSpeed: 0.8,
      wyrtkiDirection: 0.6,
      eiccDirection: 0.2,
      upwellingCold: false,
      eddies: [
        { x: 0.70, y: 0.50, radius: 48, strength: 1.5, label: 'BoB Warm Core Eddy (RI Fuel)' },
        { x: 0.35, y: 0.52, radius: 42, strength: 1.3, label: 'Arabian Sea Warm Pool' },
        { x: 0.62, y: 0.38, radius: 35, strength: -1.1, label: 'Cyclonic Cold Pumping' },
      ],
      sstHighlight: 'Intense Tropical Warm Pool (>30.5°C) · OHC > 100 kJ/cm²',
    },
  };

  const activeSeason = seasonConfig[season];

  // Initialize particles
  const initParticles = useCallback((count = 450) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    const parts: Particle[] = [];
    for (let i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        age: Math.random() * 100,
        life: 100 + Math.random() * 120,
        color: '#38bdf8',
        size: 1 + Math.random() * 2,
      });
    }
    particlesRef.current = parts;
  }, []);

  // Compute flow velocity vector (u, v) at canvas position (x, y) based on active season
  const getVelocity = useCallback(
    (nx: number, ny: number, seasonKey: MonsoonSeason): [number, number] => {
      let u = 0;
      let v = 0;

      // Somali coastal current region (nx: 0.15 .. 0.32, ny: 0.45 .. 0.85)
      if (nx >= 0.12 && nx <= 0.35 && ny >= 0.38 && ny <= 0.85) {
        if (seasonKey === 'sw') {
          // Flow northeastward along African coast
          u += 1.8;
          v -= 1.6;
        } else if (seasonKey === 'ne') {
          // Reverse southwestward
          u -= 1.4;
          v += 1.3;
        } else {
          u += 0.5;
          v -= 0.4;
        }
      }

      // Equatorial Current & Wyrtki Jets (ny: 0.72 .. 0.95)
      if (ny >= 0.70 && ny <= 0.95) {
        if (seasonKey === 'sw') {
          // Strong eastward Wyrtki Jet
          u += 2.2;
          v += Math.sin(nx * 12) * 0.3;
        } else if (seasonKey === 'ne') {
          // Westward North Equatorial Current
          u -= 1.9;
          v -= Math.sin(nx * 10) * 0.25;
        } else {
          u += 0.9;
          v += Math.cos(nx * 8) * 0.4;
        }
      }

      // Arabian Sea Gyre (nx: 0.25 .. 0.52, ny: 0.25 .. 0.65)
      if (nx >= 0.25 && nx <= 0.52 && ny >= 0.22 && ny <= 0.68) {
        const cx = 0.38;
        const cy = 0.45;
        const dx = nx - cx;
        const dy = ny - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.04 && dist < 0.28) {
          if (seasonKey === 'sw') {
            // Anticyclonic (clockwise) gyre
            u += -dy * 3.5;
            v += dx * 3.5;
          } else {
            // Cyclonic (counter-clockwise) circulation
            u += dy * 3.0;
            v += -dx * 3.0;
          }
        }
      }

      // Bay of Bengal Circulation (nx: 0.60 .. 0.88, ny: 0.25 .. 0.70)
      if (nx >= 0.58 && nx <= 0.88 && ny >= 0.22 && ny <= 0.72) {
        const cx = 0.72;
        const cy = 0.46;
        const dx = nx - cx;
        const dy = ny - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.04 && dist < 0.25) {
          if (seasonKey === 'sw') {
            // Cyclonic gyre in northern BoB + anticyclonic in south
            u += dy * 2.8;
            v += -dx * 2.8;
          } else {
            // Anticyclonic gyre during NE monsoon
            u += -dy * 3.2;
            v += dx * 3.2;
          }
        }

        // East India Coastal Current (EICC) along east coast of India (nx ~ 0.60 .. 0.68)
        if (nx >= 0.58 && nx <= 0.66 && ny >= 0.32 && ny <= 0.62) {
          if (seasonKey === 'sw') {
            // Southward during peak summer
            v += 1.4;
            u -= 0.3;
          } else {
            // Northward during winter
            v -= 1.6;
            u += 0.2;
          }
        }
      }

      // West India Coastal Current (WICC) along west coast of India (nx ~ 0.46 .. 0.54, ny ~ 0.35 .. 0.65)
      if (nx >= 0.45 && nx <= 0.54 && ny >= 0.32 && ny <= 0.65) {
        if (seasonKey === 'sw') {
          // Equatorward (southward) in summer
          v += 1.3;
          u += 0.1;
        } else {
          // Poleward (northward) in winter
          v -= 1.4;
          u -= 0.1;
        }
      }

      // Meso-scale Eddies injection
      const eddies = seasonConfig[seasonKey].eddies;
      for (const eddy of eddies) {
        const dx = nx - eddy.x;
        const dy = ny - eddy.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const eddyNormRadius = eddy.radius / 300;
        if (d < eddyNormRadius) {
          const factor = (1 - d / eddyNormRadius) * eddy.strength * 2.2;
          u += -dy * factor;
          v += dx * factor;
        }
      }

      // Background ambient drift
      u += 0.2;
      v -= 0.1;

      return [u, v];
    },
    []
  );

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas resizing
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initParticles(550);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Dark translucent clear for particle trails
      ctx.fillStyle = 'rgba(2, 11, 24, 0.22)';
      ctx.fillRect(0, 0, w, h);

      // ── Draw SST Thermal Heatmap background if enabled ──
      if (showSSTHeatmap) {
        // Cold Upwelling tongue off Somalia
        if (season === 'sw') {
          const somaliGrad = ctx.createRadialGradient(
            w * 0.22, h * 0.65, 10,
            w * 0.22, h * 0.65, w * 0.25
          );
          somaliGrad.addColorStop(0, 'rgba(14, 165, 233, 0.28)');
          somaliGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.14)');
          somaliGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = somaliGrad;
          ctx.fillRect(0, 0, w, h);
        }

        // Warm Pool in eastern Bay of Bengal & Equatorial Channel
        const warmGrad = ctx.createRadialGradient(
          w * 0.72, h * 0.52, 20,
          w * 0.72, h * 0.52, w * 0.35
        );
        warmGrad.addColorStop(0, season === 'transition' ? 'rgba(239, 68, 68, 0.30)' : 'rgba(249, 115, 22, 0.20)');
        warmGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.12)');
        warmGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = warmGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Draw Schematic Coastlines & Geography Outline ──
      ctx.strokeStyle = 'rgba(130, 220, 240, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.fillStyle = 'rgba(7, 24, 38, 0.55)';

      // Draw Indian Subcontinent Schematic
      ctx.beginPath();
      // Gujarat / Karachi
      ctx.moveTo(w * 0.44, h * 0.12);
      ctx.lineTo(w * 0.46, h * 0.28);
      // West Coast (Mumbai -> Goa -> Kerala)
      ctx.lineTo(w * 0.49, h * 0.46);
      ctx.lineTo(w * 0.54, h * 0.68);
      // Cape Comorin / Kanyakumari
      ctx.lineTo(w * 0.56, h * 0.72);
      // East Coast (Chennai -> Visakhapatnam -> Odisha -> Bengal)
      ctx.lineTo(w * 0.60, h * 0.64);
      ctx.lineTo(w * 0.64, h * 0.48);
      ctx.lineTo(w * 0.70, h * 0.30);
      ctx.lineTo(w * 0.74, h * 0.22);
      ctx.stroke();

      // Sri Lanka
      ctx.beginPath();
      ctx.arc(w * 0.58, h * 0.75, w * 0.022, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12, 38, 58, 0.7)';
      ctx.fill();
      ctx.stroke();

      // Horn of Africa / Somali Coast
      ctx.beginPath();
      ctx.moveTo(w * 0.10, h * 0.42);
      ctx.lineTo(w * 0.18, h * 0.52);
      ctx.lineTo(w * 0.24, h * 0.65);
      ctx.lineTo(w * 0.22, h * 0.88);
      ctx.stroke();

      // Arabian Peninsula
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.20);
      ctx.lineTo(w * 0.32, h * 0.22);
      ctx.lineTo(w * 0.38, h * 0.38);
      ctx.lineTo(w * 0.32, h * 0.45);
      ctx.stroke();

      // Myanmar / Andaman / Sumatra
      ctx.beginPath();
      ctx.moveTo(w * 0.77, h * 0.24);
      ctx.lineTo(w * 0.80, h * 0.45);
      ctx.lineTo(w * 0.83, h * 0.65);
      ctx.lineTo(w * 0.88, h * 0.85);
      ctx.stroke();

      // ── Draw Vector Grid if enabled ──
      if (showVectorGrid) {
        const step = 45;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let gx = 30; gx < w; gx += step) {
          for (let gy = 30; gy < h; gy += step) {
            const nx = gx / w;
            const ny = gy / h;
            const [u, v] = getVelocity(nx, ny, season);
            const len = Math.sqrt(u * u + v * v);
            if (len > 0.1) {
              const arrowLen = Math.min(len * 6, 20);
              const angle = Math.atan2(v, u);
              ctx.beginPath();
              ctx.moveTo(gx, gy);
              ctx.lineTo(gx + Math.cos(angle) * arrowLen, gy + Math.sin(angle) * arrowLen);
              ctx.stroke();
            }
          }
        }
      }

      // ── Draw Mesoscale Eddies if enabled ──
      if (showEddies) {
        const eddies = seasonConfig[season].eddies;
        for (const eddy of eddies) {
          const ex = eddy.x * w;
          const ey = eddy.y * h;
          const isAnticyclonic = eddy.strength > 0;

          // Outer pulsing ring
          ctx.beginPath();
          ctx.arc(ex, ey, eddy.radius, 0, Math.PI * 2);
          ctx.strokeStyle = isAnticyclonic
            ? 'rgba(249, 115, 22, 0.45)'
            : 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Center icon & label
          ctx.beginPath();
          ctx.arc(ex, ey, 4, 0, Math.PI * 2);
          ctx.fillStyle = isAnticyclonic ? '#f97316' : '#38bdf8';
          ctx.fill();

          ctx.font = '10px monospace';
          ctx.fillStyle = isAnticyclonic ? '#fed7aa' : '#bae6fd';
          ctx.fillText(eddy.label, ex + 10, ey + 3);
        }
      }

      // ── Update & Render Flow Particles ──
      if (isPlaying) {
        const speed = speedMultiplier * 55;
        const parts = particlesRef.current;

        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const nx = p.x / w;
          const ny = p.y / h;

          const [u, v] = getVelocity(nx, ny, season);
          p.x += u * speed * dt;
          p.y += v * speed * dt;
          p.age += 1;

          // Color based on velocity & thermal properties
          const vel = Math.sqrt(u * u + v * v);
          if (season === 'sw' && nx < 0.32 && ny > 0.45) {
            // Cold upwelling particle
            p.color = '#38bdf8';
          } else if (vel > 2.0) {
            // High speed jet (Wyrtki Jet or Somali Jet)
            p.color = '#fbbf24';
          } else if (nx > 0.65 && ny > 0.4) {
            // Warm Bay of Bengal pool
            p.color = '#f97316';
          } else {
            p.color = '#06b6d4';
          }

          // Draw particle streak
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Wrap or respawn
          if (p.x < 0 || p.x > w || p.y < 0 || p.y > h || p.age > p.life) {
            p.x = Math.random() * w;
            p.y = Math.random() * h;
            p.age = 0;
            p.life = 90 + Math.random() * 110;
          }
        }
      }

      // Geographic Watermark Labels
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillText('ARABIAN SEA', w * 0.32, h * 0.48);
      ctx.fillText('BAY OF BENGAL', w * 0.68, h * 0.42);
      ctx.fillText('EQUATORIAL CHANNEL (WYRTKI JET)', w * 0.38, h * 0.88);
      ctx.fillText('SOMALI BASIN', w * 0.14, h * 0.72);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [
    season,
    isPlaying,
    speedMultiplier,
    showEddies,
    showSSTHeatmap,
    showVectorGrid,
    getVelocity,
    initParticles,
  ]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-sky-200 dark:border-cyan-500/20 bg-[#010b17] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      {/* Top Console Bar */}
      <div
        className="p-5 sm:p-6 border-b border-sky-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{ backgroundColor: 'rgba(248, 253, 255, 0.95)' }}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
            <span className="text-xs font-mono tracking-wider uppercase font-black" style={{ color: '#005088' }}>
              Hydrodynamic Surface Velocity &amp; Gyre Simulation
            </span>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${activeSeason.badgeColor}`}>
              {activeSeason.badge}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: '#002f52' }}>
            North Indian Ocean Seasonal Circulation Engine
          </h2>
          <p className="text-xs sm:text-sm font-semibold max-w-2xl leading-relaxed" style={{ color: '#003355' }}>
            {activeSeason.description}
          </p>
        </div>

        {/* Season Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-sky-50/90 border border-sky-200 self-stretch md:self-auto justify-center font-mono">
          <button
            onClick={() => setSeason('sw')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
            style={
              season === 'sw'
                ? { backgroundColor: '#ea580c', color: '#ffffff', borderColor: '#c2410c', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)' }
                : { backgroundColor: '#ffffff', color: '#002f52', borderColor: '#bae6fd' }
            }
          >
            SW Summer Monsoon
          </button>
          <button
            onClick={() => setSeason('ne')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
            style={
              season === 'ne'
                ? { backgroundColor: '#0284c7', color: '#ffffff', borderColor: '#0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }
                : { backgroundColor: '#ffffff', color: '#002f52', borderColor: '#bae6fd' }
            }
          >
            NE Winter Monsoon
          </button>
          <button
            onClick={() => setSeason('transition')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border"
            style={
              season === 'transition'
                ? { backgroundColor: '#7c3aed', color: '#ffffff', borderColor: '#6d28d9', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }
                : { backgroundColor: '#ffffff', color: '#002f52', borderColor: '#bae6fd' }
            }
          >
            Pre-Cyclone Transition
          </button>
        </div>
      </div>

      {/* Main Interactive Flow Canvas */}
      <div className="relative w-full h-[460px] sm:h-[540px] bg-[#020b17] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width;
            const ny = (e.clientY - rect.top) / rect.height;
            const [u, v] = getVelocity(nx, ny, season);
            const speed = Math.sqrt(u * u + v * v).toFixed(2);
            setSelectedRegionInfo(
              `Coordinates: ${(5 + (1 - ny) * 25).toFixed(1)}°N, ${(45 + nx * 60).toFixed(1)}°E · Velocity: ${speed} m/s · Current Vector: U=${u.toFixed(2)}, V=${v.toFixed(2)}`
            );
          }}
        />

        {/* Floating Controls Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-xl pointer-events-auto">
          {/* Play / Speed Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-mono">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeedMultiplier(s)}
                  className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                    speedMultiplier === s
                      ? 'bg-cyan-500 text-white font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Layer Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setShowEddies(!showEddies)}
              className={`px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                showEddies
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <Compass size={13} />
              Mesoscale Eddies
            </button>

            <button
              onClick={() => setShowSSTHeatmap(!showSSTHeatmap)}
              className={`px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                showSSTHeatmap
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <Waves size={13} />
              SST Thermal Pool
            </button>

            <button
              onClick={() => setShowVectorGrid(!showVectorGrid)}
              className={`px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                showVectorGrid
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <Wind size={13} />
              Vector Field
            </button>
          </div>

          {/* Thermal Summary Badge */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-white/70">
            <Sparkles size={13} className="text-amber-400" />
            <span>{activeSeason.sstHighlight}</span>
          </div>
        </div>

        {/* Click Inspection Toast */}
        {selectedRegionInfo && (
          <div className="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-black/85 border border-cyan-400/40 text-xs font-mono text-cyan-200 shadow-2xl flex items-center gap-2">
            <Info size={14} className="text-cyan-400 shrink-0" />
            <span>{selectedRegionInfo}</span>
            <button
              onClick={() => setSelectedRegionInfo(null)}
              className="text-white/40 hover:text-white text-xs ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Physics Footer Details */}
      <div className="p-4 sm:p-5 border-t border-sky-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs" style={{ backgroundColor: 'rgba(248, 253, 255, 0.95)' }}>
        <div className="p-3 rounded-xl bg-white border-2 border-black space-y-1 shadow-sm">
          <p className="font-black uppercase text-[11px] tracking-wider text-amber-700">
            Somali Upwelling &amp; Reversal
          </p>
          <p className="text-slate-800 leading-relaxed font-medium" style={{ color: '#1e293b' }}>
            The world&apos;s only seasonally reversing western boundary current. Upwelling lowers SST to &lt;20°C, enriching fisheries while modulating monsoon moisture.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white border-2 border-black space-y-1 shadow-sm">
          <p className="font-black uppercase text-[11px] tracking-wider text-[#005088]">
            Equatorial Wyrtki Jets
          </p>
          <p className="text-slate-800 leading-relaxed font-medium" style={{ color: '#1e293b' }}>
            Semi-annual eastward jet currents peaking during monsoon transitions (~May and ~Nov), pushing warm water into the eastern equatorial Indian Ocean.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white border-2 border-black space-y-1 shadow-sm">
          <p className="font-black uppercase text-[11px] tracking-wider text-red-700">
            Mesoscale Eddy Thermal Pumping
          </p>
          <p className="text-slate-800 leading-relaxed font-medium" style={{ color: '#1e293b' }}>
            Anticyclonic warm-core eddies depress the thermocline by up to 50m, trapping huge OHC (&gt;90 kJ/cm²) that feeds violent cyclone rapid intensification.
          </p>
        </div>
      </div>
    </div>
  );
}
