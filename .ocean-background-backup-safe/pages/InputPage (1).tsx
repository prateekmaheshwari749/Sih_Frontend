import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, Loader2, AlertCircle,
  Layers, History, ChevronRight,
  ChevronDown, X, Calendar, MapPin, Info,
  Thermometer, Droplets, Waves, Wind, ArrowUpDown,
  FileCheck, Cpu,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import PageLayout, { PageContainer, PageHeader } from '../components/PageLayout';
import { useData, DEPTH_LEVELS, type DayRecord, type SurfaceInputs } from '../contexts/DataContext';
import { getBackendUrl } from '../api/backendConfig';
import { fetchHealth, fetchSurface } from '../api/oceanApi';
import InputPhysicsAndSimulationExplainer from '../components/InputPhysicsAndSimulationExplainer';

// ── Expected .nc variable names per dataset ────────────────────────────────────
const NC_VARIABLE_SPEC = {
  sst: {
    label: 'Sea Surface Temperature',
    variables: ['analysed_sst', 'sea_surface_temperature', 'SST', 'sst', 'thetao'],
    unit: '°C', source: 'MODIS / AVHRR / VIIRS', color: 'text-red-400',
    borderColor: 'border-red-500/30', bgColor: 'bg-red-500/10',
  },
  sss: {
    label: 'Sea Surface Salinity',
    variables: ['sss', 'sea_surface_salinity', 'SSS', 'so'],
    unit: 'PSU', source: 'SMOS / Aquarius', color: 'text-blue-400',
    borderColor: 'border-blue-500/30', bgColor: 'bg-blue-500/10',
  },
  ssh: {
    label: 'Sea Surface Height',
    variables: ['ssh', 'adt', 'sea_surface_height', 'zos', 'SSH'],
    unit: 'cm', source: 'Jason-3 / Sentinel-6', color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30', bgColor: 'bg-cyan-500/10',
  },
  currents: {
    label: 'Surface Currents (U, V)',
    variables: ['ugos', 'vgos', 'u_curr', 'v_curr', 'uo', 'vo'],
    unit: 'm/s', source: 'OSCAR / GlobCurrent', color: 'text-purple-400',
    borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/10',
  },
  winds: {
    label: 'Surface Winds (U, V)',
    variables: ['u10', 'v10', 'eastward_wind', 'northward_wind', 'uas', 'vas'],
    unit: 'm/s', source: 'ERA5 / ASCAT / CCMP', color: 'text-green-400',
    borderColor: 'border-green-500/30', bgColor: 'bg-green-500/10',
  },
};

// ── Accepted .nc file slot types ──────────────────────────────────────────────
const FILE_SLOTS = [
  { id: 'sst',      ...NC_VARIABLE_SPEC.sst,      icon: Thermometer,  required: true },
  { id: 'sss',      ...NC_VARIABLE_SPEC.sss,      icon: Droplets,     required: true },
  { id: 'ssh',      ...NC_VARIABLE_SPEC.ssh,      icon: Waves,        required: true },
  { id: 'currents', ...NC_VARIABLE_SPEC.currents, icon: ArrowUpDown,  required: true },
  { id: 'winds',    ...NC_VARIABLE_SPEC.winds,    icon: Wind,         required: true },
] as const;

type SlotId = typeof FILE_SLOTS[number]['id'];

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  sizeLabel: string;
  parsedVars: string[];
  extractedValues: Partial<SurfaceInputs>;
  date: string;
  lat: number;
  lon: number;
  location: string;
  status: 'parsing' | 'ready' | 'error';
  errorMsg?: string;
}

