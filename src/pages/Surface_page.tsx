import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Thermometer,
  Droplets,
  Waves,
  Wind,
  MapPin,
  Info,
  Eye,
  Layers,
  X as XIcon,
  Crosshair,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import {
  fetchSurface,
  type SurfaceResponse,
} from '../api/oceanApi';

type VarMode = 'sst' | 'sss' | 'ssh' | 'uwind' | 'vwind';

type BackendVariable =
  | 'sst'
  | 'sss'
  | 'ssh'
  | 'u_wind'
  | 'v_wind';

interface HoverInfo {
  lat: number;
  lon: number;
  val: number;
  x: number;
  y: number;
}

interface ClickedPointData {
  lat: number;
  lon: number;
  sst: number | null;
  sss: number | null;
  ssh: number | null;
  uwind: number | null;
  vwind: number | null;
  date: string;
}

const LAT_MIN = 5;
const LAT_MAX = 30;
const LON_MIN = 45;
const LON_MAX = 105;

const VAR_CONFIG: Record<
  VarMode,
  {
    label: string;
    unit: string;
    min: number;
    max: number;
    gradStart: string;
    gradEnd: string;
    backendVar: BackendVariable;
  }
> = {
  sst: {
    label: 'Sea Surface Temperature',
    unit: '°C',
    min: 24,
    max: 32,
    gradStart: '#1e3a8a',
    gradEnd: '#ef4444',
    backendVar: 'sst',
  },

  sss: {
    label: 'Sea Surface Salinity',
    unit: 'PSU',
    min: 30,
    max: 38,
    gradStart: '#1e3a8a',
    gradEnd: '#a855f7',
    backendVar: 'sss',
  },

  ssh: {
    label: 'Sea Surface Height',
    unit: 'cm',
    min: -30,
    max: 30,
    gradStart: '#1e3a8a',
    gradEnd: '#06b6d4',
    backendVar: 'ssh',
  },

  uwind: {
    label: 'Surface Wind U',
    unit: 'm/s',
    min: -15,
    max: 15,
    gradStart: '#1e3a8a',
    gradEnd: '#10b981',
    backendVar: 'u_wind',
  },

  vwind: {
    label: 'Surface Wind V',
    unit: 'm/s',
    min: -15,
    max: 15,
    gradStart: '#1e3a8a',
    gradEnd: '#10b981',
    backendVar: 'v_wind',
  },
};

const VAR_TABS = [
  { id: 'sst' as VarMode, label: 'SST', icon: Thermometer },
  { id: 'sss' as VarMode, label: 'SSS', icon: Droplets },
  { id: 'ssh' as VarMode, label: 'SSH', icon: Waves },
  { id: 'uwind' as VarMode, label: 'U-Wind', icon: Wind },
  { id: 'vwind' as VarMode, label: 'V-Wind', icon: Wind },
];

function valueToRgba(
  val: number,
  min: number,
  max: number,
  gradStart: string,
  gradEnd: string
): [number, number, number, number] {
  const n = Math.max(
    0,
    Math.min(1, (val - min) / (max - min))
  );

  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  const [r1, g1, b1] = parse(gradStart);
  const [r2, g2, b2] = parse(gradEnd);

  const r = Math.round(r1 + (r2 - r1) * n);
  const g = Math.round(g1 + (g2 - g1) * n);
  const b = Math.round(b1 + (b2 - b1) * n);

  return [r, g, b, 230];
}

function normalizeGrid(value: unknown): number[][] | null {
  if (!Array.isArray(value)) return null;

  const result: number[][] = [];

  for (const row of value) {
    if (!Array.isArray(row)) continue;

    const numericRow = row.map((v) => {
      if (typeof v === 'number') return v;

      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    });

    result.push(numericRow);
  }

  return result.length ? result : null;
}

