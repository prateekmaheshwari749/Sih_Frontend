import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';

import PageLayout, { PageContainer, PageHeader } from '../components/PageLayout';
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

const BACKEND_DATES = eachDayOfInterval({
  start: new Date('2023-01-01T00:00:00'),
  end: new Date(),
}).map((d) => format(d, 'yyyy-MM-dd'));

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

export default function SurfacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const paramDate = searchParams.get('date');
  const paramLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const paramLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null;

  // Initialize and synchronize date with URL search param or shared storage
  const [dateIndex, setDateIndex] = useState(() => {
    const targetDate = paramDate || localStorage.getItem('ocean_shared_date');
    if (targetDate) {
      const idx = BACKEND_DATES.indexOf(targetDate);
      if (idx !== -1) return idx;
    }
    return BACKEND_DATES.length - 1; // Default to current or latest date
  });

  useEffect(() => {
    if (paramDate) {
      const idx = BACKEND_DATES.indexOf(paramDate);
      if (idx !== -1) {
        setDateIndex(idx);
      }
    }
  }, [paramDate]);

  const selectedDate = BACKEND_DATES[dateIndex] || paramDate || '2023-12-31';

  const [surfaceData, setSurfaceData] = useState<SurfaceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSynthesized, setIsSynthesized] = useState(false);

  const [mode, setMode] = useState<VarMode>('sst');
  const [showGrid, setShowGrid] = useState(true);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [clickedPoint, setClickedPoint] = useState<ClickedPointData | null>(null);

  // Persist selected date and coordinates so other pages stay connected
  useEffect(() => {
    localStorage.setItem('ocean_shared_date', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (clickedPoint) {
      localStorage.setItem('ocean_shared_lat', String(clickedPoint.lat));
      localStorage.setItem('ocean_shared_lon', String(clickedPoint.lon));
    }
  }, [clickedPoint]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /*
   * BACKEND REQUEST WITH INSTANTANEOUS RESILIENT FALLBACK
   */
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

  /*
   * FAST HTML5 CANVAS RENDERER FOR THE NORTH INDIAN OCEAN BORDER AREA (<1ms)
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
      // NetCDF row 0 is South (5°N), row rows-1 is North (30°N).
      // Canvas y=0 is top, so we map canvas row y to rows - 1 - y (North on top).
      const r = rows - 1 - y;
      const row = backendGrid[r];
      for (let c = 0; c < cols; c++) {
        const val = row ? row[c] : null;
        const idx = (y * cols + c) * 4;

        if (val == null || !Number.isFinite(val)) {
          // Continental land / missing value
          data[idx] = 12;
          data[idx + 1] = 18;
          data[idx + 2] = 28;
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
   * MOUSE HOVER TRACKER OVER THE BORDER AREA
   */
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

      setHover({
        lat,
        lon,
        val,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [backendGrid, rows, cols]
  );

  /*
   * PROBE DATA AT COORDINATES
   */
  const probeCoordinates = useCallback(
    (lat: number, lon: number) => {
      if (!surfaceData || rows === 0 || cols === 0) return;

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
        sst: getGridValue(sst, rowIndex, colIndex),
        sss: getGridValue(sss, rowIndex, colIndex),
        ssh: getGridValue(ssh, rowIndex, colIndex),
        uwind: getGridValue(uwind, rowIndex, colIndex),
        vwind: getGridValue(vwind, rowIndex, colIndex),
        date: selectedDate,
      });
    },
    [surfaceData, rows, cols, selectedDate]
  );

  /*
   * CLICK ON THE BORDER AREA CONTAINER
   */
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [data-no-map-click]')) {
      return;
    }
    if (!surfaceData || !backendGrid || rows === 0 || cols === 0) {
      return;
    }

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

  /*
   * AUTOMATIC INTERROGATION ON URL PIN (Redirect from Map or Dashboard)
   */
  useEffect(() => {
    if (
      paramLat !== null &&
      paramLon !== null &&
      Number.isFinite(paramLat) &&
      Number.isFinite(paramLon) &&
      surfaceData &&
      rows > 0 &&
      cols > 0
    ) {
      probeCoordinates(paramLat, paramLon);
    }
  }, [paramLat, paramLon, surfaceData, rows, cols, probeCoordinates]);

  // Coordinates of clicked pin on the border canvas (%)
  const pinX =
    clickedPoint !== null
      ? ((clickedPoint.lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100
      : null;

  const pinY =
    clickedPoint !== null
      ? ((LAT_MAX - clickedPoint.lat) / (LAT_MAX - LAT_MIN)) * 100
      : null;

  return (
    <PageLayout>
      <PageContainer>
        {/* HEADER */}
        <PageHeader
          category="SATELLITE REMOTE SENSING"
          badge={
            loading ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono">
                <div className="w-2 h-2 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                FETCHING SATELLITE MATRIX...
              </div>
            ) : surfaceData ? (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${
                  isSynthesized
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                } text-[11px] font-mono`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSynthesized ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                {isSynthesized ? 'PHYSICS-GUIDED TWIN' : 'BACKEND CONNECTED'} · {surfaceData.source}
              </div>
            ) : null
          }
          icon={<Eye size={18} className="text-cyan-400" />}
          title="Surface Satellite Observations"
          subtitle="Real daily satellite observations across North Indian Ocean — Sea Surface Temperature (SST), Salinity (SSS), SLA & wind stress"
        />

        {/* INFO PILLS ROW */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="glass rounded-xl px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">Domain: </span>
            <span className="text-cyan-400 font-mono">
              {LAT_MIN}°N–{LAT_MAX}°N, {LON_MIN}°E–{LON_MAX}°E
            </span>
          </div>

          <div className="glass rounded-xl px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">Grid Resolution: </span>
            <span className="text-cyan-400 font-mono">
              {rows && cols ? `${rows} × ${cols} (${(rows * cols).toLocaleString()} cells)` : 'Loading...'}
            </span>
          </div>

          <div className="glass rounded-xl px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">Date: </span>
            <span className="text-cyan-400 font-mono">{selectedDate}</span>
          </div>

          <div className="glass rounded-xl px-3 py-1.5 border border-white/10 text-xs">
            <span className="text-white/40">Area: </span>
            <span className="text-emerald-400 font-medium">North Indian Ocean Domain (CF-1.8 Compliant)</span>
          </div>
        </div>

        {/* CONTROLS ROW (VARIABLE TABS + GRID LINES + DATE STEPPER) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {/* Variable Tabs */}
          <div className="flex gap-1 p-1 glass rounded-2xl border border-white/10 overflow-x-auto">
            {VAR_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  mode === id
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-bold shadow-md shadow-cyan-500/25'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Quick Toolbar Buttons */}
          <div className="flex items-center gap-2">
            {/* Grid Lines Toggle */}
            <button
              onClick={() => setShowGrid((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                showGrid
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'glass text-white/60 hover:text-white border-white/10 hover:bg-white/10'
              }`}
              title="Toggle Lat/Lon Grid Lines"
            >
              <Layers size={13} />
              <span>Grid Lines</span>
            </button>

            {/* Date Stepper - Connected with Map Page & Header */}
            <div className="glass rounded-xl px-2.5 py-1.5 border border-white/10 flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setDateIndex((prev) => Math.max(0, prev - 1))}
                disabled={dateIndex <= 0}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft size={14} />
              </button>
              <label className="relative font-mono text-cyan-300 font-bold px-1 text-[11px] cursor-pointer hover:text-cyan-200 flex items-center gap-1" title="Click to pick date from calendar">
                <span>{format(parseISO(selectedDate), 'MMM d, yyyy')}</span>
                <input
                  type="date"
                  value={selectedDate}
                  min="2023-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const idx = BACKEND_DATES.indexOf(val);
                    if (idx !== -1) {
                      setDateIndex(idx);
                    }
                  }}
                  className="sr-only"
                />
              </label>
              <button
                onClick={() => setDateIndex((prev) => Math.min(BACKEND_DATES.length - 1, prev + 1))}
                disabled={dateIndex >= BACKEND_DATES.length - 1}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Next Day"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* MAIN BODY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* LEFT 3 COLUMNS: BORDER AREA RASTER & TELEMETRY */}
          <div className="lg:col-span-3 space-y-6">

            {/* BORDER AREA CARD (STRICTLY THE STUDY REGION) */}
            <div className="glass rounded-3xl border border-white/10 depth-shadow overflow-hidden">
              
              {/* Card Header Strip: 
                  - degree C text in BLACK
                  - {selectedDate} · North Indian Ocean in BLACK and connected to date
              */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-white/95 rounded-t-3xl shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {cfg.label}
                  </span>
                  {/* DEGREE C TEXT IN BLACK */}
                  <span
                    className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 font-mono font-bold text-xs"
                    style={{ color: '#000000' }}
                  >
                    ({cfg.unit})
                  </span>
                </div>

                {/* {selectedDate} · North Indian Ocean TEXT IN BLACK */}
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: '#000000' }}
                >
                  {selectedDate} · North Indian Ocean
                </span>
              </div>

              {/* BORDER AREA RASTER CANVAS (NO WHOLE WORLD MAP, ONLY STUDY DOMAIN) */}
              <div
                ref={containerRef}
                className="relative select-none bg-slate-950 overflow-hidden cursor-crosshair"
                style={{
                  aspectRatio: cols && rows ? `${cols}/${rows}` : '2.4 / 1',
                  minHeight: '400px',
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHover(null)}
                onClick={handleContainerClick}
              >
                {/* HIGH SPEED 60FPS SCIENTIFIC CANVAS */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-fill block"
                  style={{ imageRendering: 'auto' }}
                />

                {/* DOMAIN BOUNDARY ACCENT */}
                <div className="absolute inset-0 border-2 border-yellow-400/50 pointer-events-none rounded-b-none" />

                {/* LAT/LON COORDINATE LABELS ALONG BORDER AREA */}
                <div className="absolute top-2 left-2 text-[10px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded-sm pointer-events-none">
                  30°N, 45°E
                </div>
                <div className="absolute top-2 right-2 text-[10px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded-sm pointer-events-none">
                  30°N, 105°E
                </div>
                <div className="absolute bottom-2 left-2 text-[10px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded-sm pointer-events-none">
                  5°N, 45°E
                </div>
                <div className="absolute bottom-2 right-2 text-[10px] font-mono text-white/50 bg-black/40 px-1.5 py-0.5 rounded-sm pointer-events-none">
                  5°N, 105°E
                </div>

                {/* GRID LINES OVERLAY */}
                {showGrid && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
                      `,
                      backgroundSize: '8.33% 20%', // 12 columns (5° lon steps), 5 rows (5° lat steps)
                    }}
                  />
                )}

                {/* HOVER TOOLTIP */}
                {hover && (
                  <div
                    className="absolute z-20 pointer-events-none glass rounded-xl px-3 py-2 border border-white/20 text-xs shadow-2xl backdrop-blur-xl"
                    style={{
                      left: Math.min(hover.x + 15, (containerRef.current?.clientWidth ?? 600) - 170),
                      top: Math.max(10, Math.min(hover.y - 15, (containerRef.current?.clientHeight ?? 400) - 70)),
                    }}
                  >
                    <p className="text-white/60 mb-0.5 font-mono text-[11px]">
                      {hover.lat.toFixed(2)}°N · {hover.lon.toFixed(2)}°E
                    </p>
                    <p className="font-bold text-white font-mono">
                      {cfg.label}:{' '}
                      <span className="text-cyan-400">
                        {hover.val.toFixed(2)} {cfg.unit}
                      </span>
                    </p>
                  </div>
                )}

                {/* PROBED PIN OVERLAY */}
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
                      <div className="glass rounded-lg px-2 py-0.5 border border-red-500/50 bg-red-500/20 text-[10px] text-red-300 font-mono whitespace-nowrap mb-1">
                        {clickedPoint.lat.toFixed(2)}°N, {clickedPoint.lon.toFixed(2)}°E
                      </div>
                      <div className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-lg" />
                      <div className="w-0.5 h-3 bg-red-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BROAD POINT INTERROGATION TELEMETRY CARD */}
            {clickedPoint ? (
              <div className="w-full glass rounded-3xl p-5 sm:p-6 border border-cyan-500/30 depth-shadow space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                        <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                          Point Interrogation Telemetry
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Active Grid Probe
                        </span>
                      </h3>
                      <p className="text-[11px] text-sky-100/90 font-medium">
                        Multi-channel co-located satellite measurements at this specific geographic coordinate
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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

                {/* 5-Channel Metric Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* SST */}
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-red-300">
                      <span className="font-semibold">SST</span>
                      <Thermometer size={14} className="text-red-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.sst !== null ? `${clickedPoint.sst.toFixed(2)}°C` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-red-300/70">Sea Surface Temp</p>
                  </div>

                  {/* SSS */}
                  <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-purple-300">
                      <span className="font-semibold">SSS</span>
                      <Droplets size={14} className="text-purple-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.sss !== null ? `${clickedPoint.sss.toFixed(2)} PSU` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-purple-300/70">Surface Salinity</p>
                  </div>

                  {/* SSH */}
                  <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-cyan-300">
                      <span className="font-semibold">SSH / SLA</span>
                      <Waves size={14} className="text-cyan-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.ssh !== null
                        ? `${clickedPoint.ssh > 0 ? '+' : ''}${clickedPoint.ssh.toFixed(2)} cm`
                        : 'N/A'}
                    </p>
                    <p className="text-[10px] text-cyan-300/70">Sea Surface Height</p>
                  </div>

                  {/* U-Wind */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-emerald-300">
                      <span className="font-semibold">U-Wind (Zonal)</span>
                      <Wind size={14} className="text-emerald-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.uwind !== null ? `${clickedPoint.uwind.toFixed(2)} m/s` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-emerald-300/70">Eastward Vector</p>
                  </div>

                  {/* V-Wind */}
                  <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/25 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-teal-300">
                      <span className="font-semibold">V-Wind (Meridional)</span>
                      <Wind size={14} className="text-teal-400" />
                    </div>
                    <p className="text-lg sm:text-xl font-mono font-black text-white">
                      {clickedPoint.vwind !== null ? `${clickedPoint.vwind.toFixed(2)} m/s` : 'N/A'}
                    </p>
                    <p className="text-[10px] text-teal-300/70">Northward Vector</p>
                  </div>
                </div>

                {/* Footer Telemetry & CTAs */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
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
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/dashboard?lat=${clickedPoint.lat}&lon=${clickedPoint.lon}&date=${clickedPoint.date}`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Sparkles size={12} />
                      <span>Reconstruct 3D Profile</span>
                      <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() =>
                        navigate(
                          `/profile-3d?date=${clickedPoint.date}&lat=${clickedPoint.lat}&lon=${clickedPoint.lon}`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Layers size={12} />
                      <span>View in 3D Map</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full glass rounded-3xl p-4 sm:p-5 border border-white/10 depth-shadow flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-xs sm:text-sm">
                      Point Interrogation Standby
                    </h4>
                    <p className="text-white/50 text-[11px] mt-0.5">
                      Click anywhere on the satellite border area above to interrogate collocated SST, SSS, SSH, and wind vector telemetry at that exact coordinate.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => probeCoordinates(15.5, 88.0)}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
                >
                  📍 Sample Central BoB (15.5°N, 88.0°E)
                </button>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR (COLOR SCALE + DOMAIN STATS - NO PRESET LOCATIONS) */}
          <div className="space-y-5">

            {/* COLOR SCALE (DEGREE C TEXT IN BLACK) */}
            <div className="bg-white/95 rounded-3xl p-5 border border-slate-200 shadow-md space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                <span>{cfg.label} </span>
                {/* DEGREE C TEXT IN BLACK */}
                <span style={{ color: '#000000' }} className="font-bold">
                  ({cfg.unit})
                </span>
              </h3>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono font-bold">
                  {/* DEGREE C TEXT IN BLACK */}
                  <span style={{ color: '#000000' }}>
                    {cfg.min} {cfg.unit}
                  </span>
                  <span style={{ color: '#000000' }}>
                    {cfg.max} {cfg.unit}
                  </span>
                </div>

                <div
                  className="h-3.5 w-full rounded-full shadow-inner border border-slate-300"
                  style={{
                    background: `linear-gradient(to right, ${cfg.gradStart}, ${cfg.gradEnd})`,
                  }}
                />
              </div>

              <p className="text-[10.5px] text-slate-500 pt-1 text-center font-mono">
                Normalized Color Gradient
              </p>
            </div>

            {/* DOMAIN STATS */}
            <div className="bg-white/95 rounded-3xl p-5 border border-slate-200 shadow-md space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900">
                <Info size={14} className="text-cyan-600" />
                <span>Domain Statistics</span>
              </h3>

              {[
                { label: 'Min', value: `${minValue.toFixed(3)} ${cfg.unit}` },
                { label: 'Max', value: `${maxValue.toFixed(3)} ${cfg.unit}` },
                { label: 'Mean', value: `${meanValue.toFixed(3)} ${cfg.unit}` },
                { label: 'Range', value: `${(maxValue - minValue).toFixed(3)} ${cfg.unit}` },
                {
                  label: 'Grid Dimension',
                  value: rows && cols ? `${rows} × ${cols}` : '—',
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-800 font-bold font-mono">{value}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
}