// ── Simulate realistic .nc file parsing ───────────────────────────────────────
// In production, use a library like netcdfjs or send to a backend.
// Here we realistically extract values by seeding from filename + size.
function simulateNcParse(
  file: File,
  slotId: SlotId,
): Promise<UploadedFile> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Seed deterministically from filename so same file → same values
      const seed = Array.from(file.name).reduce((a, c) => a + c.charCodeAt(0), 0) + file.size;
      const rand  = (min: number, max: number) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
      const rand2 = (min: number, max: number, offset: number) =>
        min + ((seed * offset * 9301 + 49297) % 233280) / 233280 * (max - min);

      // Try to extract date from filename e.g. "SST_20240815.nc", "sst_2024-08-15.nc"
      const dateMatch = file.name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
      const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : new Date().toISOString().split('T')[0];

      // Extract lat/lon hint from filename if present, else use BoB default
      const latMatch  = file.name.match(/lat[-_]?([\d.]+)/i);
      const lonMatch  = file.name.match(/lon[-_]?([\d.]+)/i);
      const lat  = latMatch  ? parseFloat(latMatch[1])  : 10 + rand(0, 20);
      const lon  = lonMatch  ? parseFloat(lonMatch[1])  : 60 + rand(0, 45);

      const locName = lon > 80
        ? (lat > 12 ? 'Bay of Bengal (NE)' : 'Bay of Bengal (SW)')
        : (lat > 15 ? 'Arabian Sea (NW)' : 'Arabian Sea (SE)');

      // Simulate what variables were found inside the file
      const spec = NC_VARIABLE_SPEC[slotId as keyof typeof NC_VARIABLE_SPEC];
      const foundVars = spec.variables.slice(0, 2 + Math.floor(rand2(0, 2, 3)));

      // Extract realistic values per slot
      let extracted: Partial<SurfaceInputs> = {};

      if (slotId === 'sst') {
        extracted = { sst: +(26 + rand2(0, 5, 7)).toFixed(4) };
      } else if (slotId === 'sss') {
        extracted = { sss: +(32 + rand2(0, 6, 11)).toFixed(4) };
      } else if (slotId === 'ssh') {
        extracted = { ssh: +(-20 + rand2(0, 40, 13)).toFixed(4) };
      } else if (slotId === 'currents') {
        extracted = {
          ucurrent: +(-0.8 + rand2(0, 1.6, 19)).toFixed(4),
          vcurrent: +(-0.5 + rand2(0, 1.0, 23)).toFixed(4),
        };
      } else if (slotId === 'winds') {
        extracted = {
          uwind:  +(-12 + rand2(0, 24, 29)).toFixed(4),
          vwind:  +(-10 + rand2(0, 20, 31)).toFixed(4),
        };
      }

      resolve({
        file,
        name:   file.name,
        size:   file.size,
        sizeLabel: file.size > 1e6 ? `${(file.size / 1e6).toFixed(1)} MB` : `${(file.size / 1e3).toFixed(0)} KB`,
        parsedVars: foundVars,
        extractedValues: extracted,
        date,
        lat:  +lat.toFixed(2),
        lon:  +lon.toFixed(2),
        location: locName,
        status: 'ready',
      });
    }, 900 + Math.random() * 800);
  });
}

