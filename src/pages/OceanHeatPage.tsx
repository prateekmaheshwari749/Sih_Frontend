import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Thermometer,
  Layers,
  Activity,
  Wind,
  Waves,
  Shield,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Download,
  RefreshCw,
  Info,
  Calendar,
  Zap,
  Sliders,
  Sparkles,
  Compass,
  FileText,
  CheckCircle2,
  ChevronRight,
  Droplets
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Popup,
  Polyline,
  Circle,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageLayout, { PageContainer, PageHeader } from '../components/PageLayout';
import IndiaFlag from '../components/IndiaFlag';
import {
  fetchOceanDiagnostics,
  fetchOceanDiagnosticMap,
  type OceanDiagnosticsResponse,
  type OceanDiagnosticMapResponse,
} from '../api/oceanApi';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─────────────────────────────────────────────────────────────────────────────
// REGIONAL OCEAN HEAT SITES & BUOYS DATA
// ─────────────────────────────────────────────────────────────────────────────

interface OceanHeatProbe {
  id: string;
  name: string;
  region: 'Bay of Bengal' | 'Arabian Sea' | 'Equatorial Indian Ocean' | 'Andaman Sea' | 'Lakshadweep';
  lat: number;
  lon: number;
  sst: number;
  tchp: number; // kJ/cm²
  d26: number; // meters
  mld: number; // Mixed Layer Depth (meters)
  ohc700: number; // GJ/m²
  dhw: number; // Degree Heating Weeks (°C-weeks)
  mhwCategory: 'None' | 'Cat I (Moderate)' | 'Cat II (Strong)' | 'Cat III (Severe)' | 'Cat IV (Extreme)';
  coralRisk: 'Low' | 'Moderate' | 'Alert Level 1' | 'Alert Level 2';
  cycloneFuel: 'Suppressed' | 'Favorable' | 'Rapid Intensification Risk' | 'Extreme Energy Engine';
  temperatures: { depth: number; temp: number; heatDensity: number }[];
}

