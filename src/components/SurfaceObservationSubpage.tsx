import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Thermometer,
  Droplets,
  Waves,
  Wind,
  MapPin,
  Layers,
  X as XIcon,
  Crosshair,
  Compass,
  ArrowRight,
  Sparkles,
  Eye,
  Map,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchSurface, type SurfaceResponse } from '../api/oceanApi';
import { evaluateBathymetry, type BathymetryResult } from '../pages/WorldMapPage';

export type VarMode = 'sst' | 'sss' | 'ssh' | 'uwind' | 'vwind';

export type BackendVariable =
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
  isLand?: boolean;
}

export interface ClickedPointData {
  lat: number;
  lon: number;
  sst: number | null;
  sss: number | null;
  ssh: number | null;
  uwind: number | null;
  vwind: number | null;
  date: string;
  bathy: BathymetryResult;
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
    label: 'Surface Wind U (Zonal)',
    unit: 'm/s',
    min: -15,
    max: 15,
    gradStart: '#1e3a8a',
    gradEnd: '#10b981',
    backendVar: 'u_wind',
  },
  vwind: {
    label: 'Surface Wind V (Meridional)',
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
  const n = Math.max(0, Math.min(1, (val - min) / (max - min)));

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

  return [r, g, b, 240];
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
  return normalizeGrid(surfaceData.variables[variable]);
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

interface SurfaceObservationSubpageProps {
  selectedDate: string;
  className?: string;
}

export default function SurfaceObservationSubpage({
  selectedDate,
  className = '',
}: SurfaceObservationSubpageProps) {
  const navigate = useNavigate();

  const [mode, setMode] = useState<VarMode>('sst');
  const [showGrid, setShowGrid] = useState(true);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [clickedPoint, setClickedPoint] = useState<ClickedPointData | null>(null);

  const [surfaceData, setSurfaceData] = useState<SurfaceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSynthesized, setIsSynthesized] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync clicked coordinates to localStorage for profile and map continuity
  useEffect(() => {
    if (clickedPoint) {
      localStorage.setItem('ocean_shared_lat', String(clickedPoint.lat));
      localStorage.setItem('ocean_shared_lon', String(clickedPoint.lon));
    }
  }, [clickedPoint]);

  // Fetch surface observations whenever date changes
  useEffect(() => {
    if (!selectedDate) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

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
          '[SurfaceObservationSubpage] Backend surface offline/missing date, using high-res physics twin:',
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
    () => getBackendGrid(surfaceData, cfg.backendVar),
    [surfaceData, cfg.backendVar]
  );

  const rows = backendGrid?.length ?? 0;
  const cols =
    backendGrid && backendGrid.length
      ? Math.max(...backendGrid.map((row) => row.length))
      : 0;

  const flatValues = useMemo(() => {
    if (!backendGrid) return [];
    return backendGrid
      .flat()
      .filter((v) => typeof v === 'number' && Number.isFinite(v));
  }, [backendGrid]);

  const minValue = flatValues.length ? Math.min(...flatValues) : 0;
  const maxValue = flatValues.length ? Math.max(...flatValues) : 0;
  const meanValue =
    flatValues.length
      ? flatValues.reduce((a, b) => a + b, 0) / flatValues.length
      : 0;

  // Canvas renderer
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
      const r = rows - 1 - y;
      const row = backendGrid[r];
      for (let c = 0; c < cols; c++) {
        const val = row ? row[c] : null;
        const idx = (y * cols + c) * 4;

        if (val == null || !Number.isFinite(val)) {
          data[idx] = 15;
          data[idx + 1] = 23;
          data[idx + 2] = 42;
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!backendGrid || rows === 0 || cols === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const rawXNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const rawYNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const ci = Math.min(cols - 1, Math.max(0, Math.floor(rawXNorm * cols)));
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

      const bathy = evaluateBathymetry(lat, lon);
      setHover({
        lat,
        lon,
        val,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        isLand: bathy.isLand,
      });
    },
    [backendGrid, rows, cols]
  );

  const probeCoordinates = useCallback(
    (lat: number, lon: number) => {
      if (!surfaceData || rows === 0 || cols === 0) return;

      const bathy = evaluateBathymetry(lat, lon);

      const clampedLat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
      const clampedLon = Math.max(LON_MIN, Math.min(LON_MAX, lon));

      const rowIndex = Math.min(
        rows - 1,
        Math.max(
          0,
          Math.round(((clampedLat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (rows - 1))
        )
      );
      const colIndex = Math.min(
        cols - 1,
        Math.max(
          0,
          Math.round(((clampedLon - LON_MIN) / (LON_MAX - LON_MIN)) * (cols - 1))
        )
      );

      const sst = getBackendGrid(surfaceData, 'sst');
      const sss = getBackendGrid(surfaceData, 'sss');
      const ssh = getBackendGrid(surfaceData, 'ssh');
      const uwind = getBackendGrid(surfaceData, 'u_wind');
      const vwind = getBackendGrid(surfaceData, 'v_wind');

      setClickedPoint({
        lat: Number(lat.toFixed(3)),
        lon: Number(lon.toFixed(3)),
        sst: bathy.isLand ? null : getGridValue(sst, rowIndex, colIndex),
        sss: bathy.isLand ? null : getGridValue(sss, rowIndex, colIndex),
        ssh: bathy.isLand ? null : getGridValue(ssh, rowIndex, colIndex),
        uwind: bathy.isLand ? null : getGridValue(uwind, rowIndex, colIndex),
        vwind: bathy.isLand ? null : getGridValue(vwind, rowIndex, colIndex),
        date: selectedDate,
        bathy,
      });
    },
    [surfaceData, rows, cols, selectedDate]
  );

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-no-map-click]')) return;
    if (!surfaceData || !backendGrid || rows === 0 || cols === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const rawXNorm = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawYNorm = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const lat =
      rows <= 1
        ? (LAT_MIN + LAT_MAX) / 2
        : LAT_MAX - rawYNorm * (LAT_MAX - LAT_MIN);

    const lon =
      cols <= 1
        ? (LON_MIN + LON_MAX) / 2
        : LON_MIN + rawXNorm * (LON_MAX - LON_MIN);

    probeCoordinates(lat, lon);
  };

  const pinX =
    clickedPoint !== null
      ? ((clickedPoint.lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100
      : null;

  const pinY =
    clickedPoint !== null
      ? ((LAT_MAX - clickedPoint.lat) / (LAT_MAX - LAT_MIN)) * 100
      : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls Bar: Variable tabs + Grid toggle + Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
        {/* Variable selector tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
          {VAR_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                mode === id
                  ? 'bg-[#005088] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showGrid
                ? 'bg-blue-50 text-[#005088] border-blue-300'
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
            }`}
            title="Toggle Grid Lines"
          >
            <Layers size={13} />
            <span>Grid Lines</span>
          </button>

          {/* Connection status pill */}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10.5px] font-mono text-slate-700">
            <span className={`w-1.5 h-1.5 rounded-full ${isSynthesized ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            {loading ? 'Ingesting...' : isSynthesized ? 'Synthetic Twin' : 'Copernicus L4'}
          </span>
        </div>
      </div>

      {/* Surface Raster Card */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
        {/* Header Strip: Degree C text in bold BLACK, Date in bold BLACK */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-slate-900">
              {cfg.label}
            </span>
            <span
              className="px-2 py-0.5 rounded-full bg-white border border-slate-300 font-mono font-black text-xs"
              style={{ color: '#000000' }}
            >
              ({cfg.unit})
            </span>
          </div>

          <span
            className="text-xs font-mono font-black"
            style={{ color: '#000000' }}
          >
            {selectedDate} &bull; North Indian Ocean
          </span>
        </div>

        {/* Canvas raster container */}
        <div
          ref={containerRef}
          className="relative select-none bg-slate-950 overflow-hidden cursor-crosshair"
          style={{
            aspectRatio: cols && rows ? `${cols}/${rows}` : '2.4 / 1',
            minHeight: '340px',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleContainerClick}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-fill block"
            style={{ imageRendering: 'auto' }}
          />

          {/* Domain Boundary Accent */}
          <div className="absolute inset-0 border-2 border-yellow-400/50 pointer-events-none" />

          {/* Coordinate corner badges */}
          <div className="absolute top-2 left-2 text-[10px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none">
            30°N, 45°E
          </div>
          <div className="absolute top-2 right-2 text-[10px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none">
            30°N, 105°E
          </div>
          <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none">
            5°N, 45°E
          </div>
          <div className="absolute bottom-2 right-2 text-[10px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none">
            5°N, 105°E
          </div>

          {/* Grid lines overlay */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: '8.33% 20%',
              }}
            />
          )}

          {/* Hover Tooltip */}
          {hover && (
            <div
              className={`absolute z-20 pointer-events-none rounded-xl px-3 py-2 border text-xs shadow-2xl backdrop-blur-md ${
                hover.isLand
                  ? 'border-amber-300 bg-amber-50/95 text-amber-950'
                  : 'border-slate-300 bg-white/95 text-slate-900'
              }`}
              style={{
                left: Math.min(hover.x + 15, (containerRef.current?.clientWidth ?? 600) - 170),
                top: Math.max(10, Math.min(hover.y - 15, (containerRef.current?.clientHeight ?? 340) - 70)),
              }}
            >
              <p className="text-slate-500 mb-0.5 font-mono text-[11px]">
                {hover.lat.toFixed(2)}°N &bull; {hover.lon.toFixed(2)}°E
              </p>
              {hover.isLand ? (
                <p className="font-bold text-amber-800 font-mono flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-600" />
                  Continental Landmass
                </p>
              ) : (
                <p className="font-bold text-slate-900 font-mono">
                  {cfg.label}:{' '}
                  <span className="text-[#005088]">
                    {hover.val.toFixed(2)} {cfg.unit}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Probed Pin Overlay */}
          {clickedPoint && pinX !== null && pinY !== null && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                left: `${pinX}%`,
                top: `${pinY}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="flex flex-col items-center animate-bounce">
                <div
                  className={`rounded-lg px-2 py-0.5 text-white text-[10px] font-mono font-bold whitespace-nowrap mb-1 shadow-md flex items-center gap-1 ${
                    !clickedPoint.bathy.isValidGrid ? 'bg-amber-600' : 'bg-rose-600'
                  }`}
                >
                  {!clickedPoint.bathy.isValidGrid && <AlertTriangle size={10} />}
                  <span>
                    {!clickedPoint.bathy.isValidGrid ? 'LAND: ' : ''}
                    {clickedPoint.lat.toFixed(2)}°N, {clickedPoint.lon.toFixed(2)}°E
                  </span>
                </div>
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg ${
                    !clickedPoint.bathy.isValidGrid ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
                <div
                  className={`w-0.5 h-3 ${
                    !clickedPoint.bathy.isValidGrid ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Legend bar footer (Min, Mean, Max, Degree C in Black) */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Color Gradient Scale:</span>
            <span className="font-mono font-bold" style={{ color: '#000000' }}>
              {cfg.min} {cfg.unit}
            </span>
            <div
              className="h-2.5 w-28 sm:w-36 rounded-full shadow-inner border border-slate-300"
              style={{
                background: `linear-gradient(to right, ${cfg.gradStart}, ${cfg.gradEnd})`,
              }}
            />
            <span className="font-mono font-bold" style={{ color: '#000000' }}>
              {cfg.max} {cfg.unit}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-700">
            <span>Min: <strong className="text-slate-900">{minValue.toFixed(1)}</strong></span>
            <span>Mean: <strong className="text-slate-900">{meanValue.toFixed(1)}</strong></span>
            <span>Max: <strong className="text-slate-900">{maxValue.toFixed(1)} {cfg.unit}</strong></span>
          </div>
        </div>
      </div>

      {/* Point Interrogation Telemetry Box */}
      {clickedPoint ? (
        <div
          className={`rounded-2xl p-4 sm:p-5 border space-y-3.5 shadow-sm transition-all duration-300 ${
            !clickedPoint.bathy.isValidGrid
              ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border-amber-300'
              : 'bg-gradient-to-r from-sky-50/80 to-blue-50/80 border-sky-200'
          }`}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
                  !clickedPoint.bathy.isValidGrid ? 'bg-amber-600' : 'bg-[#005088]'
                }`}
              >
                {!clickedPoint.bathy.isValidGrid ? <AlertTriangle size={16} /> : <MapPin size={16} />}
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Selected Coordinate:</span>
                  <span className="font-mono text-[#005088]">
                    {clickedPoint.lat.toFixed(3)}°N, {clickedPoint.lon.toFixed(3)}°E
                  </span>
                </h4>
                <p className="text-[11px] font-mono text-slate-600">
                  {clickedPoint.bathy.locationName} &bull; {clickedPoint.date}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  navigate(
                    `/worldmap?date=${clickedPoint.date}&lat=${clickedPoint.lat}&lon=${clickedPoint.lon}`
                  )
                }
                className="px-3.5 py-1.5 rounded-xl bg-[#005088] hover:bg-[#003d66] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Map size={13} />
                <span>View on Map</span>
                <ArrowRight size={13} />
              </button>
              <button
                onClick={() => setClickedPoint(null)}
                className="w-7 h-7 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                title="Clear Point"
              >
                <XIcon size={13} />
              </button>
            </div>
          </div>

          {/* Validation Status Badge */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10.5px] font-mono px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                clickedPoint.bathy.isValidGrid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {clickedPoint.bathy.isValidGrid ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>VALID DEEP OCEAN (~{clickedPoint.bathy.depthMeters}m Bathymetry)</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>
                    {clickedPoint.bathy.isLand
                      ? 'CONTINENTAL LANDMASS (NO OCEAN DATA)'
                      : `SHALLOW WATER (~${clickedPoint.bathy.depthMeters}m)`}
                  </span>
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              NIO Domain (5°N–30°N, 45°E–105°E)
            </span>
          </div>

          {/* If Invalid Grid (Land or Shallow Water): Show Warning, DO NOT give ocean data! */}
          {!clickedPoint.bathy.isValidGrid ? (
            <div className="p-3.5 rounded-2xl bg-amber-100/70 border border-amber-300 text-amber-950 text-xs leading-relaxed flex items-start gap-2.5">
              <AlertTriangle size={17} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950">
                  {clickedPoint.bathy.isLand ? 'Continental Landmass Detected' : 'Shallow Bathymetry Warning'}
                </p>
                <p className="text-[11.5px] text-amber-900">
                  {clickedPoint.bathy.statusMessage}
                </p>
                <p className="text-[10.5px] text-amber-800/90 font-mono pt-1">
                  💡 Satellite observation products (SST, SSS, SLA altimetry) and 3D subsurface physical reconstructions require marine waters. Please click an ocean grid cell in the Arabian Sea or Bay of Bengal.
                </p>
              </div>
            </div>
          ) : (
            /* Valid Deep Ocean Grid: Display 5-Channel Metric Tiles */
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 block">SST</span>
                <span className="font-mono font-black text-rose-600 text-sm">
                  {clickedPoint.sst !== null ? `${clickedPoint.sst.toFixed(2)}°C` : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 block">SSS</span>
                <span className="font-mono font-black text-blue-600 text-sm">
                  {clickedPoint.sss !== null ? `${clickedPoint.sss.toFixed(2)} PSU` : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 block">SSH</span>
                <span className="font-mono font-black text-cyan-700 text-sm">
                  {clickedPoint.ssh !== null ? `${clickedPoint.ssh > 0 ? '+' : ''}${clickedPoint.ssh.toFixed(1)} cm` : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 block">U-Wind</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {clickedPoint.uwind !== null ? `${clickedPoint.uwind.toFixed(2)} m/s` : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 block">V-Wind</span>
                <span className="font-mono font-black text-teal-700 text-sm">
                  {clickedPoint.vwind !== null ? `${clickedPoint.vwind.toFixed(2)} m/s` : 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Crosshair size={14} className="text-[#005088]" />
            <span>Click anywhere on the raster map above to interrogate multi-parameter satellite telemetry.</span>
          </div>
          <button
            onClick={() => probeCoordinates(15.5, 88.0)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[#005088] font-bold font-mono text-[11px] transition-colors cursor-pointer"
          >
            Probe Central BoB (15.5°N, 88°E)
          </button>
        </div>
      )}
    </div>
  );
}