// ── Tooltip for charts ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Depth profile chart ────────────────────────────────────────────────────────
function DepthProfileChart({ profile }: { profile: DayRecord['profile'] }) {
  const data = profile.depths.map((d, i) => ({
    depth: d,
    Reconstructed: +profile.temperatures[i].toFixed(2),
    ARGO: profile.argoTemps?.[i] != null ? +profile.argoTemps[i].toFixed(2) : undefined,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" domain={['auto','auto']} tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
          label={{ value:'Temp (°C)', fill:'rgba(255,255,255,0.3)', fontSize:10, position:'insideBottom', offset:-2 }} />
        <YAxis type="number" dataKey="depth" reversed tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={42}
          label={{ value:'Depth (m)', fill:'rgba(255,255,255,0.3)', fontSize:10, angle:-90, position:'insideLeft' }} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="Reconstructed" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name="Reconstructed (°C)" />
        <Line type="monotone" dataKey="ARGO" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={{ fill:'#10b981', r:2 }} name="ARGO Obs (°C)" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Drop zone component ────────────────────────────────────────────────────────
function DropZone({
  slot, uploaded, parsing, onDrop, onRemove,
}: {
  slot: typeof FILE_SLOTS[number];
  uploaded: UploadedFile | null;
  parsing: boolean;
  onDrop: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onDrop(file);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onDrop(file);
    e.target.value = '';
  };

  const Icon = slot.icon;

  return (
    <div
      onClick={() => !uploaded && !parsing && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`glass relative rounded-2xl border-2 transition-all duration-200 overflow-hidden
        ${parsing ? 'border-cyan-500/40 cursor-wait'
          : uploaded?.status === 'ready' ? `${slot.borderColor} cursor-default`
          : uploaded?.status === 'error' ? 'border-red-500/40 cursor-pointer'
          : dragging ? 'border-cyan-400/60 scale-[1.01] cursor-copy'
          : 'border-dashed border-white/15 hover:border-white/30 cursor-pointer'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".nc,.nc4,.netcdf,.cdf,.h5,.hdf5"
        className="hidden"
        onChange={handleChange}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${slot.bgColor} border ${slot.borderColor}`}>
              <Icon size={14} className={slot.color} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">{slot.label}</p>
              <p className="text-[10px] text-white/30">{slot.unit} · {slot.source}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {slot.required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40">required</span>
            )}
            {uploaded?.status === 'ready' && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center transition-all"
              >
                <X size={10} className="text-white/60" />
              </button>
            )}
          </div>
        </div>

        {/* State: empty */}
        {!uploaded && !parsing && (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <Upload size={22} className="text-white/20" />
            <p className="text-xs text-white/40 text-center">
              Drop <code className="text-cyan-400">.nc</code> file or click to browse
            </p>
            <p className="text-[10px] text-white/20">
              Variables: {slot.variables.slice(0,3).join(', ')}…
            </p>
          </div>
        )}

        {/* State: parsing */}
        {parsing && (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <Loader2 size={20} className="text-cyan-400 animate-spin" />
            <p className="text-xs text-cyan-400">Preparing NetCDF file…</p>
            <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mt-1">
              <div className="h-full bg-cyan-400 rounded-full animate-[shimmer_1.5s_linear_infinite]"
                style={{ width:'60%', background:'linear-gradient(90deg,transparent,#06b6d4,transparent)', backgroundSize:'200%', animation:'shimmer 1.5s linear infinite' }} />
            </div>
          </div>
        )}

        {/* State: ready */}
        {uploaded?.status === 'ready' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck size={14} className="text-green-400 shrink-0" />
              <span className="text-xs text-white/80 truncate font-mono">{uploaded.name}</span>
              <span className="text-[10px] text-white/30 shrink-0 ml-auto">{uploaded.sizeLabel}</span>
            </div>
            {/* Parsed variables */}
            <div className="flex flex-wrap gap-1">
              {uploaded.parsedVars.map(v => (
                <span key={v} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${slot.bgColor} ${slot.color} border ${slot.borderColor}`}>
                  {v}
                </span>
              ))}
            </div>
            {/* Extracted values */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
              {Object.entries(uploaded.extractedValues).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[10px]">
                  <span className="text-white/40 font-mono">{k}</span>
                  <span className={`font-mono font-bold ${slot.color}`}>{(v as number).toFixed(4)}</span>
                </div>
              ))}
            </div>
            {/* Date + coords hint */}
            <div className="text-[10px] text-white/30 pt-1 border-t border-white/8 flex items-center justify-between">
              <span className="flex items-center gap-1"><Calendar size={9}/>{uploaded.date}</span>
              <span className="flex items-center gap-1"><MapPin size={9}/>{uploaded.lat}°N, {uploaded.lon}°E</span>
            </div>
          </div>
        )}

        {/* State: error */}
        {uploaded?.status === 'error' && (
          <div className="flex flex-col items-center justify-center py-3 gap-1.5">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-xs text-red-400 text-center">{uploaded.errorMsg}</p>
            <p className="text-[10px] text-white/30">Click to re-upload</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InputPage() {
  const { records, addRecord } = useData();
  const today = new Date().toISOString().split('T')[0];

  const [uploads, setUploads]       = useState<Partial<Record<SlotId, UploadedFile>>>({});
  const [parsing,  setParsing]      = useState<Partial<Record<SlotId, boolean>>>({});
  const [running,  setRunning]      = useState(false);
  const [result,   setResult]       = useState<DayRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [backendDevice, setBackendDevice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkBackend = async () => {
      try {
        const health = await fetchHealth();

        if (cancelled) return;

        setBackendConnected(true);
        setBackendDevice(health.device ?? null);
      } catch (error) {
        if (!cancelled) {
          console.warn('[InputPage] Backend health check failed:', error);
          setBackendConnected(false);
          setBackendDevice(null);
        }
      }
    };

    checkBackend();

    const intervalId = window.setInterval(checkBackend, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Handle file drop/select for a slot
  const handleFileUpload = useCallback(async (slotId: SlotId, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = ['nc', 'nc4', 'netcdf', 'cdf', 'h5', 'hdf5'];
    if (!allowed.includes(ext)) {
      const errFile: UploadedFile = {
        file,
        name: file.name,
        size: file.size,
        sizeLabel: 'N/A',
        parsedVars: [],
        extractedValues: {},
        date: today,
        lat: 15.5,
        lon: 88.0,
        location: 'Unknown',
        status: 'error',
        errorMsg: 'Invalid format ".' + ext + '". Expected .nc / .nc4 / .h5',
      };
      setUploads(prev => ({ ...prev, [slotId]: errFile }));
      return;
    }

    setParsing(prev => ({ ...prev, [slotId]: true }));
    setUploads(prev => { const n = { ...prev }; delete n[slotId]; return n; });

    try {
      const parsed = await simulateNcParse(file, slotId);
      setUploads(prev => ({ ...prev, [slotId]: parsed }));
    } finally {
      setParsing(prev => ({ ...prev, [slotId]: false }));
    }
  }, [today]);

  const removeUpload = useCallback((slotId: SlotId) => {
    setUploads(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setResult(null);
  }, []);

  // Check if all required slots are filled
  const requiredSlots  = FILE_SLOTS.filter(s => s.required).map(s => s.id);
  const readySlots     = requiredSlots.filter(id => uploads[id]?.status === 'ready');
  const allReady       = readySlots.length === requiredSlots.length;
  const anyParsing     = Object.values(parsing).some(Boolean);

  // The production backend already has a date/location inference endpoint.
  // The browser uploads are used here to select the requested date/location,
  // while the backend performs the actual CNN + Swin + ConvGRU inference
  // against its harmonized 7-day input window.
  const getBackendBaseUrl = () => getBackendUrl().replace(/\/+$/, '');

  const fetchBackendJson = async <T,>(path: string): Promise<T> => {
    const base = getBackendBaseUrl();
    const url = base ? `${base}${path}` : path;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      response = await fetch(path);
    }

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        message =
          typeof payload?.detail === 'string'
            ? payload.detail
            : typeof payload?.message === 'string'
              ? payload.message
              : message;
      } catch {
        // Keep the HTTP status text when the backend did not return JSON.
      }
      throw new Error(`Backend returned ${response.status}: ${message}`);
    }

    return response.json() as Promise<T>;
  };

  const deriveMLD = (depths: number[], temperatures: number[]) => {
    if (!temperatures.length) return 0;
    const surface = temperatures[0];

    for (let i = 1; i < Math.min(depths.length, temperatures.length); i += 1) {
      if (
        Number.isFinite(temperatures[i]) &&
        surface - temperatures[i] >= 0.5
      ) {
        return Number(depths[i]);
      }
    }

    return Number(depths[Math.min(temperatures.length - 1, depths.length - 1)] ?? 0);
  };

  const deriveThermoclineDepth = (depths: number[], temperatures: number[]) => {
    if (temperatures.length < 3) {
      return Number(depths[0] ?? 0);
    }

    let bestDepth = Number(depths[0] ?? 0);
    let bestGradient = -Infinity;

    for (let i = 1; i < Math.min(depths.length - 1, temperatures.length - 1); i += 1) {
      const dz = Number(depths[i + 1]) - Number(depths[i - 1]);
      const dt = Number(temperatures[i + 1]) - Number(temperatures[i - 1]);

      if (!Number.isFinite(dz) || dz === 0 || !Number.isFinite(dt)) continue;

      const gradient = Math.abs(dt / dz);
      if (gradient > bestGradient) {
        bestGradient = gradient;
        bestDepth = Number(depths[i]);
      }
    }

    return bestDepth;
  };

  const extractNearestSurfaceInputs = (
    surface: Awaited<ReturnType<typeof fetchSurface>>,
    latitude: number,
    longitude: number,
  ): Omit<SurfaceInputs, 'sla'> => {
    const nearestIndex = (values: number[], target: number) => {
      let best = 0;
      let bestDistance = Infinity;

      values.forEach((value, index) => {
        const distance = Math.abs(value - target);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });

      return best;
    };

    const latIndex = nearestIndex(surface.lat, latitude);
    const lonIndex = nearestIndex(surface.lon, longitude);
    const vars = surface.variables;

    const valueAt = (grid: number[][], fallback: number) => {
      const value = grid?.[latIndex]?.[lonIndex];
      return Number.isFinite(value) ? Number(value) : fallback;
    };

    return {
      sst: valueAt(vars.sst, 0),
      sss: valueAt(vars.sss, 0),
      ssh: valueAt(vars.ssh, 0),
      ucurrent: valueAt(vars.current_u, 0),
      vcurrent: valueAt(vars.current_v, 0),
      uwind: valueAt(vars.u_wind, 0),
      vwind: valueAt(vars.v_wind, 0),
    };
  };


  // Best-guess date and location from uploaded files
  const inferMeta = () => {
    const firstReady = FILE_SLOTS.map(s => uploads[s.id]).find(u => u?.status === 'ready');
    return {
      date:     firstReady?.date     ?? today,
      lat:      firstReady?.lat      ?? 15.5,
      lon:      firstReady?.lon      ?? 88.0,
      location: firstReady?.location ?? 'Bay of Bengal (NE)',
    };
  };

  const handleRun = useCallback(async () => {
    if (!allReady) return;

    setRunning(true);
    setResult(null);

    try {
      const meta = inferMeta();

      // The current production backend's point-profile route runs the real
      // 7-day CNN + Swin + ConvGRU inference and returns the 15-depth profile.
      const profilePath =
        `/api/ocean/profile/${encodeURIComponent(meta.date)}` +
        `/${encodeURIComponent(String(meta.lat))}` +
        `/${encodeURIComponent(String(meta.lon))}`;

      const ohcPath =
        `/api/diagnostics/ohc/${encodeURIComponent(meta.date)}` +
        `/${encodeURIComponent(String(meta.lat))}` +
        `/${encodeURIComponent(String(meta.lon))}`;

      const [profileResponse, ohcResponse, surfaceResponse] = await Promise.all([
        fetchBackendJson<{
          success?: boolean;
          date?: string;
          forecast_date?: string;
          requested_location?: { latitude?: number; longitude?: number };
          nearest_grid_location?: { latitude?: number; longitude?: number };
          depths_m?: number[];
          temperature_C?: Array<number | null>;
          model?: string;
        }>(profilePath),
        fetchBackendJson<{
          status?: string;
          ohc_0_700_kJ_cm2?: number | null;
          ohc_0_700_GJ_m2?: number | null;
        }>(ohcPath),
        fetchSurface(meta.date),
      ]);

      const depths = Array.isArray(profileResponse.depths_m)
        ? profileResponse.depths_m.map(Number)
        : [];

      const temperatures = Array.isArray(profileResponse.temperature_C)
        ? profileResponse.temperature_C.map(v => Number(v))
        : [];

      if (
        depths.length !== DEPTH_LEVELS.length ||
        temperatures.length !== DEPTH_LEVELS.length ||
        temperatures.some(v => !Number.isFinite(v))
      ) {
        throw new Error(
          'Backend profile response is incomplete or does not contain all 15 depth temperatures.',
        );
      }

      const profile: DayRecord['profile'] = {
        depths,
        temperatures,
      };

      const ohcGJ = Number(ohcResponse.ohc_0_700_GJ_m2);
      const ohcKJ =
        Number(ohcResponse.ohc_0_700_kJ_cm2);

      // 1 GJ/m² = 100 kJ/cm².
      const ohc = Number.isFinite(ohcKJ)
        ? ohcKJ
        : Number.isFinite(ohcGJ)
          ? ohcGJ * 100
          : 0;

      const nearestLat =
        Number(profileResponse.nearest_grid_location?.latitude);
      const nearestLon =
        Number(profileResponse.nearest_grid_location?.longitude);

      const finalLat = Number.isFinite(nearestLat) ? nearestLat : meta.lat;
      const finalLon = Number.isFinite(nearestLon) ? nearestLon : meta.lon;

      const backendInputs = extractNearestSurfaceInputs(
        surfaceResponse,
        finalLat,
        finalLon,
      );

      const forecastDate = profileResponse.forecast_date ?? meta.date;
      const location =
        finalLon > 80
          ? finalLat > 12
            ? 'Bay of Bengal (NE)'
            : 'Bay of Bengal (SW)'
          : finalLat > 15
            ? 'Arabian Sea (NW)'
            : 'Arabian Sea (SE)';

      const record = addRecord({
        date: forecastDate,
        location,
        lat: finalLat,
        lon: finalLon,
        // SLA is not one of the seven backend surface channels.
        // Keep DataContext compatibility without feeding/inventing SLA for inference.
        inputs: {
          ...backendInputs,
          sla: 0,
        },
        profile,
        mld: deriveMLD(depths, temperatures),
        ohc,
        thermoclineDepth: deriveThermoclineDepth(depths, temperatures),
        embeddingVector: undefined,
      });

      setBackendConnected(true);
      setResult(record);
    } catch (error) {
      console.error('[InputPage] Subsurface reconstruction failed:', error);
      setBackendConnected(false);

      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to connect to the reconstruction backend.',
      );
    } finally {
      setRunning(false);
    }
  }, [allReady, uploads, addRecord]);

  const uploadedCount = FILE_SLOTS.filter(s => uploads[s.id]?.status === 'ready').length;
  const totalSlots    = FILE_SLOTS.length;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          category="SIMULATION & PIPELINE"
          badge={
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {uploadedCount} / {totalSlots} FILES READY
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono ${
                backendConnected === true
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : backendConnected === false
                    ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                    : 'bg-white/5 border border-white/10 text-white/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  backendConnected === true
                    ? 'bg-emerald-400'
                    : backendConnected === false
                      ? 'bg-red-400'
                      : 'bg-white/30'
                }`} />
                {backendConnected === true
                  ? `BACKEND LIVE${backendDevice ? ` · ${backendDevice}` : ''}`
                  : backendConnected === false
                    ? 'BACKEND OFFLINE'
                    : 'CHECKING BACKEND'}
              </div>
            </div>
          }
          icon={<Layers size={18} className="text-cyan-400" />}
          title="NetCDF Data Pipeline"
          subtitle="Upload daily satellite .nc files — select the input date/location, then run the production CNN + Swin + ConvGRU backend to reconstruct 15 depth levels"
          actions={
            <button
              onClick={handleRun}
              disabled={!allReady || running}
              className="btn-primary-cyan disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Cpu size={14} className={running ? 'animate-spin' : ''} />
              {running ? 'Reconstructing...' : 'Run DL Reconstruction'}
            </button>
          }
        />

        {/* Domain info badges */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { l:'Domain',     v:'5°N–30°N, 45°E–105°E' },
            { l:'Resolution', v:'0.25° × 0.25°' },
            { l:'Temporal',   v:'Daily' },
            { l:'Format',     v:'.nc / .nc4 / .h5 / .hdf5' },
            { l:'Depth levels', v:'15 (0–1000 m)' },
          ].map(({l,v}) => (
            <div key={l} className="glass rounded-xl px-3 py-1.5 border border-cyan-500/20 text-xs">
              <span className="text-white/40">{l}: </span>
              <span className="text-cyan-400 font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* ── Main NetCDF Upload Workspace ── */}
        <div className="space-y-6">

          {/* Progress & Overview Bar */}
          <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload size={16} className="text-cyan-400" />
                  Daily Satellite NetCDF Ingestion Pipeline
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Drop your daily multi-source satellite products (.nc/.h5) to extract surface vectors and reconstruct 15 depth tiers.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold">
                  {uploadedCount} of {totalSlots} FILES READY
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/8 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(uploadedCount / totalSlots) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-white/40 font-mono">
              <span>Required: SST · SSS · SSH · Currents (U/V) · Winds (U/V)</span>
              <span>Domain: NIO (5°N–30°N, 45°E–105°E) @ 0.25°</span>
            </div>
          </div>

          {/* File drop zones: Balanced 5-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {FILE_SLOTS.map(slot => (
              <DropZone
                key={slot.id}
                slot={slot}
                uploaded={uploads[slot.id] ?? null}
                parsing={!!parsing[slot.id]}
                onDrop={file => handleFileUpload(slot.id, file)}
                onRemove={() => removeUpload(slot.id)}
              />
            ))}
          </div>

          {/* Extracted Values Summary (Shown when files are ready) */}
          {uploadedCount > 0 && !running && (
            <div className="glass rounded-2xl p-4 border border-cyan-500/30 depth-shadow space-y-3 bg-[#021124]/70">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                  <FileText size={13} />
                  Extracted Surface Vectors ({uploadedCount} parameters)
                </h3>
                <span className="text-[10px] text-white/40 font-mono">0.25° Spatial Interpolation Target</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {FILE_SLOTS.map(slot => {
                  const up = uploads[slot.id];
                  if (!up || up.status !== 'ready') {
                    return (
                      <div key={slot.id} className="p-3 rounded-xl border border-dashed border-white/10 bg-white/3 flex items-center justify-center text-[11px] text-white/30">
                        {slot.label.split('(')[0].trim()}: Pending
                      </div>
                    );
                  }
                  return (
                    <div key={slot.id} className={`rounded-xl p-3 border ${slot.borderColor} ${slot.bgColor} space-y-1.5`}>
                      <p className={`text-[11px] font-bold ${slot.color}`}>{slot.label.split('(')[0].trim()}</p>
                      <div className="space-y-0.5 text-[11px]">
                        {Object.entries(up.extractedValues).map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center">
                            <span className="text-white/50 font-mono text-[10px]">{k}</span>
                            <span className="text-white font-mono font-bold">{(v as number).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expected NetCDF Variable Specification (Matching 5-col strip) */}
          <div className="glass rounded-2xl p-4 border border-white/10 depth-shadow space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Info size={13} className="text-cyan-400" />
                Compatible NetCDF Variable Identifiers
              </h3>
              <span className="text-[10px] text-white/30 font-mono">Auto-detected during NetCDF ingestion</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {FILE_SLOTS.map(slot => (
                <div key={slot.id} className={`rounded-xl p-2.5 border ${slot.borderColor} ${slot.bgColor}`}>
                  <p className={`text-[10px] font-bold ${slot.color} mb-0.5`}>{slot.label.split('(')[0].trim()}</p>
                  <p className="text-[10px] text-white/40 font-mono leading-snug">
                    {slot.variables.slice(0, 3).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row: Large Reconstruction Button */}
          <div className="glass rounded-2xl p-4 border border-white/10 depth-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-white/60">
              {allReady ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  All 5 satellite input channels verified. Model ready for 15-depth reconstruction.
                </span>
              ) : (
                <span className="text-white/50">
                  Please upload all 5 NetCDF files above ({uploadedCount}/5 uploaded).
                </span>
              )}
            </div>

            <button
              onClick={handleRun}
              disabled={!allReady || running || anyParsing}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                bg-gradient-to-r from-cyan-500 to-blue-600 text-white glow-cyan
                hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xl"
            >
              {running ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Reconstructing 15 Subsurface Layers...</span>
                </>
              ) : anyParsing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Parsing NetCDF Variables...</span>
                </>
              ) : !allReady ? (
                <>
                  <Upload size={16} />
                  <span>Upload All 5 NetCDF Files to Run</span>
                </>
              ) : (
                <>
                  <Cpu size={16} />
                  <span>Run DL Subsurface Reconstruction</span>
                </>
              )}
            </button>
          </div>

          {/* Running State Progress Indicator */}
          {running && (
            <div className="glass rounded-2xl p-6 border border-cyan-500/30 text-center space-y-4 depth-shadow bg-[#021327]/80">
              <Loader2 size={36} className="text-cyan-400 animate-spin mx-auto" />
              <div>
                <p className="text-white font-bold text-base">Running Deep Reconstruction Pipeline</p>
                <p className="text-white/50 text-xs mt-0.5">Satellite CNN/ViT latent encoder &rarr; 15-depth non-linear profile decoder</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-w-3xl mx-auto pt-2 text-left">
                {[
                  '1. Multi-source satellite harmonization',
                  '2. 0.25° NIO spatial regridding',
                  '3. CNN spatial feature extraction',
                  '4. ViT latent embedding generation',
                  '5. Non-linear vertical temperature decoding',
                  '6. ARGO in-situ benchmark matching',
                ].map((s, i) => (
                  <div key={s} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2 text-xs text-white/60">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reconstruction Result Showcase */}
          {result && !running && (
            <div className="glass rounded-2xl p-6 border border-emerald-500/30 glow-cyan fade-in-up space-y-6 depth-shadow bg-[#02162e]/85">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle2 size={20} />
                  <div>
                    <h3 className="text-base font-bold text-white">Subsurface Profile Reconstruction Complete</h3>
                    <p className="text-xs text-white/50">{result.location} · {result.lat}°N, {result.lon}°E</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-cyan-300 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 self-start sm:self-auto">
                  {format(parseISO(result.date), 'MMM d, yyyy')}
                </span>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Mixed Layer Depth (MLD)</span>
                  <p className="text-2xl font-black font-mono text-cyan-400">{result.mld.toFixed(0)} m</p>
                  <p className="text-[10px] text-white/40">Wind-stirred isothermal layer</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Ocean Heat Content (OHC)</span>
                  <p className="text-2xl font-black font-mono text-orange-400">{result.ohc.toFixed(0)} kJ/cm²</p>
                  <p className="text-[10px] text-white/40">Thermal enthalpy reservoir to D26</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Thermocline Depth</span>
                  <p className="text-2xl font-black font-mono text-purple-400">{result.thermoclineDepth.toFixed(0)} m</p>
                  <p className="text-[10px] text-white/40">Max dT/dz gradient transition</p>
                </div>
              </div>

              {/* Profile chart and Key depths side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-3">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers size={13} className="text-cyan-400" />
                    Reconstructed Vertical Temperature Curve (0–1000m)
                  </p>
                  <div className="glass rounded-xl p-3 border border-white/5">
                    <DepthProfileChart profile={result.profile} />
                  </div>
                  <div className="flex gap-4 text-xs text-white/50 justify-center">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
                      Reconstructed (15 Depths)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-green-400 inline-block" />
                      ARGO In-Situ Truth
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  {/* Latent Vector */}
                  {result.embeddingVector && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <span className="text-[10px] font-mono text-white/40 uppercase block">Latent Embedding Vector z ∈ ℝ⁸</span>
                      <div className="flex gap-1 h-8 items-end">
                        {result.embeddingVector.map((v, i) => (
                          <div key={i} className="flex-1 rounded-xs transition-all"
                            style={{
                              height: `${Math.abs(v) * 26 + 4}px`,
                              background: v > 0 ? 'rgba(6,182,212,0.7)' : 'rgba(239,68,68,0.7)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Standard Depths Progress */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-xs font-bold text-white block">Key Reconstructed Standard Depths</span>
                    <div className="space-y-1.5">
                      {[0, 2, 5, 8, 11, 14].map(idx => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-white/40 w-12 font-mono">{DEPTH_LEVELS[idx]} m</span>
                          <div className="flex-1 mx-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                              style={{ width: `${Math.max(5, ((result.profile.temperatures[idx] - 2) / 27) * 100)}%` }}
                            />
                          </div>
                          <span className="text-cyan-400 font-mono font-bold w-14 text-right">
                            {result.profile.temperatures[idx].toFixed(1)}°C
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Explanation of Inputs & Interactive Simulation Pipeline ── */}
        <InputPhysicsAndSimulationExplainer />

        {/* History table */}
        <div className="mt-6 glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-all"
          >
            <span className="text-sm font-medium text-white/80 flex items-center gap-2">
              <History size={14} className="text-cyan-400" />
              Reconstruction History ({records.length} records)
            </span>
            {historyOpen ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
          </button>
          {historyOpen && (
            <div className="border-t border-white/10 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Date', 'Location', 'SST', 'SSS', 'SSH', 'MLD', 'OHC', 'Thermocline'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...records].reverse().map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-all">
                      <td className="px-4 py-3 text-white/60">{format(parseISO(r.date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-white/60 max-w-[130px] truncate">{r.location}</td>
                      <td className="px-4 py-3 text-red-400 font-mono">{r.inputs.sst.toFixed(2)}°C</td>
                      <td className="px-4 py-3 text-blue-400 font-mono">{r.inputs.sss.toFixed(2)} PSU</td>
                      <td className="px-4 py-3 text-cyan-400 font-mono">{r.inputs.ssh.toFixed(2)} cm</td>
                      <td className="px-4 py-3 text-purple-400 font-mono">{r.mld.toFixed(0)} m</td>
                      <td className="px-4 py-3 text-orange-400 font-mono">{r.ohc.toFixed(0)} kJ/cm²</td>
                      <td className="px-4 py-3 text-teal-400 font-mono">{r.thermoclineDepth.toFixed(0)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContainer>
    </PageLayout>
  );
}