const REGIONAL_PROBES: OceanHeatProbe[] = [
  {
    id: 'bob-central',
    name: 'Central Bay of Bengal (RAMA 15°N 90°E)',
    region: 'Bay of Bengal',
    lat: 15.0,
    lon: 90.0,
    sst: 30.6,
    tchp: 114.5,
    d26: 82,
    mld: 28,
    ohc700: 1.84,
    dhw: 3.8,
    mhwCategory: 'Cat II (Strong)',
    coralRisk: 'Moderate',
    cycloneFuel: 'Extreme Energy Engine',
    temperatures: [
      { depth: 0, temp: 30.6, heatDensity: 128.2 },
      { depth: 10, temp: 30.4, heatDensity: 127.4 },
      { depth: 20, temp: 30.2, heatDensity: 126.5 },
      { depth: 30, temp: 29.8, heatDensity: 124.9 },
      { depth: 50, temp: 28.9, heatDensity: 121.1 },
      { depth: 75, temp: 27.2, heatDensity: 114.0 },
      { depth: 100, temp: 24.8, heatDensity: 103.9 },
      { depth: 150, temp: 19.5, heatDensity: 81.7 },
      { depth: 200, temp: 15.2, heatDensity: 63.7 },
      { depth: 300, temp: 11.8, heatDensity: 49.4 },
      { depth: 500, temp: 8.4, heatDensity: 35.2 },
      { depth: 700, temp: 6.1, heatDensity: 25.6 },
      { depth: 1000, temp: 4.8, heatDensity: 20.1 },
    ],
  },
  {
    id: 'andaman-south',
    name: 'South Andaman Sea Deep Reservoir',
    region: 'Andaman Sea',
    lat: 11.5,
    lon: 93.5,
    sst: 31.2,
    tchp: 128.0,
    d26: 95,
    mld: 32,
    ohc700: 2.05,
    dhw: 6.2,
    mhwCategory: 'Cat III (Severe)',
    coralRisk: 'Alert Level 2',
    cycloneFuel: 'Extreme Energy Engine',
    temperatures: [
      { depth: 0, temp: 31.2, heatDensity: 130.7 },
      { depth: 10, temp: 31.0, heatDensity: 129.9 },
      { depth: 20, temp: 30.8, heatDensity: 129.1 },
      { depth: 30, temp: 30.3, heatDensity: 127.0 },
      { depth: 50, temp: 29.5, heatDensity: 123.6 },
      { depth: 75, temp: 28.2, heatDensity: 118.2 },
      { depth: 100, temp: 25.9, heatDensity: 108.5 },
      { depth: 150, temp: 21.0, heatDensity: 88.0 },
      { depth: 200, temp: 16.5, heatDensity: 69.1 },
      { depth: 300, temp: 12.6, heatDensity: 52.8 },
      { depth: 500, temp: 9.1, heatDensity: 38.1 },
      { depth: 700, temp: 6.8, heatDensity: 28.5 },
      { depth: 1000, temp: 5.2, heatDensity: 21.8 },
    ],
  },
  {
    id: 'as-eastern',
    name: 'Southeast Arabian Sea (AD02 Buoy)',
    region: 'Arabian Sea',
    lat: 13.2,
    lon: 72.8,
    sst: 29.8,
    tchp: 86.2,
    d26: 62,
    mld: 24,
    ohc700: 1.55,
    dhw: 2.1,
    mhwCategory: 'Cat I (Moderate)',
    coralRisk: 'Low',
    cycloneFuel: 'Rapid Intensification Risk',
    temperatures: [
      { depth: 0, temp: 29.8, heatDensity: 124.9 },
      { depth: 10, temp: 29.6, heatDensity: 124.0 },
      { depth: 20, temp: 29.1, heatDensity: 121.9 },
      { depth: 30, temp: 28.3, heatDensity: 118.6 },
      { depth: 50, temp: 26.8, heatDensity: 112.3 },
      { depth: 75, temp: 24.1, heatDensity: 101.0 },
      { depth: 100, temp: 21.5, heatDensity: 90.1 },
      { depth: 150, temp: 17.8, heatDensity: 74.6 },
      { depth: 200, temp: 14.5, heatDensity: 60.8 },
      { depth: 300, temp: 11.2, heatDensity: 46.9 },
      { depth: 500, temp: 8.0, heatDensity: 33.5 },
      { depth: 700, temp: 5.9, heatDensity: 24.7 },
      { depth: 1000, temp: 4.5, heatDensity: 18.9 },
    ],
  },
  {
    id: 'lakshadweep-sea',
    name: 'Lakshadweep Coral Barrier & Sea',
    region: 'Lakshadweep',
    lat: 10.5,
    lon: 72.6,
    sst: 30.2,
    tchp: 92.4,
    d26: 68,
    mld: 26,
    ohc700: 1.62,
    dhw: 4.9,
    mhwCategory: 'Cat II (Strong)',
    coralRisk: 'Alert Level 1',
    cycloneFuel: 'Rapid Intensification Risk',
    temperatures: [
      { depth: 0, temp: 30.2, heatDensity: 126.5 },
      { depth: 10, temp: 30.0, heatDensity: 125.7 },
      { depth: 20, temp: 29.5, heatDensity: 123.6 },
      { depth: 30, temp: 28.8, heatDensity: 120.7 },
      { depth: 50, temp: 27.2, heatDensity: 114.0 },
      { depth: 75, temp: 24.9, heatDensity: 104.3 },
      { depth: 100, temp: 22.1, heatDensity: 92.6 },
      { depth: 150, temp: 18.3, heatDensity: 76.7 },
      { depth: 200, temp: 15.0, heatDensity: 62.9 },
      { depth: 300, temp: 11.5, heatDensity: 48.2 },
      { depth: 500, temp: 8.2, heatDensity: 34.4 },
      { depth: 700, temp: 6.0, heatDensity: 25.1 },
      { depth: 1000, temp: 4.6, heatDensity: 19.3 },
    ],
  },
  {
    id: 'eq-indian',
    name: 'Equatorial Indian Ocean Warm Pool',
    region: 'Equatorial Indian Ocean',
    lat: 2.0,
    lon: 85.0,
    sst: 30.8,
    tchp: 132.0,
    d26: 105,
    mld: 40,
    ohc700: 2.18,
    dhw: 1.8,
    mhwCategory: 'Cat I (Moderate)',
    coralRisk: 'Low',
    cycloneFuel: 'Extreme Energy Engine',
    temperatures: [
      { depth: 0, temp: 30.8, heatDensity: 129.1 },
      { depth: 10, temp: 30.7, heatDensity: 128.6 },
      { depth: 20, temp: 30.5, heatDensity: 127.8 },
      { depth: 30, temp: 30.1, heatDensity: 126.1 },
      { depth: 50, temp: 29.6, heatDensity: 124.0 },
      { depth: 75, temp: 28.8, heatDensity: 120.7 },
      { depth: 100, temp: 27.1, heatDensity: 113.6 },
      { depth: 150, temp: 22.4, heatDensity: 93.9 },
      { depth: 200, temp: 17.8, heatDensity: 74.6 },
      { depth: 300, temp: 13.5, heatDensity: 56.6 },
      { depth: 500, temp: 9.8, heatDensity: 41.1 },
      { depth: 700, temp: 7.2, heatDensity: 30.2 },
      { depth: 1000, temp: 5.4, heatDensity: 22.6 },
    ],
  },
  {
    id: 'gulf-mannar',
    name: 'Gulf of Mannar Biosphere Reserve',
    region: 'Bay of Bengal',
    lat: 9.0,
    lon: 79.2,
    sst: 31.0,
    tchp: 78.5,
    d26: 54,
    mld: 18,
    ohc700: 1.38,
    dhw: 5.4,
    mhwCategory: 'Cat II (Strong)',
    coralRisk: 'Alert Level 1',
    cycloneFuel: 'Favorable',
    temperatures: [
      { depth: 0, temp: 31.0, heatDensity: 129.9 },
      { depth: 10, temp: 30.8, heatDensity: 129.1 },
      { depth: 20, temp: 30.1, heatDensity: 126.1 },
      { depth: 30, temp: 28.6, heatDensity: 119.8 },
      { depth: 50, temp: 26.4, heatDensity: 110.6 },
      { depth: 75, temp: 23.5, heatDensity: 98.5 },
      { depth: 100, temp: 20.8, heatDensity: 87.2 },
      { depth: 150, temp: 16.9, heatDensity: 70.8 },
      { depth: 200, temp: 14.1, heatDensity: 59.1 },
      { depth: 300, temp: 10.9, heatDensity: 45.7 },
      { depth: 500, temp: 7.8, heatDensity: 32.7 },
      { depth: 700, temp: 5.8, heatDensity: 24.3 },
      { depth: 1000, temp: 4.4, heatDensity: 18.4 },
    ],
  },
];