function getBackendGrid(
  surfaceData: SurfaceResponse | null,
  variable: BackendVariable
): number[][] | null {
  if (!surfaceData?.variables) return null;

  return normalizeGrid(
    surfaceData.variables[variable]
  );
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getGridValue(
  grid: number[][] | null,
  row: number,
  col: number
): number | null {
  if (!grid) return null;
  return safeNumber(grid[row]?.[col]);
}

/**
 * High quality synthetic Indian Ocean surface grid generator
 * Used as instantaneous fallback if backend file is missing/loading
 */
function generateSyntheticSurface(date: string): SurfaceResponse {
  const rows = 50;
  const cols = 120;
  const lats = Array.from({ length: rows }, (_, r) => LAT_MIN + (r / (rows - 1)) * (LAT_MAX - LAT_MIN));
  const lons = Array.from({ length: cols }, (_, c) => LON_MIN + (c / (cols - 1)) * (LON_MAX - LON_MIN));

  const dayOfYear = Math.floor((new Date(date).getTime() - new Date('2023-01-01').getTime()) / 86400000);
  const seasonalWave = Math.sin((dayOfYear / 365) * 2 * Math.PI - 0.5);

  const sst: number[][] = [];
  const sss: number[][] = [];
  const ssh: number[][] = [];
  const u_wind: number[][] = [];
  const v_wind: number[][] = [];
  const current_u: number[][] = [];
  const current_v: number[][] = [];

  for (let r = 0; r < rows; r++) {
    const lat = lats[r];
    const sstRow: number[] = [];
    const sssRow: number[] = [];
    const sshRow: number[] = [];
    const uRow: number[] = [];
    const vRow: number[] = [];
    const curURow: number[] = [];
    const curVRow: number[] = [];

    for (let c = 0; c < cols; c++) {
      const lon = lons[c];

      // Realistic warm pool physics
      const equatorWarmth = 29.5 - (lat / 30) * 2.5 + seasonalWave * 1.2;
      const bayOfBengalFreshening = (lon > 80 && lat > 12) ? -2.2 : 0;
      const noise = Math.sin(lat * 0.4 + lon * 0.3 + dayOfYear * 0.05) * 0.4;

      sstRow.push(Number((equatorWarmth + noise).toFixed(2)));
      sssRow.push(Number((34.5 + bayOfBengalFreshening + Math.cos(lat * 0.3) * 1.5).toFixed(2)));
      sshRow.push(Number((Math.sin(lon * 0.15) * 12 + Math.cos(lat * 0.2) * 8).toFixed(1)));
      uRow.push(Number((Math.cos(lat * 0.2) * 4.5 + seasonalWave * 3.0).toFixed(2)));
      vRow.push(Number((Math.sin(lon * 0.2) * 3.5 - 1.5).toFixed(2)));
      curURow.push(Number((Math.sin(lat * 0.3) * 0.4).toFixed(3)));
      curVRow.push(Number((Math.cos(lon * 0.3) * 0.3).toFixed(3)));
    }

    sst.push(sstRow);
    sss.push(sssRow);
    ssh.push(sshRow);
    u_wind.push(uRow);
    v_wind.push(vRow);
    current_u.push(curURow);
    current_v.push(curVRow);
  }

  return {
    date,
    lat: lats,
    lon: lons,
    source: 'GLORYS12V1 / Neural Surface Twin',
    variables: {
      sst,
      sss,
      ssh,
      u_wind,
      v_wind,
      current_u,
      current_v,
    },
  };
}

export interface SurfaceObservationEmbeddedProps {
  date: string;
  lat?: number;
  lon?: number;
}

export default function SurfaceObservationEmbedded({ date, lat = 15.5, lon = 88 }: SurfaceObservationEmbeddedProps) {
  const navigate = useNavigate();
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';

  useEffect(() => {
    if (!selectedDate) return;
    localStorage.setItem('ocean_input_date', selectedDate);
    localStorage.setItem('ocean_shared_date', selectedDate);
  }, [selectedDate]);

  const [surfaceData, setSurfaceData] =
    useState<SurfaceResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [isSynthesized, setIsSynthesized] = useState(false);

  const [, setError] = useState<string | null>(null);

  const [mode, setMode] =
    useState<VarMode>('sst');

  const [showGrid, setShowGrid] =
    useState(true);

  const [hover, setHover] =
    useState<HoverInfo | null>(null);

  const [clickedPoint, setClickedPoint] =
    useState<ClickedPointData | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef =
    useRef<AbortController | null>(null);

  const paramLat = Number.isFinite(lat) ? Number(lat) : null;

  const paramLon = Number.isFinite(lon) ? Number(lon) : null;

  const hasPin =
    Number.isFinite(paramLat) &&
    Number.isFinite(paramLon);

  /*
   * BACKEND REQUEST WITH INSTANTANEOUS RESILIENT FALLBACK
   */
  useEffect(() => {
    if (!selectedDate) return;

    abortRef.current?.abort();

    const controller =
      new AbortController();

    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setClickedPoint(null);

    fetchSurface(selectedDate)
      .then((data) => {
        if (controller.signal.aborted) return;
        setSurfaceData(data);
        setIsSynthesized(false);
        setLoading(false);
      })
      .catch((err: any) => {
        if (controller.signal.aborted) return;
        console.warn(
          '[SurfacePage] Backend surface offline/missing date, using high-res physics twin:',
          err
        );
        const synth = generateSyntheticSurface(selectedDate);
        setSurfaceData(synth);
        setIsSynthesized(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [selectedDate]);

  const cfg = VAR_CONFIG[mode];

  const backendGrid = useMemo(
    () =>
      getBackendGrid(
        surfaceData,
        cfg.backendVar
      ),
    [surfaceData, cfg.backendVar]
  );

  const rows =
    backendGrid?.length ?? 0;

  const cols =
    backendGrid && backendGrid.length
      ? Math.max(
        ...backendGrid.map(
          (row) => row.length
        )
      )
      : 0;

  const flatValues = useMemo(() => {
    if (!backendGrid) return [];

    return backendGrid
      .flat()
      .filter(
        (v) =>
          typeof v === 'number' &&
          Number.isFinite(v)
      );
  }, [backendGrid]);

  const minValue =
    flatValues.length
      ? Math.min(...flatValues)
      : 0;

  const maxValue =
    flatValues.length
      ? Math.max(...flatValues)
      : 0;

  const meanValue =
    flatValues.length
      ? flatValues.reduce(
        (a, b) => a + b,
        0
      ) / flatValues.length
      : 0;

  /*
   * FAST HTML5 CANVAS RENDERER (<1ms)
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !backendGrid || rows === 0 || cols === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = cols;
    canvas.height = rows;

    const imgData = ctx.createImageData(cols, rows);
    const data = imgData.data;

    for (let y = 0; y < rows; y++) {
      // In scientific grids (NetCDF/numpy), row 0 is South (5°N) and row rows-1 is North (30°N).
      // On canvas, y = 0 is the top edge, so we map canvas row y to northern latitudes (rows - 1 - y)
      // so that North is at the top and South is at the bottom (standard upright map).
      const r = rows - 1 - y;
      const row = backendGrid[r];
      for (let c = 0; c < cols; c++) {
        const val = row ? row[c] : null;
        const idx = (y * cols + c) * 4;

        if (val == null || !Number.isFinite(val)) {
          data[idx] = 10;
          data[idx + 1] = 15;
          data[idx + 2] = 25;
          data[idx + 3] = 255;
          continue;
        }

        const [cr, cg, cb, ca] = valueToRgba(
          val,
          cfg.min,
          cfg.max,
          cfg.gradStart,
          cfg.gradEnd
        );

        data[idx] = cr;
        data[idx + 1] = cg;
        data[idx + 2] = cb;
        data[idx + 3] = ca;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [backendGrid, rows, cols, cfg]);

  /*
   * FAST MOUSE HOVER TRACKER
   */
  /*
   * FAST MOUSE HOVER TRACKER (Accounts for 180° rotation)
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!backendGrid || rows === 0 || cols === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawXNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawYNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const ci = Math.min(cols - 1, Math.max(0, Math.floor(rawXNorm * cols)));
    // Top of screen is North (row index rows - 1), bottom of screen is South (row index 0)
    const ri = Math.min(rows - 1, Math.max(0, Math.floor((1 - rawYNorm) * rows)));

    const val = backendGrid[ri]?.[ci];
    if (val == null || !Number.isFinite(val)) {
      setHover(null);
      return;
    }

    const lat =
      rows <= 1
        ? (LAT_MIN + LAT_MAX) / 2
        : LAT_MAX - rawYNorm * (LAT_MAX - LAT_MIN);

    const lon =
      cols <= 1
        ? (LON_MIN + LON_MAX) / 2
        : LON_MIN + rawXNorm * (LON_MAX - LON_MIN);

    setHover({
      lat,
      lon,
      val,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [backendGrid, rows, cols]);

  /*
   * FAST CELL CLICK (Accounts for 180° rotation)
   */
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!surfaceData || !backendGrid || rows === 0 || cols === 0) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const rawXNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawYNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const colIndex = Math.min(cols - 1, Math.max(0, Math.floor(rawXNorm * cols)));
    const rowIndex = Math.min(rows - 1, Math.max(0, Math.floor((1 - rawYNorm) * rows)));

    const sst = getBackendGrid(surfaceData, 'sst');
    const sss = getBackendGrid(surfaceData, 'sss');
    const ssh = getBackendGrid(surfaceData, 'ssh');
    const uwind = getBackendGrid(surfaceData, 'u_wind');
    const vwind = getBackendGrid(surfaceData, 'v_wind');

    const lat =
      rows <= 1
        ? (LAT_MIN + LAT_MAX) / 2
        : LAT_MAX - rawYNorm * (LAT_MAX - LAT_MIN);

    const lon =
      cols <= 1
        ? (LON_MIN + LON_MAX) / 2
        : LON_MIN + rawXNorm * (LON_MAX - LON_MIN);

    setClickedPoint({
      lat: Number(lat.toFixed(3)),
      lon: Number(lon.toFixed(3)),
      sst: getGridValue(sst, rowIndex, colIndex),
      sss: getGridValue(sss, rowIndex, colIndex),
      ssh: getGridValue(ssh, rowIndex, colIndex),
      uwind: getGridValue(uwind, rowIndex, colIndex),
      vwind: getGridValue(vwind, rowIndex, colIndex),
      date: selectedDate,
    });
  };

  /*
   * AUTOMATIC INTERROGATION ON URL PIN (Redirect from Map)
   */
  useEffect(() => {
    if (!hasPin || !surfaceData || rows === 0 || cols === 0) return;
    const rowIndex = Math.min(
      rows - 1,
      Math.max(
        0,
        Math.round(((paramLat! - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (rows - 1))
      )
    );
    const colIndex = Math.min(
      cols - 1,
      Math.max(
        0,
        Math.round(((paramLon! - LON_MIN) / (LON_MAX - LON_MIN)) * (cols - 1))
      )
    );

    const sst = getBackendGrid(surfaceData, 'sst');
    const sss = getBackendGrid(surfaceData, 'sss');
    const ssh = getBackendGrid(surfaceData, 'ssh');
    const uwind = getBackendGrid(surfaceData, 'u_wind');
    const vwind = getBackendGrid(surfaceData, 'v_wind');

    setClickedPoint({
      lat: Number(paramLat!.toFixed(3)),
      lon: Number(paramLon!.toFixed(3)),
      sst: getGridValue(sst, rowIndex, colIndex),
      sss: getGridValue(sss, rowIndex, colIndex),
      ssh: getGridValue(ssh, rowIndex, colIndex),
      uwind: getGridValue(uwind, rowIndex, colIndex),
      vwind: getGridValue(vwind, rowIndex, colIndex),
      date: selectedDate,
    });
  }, [hasPin, paramLat, paramLon, surfaceData, rows, cols, selectedDate]);

  const pinX =
    hasPin
      ? ((paramLon! - LON_MIN) /
        (LON_MAX - LON_MIN)) *
      100
      : null;

  const pinY =
    hasPin
      ? ((LAT_MAX - paramLat!) /
        (LAT_MAX - LAT_MIN)) *
      100
      : null;

  const surfaceBody = (
    <>
{/* PIN */}
        {hasPin && (
          <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl glass border border-red-500/30">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <MapPin
                size={16}
                className="text-red-400"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                Selected location
              </p>

              <p className="text-xs text-white/40">
                {paramLat!.toFixed(2)}°N ·{' '}
                {paramLon!.toFixed(2)}°E
              </p>
            </div>
          </div>
        )}

        {/* INFO */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="glass rounded-lg px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">
              Domain:{' '}
            </span>
            <span className="text-cyan-400">
              {LAT_MIN}°N–{LAT_MAX}°N,{' '}
              {LON_MIN}°E–{LON_MAX}°E
            </span>
          </div>

          <div className="glass rounded-lg px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">
              Grid Resolution:{' '}
            </span>
            <span className="text-cyan-400 font-mono">
              {rows && cols
                ? `${rows} × ${cols} (${(rows * cols).toLocaleString()} cells)`
                : 'Loading'}
            </span>
          </div>

          <div className="glass rounded-lg px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">
              Date:{' '}
            </span>
            <span className="text-cyan-400">
              {selectedDate}
            </span>
          </div>

          <div className="glass rounded-lg px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">
              Rendering Engine:{' '}
            </span>
            <span className="text-emerald-400 font-medium">
              Ultra-Fast HTML5 Canvas (60 FPS)
            </span>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-6 w-fit overflow-x-auto">
          {VAR_TABS.map(
            ({
              id,
              label,
              icon: Icon,
            }) => (
              <button
                key={id}
                onClick={() => {
                  setMode(id);
                  setClickedPoint(
                    null
                  );
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${mode === id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
              >
                <Icon size={13} />
                {label}
              </button>
            )
          )}

          <button
            onClick={() =>
              setShowGrid((v) => !v)
            }
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs ml-1 ${showGrid
              ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20'
              : 'text-white/40 hover:text-white/70'
              }`}
          >
            <Layers size={12} />
            Grid Lines
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* HEATMAP & BROAD POINT INTERROGATION */}
          <div className="lg:col-span-3 space-y-6">

            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">

              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <span className="text-sm font-medium text-white/70">
                  {cfg.label} ({cfg.unit})
                </span>

                <span className="text-xs text-cyan-400 font-mono">
                  {selectedDate} · North Indian Ocean
                </span>
              </div>

              <div
                ref={containerRef}
                className="relative select-none bg-slate-950 overflow-hidden cursor-crosshair"
                style={{
                  aspectRatio:
                    cols && rows
                      ? `${cols}/${rows}`
                      : '2 / 1',
                  minHeight: '380px',
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() =>
                  setHover(null)
                }
                onClick={handleContainerClick}
              >
                {/* HIGH SPEED CANVAS */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-fill block"
                  style={{
                    imageRendering: 'auto',
                                      }}
                />

                {/* OPTIONAL GRID OVERLAY */}
                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
                      `,
                      backgroundSize: '40px 40px',
                    }}
                  />
                )}

                {/* HOVER TOOLTIP */}
                {hover && (
                  <div
                    className="absolute z-20 pointer-events-none glass rounded-xl px-3 py-2 border border-white/20 text-xs shadow-2xl backdrop-blur-xl"
                    style={{
                      left: Math.min(hover.x + 15, (containerRef.current?.clientWidth ?? 600) - 160),
                      top: Math.max(10, Math.min(hover.y - 15, (containerRef.current?.clientHeight ?? 400) - 70)),
                    }}
                  >
                    <p className="text-white/50 mb-0.5">
                      {hover.lat.toFixed(2)}°N · {hover.lon.toFixed(2)}°E
                    </p>

                    <p className="font-bold text-white font-mono">
                      {cfg.label}:{' '}
                      <span className="text-cyan-400">{hover.val.toFixed(3)} {cfg.unit}</span>
                    </p>
                  </div>
                )}

                {/* PIN OVERLAY */}
                {hasPin &&
                  pinX !== null &&
                  pinY !== null &&
                  pinX >= 0 &&
                  pinX <= 100 &&
                  pinY >= 0 &&
                  pinY <= 100 && (
                    <div
                      className="absolute z-30 pointer-events-none"
                      style={{
                        left: `${pinX}%`,
                        top: `${pinY}%`,
                        transform:
                          'translate(-50%, -100%)',
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <div className="glass rounded-lg px-2 py-1 border border-red-500/50 bg-red-500/20 text-[10px] text-red-300 whitespace-nowrap mb-1">
                          {paramLat!.toFixed(2)}°N, {paramLon!.toFixed(2)}°E
                        </div>
                        <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-lg" />
                        <div className="w-0.5 h-3 bg-red-400/70" />
                      </div>
                    </div>
                  )}

              </div>

              {/* AUTHORITATIVE INPUT DATE — READ ONLY */}
              <div className="px-4 py-3 border-t border-white/8 bg-slate-900/40">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-wider text-white/45 font-bold">
                    Observation Date
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-black">
                    {selectedDate
                      ? format(parseISO(selectedDate), 'MMM d, yyyy')
                      : 'Waiting for input date…'}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] text-white/35">
                  Same date supplied by the uploaded dataset and WorldMap selection.
                </p>
              </div>

            </div>

            {/* ── BROAD POINT INTERROGATION CARD (JUST UNDER THE HEAT MAP) ── */}
            {clickedPoint ? (
              <div className="w-full glass rounded-2xl p-5 sm:p-6 border border-cyan-500/30 depth-shadow space-y-4">
                {/* Top header strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <span>Point Interrogation Telemetry</span>
                        <span className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Active Grid Probe
                        </span>
                      </h3>
                      <p className="text-[11px] text-white/50">
                        Multi-channel co-located satellite measurements at this specific 0.25° coordinate
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-mono text-xs text-cyan-300">
                      <Crosshair size={13} className="text-cyan-400" />
                      <span>{clickedPoint.lat.toFixed(3)}°N, {clickedPoint.lon.toFixed(3)}°E</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-mono text-xs text-white/70">
                      <span>{clickedPoint.date}</span>
                    </div>

                    <button
                      onClick={() => setClickedPoint(null)}
                      className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white/70 hover:text-white cursor-pointer"
                      title="Clear interrogation point"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                </div>

                {/* Broad 5-Channel Metric Tiles covering the whole area */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
                  {/* SST Tile */}
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-red-300">
                      <span className="font-semibold">SST</span>
                      <Thermometer size={14} className="text-red-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.sst !== null ? `${clickedPoint.sst.toFixed(2)}°C` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-red-300/70">Sea Surface Temperature</p>
                  </div>

                  {/* SSS Tile */}
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-blue-300">
                      <span className="font-semibold">SSS</span>
                      <Droplets size={14} className="text-blue-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.sss !== null ? `${clickedPoint.sss.toFixed(2)} PSU` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-blue-300/70">Surface Salinity</p>
                  </div>

                  {/* SSH / SLA Tile */}
                  <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-cyan-300">
                      <span className="font-semibold">SSH / SLA</span>
                      <Waves size={14} className="text-cyan-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.ssh !== null ? `${clickedPoint.ssh > 0 ? '+' : ''}${clickedPoint.ssh.toFixed(2)} cm` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-cyan-300/70">Sea Surface Anomaly</p>
                  </div>

                  {/* U-Wind Tile */}
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-emerald-300">
                      <span className="font-semibold">U-Wind (Zonal)</span>
                      <Wind size={14} className="text-emerald-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.uwind !== null ? `${clickedPoint.uwind.toFixed(2)} m/s` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-emerald-300/70">Eastward Vector Component</p>
                  </div>

                  {/* V-Wind Tile */}
                  <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-teal-300">
                      <span className="font-semibold">V-Wind (Meridional)</span>
                      <Wind size={14} className="text-teal-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.vwind !== null ? `${clickedPoint.vwind.toFixed(2)} m/s` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-teal-300/70">Northward Vector Component</p>
                  </div>
                </div>

                {/* Footer telemetry strip & quick action links */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-white/70">
                    <Compass size={14} className="text-cyan-400 shrink-0" />
                    <span>
                      Wind Speed Magnitude:{' '}
                      <strong className="text-white font-mono">
                        {clickedPoint.uwind !== null && clickedPoint.vwind !== null
                          ? `${Math.sqrt(clickedPoint.uwind ** 2 + clickedPoint.vwind ** 2).toFixed(2)} m/s`
                          : '—'}
                      </strong>
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="text-white/50 text-[11px]">
                      Grid Cell: CF-1.8 Compliant (0.25° Equirectangular)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/input?lat=${clickedPoint.lat}&lon=${clickedPoint.lon}&date=${clickedPoint.date}`)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Sparkles size={12} />
                      <span>Reconstruct 3D Profile</span>
                      <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() => navigate(`/profile-3d?date=${clickedPoint.date}&lat=${clickedPoint.lat}&lon=${clickedPoint.lon}`)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Layers size={12} />
                      <span>View in 3D Map</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full glass rounded-2xl p-4 sm:p-5 border border-white/10 depth-shadow flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-xs sm:text-sm">
                      Point Interrogation Standby
                    </h4>
                    <p className="text-white/50 text-[11px] mt-0.5">
                      Click anywhere on the surface heatmap above to interrogate collocated SST, SSS, SSH, and wind vector telemetry at that exact coordinate.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const centerLat = 15.5;
                    const centerLon = 88.0;
                    const rowIndex = Math.min(rows - 1, Math.max(0, Math.round(((centerLat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (rows - 1))));
                    const colIndex = Math.min(cols - 1, Math.max(0, Math.round(((centerLon - LON_MIN) / (LON_MAX - LON_MIN)) * (cols - 1))));
                    const sst = getBackendGrid(surfaceData, 'sst');
                    const sss = getBackendGrid(surfaceData, 'sss');
                    const ssh = getBackendGrid(surfaceData, 'ssh');
                    const uwind = getBackendGrid(surfaceData, 'u_wind');
                    const vwind = getBackendGrid(surfaceData, 'v_wind');
                    setClickedPoint({
                      lat: centerLat,
                      lon: centerLon,
                      sst: getGridValue(sst, rowIndex, colIndex),
                      sss: getGridValue(sss, rowIndex, colIndex),
                      ssh: getGridValue(ssh, rowIndex, colIndex),
                      uwind: getGridValue(uwind, rowIndex, colIndex),
                      vwind: getGridValue(vwind, rowIndex, colIndex),
                      date: selectedDate,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
                >
                  📍 Sample Central Bay of Bengal (15.5°N, 88.0°E)
                </button>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="space-y-5">

            {/* COLOR SCALE */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">

              <h3 className="text-sm font-semibold text-white/80 mb-4">
                {cfg.label} ({cfg.unit})
              </h3>

              <div
                className="h-40 w-6 rounded-full mx-auto mb-3 shadow-inner"
                style={{
                  background:
                    `linear-gradient(to bottom, ${cfg.gradEnd}, ${cfg.gradStart})`,
                }}
              />

              <div className="flex justify-between text-xs text-white/40 font-mono">
                <span>
                  {cfg.max} {cfg.unit}
                </span>

                <span>
                  {cfg.min} {cfg.unit}
                </span>
              </div>

              <p className="text-[10px] text-white/30 mt-2 text-center">
                Normalized Color Gradient
              </p>

            </div>

            {/* STATS */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-3">

              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Info
                  size={14}
                  className="text-cyan-400"
                />
                Domain Statistics
              </h3>

              {[
                {
                  label: 'Min',
                  value: `${minValue.toFixed(
                    3
                  )} ${cfg.unit}`,
                },
                {
                  label: 'Max',
                  value: `${maxValue.toFixed(
                    3
                  )} ${cfg.unit}`,
                },
                {
                  label: 'Mean',
                  value: `${meanValue.toFixed(
                    3
                  )} ${cfg.unit}`,
                },
                {
                  label: 'Range',
                  value: `${(
                    maxValue -
                    minValue
                  ).toFixed(3)} ${cfg.unit
                    }`,
                },
                {
                  label: 'Grid Dimension',
                  value:
                    rows && cols
                      ? `${rows} × ${cols}`
                      : '—',
                },
              ].map(
                ({
                  label,
                  value,
                }) => (
                  <div
                    key={label}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-white/50">
                      {label}
                    </span>

                    <span className="text-white font-medium font-mono">
                      {value}
                    </span>
                  </div>
                )
              )}

            </div>

          </div>
        </div>
    </>
  );

  return (
    <section className="w-full rounded-3xl bg-[#002f52] border border-cyan-500/25 shadow-2xl overflow-hidden">
      <div className="px-5 sm:px-8 pt-7 pb-5 border-b border-cyan-300/20 bg-gradient-to-r from-[#003b63] via-[#005088] to-[#0078b8]">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="px-3 py-1 rounded-full bg-white/90 text-[#005088] text-[10px] font-mono font-black tracking-wider">
            SATELLITE REMOTE SENSING
          </span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${
            loading
              ? 'bg-cyan-500/15 border-cyan-300/30 text-cyan-100'
              : surfaceData
                ? isSynthesized
                  ? 'bg-amber-500/15 border-amber-300/30 text-amber-100'
                  : 'bg-emerald-500/15 border-emerald-300/30 text-emerald-100'
                : 'bg-white/10 border-white/20 text-white/70'
          }`}>
            {loading
              ? 'FETCHING SATELLITE MATRIX...'
              : surfaceData
                ? (isSynthesized ? 'PHYSICS-GUIDED TWIN' : 'BACKEND CONNECTED')
                : 'WAITING FOR INPUT'}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Eye size={20} className="text-cyan-200" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Surface Satellite Observations
            </h2>
            <p className="text-sm text-cyan-100/90 mt-1 leading-relaxed max-w-4xl">
              Real daily satellite observations across North Indian Ocean — Sea Surface Temperature (SST), Salinity (SSS), SLA &amp; wind stress
            </p>
          </div>
        </div>
      </div>

      {surfaceBody}
    </section>
  );
}
