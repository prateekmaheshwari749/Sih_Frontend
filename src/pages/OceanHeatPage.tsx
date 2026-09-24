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

// Helper: Custom Tooltip for Recharts
function CleanChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
      <p className="font-bold text-slate-800 border-b border-slate-100 pb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="text-slate-600 font-medium" style={{ color: entry.color }}>
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
function MapFlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 6, { duration: 1.2 });
  }, [lat, lon, map]);
  return null;
}

export default function OceanHeatPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();

  // State
  const [selectedProbeId, setSelectedProbeId] = useState<string>('bob-central');
  const [metricMode, setMetricMode] = useState<'tchp' | 'ohc' | 'd26' | 'dhw'>('tchp');
  
  // Interactive Simulator States
  const [solarFluxW, setSolarFluxW] = useState<number>(220); // W/m²
  const [windMixingSpeed, setWindMixingSpeed] = useState<number>(7.5); // m/s
  const [upwellingRate, setUpwellingRate] = useState<number>(1.2); // m/day

  const activeProbe = useMemo(() => {
    return REGIONAL_PROBES.find((p) => p.id === selectedProbeId) || REGIONAL_PROBES[0];
  }, [selectedProbeId]);

  // Physics-based interactive dynamic adjustments
  const simulatedTCHP = useMemo(() => {
    const deltaSolar = (solarFluxW - 200) * 0.08;
    const deltaWindCooling = (windMixingSpeed - 5) * -1.8;
    const deltaUpwelling = (upwellingRate - 1.0) * -4.5;
    return Math.max(10, +(activeProbe.tchp + deltaSolar + deltaWindCooling + deltaUpwelling).toFixed(1));
  }, [activeProbe, solarFluxW, windMixingSpeed, upwellingRate]);

  const simulatedSST = useMemo(() => {
    const delta = (solarFluxW - 200) * 0.004 - (windMixingSpeed - 5) * 0.08 - (upwellingRate - 1.0) * 0.25;
    return +(activeProbe.sst + delta).toFixed(2);
  }, [activeProbe, solarFluxW, windMixingSpeed, upwellingRate]);

  const simulatedD26 = useMemo(() => {
    const delta = (solarFluxW - 200) * 0.05 - (upwellingRate - 1.0) * 8.0;
    return Math.max(10, Math.round(activeProbe.d26 + delta));
  }, [activeProbe, solarFluxW, upwellingRate]);

  // Color helper for TCHP
  const getTchpBadge = (tchp: number) => {
    if (tchp >= 100) return { label: 'Extreme RI Potential (>100 kJ/cm²)', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
    if (tchp >= 80) return { label: 'High RI Fuel (80–100 kJ/cm²)', bg: 'bg-red-100 text-red-800 border-red-300' };
    if (tchp >= 50) return { label: 'Moderate Energy (50–80 kJ/cm²)', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { label: 'Low Thermal Potential (<50 kJ/cm²)', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  const pageContent = (
    <PageContainer>
        {/* ── Official Government Header ── */}
        <PageHeader
          category="INCOIS OCEAN THERMAL OBSERVATION & CLIMATE SYSTEM"
          badge={
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-[#005088]/30 text-[#005088] text-xs font-mono font-bold shadow-xs">
              <Flame size={14} className="text-orange-600 animate-pulse" />
              <span>OCEAN HEAT CONTENT (OHC) &amp; TCHP RADAR</span>
            </div>
          }
          icon={<Thermometer size={18} className="text-[#005088]" />}
          title="Ocean Thermal Energy & Subsurface Heat Diagnostic System"
          subtitle="Real-time multi-depth thermodynamic heat budget, Tropical Cyclone Heat Potential (TCHP), and Marine Heatwave (MHW) alert monitoring across the North Indian Ocean."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSolarFluxW(220);
                  setWindMixingSpeed(7.5);
                  setUpwellingRate(1.2);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-mono text-xs font-bold transition-all shadow-xs"
              >
                <RefreshCw size={13} />
                Reset Sim
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005088] font-mono text-xs font-bold border border-blue-200 transition-all shadow-xs"
              >
                <Download size={13} />
                Export OHC Bulletin
              </button>
            </div>
          }
        />

        {/* ── Top Executive KPI Overview Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Active Site TCHP
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-orange-600 font-mono">
                {simulatedTCHP}
              </span>
              <span className="text-[11px] font-bold text-slate-600">kJ/cm²</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-medium">
              Threshold: &gt;80 kJ/cm² RI
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              26°C Isotherm Depth (D₂₆)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-[#005088] font-mono">
                {simulatedD26}
              </span>
              <span className="text-[11px] font-bold text-slate-600">meters</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-medium">
              Warm reservoir depth
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Upper OHC (0–700m)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-indigo-700 font-mono">
                {activeProbe.ohc700.toFixed(2)}
              </span>
              <span className="text-[11px] font-bold text-slate-600">GJ/m²</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block mt-1">
              +0.70 GJ/m² vs Normal
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Surface Temp (SST)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-red-600 font-mono">
                {simulatedSST}°C
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-medium">
              Mixed layer top
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Marine Heatwave
            </span>
            <span className="text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
              {activeProbe.mhwCategory}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1 font-medium">
              DHW: {activeProbe.dhw} °C-weeks
            </span>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Cyclone Fuel State
            </span>
            <span className="text-xs font-black text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block mt-0.5">
              {activeProbe.cycloneFuel}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1 font-medium">
              MoES Early Warning
            </span>
          </div>
        </div>

        {/* ── Main 2-Column Grid: Left (Interactive Map & Buoys) | Right (Vertical Heat Column & Curves) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Left: Map & Site Selector (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Map Toolbar Header */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Compass size={16} className="text-[#005088]" />
                  <span className="font-black text-slate-800 text-sm">
                    Interactive North Indian Ocean Thermal Hotspots
                  </span>
                </div>

                {/* Metric Mode Selector */}
                <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setMetricMode('tchp')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                      metricMode === 'tchp' ? 'bg-blue-50 text-[#005088] border border-blue-300 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    TCHP
                  </button>
                  <button
                    onClick={() => setMetricMode('ohc')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                      metricMode === 'ohc' ? 'bg-blue-50 text-[#005088] border border-blue-300 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    OHC (0-700m)
                  </button>
                  <button
                    onClick={() => setMetricMode('d26')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                      metricMode === 'd26' ? 'bg-blue-50 text-[#005088] border border-blue-300 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    D₂₆ Isotherm
                  </button>
                  <button
                    onClick={() => setMetricMode('dhw')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                      metricMode === 'dhw' ? 'bg-blue-50 text-[#005088] border border-blue-300 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    MHW (DHW)
                  </button>
                </div>
              </div>

              {/* Leaflet Map */}
              <div className="h-[380px] w-full relative">
                <MapContainer
                  center={[activeProbe.lat, activeProbe.lon]}
                  zoom={5}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  />
                  <MapFlyTo lat={activeProbe.lat} lon={activeProbe.lon} />

                  {/* Thermal Hotspot Circles */}
                  {REGIONAL_PROBES.map((probe) => {
                    const isSelected = probe.id === activeProbe.id;
                    const radius = metricMode === 'tchp' ? Math.max(14, probe.tchp * 0.22) : 20;
                    const circleColor =
                      probe.tchp >= 100 ? '#9333ea' : probe.tchp >= 80 ? '#dc2626' : probe.tchp >= 50 ? '#ea580c' : '#16a34a';

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
                            <div className="p-2 text-xs font-sans">
                              <p className="font-bold text-slate-900">{probe.name}</p>
                              <p className="text-slate-600 mt-0.5">Region: {probe.region}</p>
                              <div className="mt-2 pt-1 border-t border-slate-200 space-y-1 font-mono">
                                <p className="text-orange-700 font-bold">TCHP: {probe.tchp} kJ/cm²</p>
                                <p className="text-blue-700 font-bold">D₂₆ Depth: {probe.d26} m</p>
                                <p className="text-red-700 font-bold">SST: {probe.sst}°C</p>
                              </div>
                              <button
                                onClick={() => setSelectedProbeId(probe.id)}
                                className="mt-2 w-full py-1 bg-blue-50 hover:bg-blue-100 text-[#005088] border border-blue-200 rounded font-bold text-[11px] cursor-pointer shadow-xs"
                              >
                                Select Probe
                              </button>
                            </div>
                          </Popup>
                        </CircleMarker>
                      </React.Fragment>
                    );
                  })}
                </MapContainer>

                {/* Map Bottom Legend */}
                <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md rounded-xl p-2.5 border border-slate-200 shadow-md text-[11px] font-mono">
                  <p className="font-bold text-slate-800 mb-1">TCHP Potential Scale (kJ/cm²):</p>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> &lt;50 Low
                    </span>
                    <span className="flex items-center gap-1 text-amber-700 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 50–80 Mod
                    </span>
                    <span className="flex items-center gap-1 text-red-700 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> 80–100 High
                    </span>
                    <span className="flex items-center gap-1 text-purple-700 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> &gt;100 Extreme
                    </span>
                  </div>
                </div>
              </div>

              {/* Probe Selector Quick Cards */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-600 block mb-2 uppercase tracking-wider">
                  Select Oceanic Observation Probe / Station:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {REGIONAL_PROBES.map((probe) => {
                    const isSelected = probe.id === activeProbe.id;
                    return (
                      <button
                        key={probe.id}
                        onClick={() => setSelectedProbeId(probe.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-[#005088] shadow-sm ring-2 ring-[#005088]/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {probe.region}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              probe.tchp >= 80 ? 'bg-red-500 animate-ping' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                        <p className="text-xs font-black text-slate-900 truncate">{probe.name}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] font-mono font-bold">
                          <span className="text-orange-700">{probe.tchp} kJ/cm²</span>
                          <span className="text-slate-600">{probe.sst}°C</span>
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
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Layers size={16} className="text-[#005088]" />
                    Subsurface Temperature &amp; Heat Profile
                  </h3>
                  <p className="text-xs text-slate-500">{activeProbe.name}</p>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    getTchpBadge(simulatedTCHP).bg
                  }`}
                >
                  {getTchpBadge(simulatedTCHP).label}
                </span>
              </div>

              {/* Vertical Chart */}
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeProbe.temperatures} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      type="number"
                      domain={[0, 34]}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      label={{ value: 'Temperature (°C)', fill: '#475569', fontSize: 10, position: 'insideBottom' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="depth"
                      reversed
                      domain={[0, 1000]}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10 }}
                    />
                    <Tooltip content={<CleanChartTooltip />} />
                    <ReferenceLine x={26} stroke="#ea580c" strokeDasharray="4 4" label={{ value: '26°C RI Line', fill: '#ea580c', fontSize: 9 }} />
                    <ReferenceLine y={simulatedD26} stroke="#0284c7" strokeDasharray="3 3" label={{ value: `D₂₆: ${simulatedD26}m`, fill: '#0284c7', fontSize: 9 }} />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#dc2626"
                      strokeWidth={3}
                      dot={{ fill: '#dc2626', r: 3.5 }}
                      name="Temperature (°C)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Layer Heat Energy Breakdown Table */}
              <div className="mt-4 pt-3 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Layer-Integrated Heat Energy Breakdown (J/m²):
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Mixed (0–50m)</span>
                    <span className="font-bold text-red-600 text-sm">6.2 × 10⁸ J</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Thermo (50–200m)</span>
                    <span className="font-bold text-orange-600 text-sm">9.4 × 10⁸ J</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Deep (200–1000m)</span>
                    <span className="font-bold text-indigo-700 text-sm">1.8 × 10⁹ J</span>
                  </div>
                </div>
              </div>
            </div>

            {/* OHC Physics Integral Formula Explainer Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-xs space-y-2">
              <div className="flex items-center gap-2 text-[#005088] font-bold">
                <Info size={15} />
                <span>Thermodynamic OHC &amp; TCHP Formulation:</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 leading-relaxed">
                <div className="font-bold text-[#005088] text-xs">
                  {'TCHP = ρ · Cp · ∫ [T(z) - 26°C] dz  (integrated from surface to D₂₆)'}
                </div>
                <p className="text-[10.5px] text-slate-600 mt-1 font-sans">
                  {'Where ρ = 1025 kg/m³, Cp = 3985 J/(kg·K), and D₂₆ is the depth of the 26°C isotherm.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Interactive Ocean Heat & Atmosphere Coupling Simulator ── */}
        <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-xs">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                  Ocean Heat Budget &amp; Atmospheric Forcing Simulator
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Simulate how Net Solar Radiation, Wind Stress Mixing, and Ekman Upwelling affect the subsurface warm water reservoir.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-mono font-bold text-[#005088]">
              <Sparkles size={13} />
              <span>Real-Time Subsurface Thermodynamic Model</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Slider 1: Net Solar Flux */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Net Solar Radiation (Qₙₑₜ)</span>
                <span className="text-xs font-mono font-black text-orange-600">{solarFluxW} W/m²</span>
              </div>
              <input
                type="range"
                min="100"
                max="350"
                step="5"
                value={solarFluxW}
                onChange={(e) => setSolarFluxW(Number(e.target.value))}
                className="w-full accent-orange-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>100 (Cloudy / Storm)</span>
                <span>220 (Normal)</span>
                <span>350 (Intense Insolation)</span>
              </div>
            </div>

            {/* Slider 2: Wind Stress */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Surface Wind Mixing</span>
                <span className="text-xs font-mono font-black text-blue-600">{windMixingSpeed} m/s</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={windMixingSpeed}
                onChange={(e) => setWindMixingSpeed(Number(e.target.value))}
                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>1.0 (Calm Sea)</span>
                <span>7.5 (Breeze)</span>
                <span>25.0 (Cyclone Gale)</span>
              </div>
            </div>

            {/* Slider 3: Upwelling Rate */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Ekman Upwelling Velocity (w)</span>
                <span className="text-xs font-mono font-black text-indigo-700">{upwellingRate} m/day</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={upwellingRate}
                onChange={(e) => setUpwellingRate(Number(e.target.value))}
                className="w-full accent-indigo-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.0 (Downwelling Pool)</span>
                <span>1.2 (Normal)</span>
                <span>5.0 (Strong Divergence)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Historical Climatology & Multi-Decadal Warming Trend ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-[#005088]" />
                  Multi-Decadal Ocean Heat Content Accumulation (0–700m)
                </h3>
                <p className="text-xs text-slate-500">
                  Historical upper ocean heat content progression in the North Indian Ocean (1995–2025)
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                MoES Long-Term Climatology
              </span>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={OHC_HISTORICAL_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis domain={[1.0, 2.1]} tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <Tooltip content={<CleanChartTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ohc0_700"
                    stroke="#4f46e5"
                    fill="rgba(79, 70, 229, 0.15)"
                    strokeWidth={2.5}
                    name="Upper OHC (GJ/m²)"
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    name="1990–2000 Baseline (1.18 GJ/m²)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Marine Heatwave Coral Bleaching Warning Table */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5 mb-1">
              <AlertTriangle size={16} className="text-red-600" />
              Marine Heatwave &amp; Coral Alert
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Ecological heat stress alerts for key sensitive marine zones
            </p>

            <div className="space-y-2.5">
              {[
                { zone: 'Andaman & Nicobar Reefs', dhw: '6.2 °C-w', status: 'Cat III (Severe)', color: 'text-red-700 bg-red-50 border-red-200' },
                { zone: 'Gulf of Mannar Biosphere', dhw: '5.4 °C-w', status: 'Cat II (Strong)', color: 'text-orange-700 bg-orange-50 border-orange-200' },
                { zone: 'Lakshadweep Atolls', dhw: '4.9 °C-w', status: 'Cat II (Strong)', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { zone: 'Malvan Marine Sanctuary', dhw: '2.4 °C-w', status: 'Cat I (Moderate)', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                { zone: 'Gulf of Kachchh Corals', dhw: '1.8 °C-w', status: 'Watch', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              ].map((item) => (
                <div key={item.zone} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{item.zone}</p>
                    <p className="text-[10px] text-slate-500 font-mono">DHW Stress: {item.dhw}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${item.color}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
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