// Historical OHC Climatological Trend Data (1990 to 2025)
const OHC_HISTORICAL_TREND = [
  { year: '1995', ohc0_700: 1.15, baseline: 1.18, anomaly: -0.03, tchpMean: 62 },
  { year: '2000', ohc0_700: 1.21, baseline: 1.18, anomaly: 0.03, tchpMean: 66 },
  { year: '2005', ohc0_700: 1.28, baseline: 1.18, anomaly: 0.10, tchpMean: 71 },
  { year: '2010', ohc0_700: 1.35, baseline: 1.18, anomaly: 0.17, tchpMean: 76 },
  { year: '2015', ohc0_700: 1.48, baseline: 1.18, anomaly: 0.30, tchpMean: 84 },
  { year: '2020', ohc0_700: 1.62, baseline: 1.18, anomaly: 0.44, tchpMean: 93 },
  { year: '2022', ohc0_700: 1.69, baseline: 1.18, anomaly: 0.51, tchpMean: 98 },
  { year: '2023', ohc0_700: 1.76, baseline: 1.18, anomaly: 0.58, tchpMean: 104 },
  { year: '2024', ohc0_700: 1.81, baseline: 1.18, anomaly: 0.63, tchpMean: 108 },
  { year: '2025 (Obs)', ohc0_700: 1.88, baseline: 1.18, anomaly: 0.70, tchpMean: 114 },
];

const OCEAN_HEAT_PAGE_STYLES = `
  .oceanheat-shell .leaflet-container {
    background: #020917 !important;
  }
  .oceanheat-shell .leaflet-popup-content-wrapper,
  .oceanheat-shell .leaflet-popup-tip {
    background: rgba(4, 18, 38, 0.95) !important;
    color: #ffffff !important;
    border: 1px solid rgba(34, 211, 238, 0.3) !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(12px) !important;
  }
`;

// Helper: Custom Tooltip for Recharts
function CleanChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-xl text-xs space-y-1 backdrop-blur-md text-slate-900">
      <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="font-medium" style={{ color: entry.color }}>
            {entry.name}:
          </span>
          <span className="font-mono font-bold text-slate-900">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Map Centering Helper

function OceanDiagnosticHeatOverlay({
  mapData,
  opacity = 0.58,
}: {
  mapData: OceanDiagnosticMapResponse | null;
  opacity?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!mapData || !mapData.lat.length || !mapData.lon.length || !mapData.values.length) {
      return;
    }

    const lat = mapData.lat;
    const lon = mapData.lon;
    const values = mapData.values;
    const height = values.length;
    const width = values[0]?.length ?? 0;
    if (!width || !height) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const finiteValues: number[] = [];
    for (const row of values) {
      for (const value of row) {
        if (typeof value === 'number' && Number.isFinite(value)) finiteValues.push(value);
      }
    }

    if (!finiteValues.length) return;

    finiteValues.sort((a, b) => a - b);
    const qLow = finiteValues[Math.floor((finiteValues.length - 1) * 0.02)];
    const qHigh = finiteValues[Math.floor((finiteValues.length - 1) * 0.98)];
    const minValue = qLow;
    const maxValue = qHigh > qLow ? qHigh : qLow + 1;

    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      const sourceRow = values[height - 1 - y] ?? [];
      for (let x = 0; x < width; x += 1) {
        const value = sourceRow[x];
        const offset = (y * width + x) * 4;
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          image.data[offset + 3] = 0;
          continue;
        }

        const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
        const hue = 220 - normalized * 210;
        const lightness = 46 + normalized * 8;
        const rgb = hslToRgb(hue / 360, 0.88, lightness / 100);
        image.data[offset] = rgb[0];
        image.data[offset + 1] = rgb[1];
        image.data[offset + 2] = rgb[2];
        image.data[offset + 3] = Math.round(255 * opacity);
      }
    }

    ctx.putImageData(image, 0, 0);

    const url = canvas.toDataURL('image/png');
    const bounds: L.LatLngBoundsExpression = [
      [Math.min(...lat), Math.min(...lon)],
      [Math.max(...lat), Math.max(...lon)],
    ];
    const overlay = L.imageOverlay(url, bounds, {
      opacity: 1,
      interactive: false,
      zIndex: 10,
    }).addTo(map);

    return () => {
      map.removeLayer(overlay);
    };
  }, [map, mapData, opacity]);

  return null;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue2rgb = (p: number, q: number, t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function MapFlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 6, { duration: 1.2 });
  }, [lat, lon, map]);
  return null;
}

const LIVE_OCEAN_END = '2026-09-18';
const SEAWATER_DENSITY = 1025;
const SEAWATER_CP = 3985;

function interpolateProfileTemperature(
  profile: { depth: number; temp: number }[],
  depth: number,
): number | null {
  if (!profile.length) return null;
  const sorted = [...profile].sort((a, b) => a.depth - b.depth);
  if (depth < sorted[0].depth || depth > sorted[sorted.length - 1].depth) return null;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].depth === depth) return sorted[i].temp;
    if (i > 0 && sorted[i].depth > depth) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const t = (depth - a.depth) / (b.depth - a.depth);
      return a.temp + (b.temp - a.temp) * t;
    }
  }
  return sorted[sorted.length - 1].temp;
}

function integrateProfileTemperature(
  profile: { depth: number; temp: number }[],
  startDepth: number,
  endDepth: number,
): number {
  const start = interpolateProfileTemperature(profile, startDepth);
  const end = interpolateProfileTemperature(profile, endDepth);
  if (start === null || end === null || endDepth <= startDepth) return 0;

  const interior = profile
    .filter(point => point.depth > startDepth && point.depth < endDepth)
    .sort((a, b) => a.depth - b.depth);
  const points = [
    { depth: startDepth, temp: start },
    ...interior,
    { depth: endDepth, temp: end },
  ];

  let integral = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dz = points[i].depth - points[i - 1].depth;
    integral += 0.5 * (points[i - 1].temp + points[i].temp) * dz;
  }
  return SEAWATER_DENSITY * SEAWATER_CP * integral;
}

export default function OceanHeatPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();

  // State
  const [selectedProbeId, setSelectedProbeId] = useState<string>('bob-central');
  const [metricMode, setMetricMode] = useState<'tchp' | 'ohc' | 'd26'>('tchp');
  const [diagnosticMap, setDiagnosticMap] = useState<OceanDiagnosticMapResponse | null>(null);
  const [diagnosticMapLoading, setDiagnosticMapLoading] = useState(false);
  const [diagnosticMapError, setDiagnosticMapError] = useState<string | null>(null);
  const [observationDate, setObservationDate] = useState<string>(() => {
    const saved = localStorage.getItem('ocean_shared_date');
    return saved && saved <= LIVE_OCEAN_END ? saved : LIVE_OCEAN_END;
  });
  const [latitude, setLatitude] = useState<number>(() => {
    const saved = localStorage.getItem('ocean_shared_lat');
    const value = saved == null ? 15 : Number(saved);
    return Number.isFinite(value) ? Math.min(30, Math.max(5, value)) : 15;
  });
  const [longitude, setLongitude] = useState<number>(() => {
    const saved = localStorage.getItem('ocean_shared_lon');
    const value = saved == null ? 90 : Number(saved);
    return Number.isFinite(value) ? Math.min(105, Math.max(45, value)) : 90;
  });
  const [latitudeInput, setLatitudeInput] = useState<string>(() => localStorage.getItem('ocean_shared_lat') ?? '15');
  const [longitudeInput, setLongitudeInput] = useState<string>(() => localStorage.getItem('ocean_shared_lon') ?? '90');
  const [liveDiagnostics, setLiveDiagnostics] = useState<OceanDiagnosticsResponse | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  
  // Interactive Simulator States
  const [solarFluxW, setSolarFluxW] = useState<number>(220); // W/m²
  const [windMixingSpeed, setWindMixingSpeed] = useState<number>(7.5); // m/s
  const [upwellingRate, setUpwellingRate] = useState<number>(1.2); // m/day

  const activeProbe = useMemo(() => {
    return REGIONAL_PROBES.find((p) => p.id === selectedProbeId) || REGIONAL_PROBES[0];
  }, [selectedProbeId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLiveDiagnostics() {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const payload = await fetchOceanDiagnostics(
          observationDate,
          latitude,
          longitude,
        );
        if (!cancelled) {
          setLiveDiagnostics(payload);
          localStorage.setItem('ocean_shared_date', payload.date);
          localStorage.setItem('ocean_shared_lat', String(latitude));
          localStorage.setItem('ocean_shared_lon', String(longitude));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[OceanHeatPage] Live diagnostics failed:', error);
          setLiveDiagnostics(null);
          setLiveError(error instanceof Error ? error.message : 'Backend diagnostics unavailable.');
        }
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }

    loadLiveDiagnostics();
    return () => {
      cancelled = true;
    };
  }, [observationDate, latitude, longitude]);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnosticMap() {
      setDiagnosticMapLoading(true);
      setDiagnosticMapError(null);
      try {
        const data = await fetchOceanDiagnosticMap(observationDate, metricMode);
        if (!cancelled) setDiagnosticMap(data);
      } catch (error) {
        if (!cancelled) {
          setDiagnosticMap(null);
          setDiagnosticMapError(
            error instanceof Error ? error.message : 'Failed to load diagnostic heatmap.',
          );
        }
      } finally {
        if (!cancelled) setDiagnosticMapLoading(false);
      }
    }

    loadDiagnosticMap();
    return () => {
      cancelled = true;
    };
  }, [observationDate, metricMode]);

  const liveProfile = useMemo(() => {
    if (!liveDiagnostics?.depths_m?.length) return [];
    return liveDiagnostics.depths_m
      .map((depth, index) => ({
        depth,
        temp: liveDiagnostics.temperature_profile_C[index],
      }))
      .filter((point): point is { depth: number; temp: number } =>
        point.temp != null && Number.isFinite(point.temp),
      );
  }, [liveDiagnostics]);

  const liveTCHP = liveDiagnostics?.tchp?.tchp_kJ_cm2 ?? null;
  const liveOHC = liveDiagnostics?.ohc_0_700?.ohc_0_700_GJ_m2 ?? null;
  const liveSST = liveDiagnostics?.surface_temperature_C ?? null;
  const liveD26 = liveDiagnostics?.d26?.d26_depth_m ?? null;

  const formatMetric = (value: number | null, digits = 2): string =>
    value != null && Number.isFinite(value) ? value.toFixed(digits) : '—';

  const liveLayerEnergy = useMemo(() => {
    if (!liveProfile.length) return null;
    return {
      mixed: integrateProfileTemperature(liveProfile, 0, 50),
      thermo: integrateProfileTemperature(liveProfile, 50, 200),
      deep: integrateProfileTemperature(liveProfile, 200, 1000),
    };
  }, [liveProfile]);

  // Physics-based interactive dynamic adjustments
  const simulatedTCHP = useMemo(() => {
    if (liveTCHP == null) return null;
    const deltaSolar = (solarFluxW - 200) * 0.08;
    const deltaWindCooling = (windMixingSpeed - 5) * -1.8;
    const deltaUpwelling = (upwellingRate - 1.0) * -4.5;
    return Math.max(10, +(liveTCHP + deltaSolar + deltaWindCooling + deltaUpwelling).toFixed(1));
  }, [liveTCHP, solarFluxW, windMixingSpeed, upwellingRate]);

  const simulatedSST = useMemo(() => {
    if (liveSST == null) return null;
    const delta = (solarFluxW - 200) * 0.004 - (windMixingSpeed - 5) * 0.08 - (upwellingRate - 1.0) * 0.25;
    return +(liveSST + delta).toFixed(2);
  }, [liveSST, solarFluxW, windMixingSpeed, upwellingRate]);

  const simulatedD26 = useMemo(() => {
    if (liveD26 == null) return null;
    const delta = (solarFluxW - 200) * 0.05 - (upwellingRate - 1.0) * 8.0;
    return Math.max(10, Math.round(liveD26 + delta));
  }, [liveD26, solarFluxW, upwellingRate]);

  // Color helper for TCHP
  const getTchpBadge = (tchp: number) => {
    if (tchp >= 100) return { label: 'Extreme RI Potential (>100 kJ/cm²)', bg: 'bg-purple-950/70 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]' };
    if (tchp >= 80) return { label: 'High RI Fuel (80–100 kJ/cm²)', bg: 'bg-rose-950/70 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]' };
    if (tchp >= 50) return { label: 'Moderate Energy (50–80 kJ/cm²)', bg: 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]' };
    return { label: 'Low Thermal Potential (<50 kJ/cm²)', bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]' };
  };

  const applyCoordinates = () => {
    const nextLatitude = Number(latitudeInput);
    const nextLongitude = Number(longitudeInput);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) return;

    const clampedLatitude = Math.min(30, Math.max(5, nextLatitude));
    const clampedLongitude = Math.min(105, Math.max(45, nextLongitude));

    setSelectedProbeId('custom');
    setLatitude(clampedLatitude);
    setLongitude(clampedLongitude);
    setLatitudeInput(String(clampedLatitude));
    setLongitudeInput(String(clampedLongitude));
    localStorage.setItem('ocean_shared_lat', String(clampedLatitude));
    localStorage.setItem('ocean_shared_lon', String(clampedLongitude));
  };

  const handleProbeSelect = (probeId: string) => {
    const probe = REGIONAL_PROBES.find((item) => item.id === probeId);
    if (!probe) return;
    setSelectedProbeId(probeId);
    setLatitude(probe.lat);
    setLongitude(probe.lon);
    setLatitudeInput(String(probe.lat));
    setLongitudeInput(String(probe.lon));
    localStorage.setItem('ocean_shared_lat', String(probe.lat));
    localStorage.setItem('ocean_shared_lon', String(probe.lon));
  };

  const coordinateLabel = `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`;

  const pageContent = (
    <div className="oceanheat-shell cyclone-shell cyclone-scope dark-glass-scope text-white min-h-screen">
      <style>{OCEAN_HEAT_PAGE_STYLES}</style>
      <PageContainer>
        {/* ── Official Government Header ── */}
        <PageHeader
          category="INCOIS OCEAN THERMAL OBSERVATION & CLIMATE SYSTEM"
          badge={
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-mono font-bold shadow-xs">
              <Flame size={14} className="text-orange-400 animate-pulse" />
              <span>OCEAN HEAT CONTENT (OHC) &amp; TCHP RADAR</span>
            </div>
          }
          icon={<Thermometer size={18} className="text-orange-400" />}
          title="Ocean Thermal Energy & Subsurface Heat Diagnostic System"
          subtitle="Real-time multi-depth thermodynamic heat budget, Tropical Cyclone Heat Potential (TCHP), and Marine Heatwave (MHW) alert monitoring across the North Indian Ocean."
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-1.5 focus-within:border-orange-400/60 transition">
                  <Calendar size={13} className="text-orange-400" />
                  <input
                    type="date"
                    value={observationDate}
                    min="2018-01-01"
                    max={LIVE_OCEAN_END}
                    onChange={event => setObservationDate(event.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-white outline-none"
                    aria-label="Observation date"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-1.5 focus-within:border-orange-400/60 transition">
                  <MapPin size={13} className="text-orange-400" />
                  <input
                    type="number"
                    min={5}
                    max={30}
                    step={0.25}
                    value={latitudeInput}
                    onChange={event => setLatitudeInput(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') applyCoordinates(); }}
                    className="w-16 bg-transparent text-xs font-mono font-bold text-white outline-none"
                    aria-label="Latitude"
                    title="Latitude 5°N to 30°N"
                  />
                  <span className="text-[10px] font-bold text-slate-400 font-mono">°N</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-1.5 focus-within:border-orange-400/60 transition">
                  <MapPin size={13} className="text-orange-400" />
                  <input
                    type="number"
                    min={45}
                    max={105}
                    step={0.25}
                    value={longitudeInput}
                    onChange={event => setLongitudeInput(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') applyCoordinates(); }}
                    className="w-16 bg-transparent text-xs font-mono font-bold text-white outline-none"
                    aria-label="Longitude"
                    title="Longitude 45°E to 105°E"
                  />
                  <span className="text-[10px] font-bold text-slate-400 font-mono">°E</span>
                </div>
              </div>
              <button
                onClick={applyCoordinates}
                className="h-9 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 px-3.5 text-xs font-black text-white shadow-lg shadow-orange-500/20 active:scale-95 transition cursor-pointer"
                title="Load production diagnostics at the selected coordinates"
              >
                Apply Location
              </button>
              <button
                onClick={() => {
                  setSolarFluxW(220);
                  setWindMixingSpeed(7.5);
                  setUpwellingRate(1.2);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/15 hover:bg-slate-800 text-white font-mono text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <RefreshCw size={13} />
                Reset Sim
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 font-mono text-xs font-bold border border-cyan-500/40 transition shadow-xs cursor-pointer"
              >
                <Download size={13} />
                Export OHC Bulletin
              </button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/25 bg-slate-900/80 backdrop-blur-xl px-3.5 py-2 text-[11px] text-white">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${liveLoading ? 'bg-amber-400 animate-pulse' : liveDiagnostics ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-400'}`} />
            <span className="font-semibold text-white/90">
              {liveLoading ? 'Loading production ocean diagnostics…' : liveDiagnostics ? 'Production backend diagnostics connected' : 'Production diagnostics unavailable — no live point values shown'}
            </span>
          </div>
          <div className="font-mono text-slate-400">
            {coordinateLabel} · Input: {liveDiagnostics?.input_window?.start ?? '—'} → {liveDiagnostics?.input_window?.end ?? observationDate} · Forecast: {liveDiagnostics?.forecast_date ?? '—'}
          </div>
          {liveError && <span className="text-rose-400 font-semibold">{liveError}</span>}
        </div>

        {/* ── Top Executive KPI Overview Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="glass rounded-2xl p-4 border border-cyan-500/25 depth-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Active Site TCHP
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-orange-400 font-mono">
                {formatMetric(liveTCHP, 1)}
              </span>
              <span className="text-[11px] font-bold text-slate-400">kJ/cm²</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
              Production OceanEmbed diagnostic
            </span>
          </div>

          <div className="glass rounded-2xl p-4 border border-cyan-500/25 depth-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              26°C Isotherm Depth (D₂₆)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
                {formatMetric(liveD26, 1)}
              </span>
              <span className="text-[11px] font-bold text-slate-400">meters</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
              Warm reservoir depth
            </span>
          </div>

          <div className="glass rounded-2xl p-4 border border-cyan-500/25 depth-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Upper OHC (0–700m)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-indigo-300 font-mono">
                {formatMetric(liveOHC, 2)}
              </span>
              <span className="text-[11px] font-bold text-slate-400">GJ/m²</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold block mt-1">
              {liveDiagnostics ? 'Production backend diagnostic' : 'No live value'}
            </span>
          </div>

          <div className="glass rounded-2xl p-4 border border-cyan-500/25 depth-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Surface Temp (SST)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
                {liveSST != null ? `${formatMetric(liveSST, 2)}°C` : '—'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
              Mixed layer top
            </span>
          </div>

          <div className="glass rounded-2xl p-4 border border-cyan-500/25 depth-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Marine Heatwave</span>
            <span className="text-xs font-black text-slate-300 bg-slate-950/70 px-2 py-0.5 rounded border border-white/10 inline-block mt-0.5">Point DHW unavailable</span>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium">Current point diagnostics do not expose DHW.</span>
          </div>

          <div className="glass rounded-2xl p-4 border border-cyan-500/25 depth-shadow">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">TCHP Thermal Band</span>
            <span className={`text-xs font-black px-2 py-0.5 rounded border inline-block mt-0.5 ${liveTCHP != null ? getTchpBadge(liveTCHP).bg : 'text-slate-400 bg-slate-950/70 border-white/10'}`}>
              {liveTCHP != null ? getTchpBadge(liveTCHP).label : '—'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1 font-medium">Derived from live production TCHP.</span>
          </div>
        </div>

        {/* ── Main 2-Column Grid: Left (Interactive Map & Buoys) | Right (Vertical Heat Column & Curves) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Left: Map & Site Selector (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass rounded-2xl border border-cyan-500/30 overflow-hidden depth-shadow">
              {/* Map Toolbar Header */}
              <div className="p-3.5 bg-slate-950/80 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Compass size={16} className="text-cyan-400" />
                  <span className="font-black text-white text-sm">
                    Interactive North Indian Ocean Diagnostic Stations
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(['tchp', 'ohc', 'd26'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMetricMode(mode)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono font-bold transition cursor-pointer ${
                        metricMode === mode
                          ? 'border-cyan-400 bg-cyan-500/25 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                          : 'border-white/15 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {mode === 'tchp' ? 'TCHP' : mode === 'ohc' ? 'OHC 0–700m' : 'D₂₆'}
                    </button>
                  ))}
                  <span className="rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-1 text-xs font-mono font-bold text-slate-300">
                    {diagnosticMapLoading ? 'Loading map…' : diagnosticMap ? `${diagnosticMap.units} · Production grid` : 'Map unavailable'}
                  </span>
                </div>
              </div>

              {/* Leaflet Map with Carto Dark Tiles */}
              <div className="h-[380px] w-full relative">
                <MapContainer
                  center={[latitude, longitude]}
                  zoom={5}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    maxZoom={19}
                  />
                  <OceanDiagnosticHeatOverlay mapData={diagnosticMap} opacity={0.52} />
                  <MapFlyTo lat={latitude} lon={longitude} />

                  {/* Thermal Hotspot Circles */}
                  {REGIONAL_PROBES.map((probe) => {
                    const isSelected = probe.id === activeProbe.id && selectedProbeId !== 'custom';
                    const radius = 20;
                    const circleColor = isSelected ? '#06b6d4' : '#64748b';

                    return (
                      <React.Fragment key={probe.id}>
                        {/* Outer Glow Circle */}
                        <Circle
                          center={[probe.lat, probe.lon]}
                          radius={radius * 12000}
                          pathOptions={{
                            color: circleColor,
                            fillColor: circleColor,
                            fillOpacity: isSelected ? 0.35 : 0.15,
                            weight: isSelected ? 2 : 1,
                          }}
                        />

                        {/* Interactive Center Marker */}
                        <CircleMarker
                          center={[probe.lat, probe.lon]}
                          radius={isSelected ? 10 : 7}
                          pathOptions={{
                            color: '#ffffff',
                            fillColor: circleColor,
                            fillOpacity: 1,
                            weight: 2,
                          }}
                          eventHandlers={{
                            click: () => setSelectedProbeId(probe.id),
                          }}
                        >
                          <Popup>
                            <div className="p-2 text-xs font-sans text-white">
                              <p className="font-bold text-white text-sm">{probe.name}</p>
                              <p className="text-slate-300 mt-0.5">Region: {probe.region}</p>
                              <div className="mt-2 pt-1.5 border-t border-white/10 space-y-1 font-mono text-xs">
                                <p className="text-slate-300 font-bold">Location: {probe.lat.toFixed(2)}°N, {probe.lon.toFixed(2)}°E</p>
                                {probe.id === activeProbe.id && selectedProbeId !== 'custom' && liveDiagnostics ? (
                                  <>
                                    <p className="text-orange-400 font-bold">TCHP: {formatMetric(liveTCHP, 2)} kJ/cm²</p>
                                    <p className="text-cyan-300 font-bold">D₂₆ Depth: {formatMetric(liveD26, 1)} m</p>
                                    <p className="text-rose-400 font-bold">SST: {formatMetric(liveSST, 2)}°C</p>
                                  </>
                                ) : (
                                  <p className="text-slate-400">Select station to load production diagnostics.</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleProbeSelect(probe.id)}
                                className="mt-2 w-full py-1.5 bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-400/40 rounded-lg font-bold text-xs cursor-pointer shadow-xs transition"
                              >
                                Select Probe
                              </button>
                            </div>
                          </Popup>
                        </CircleMarker>
                      </React.Fragment>
                    );
                  })}

                  {/* User-selected live diagnostic location */}
                  <CircleMarker
                    center={[latitude, longitude]}
                    radius={11}
                    pathOptions={{
                      color: '#0f172a',
                      fillColor: '#06b6d4',
                      fillOpacity: 0.95,
                      weight: 3,
                    }}
                  >
                    <Popup>
                      <div className="p-2 text-xs font-sans text-white">
                        <p className="font-bold text-white text-sm">Live Diagnostic Location</p>
                        <p className="text-slate-300 mt-0.5 font-mono">{coordinateLabel}</p>
                        <div className="mt-2 pt-1.5 border-t border-white/10 space-y-1 font-mono text-xs">
                          <p className="text-orange-400 font-bold">TCHP: {formatMetric(liveTCHP, 2)} kJ/cm²</p>
                          <p className="text-cyan-300 font-bold">D₂₆: {formatMetric(liveD26, 1)} m</p>
                          <p className="text-rose-400 font-bold">SST: {formatMetric(liveSST, 2)}°C</p>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </MapContainer>

                {/* Map Bottom Legend */}
                <div className="absolute bottom-3 left-3 z-[1000] bg-slate-950/90 backdrop-blur-md rounded-xl p-2.5 border border-cyan-500/30 shadow-2xl text-[11px] font-mono max-w-[360px] text-white">
                  <p className="font-bold text-cyan-300">
                    {metricMode === 'tchp' ? 'TCHP' : metricMode === 'ohc' ? 'OHC 0–700 m' : 'D₂₆'} production diagnostic grid
                  </p>
                  <p className="text-slate-300 mt-0.5">Cyan marker = selected point · Gray markers = reference stations</p>
                  {diagnosticMapError && <p className="text-rose-400 mt-0.5">{diagnosticMapError}</p>}
                </div>
              </div>

              {/* Probe Selector Quick Cards */}
              <div className="p-4 bg-slate-950/70 border-t border-cyan-500/20">
                <span className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">
                  Select Oceanic Observation Probe / Station:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {REGIONAL_PROBES.map((probe) => {
                    const isSelected = probe.id === activeProbe.id;
                    return (
                      <button
                        key={probe.id}
                        onClick={() => handleProbeSelect(probe.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40 text-white'
                            : 'bg-slate-900/70 border-white/10 hover:border-cyan-500/40 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold text-cyan-400">
                            {probe.region}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <p className="text-xs font-black text-white truncate">{probe.name}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] font-mono font-bold">
                          <span className="text-slate-400">{probe.lat.toFixed(2)}°N</span>
                          <span className="text-slate-400">{probe.lon.toFixed(2)}°E</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Subsurface Vertical Thermal Profile & Energy Density (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass rounded-2xl p-5 border border-cyan-500/30 depth-shadow">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <div>
                  <h3 className="font-black text-white text-sm flex items-center gap-1.5">
                    <Layers size={16} className="text-cyan-400" />
                    Subsurface Temperature &amp; Heat Profile
                  </h3>
                  <p className="text-xs text-slate-400">{coordinateLabel} · {observationDate} · {liveDiagnostics ? 'Production model' : 'No live diagnostic'}</p>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    liveTCHP != null ? getTchpBadge(liveTCHP).bg : 'bg-slate-950/70 text-slate-400 border-white/10'
                  }`}
                >
                  {liveTCHP != null ? getTchpBadge(liveTCHP).label : 'Production TCHP unavailable'}
                </span>
              </div>

              {/* Vertical Chart */}
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveProfile} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      type="number"
                      domain={[0, 34]}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                      label={{ value: 'Temperature (°C)', fill: '#94a3b8', fontSize: 10, position: 'insideBottom' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="depth"
                      reversed
                      domain={[0, 1000]}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                      label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip content={<CleanChartTooltip />} />
                    <ReferenceLine x={26} stroke="#f97316" strokeDasharray="4 4" label={{ value: '26°C RI Line', fill: '#fb923c', fontSize: 9 }} />
                    {liveD26 != null && (
                      <ReferenceLine y={liveD26} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: `D₂₆: ${formatMetric(liveD26, 1)}m`, fill: '#38bdf8', fontSize: 9 }} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#ef4444"
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 3.5 }}
                      name="Temperature (°C)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Layer Heat Energy Breakdown Table */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Layer-Integrated Heat Energy Breakdown (J/m²):
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Mixed (0–50m)</span>
                    <span className="font-bold text-rose-400 text-sm">{liveLayerEnergy ? `${(liveLayerEnergy.mixed / 1e8).toFixed(2)} × 10⁸ J` : '--'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Thermo (50–200m)</span>
                    <span className="font-bold text-orange-400 text-sm">{liveLayerEnergy ? `${(liveLayerEnergy.thermo / 1e8).toFixed(2)} × 10⁸ J` : '--'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Deep (200–1000m)</span>
                    <span className="font-bold text-indigo-400 text-sm">{liveLayerEnergy ? `${(liveLayerEnergy.deep / 1e9).toFixed(2)} × 10⁹ J` : '--'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* OHC Physics Integral Formula Explainer Card */}
            <div className="glass rounded-2xl p-4 border border-cyan-500/20 depth-shadow text-xs space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <Info size={15} />
                <span>Thermodynamic OHC &amp; TCHP Formulation:</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-white/10 font-mono text-[11px] text-slate-300 leading-relaxed">
                <div className="font-bold text-cyan-300 text-xs">
                  {'TCHP = ρ · Cp · ∫ [T(z) - 26°C] dz  (integrated from surface to D₂₆)'}
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1 font-sans">
                  {'Where ρ = 1025 kg/m³, Cp = 3985 J/(kg·K), and D₂₆ is the depth of the 26°C isotherm.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Interactive Ocean Heat & Atmosphere Coupling Simulator ── */}
        <div className="glass rounded-2xl p-6 border border-cyan-500/30 depth-shadow mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-xs">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  Ocean Heat Budget &amp; Atmospheric Forcing Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Apply an explanatory sensitivity scenario around the production diagnostic baseline; this does not retrain or rerun the OceanEmbed model.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-300">
              <Sparkles size={13} />
              <span>Production baseline + sensitivity scenario</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Slider 1: Net Solar Flux */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Net Solar Radiation (Qₙₑₜ)</span>
                <span className="text-xs font-mono font-black text-orange-400">{solarFluxW} W/m²</span>
              </div>
              <input
                type="range"
                min="100"
                max="350"
                step="5"
                value={solarFluxW}
                onChange={(e) => setSolarFluxW(Number(e.target.value))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>100 (Cloudy / Storm)</span>
                <span>220 (Normal)</span>
                <span>350 (Intense Insolation)</span>
              </div>
            </div>

            {/* Slider 2: Wind Stress */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Surface Wind Mixing</span>
                <span className="text-xs font-mono font-black text-cyan-400">{windMixingSpeed} m/s</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={windMixingSpeed}
                onChange={(e) => setWindMixingSpeed(Number(e.target.value))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>1.0 (Calm Sea)</span>
                <span>7.5 (Breeze)</span>
                <span>25.0 (Cyclone Gale)</span>
              </div>
            </div>

            {/* Slider 3: Upwelling Rate */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Ekman Upwelling Velocity (w)</span>
                <span className="text-xs font-mono font-black text-indigo-400">{upwellingRate} m/day</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={upwellingRate}
                onChange={(e) => setUpwellingRate(Number(e.target.value))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.0 (Downwelling Pool)</span>
                <span>1.2 (Normal)</span>
                <span>5.0 (Strong Divergence)</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-orange-500/30 bg-orange-950/30 p-3.5"><div className="text-[10px] font-bold uppercase tracking-wider text-orange-400">Scenario TCHP</div><div className="mt-1 text-lg font-black font-mono text-orange-300">{simulatedTCHP != null ? `${simulatedTCHP.toFixed(1)} kJ/cm²` : '—'}</div><div className="mt-1 text-[10px] text-slate-400">Sensitivity-only value; production baseline remains above.</div></div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5"><div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Scenario SST</div><div className="mt-1 text-lg font-black font-mono text-rose-300">{simulatedSST != null ? `${simulatedSST.toFixed(2)}°C` : '—'}</div><div className="mt-1 text-[10px] text-slate-400">Sensitivity-only value; not a new OceanEmbed inference.</div></div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3.5"><div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Scenario D₂₆</div><div className="mt-1 text-lg font-black font-mono text-cyan-300">{simulatedD26 != null ? `${simulatedD26} m` : '—'}</div><div className="mt-1 text-[10px] text-slate-400">Sensitivity-only value; not a new OceanEmbed inference.</div></div>
          </div>
        </div>

        {/* ── Section 3: Historical Climatology & Multi-Decadal Warming Trend ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-8 glass rounded-2xl p-6 border border-cyan-500/30 depth-shadow">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div>
                <h3 className="font-black text-white text-sm flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-cyan-400" />
                  Multi-Decadal Ocean Heat Content Accumulation (0–700m)
                </h3>
                <p className="text-xs text-slate-400">
                  Static historical reference series (1995–2025); not generated by the live OceanEmbed endpoint
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Static reference series
              </span>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={OHC_HISTORICAL_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} />
                  <YAxis domain={[1.0, 2.1]} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: 'rgba(255,255,255,0.15)' }} />
                  <Tooltip content={<CleanChartTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ohc0_700"
                    stroke="#818cf8"
                    fill="rgba(99, 102, 241, 0.25)"
                    strokeWidth={2.5}
                    name="Upper OHC (GJ/m²)"
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    name="1990–2000 Baseline (1.18 GJ/m²)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Marine Heatwave diagnostics scope */}
          <div className="lg:col-span-4 glass rounded-2xl p-6 border border-cyan-500/30 depth-shadow">
            <h3 className="font-black text-white text-sm flex items-center gap-1.5 mb-1"><AlertTriangle size={16} className="text-amber-400" />Marine Heatwave Diagnostics</h3>
            <p className="text-xs text-slate-400 mb-3">Point-local OHC/TCHP diagnostics are live above; MHW/DHW is served by a separate production model.</p>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300 space-y-2">
              <p><span className="font-bold text-white">Current point:</span> {coordinateLabel}</p>
              <p><span className="font-bold text-white">Point-local DHW:</span> not exposed by <span className="font-mono text-cyan-300">/api/ocean/diagnostics</span>.</p>
              <p><span className="font-bold text-white">Static regional alerts:</span> removed from the live view so they cannot be mistaken for current backend output.</p>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );

  if (embedded) {
    return pageContent;
  }

  return (
    <PageLayout>
      {pageContent}
    </PageLayout>
  );
}
