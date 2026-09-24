import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wind,
  Thermometer,
  Layers,
  AlertTriangle,
  Shield,
  Compass,
  Zap,
  Radio,
  BarChart2,
  Play,
  Pause,
  RotateCcw,
  Clock,
  MapPin,
  Sparkles,
  Navigation,
  Globe,
  Waves,
  Activity,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Circle,
  Tooltip as LeafletTooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageLayout, { PageContainer, PageHeader } from '../components/PageLayout';
import RiskBadge from '../components/RiskBadge';
import IndiaFlag from '../components/IndiaFlag';
import CycloneCockpitSimulator from '../components/CycloneCockpitSimulator';
import type { CycloneWaypoint, CycloneScenario } from '../components/IndiaCycloneRadarMap';

// ── Fix Leaflet icons ────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── 7-Day Detailed Forecast Waypoint & Warning Interface ─────────────────────
export interface SevenDayForecastStep extends CycloneWaypoint {
  dayId: string;
  dayTitle: string;
  dayShort: string;
  hour: number;
  alertTier: 'Yellow Watch' | 'Orange Alert' | 'Red Warning' | 'Red Landfall' | 'Blue Advisory';
  alertColor: string;
  portSignal: string;
  portSignalDesc: string;
  bulletinHeadline: string;
  fishermenWarning: string;
  stormSurgeDesc: string;
  evacuationAction: string;
  translationSpeedKmh: number;
  translationDirection: string;
  isRapidIntensificationTrigger?: boolean;
}

// ── 7-Day Cyclone Warning & Simulation Dataset (Today to Today + 7 Days) ─────
const SEVEN_DAY_FORECAST: SevenDayForecastStep[] = [
  {
    dayId: 'day-0',
    dayTitle: 'Day 0 (Today - T+0h)',
    dayShort: 'Today',
    timeLabel: 'Day 0 (Today)',
    hour: 0,
    hourOffset: 0,
    lat: 14.8,
    lon: 87.2,
    category: 'CS',
    categoryName: 'Cyclonic Storm',
    windSpeedKmh: 75,
    centralPressure: 990,
    ohc: 88, // Above 80 kJ/cm² RI threshold
    shearKts: 8.5,
    sst: 30.5,
    surgeMeters: 1.2,
    status: 'current',
    alertTier: 'Yellow Watch',
    alertColor: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
    portSignal: 'Signal II (Section Warning)',
    portSignalDesc: 'Distant Warning Signal: Port alerted to cyclonic storm in central Bay of Bengal.',
    bulletinHeadline: 'Active Cyclonic Storm BOB-02 Formed over Central Bay of Bengal. Moving NNW.',
    fishermenWarning: 'Fishermen strongly advised not to venture into deep sea of Central & North Bay of Bengal. Small craft to remain within 25 km of coast.',
    stormSurgeDesc: 'Astronomical wave height 3.0–4.5 m in open sea; coastal wave setup +1.2 m at high tide.',
    evacuationAction: 'State Disaster Management Authorities (Odisha, WB, AP) put on preliminary standby. 12 NDRF teams pre-positioned.',
    translationSpeedKmh: 14,
    translationDirection: 'NNW',
  },
  {
    dayId: 'day-1',
    dayTitle: 'Day +1 (Tomorrow - T+24h)',
    dayShort: '+1d',
    timeLabel: 'Day +1 (+24h)',
    hour: 24,
    hourOffset: 24,
    lat: 16.3,
    lon: 86.2,
    category: 'SCS',
    categoryName: 'Severe Cyclonic Storm',
    windSpeedKmh: 105,
    centralPressure: 978,
    ohc: 91,
    shearKts: 7.0,
    sst: 30.7,
    surgeMeters: 2.2,
    status: 'forecast',
    alertTier: 'Orange Alert',
    alertColor: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    portSignal: 'Signal IV (Local Warning)',
    portSignalDesc: 'Local Warning Signal: Port threatened by squally weather from approaching severe cyclonic storm.',
    bulletinHeadline: 'Severe Cyclonic Storm Entering High Ocean Heat Pool (>90 kJ/cm²). Convective Outflow Expanding.',
    fishermenWarning: 'Total suspension of fishing operations over North & Central Bay of Bengal. All trawlers and deep-sea vessels to return to nearest harbour immediately.',
    stormSurgeDesc: 'Coastal tide gauge surge expected to reach 2.2 m above astronomical tide in low-lying estuarine zones.',
    evacuationAction: 'Multi-purpose cyclone shelters opened for inspection. Power grid substations and satellite communication towers fueled with backup diesel.',
    translationSpeedKmh: 15,
    translationDirection: 'NNW',
  },
  {
    dayId: 'day-2',
    dayTitle: 'Day +2 (RI Trigger - T+48h)',
    dayShort: '+2d (RI)',
    timeLabel: 'Day +2 (+48h)',
    hour: 48,
    hourOffset: 48,
    lat: 17.9,
    lon: 85.5,
    category: 'VSCS',
    categoryName: 'Very Severe Cyclonic Storm',
    windSpeedKmh: 145,
    centralPressure: 960,
    ohc: 94, // Peak reservoir encountered
    shearKts: 6.2,
    sst: 30.9,
    surgeMeters: 3.2,
    status: 'forecast',
    alertTier: 'Orange Alert',
    alertColor: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    portSignal: 'Signal VI (Danger Signal)',
    portSignalDesc: 'Danger Signal: Port will experience severe weather with cyclonic center passing within 150 km.',
    bulletinHeadline: 'RAPID INTENSIFICATION CONFIRMED: Deep thermal pool triggers 40 km/h deepening in 24h.',
    fishermenWarning: 'Severe sea conditions "High" to "Very High". Wave heights 7–9 meters. Complete maritime ban enforced by Indian Coast Guard.',
    stormSurgeDesc: 'Storm surge inundation of 3.2 m projected for coastal belts of Ganjam, Puri, and Jagatsinghpur.',
    evacuationAction: 'Mandatory evacuation of mud & thatched dwellings within 5 km of shoreline. 28 NDRF and 40 SDRF teams deployed to vulnerable blocks.',
    translationSpeedKmh: 16,
    translationDirection: 'NNW',
    isRapidIntensificationTrigger: true,
  },
  {
    dayId: 'day-3',
    dayTitle: 'Day +3 (T+72h)',
    dayShort: '+3d',
    timeLabel: 'Day +3 (+72h)',
    hour: 72,
    hourOffset: 72,
    lat: 19.3,
    lon: 85.8,
    category: 'ESCS',
    categoryName: 'Extremely Severe CS',
    windSpeedKmh: 175,
    centralPressure: 944,
    ohc: 86,
    shearKts: 7.8,
    sst: 30.2,
    surgeMeters: 4.2,
    status: 'forecast',
    alertTier: 'Red Warning',
    alertColor: 'text-red-400 bg-red-500/15 border-red-500/30',
    portSignal: 'Signal VIII (Great Danger)',
    portSignalDesc: 'Great Danger Signal: Port will experience severe weather from cyclonic storm passing near or over.',
    bulletinHeadline: 'Extremely Severe Cyclone Approaching Odisha-WB Coast. 28-km Eye Visible on DWR Paradip.',
    fishermenWarning: 'Sea condition "Phenomenal". Total closure of all ports (Paradip, Dhamra, Gopalpur). Ships ordered to clear anchorages.',
    stormSurgeDesc: 'Surge of 4.2 m above astronomical tide. High risk of saline ingress into agricultural delta polders.',
    evacuationAction: 'Over 350,000 people evacuated into reinforced cyclone shelters. Coastal train services suspended on Kharagpur–Puri section.',
    translationSpeedKmh: 16,
    translationDirection: 'NNE',
  },
  {
    dayId: 'day-4',
    dayTitle: 'Day +4 (Peak Threat - T+96h)',
    dayShort: '+4d (Peak)',
    timeLabel: 'Day +4 (+96h)',
    hour: 96,
    hourOffset: 96,
    lat: 20.4,
    lon: 86.6,
    category: 'ESCS',
    categoryName: 'Peak Threat Pre-Landfall',
    windSpeedKmh: 185,
    centralPressure: 938,
    ohc: 76,
    shearKts: 10.5,
    sst: 29.5,
    surgeMeters: 4.8,
    status: 'forecast',
    alertTier: 'Red Warning',
    alertColor: 'text-red-400 bg-red-500/15 border-red-500/30',
    portSignal: 'Signal IX (Great Danger - Severe Cyclone)',
    portSignalDesc: 'Great Danger Signal: Severe storm of extreme intensity expected to strike near or over port.',
    bulletinHeadline: 'PEAK INTENSITY: Eyewall within 75 km of Dhamra. Squalls > 130 km/h lashing outer headlands.',
    fishermenWarning: 'Offshore wave heights 11–13 meters. Complete cessation of all maritime, offshore oil & gas, and naval traffic.',
    stormSurgeDesc: 'Catastrophic 4.8 m surge combined with spring high tide. Sea water ingress expected up to 8 km inland in Bhadrak and Kendrapara.',
    evacuationAction: 'Final sweep of low-lying settlements complete. Over 580,000 citizens in shelters. Power transmission grids proactively isolated.',
    translationSpeedKmh: 17,
    translationDirection: 'NNE',
  },
  {
    dayId: 'day-5',
    dayTitle: 'Day +5 (Coastal Strike - T+120h)',
    dayShort: '+5d (Strike)',
    timeLabel: 'Day +5 (+120h)',
    hour: 120,
    hourOffset: 120,
    lat: 21.1,
    lon: 87.2,
    category: 'VSCS',
    categoryName: 'Coastal Inundation Landfall',
    windSpeedKmh: 165,
    centralPressure: 948,
    ohc: 62,
    shearKts: 14.0,
    sst: 28.8,
    surgeMeters: 4.5,
    status: 'forecast',
    alertTier: 'Red Landfall',
    alertColor: 'text-red-300 bg-red-600/30 border-red-400',
    portSignal: 'Signal X (Great Danger - Eye Over Port)',
    portSignalDesc: 'Great Danger Signal 10: Eye of the cyclone striking port directly. Maximum wind destructive force.',
    bulletinHeadline: 'Outer Eyewall Striking Balasore–Digha Coastline. Catastrophic Inundation in Progress.',
    fishermenWarning: 'Zero maritime movement. Coastal highways (NH-16, NH-116B) submerged. Embankment breaches reported.',
    stormSurgeDesc: '4.5 m saline surge inundating coastal wetlands, Sundarbans fringes, and coastal shrimp farms.',
    evacuationAction: 'Curfew in place across coastal belt. Armed forces, Indian Air Force helicopters on 30-minute alert for search & rescue.',
    translationSpeedKmh: 18,
    translationDirection: 'NE',
  },
  {
    dayId: 'day-6',
    dayTitle: 'Day +6 (Inland Deluge - T+144h)',
    dayShort: '+6d (Inland)',
    timeLabel: 'Day +6 (+144h)',
    hour: 144,
    hourOffset: 144,
    lat: 22.1,
    lon: 87.9,
    category: 'SCS',
    categoryName: 'Inland Crossing Deluge',
    windSpeedKmh: 115,
    centralPressure: 970,
    ohc: 38,
    shearKts: 18.0,
    sst: 27.5,
    surgeMeters: 2.8,
    status: 'forecast',
    alertTier: 'Red Warning',
    alertColor: 'text-red-400 bg-red-500/15 border-red-500/30',
    portSignal: 'Signal IV (Lowered to Cautionary)',
    portSignalDesc: 'System moved inland. Port out of direct eye danger, but gales continue.',
    bulletinHeadline: 'Cyclone Passed Inland Near Sagar Island. Torrential Deluge (>250mm) Triggers Flash Floods.',
    fishermenWarning: 'Riverine navigation halted. Flash flood alerts for Subarnarekha, Baitarani, and Damodar river basins.',
    stormSurgeDesc: 'Storm surge receding; river backflow causing urban waterlogging in Haldia, Tamluk, and Howrah.',
    evacuationAction: 'NDRF clear-fell teams clearing uprooted trees and restoring high-voltage feeder lines. Relief food drop begun.',
    translationSpeedKmh: 20,
    translationDirection: 'NE',
  },
  {
    dayId: 'day-7',
    dayTitle: 'Day +7 (Inland Decay - T+168h)',
    dayShort: '+7d (Decay)',
    timeLabel: 'Day +7 (+168h)',
    hour: 168,
    hourOffset: 168,
    lat: 23.6,
    lon: 88.8,
    category: 'D',
    categoryName: 'Inland Dissipation (Depression)',
    windSpeedKmh: 55,
    centralPressure: 994,
    ohc: 15,
    shearKts: 22.0,
    sst: 26.0,
    surgeMeters: 0.5,
    status: 'forecast',
    alertTier: 'Blue Advisory',
    alertColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    portSignal: 'Signals Lowered',
    portSignalDesc: 'All formal cyclone port warning signals officially lowered. Normal operations resume under harbor master guidance.',
    bulletinHeadline: 'BOB-02 Weakened into Inland Depression over Gangetic Plains. Residual Showers Persist.',
    fishermenWarning: 'Sea state returning to moderate. Fishermen advised to inspect craft and moorings before venturing out tomorrow.',
    stormSurgeDesc: 'Normal astronomical tidal cycle restored along northern Bay of Bengal coastlines.',
    evacuationAction: 'Disaster recovery phase initiated. Drinking water purification, health clinics, and phased return from cyclone shelters.',
    translationSpeedKmh: 22,
    translationDirection: 'ENE',
  },
];

// ── Multi-Cyclone Comparison Timeline (Graph 1: Line Chart) ───────────────────
const INTENSIFICATION_TIMELINE = [
  { hour: 0, dayLabel: 'Day 0 (Today)', currentWind: 75, currentPressure: 990, amphanWind: 80, amphanPressure: 990, mochaWind: 85, mochaPressure: 988, faniWind: 100, faniPressure: 982, biparjoyWind: 130, biparjoyPressure: 970 },
  { hour: 24, dayLabel: 'Day +1', currentWind: 105, currentPressure: 978, amphanWind: 145, amphanPressure: 968, mochaWind: 140, mochaPressure: 965, faniWind: 150, faniPressure: 960, biparjoyWind: 155, biparjoyPressure: 958 },
  { hour: 48, dayLabel: 'Day +2 (RI)', currentWind: 145, currentPressure: 960, amphanWind: 260, amphanPressure: 906, mochaWind: 215, mochaPressure: 938, faniWind: 195, faniPressure: 937, biparjoyWind: 165, biparjoyPressure: 955 },
  { hour: 72, dayLabel: 'Day +3', currentWind: 175, currentPressure: 944, amphanWind: 215, amphanPressure: 932, mochaWind: 240, mochaPressure: 918, faniWind: 185, faniPressure: 944, biparjoyWind: 140, biparjoyPressure: 965 },
  { hour: 96, dayLabel: 'Day +4 (Peak)', currentWind: 185, currentPressure: 938, amphanWind: 185, amphanPressure: 945, mochaWind: 195, mochaPressure: 940, faniWind: 130, faniPressure: 968, biparjoyWind: 125, biparjoyPressure: 974 },
  { hour: 120, dayLabel: 'Day +5', currentWind: 165, currentPressure: 948, amphanWind: 155, amphanPressure: 958, mochaWind: 130, mochaPressure: 966, faniWind: 80, faniPressure: 986, biparjoyWind: 85, biparjoyPressure: 988 },
  { hour: 144, dayLabel: 'Day +6 (Landfall)', currentWind: 115, currentPressure: 970, amphanWind: 100, amphanPressure: 978, mochaWind: 75, mochaPressure: 985, faniWind: 50, faniPressure: 996, biparjoyWind: 55, biparjoyPressure: 995 },
  { hour: 168, dayLabel: 'Day +7 (Inland)', currentWind: 55, currentPressure: 994, amphanWind: 50, amphanPressure: 996, mochaWind: 45, mochaPressure: 998, faniWind: 40, faniPressure: 1000, biparjoyWind: 35, biparjoyPressure: 1002 },
];

// ── Physical Parameters Benchmark Comparison (Graph 2 & Matrix Table) ────────
const CYCLONE_COMPARISONS = [
  {
    name: 'Today: BOB-02',
    fullName: 'Active Threat BOB-02 (2026)',
    basin: 'Bay of Bengal',
    category: 'Projected ESCS',
    ohc: 94,
    sst: 30.9,
    d26: 72,
    peakWind: 185,
    minPressure: 938,
    surge: 4.8,
    riObserved: 'RI Predicted (76%)',
    riskLevel: 'Extreme',
    isToday: true,
    color: '#06b6d4',
  },
  {
    name: 'Amphan (2020)',
    fullName: 'Super Cyclone Amphan',
    basin: 'Bay of Bengal',
    category: 'Super Cyclone (SuCS)',
    ohc: 112,
    sst: 31.0,
    d26: 78,
    peakWind: 260,
    minPressure: 906,
    surge: 5.5,
    riObserved: 'Yes (+110 km/h in 24h)',
    riskLevel: 'Extreme',
    isToday: false,
    color: '#a855f7',
  },
  {
    name: 'Mocha (2023)',
    fullName: 'Extremely Severe Mocha',
    basin: 'Bay of Bengal',
    category: 'Extremely Severe (ESCS)',
    ohc: 104,
    sst: 30.8,
    d26: 72,
    peakWind: 240,
    minPressure: 918,
    surge: 4.5,
    riObserved: 'Yes (+95 km/h in 24h)',
    riskLevel: 'Extreme',
    isToday: false,
    color: '#ef4444',
  },
  {
    name: 'Fani (2019)',
    fullName: 'Extremely Severe Fani',
    basin: 'Bay of Bengal',
    category: 'Extremely Severe (ESCS)',
    ohc: 98,
    sst: 30.5,
    d26: 68,
    peakWind: 215,
    minPressure: 932,
    surge: 4.5,
    riObserved: 'Yes (+85 km/h in 24h)',
    riskLevel: 'High',
    isToday: false,
    color: '#f59e0b',
  },
  {
    name: 'Biparjoy (2023)',
    fullName: 'Very Severe Biparjoy',
    basin: 'Arabian Sea',
    category: 'Very Severe (VSCS)',
    ohc: 85,
    sst: 30.2,
    d26: 58,
    peakWind: 165,
    minPressure: 950,
    surge: 3.5,
    riObserved: 'Yes (+60 km/h in 24h)',
    riskLevel: 'High',
    isToday: false,
    color: '#10b981',
  },
];

// ── Physical Cyclone Prediction Parameters Specification ───────────────────────
const PREDICTION_PARAMETERS = [
  {
    id: 'ohc',
    name: 'Ocean Heat Content (OHC / TCHP)',
    symbol: 'Q_H',
    unit: 'kJ/cm²',
    threshold: '> 60–80 kJ/cm² (Explosive RI Trigger)',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/10',
    icon: Zap,
    role: 'Primary Thermal Engine',
    desc: 'Integrated enthalpy from the surface down to the 26°C isotherm. Reconstructed directly by OCEANINTEL from satellite altimetry & SST. When OHC exceeds 80 kJ/cm², tropical cyclones experience explosive intensification.',
  },
  {
    id: 'sst',
    name: 'Sea Surface Temperature (SST)',
    symbol: 'T_surf',
    unit: '°C',
    threshold: '≥ 26.5°C (Genesis Baseline)',
    color: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    icon: Thermometer,
    role: 'Thermodynamic Trigger',
    desc: 'Provides the sensible & latent heat boundary flux. However, high SST alone is deceptive: if the subsurface is cold, strong cyclonic winds immediately stir up frigid water and choke the storm.',
  },
  {
    id: 'd26',
    name: 'Depth of 26°C Isotherm (D26)',
    symbol: 'Z_26',
    unit: 'meters',
    threshold: '> 50 m (Negative Feedback Buffer)',
    color: 'text-teal-400',
    border: 'border-teal-500/30',
    bg: 'bg-teal-500/10',
    icon: Layers,
    role: 'Upwelling Resistance',
    desc: 'When D26 is deep (>50m), intense Ekman upwelling draws warm water up into the eyewall rather than cold water. This insulates the storm from creating a self-destructive cold wake.',
  },
  {
    id: 'vws',
    name: 'Vertical Wind Shear (VWS)',
    symbol: 'ΔV (850–200 hPa)',
    unit: 'knots',
    threshold: '< 10 kts (Favorable Chimney)',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
    icon: Compass,
    role: 'Atmospheric Structural Stability',
    desc: 'The velocity difference between the lower (850 hPa) and upper (200 hPa) troposphere. Low shear preserves the vertical chimney structure of the cyclone warm core.',
  },
  {
    id: 'mld',
    name: 'Mixed Layer Depth (MLD)',
    symbol: 'h_m',
    unit: 'meters',
    threshold: '> 30–45 m',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    icon: Wind,
    role: 'Turbulent Mixing Buffer',
    desc: 'Upper nearly-isothermal layer created by wind turbulence. A deep mixed layer delays cold thermocline entrainment during cyclonic passage.',
  },
];

// ── Coastal IMD Doppler Weather Radar (DWR) Stations ───────────────────────
const COASTAL_DWR_STATIONS = [
  { name: 'DWR Paradip', code: 'PRD', state: 'Odisha', lat: 20.31, lon: 86.61, rangeKm: 350 },
  { name: 'DWR Kolkata', code: 'KOL', state: 'West Bengal', lat: 22.57, lon: 88.36, rangeKm: 300 },
  { name: 'DWR Visakhapatnam', code: 'VSK', state: 'Andhra Pradesh', lat: 17.68, lon: 83.21, rangeKm: 350 },
  { name: 'DWR Gopalpur', code: 'GPL', state: 'Odisha', lat: 19.26, lon: 84.91, rangeKm: 300 },
  { name: 'DWR Chennai', code: 'CHN', state: 'Tamil Nadu', lat: 13.08, lon: 80.27, rangeKm: 350 },
];

// ── Scenario Object for Cockpit Compatibility ─────────────────────────────────
const ACTIVE_BOB_SCENARIO: CycloneScenario = {
  id: 'BOB-02',
  name: 'Active Alert: BOB-02 (7-Day Forecast)',
  basin: 'Bay of Bengal',
  center: [18.0, 86.5],
  zoom: 5,
  targetLandfall: {
    name: 'Dhamra / Balasore Coast',
    state: 'Odisha & West Bengal',
    lat: 21.1,
    lon: 87.2,
    etaHours: 120,
    surgeMeters: 4.8,
    peakWindKmh: 185,
    highRiskDistricts: ['Kendrapara', 'Bhadrak', 'Balasore', 'Jagatsinghpur', 'Purba Medinipur'],
  },
  waypoints: SEVEN_DAY_FORECAST,
  conePolygon: [
    [14.8, 87.2],
    [15.8, 85.0],
    [17.2, 84.2],
    [19.0, 84.4],
    [20.5, 85.2],
    [21.8, 86.1],
    [23.8, 87.5],
    [24.5, 89.8],
    [23.2, 90.2],
    [21.5, 89.0],
    [19.8, 87.8],
    [18.0, 87.2],
    [16.2, 87.6],
    [14.8, 87.2],
  ],
  ohcHotspot: {
    lat: 17.8,
    lon: 85.8,
    radiusMeters: 380000,
    maxOhc: 94,
  },
};

// ── Map Controller Component for Viewport Changes ─────────────────────────────
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.0 });
  }, [center, zoom, map]);
  return null;
}

export default function CyclonePage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();

  // Active view tabs
  const [activeTab, setActiveTab] = useState<'simulation' | 'comparison' | 'parameters'>('simulation');

  // 7-day timeline simulation state
  const [activeDayIdx, setActiveDayIdx] = useState<number>(0); // 0 = Day 0 (Today)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 4x

  // Map camera & view mode
  const [mapPreset, setMapPreset] = useState<'regional' | 'world' | 'landfall'>('regional');
  const [basemapTile, setBasemapTile] = useState<'satellite' | 'dark'>('satellite');

  // Layer toggles
  const [showVortex, setShowVortex] = useState<boolean>(true);
  const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
  const [showCone, setShowCone] = useState<boolean>(true);
  const [showRadii, setShowRadii] = useState<boolean>(true);
  const [showOhcPool, setShowOhcPool] = useState<boolean>(true);
  const [showRadarSweeps, setShowRadarSweeps] = useState<boolean>(true);
  const [showLandfallSurge, setShowLandfallSurge] = useState<boolean>(true);

  // Comparison graph metric toggle
  const [comparisonMetric, setComparisonMetric] = useState<'wind' | 'pressure'>('wind');

  const currentStep = SEVEN_DAY_FORECAST[activeDayIdx] ?? SEVEN_DAY_FORECAST[0];
  const timerRef = useRef<number | null>(null);

  // ── Camera Coordinates based on Preset ──────────────────────────────────────
  const mapCenterConfig = useMemo((): { center: [number, number]; zoom: number } => {
    if (mapPreset === 'world') {
      return { center: [15.0, 78.0], zoom: 4 }; // Global world / Indian Ocean basin overview
    }
    if (mapPreset === 'landfall') {
      return { center: [21.1, 87.2], zoom: 7 }; // Landfall strike zone focus
    }
    return { center: [18.2, 86.5], zoom: 5.2 }; // Regional Bay of Bengal track
  }, [mapPreset]);

  // ── Automated Scrubber Playback Loop (7-Day Forecast) ───────────────────────
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 2000 / playSpeed;
      timerRef.current = window.setInterval(() => {
        setActiveDayIdx((prev) => {
          if (prev >= SEVEN_DAY_FORECAST.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playSpeed]);

  const handlePlayPause = () => {
    if (!isPlaying && activeDayIdx >= SEVEN_DAY_FORECAST.length - 1) {
      setActiveDayIdx(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleResetToToday = () => {
    setIsPlaying(false);
    setActiveDayIdx(0);
  };

  // ── Trajectory Coordinates ──────────────────────────────────────────────────
  const pastTrackPoints = useMemo(() => {
    return SEVEN_DAY_FORECAST.slice(0, activeDayIdx + 1).map((w) => [w.lat, w.lon] as [number, number]);
  }, [activeDayIdx]);

  const forecastTrackPoints = useMemo(() => {
    return SEVEN_DAY_FORECAST.slice(activeDayIdx).map((w) => [w.lat, w.lon] as [number, number]);
  }, [activeDayIdx]);

  // ── Dynamic Spiral Atmospheric Inflow Streamlines ───────────────────────────
  const windStreamlines = useMemo(() => {
    const { lat, lon } = currentStep;
    const lines: [number, number][][] = [];
    const numArms = 12;
    const radiusDeg = 3.8;

    for (let i = 0; i < numArms; i++) {
      const baseAngle = (i * 2 * Math.PI) / numArms;
      const pts: [number, number][] = [];
      const steps = 7;
      for (let s = steps; s >= 0; s--) {
        const frac = s / steps;
        const r = radiusDeg * frac;
        const angle = baseAngle + (1 - frac) * 1.8;
        const ptLat = lat + r * Math.sin(angle);
        const ptLon = lon + r * Math.cos(angle) * 1.05;
        pts.push([ptLat, ptLon]);
      }
      lines.push(pts);
    }
    return lines;
  }, [currentStep]);

  // ── Custom Leaflet Icons ────────────────────────────────────────────────────
  // 1. Photorealistic Spinning Satellite Vortex Marker
  const cycloneVortexIcon = useMemo(() => {
    const isExtreme = currentStep.windSpeedKmh >= 160;
    const isSuper = currentStep.windSpeedKmh >= 220;
    const isSevere = currentStep.windSpeedKmh >= 105;

    const spinClass = isSuper
      ? 'animate-cyclone-vortex-extreme'
      : isExtreme
      ? 'animate-cyclone-vortex-fast'
      : 'animate-cyclone-vortex';

    const coreColor = isSuper ? '#a855f7' : isExtreme ? '#ef4444' : isSevere ? '#f97316' : '#06b6d4';
    const stormSize = isSuper ? 280 : isExtreme ? 250 : isSevere ? 220 : 190;
    const eyeSize = isSuper ? 46 : isExtreme ? 42 : isSevere ? 38 : 34;

    const html = `
      <div style="position: relative; width: ${stormSize}px; height: ${stormSize}px; transform: translate(-50%, -50%); pointer-events: none;">
        <!-- Natural Atmospheric Cloud Shadow on Ocean Surface -->
        <div style="position: absolute; inset: 10px; border-radius: 50%; background: radial-gradient(circle, rgba(2, 9, 23, 0.8) 40%, rgba(2, 9, 23, 0.3) 75%, transparent 100%); filter: blur(14px); transform: translate(6px, 12px); pointer-events: none;"></div>

        <!-- Photorealistic INSAT-3D / NOAA Satellite Cloud Canopy (Counter-Clockwise Vortex) -->
        <div class="${spinClass}" style="position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: center center;">
          <img 
            src="/cyclone_satellite_vortex.webp" 
            alt="Meteorological Satellite Cloud Canopy"
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
              filter: drop-shadow(0 0 20px ${coreColor}) brightness(1.1) contrast(1.08);
              pointer-events: none;
              user-select: none;
              display: block;
            "
          />
        </div>

        <!-- Eyewall Convective Infrared Thermal Pulse -->
        <div class="animate-eyewall-pulse" style="position: absolute; top: 50%; left: 50%; width: ${eyeSize * 2.2}px; height: ${eyeSize * 2.2}px; margin-top: -${eyeSize * 1.1}px; margin-left: -${eyeSize * 1.1}px; border-radius: 50%; background: radial-gradient(circle, transparent 35%, ${coreColor}45 70%, transparent 95%); pointer-events: none; mix-blend-mode: screen;"></div>

        <!-- Eyewall Lightning Discharges in Hot Towers -->
        <svg viewBox="0 0 100 100" class="animate-convective-zap" style="position: absolute; top: 22%; left: 24%; width: 32px; height: 32px; pointer-events: none; z-index: 6;">
          <path d="M 18 2 L 10 16 L 16 18 L 8 32 L 14 20 L 8 18 Z" fill="#fde047" stroke="#ffffff" stroke-width="0.5" filter="drop-shadow(0 0 8px #facc15)" />
        </svg>
        <svg viewBox="0 0 100 100" class="animate-convective-zap" style="position: absolute; bottom: 24%; right: 26%; width: 28px; height: 28px; pointer-events: none; animation-delay: 1.6s; z-index: 6;">
          <path d="M 20 2 L 12 14 L 18 16 L 10 30 L 15 18 L 9 17 Z" fill="#38bdf8" stroke="#ffffff" stroke-width="0.5" filter="drop-shadow(0 0 8px #38bdf8)" />
        </svg>

        <!-- Calm Cyclone Eye Core with Telemetry Readout -->
        <div class="animate-eyewall-pulse" style="position: absolute; top: 50%; left: 50%; width: ${eyeSize}px; height: ${eyeSize}px; margin-top: -${eyeSize / 2}px; margin-left: -${eyeSize / 2}px; border-radius: 50%; background: radial-gradient(circle, #020917 35%, #081b33 75%, ${coreColor} 100%); border: 2px solid rgba(255, 255, 255, 0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 24px ${coreColor}, inset 0 0 10px rgba(0,0,0,0.9); z-index: 7;">
          <span style="font-size: ${eyeSize > 40 ? '11px' : '9.5px'}; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">${currentStep.category}</span>
          <span style="font-size: ${eyeSize > 40 ? '8.5px' : '7.5px'}; font-family: monospace; color: #fef08a; font-weight: 700; line-height: 1; margin-top: 1.5px;">${currentStep.centralPressure}hPa</span>
        </div>

        <!-- Floating Live Telemetry Pill -->
        <div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); white-space: nowrap; background: rgba(2, 9, 23, 0.94); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; padding: 3px 8px; font-family: monospace; font-size: 10px; font-weight: 700; color: #38bdf8; box-shadow: 0 4px 14px rgba(0,0,0,0.7); z-index: 8;">
          ${currentStep.dayShort} • ${currentStep.windSpeedKmh} km/h • OHC: ${currentStep.ohc} kJ
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'cyclone-marker-container',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, [currentStep]);

  // 2. Coastal Doppler Weather Radar Sweep Marker
  const createRadarSweepIcon = useCallback((station: (typeof COASTAL_DWR_STATIONS)[0]) => {
    const html = `
      <div style="position: relative; width: 84px; height: 84px; transform: translate(-50%, -50%); pointer-events: none;">
        <div class="animate-radar-sweep" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: conic-gradient(from 0deg, rgba(6, 182, 212, 0) 0deg, rgba(6, 182, 212, 0.3) 300deg, rgba(16, 185, 129, 0.85) 360deg);"></div>
        <div style="position: absolute; inset: 10px; border-radius: 50%; border: 1px solid rgba(6, 182, 212, 0.4);"></div>
        <div style="position: absolute; top: 50%; left: 50%; width: 10px; height: 10px; margin-top: -5px; margin-left: -5px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; box-shadow: 0 0 10px #10b981;"></div>
        <div style="position: absolute; top: 92%; left: 50%; transform: translateX(-50%); font-size: 8px; font-weight: 700; color: #a7f3d0; background: rgba(2,9,23,0.85); padding: 1px 4px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.4); white-space: nowrap;">
          ${station.code} DWR
        </div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'radar-sweep-container',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, []);

  // 3. Coastal Landfall Target Marker
  const landfallImpactIcon = useMemo(() => {
    const html = `
      <div style="position: relative; width: 80px; height: 80px; transform: translate(-50%, -50%); pointer-events: none;">
        <div class="animate-surge-ring" style="position: absolute; inset: 0; border-radius: 50%; border: 3px solid #ef4444; background: rgba(239, 68, 68, 0.2);"></div>
        <div class="animate-surge-ring" style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid #f97316; animation-delay: 1.1s;"></div>
        <div style="position: absolute; top: 50%; left: 50%; width: 22px; height: 22px; margin-top: -11px; margin-left: -11px; border-radius: 50%; background: #dc2626; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px #ef4444;">
          <span style="font-size: 11px;">⚠️</span>
        </div>
        <div style="position: absolute; top: 105%; left: 50%; transform: translateX(-50%); background: rgba(220, 38, 38, 0.95); border: 1px solid #fecaca; border-radius: 6px; padding: 2px 6px; font-size: 8px; font-weight: 800; color: #ffffff; white-space: nowrap; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.7);">
          LANDFALL STRIKE<br/>Surge: +4.8m
        </div>
      </div>
    `;
    return L.divIcon({
      html,
      className: 'landfall-impact-container',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, []);

  // 4. Waypoint Node Marker Icon
  const createWaypointNodeIcon = (idx: number) => {
    const isSelected = idx === activeDayIdx;
    const isToday = idx === 0;
    const isLandfall = idx === 5;
    const bg = isToday ? '#22c55e' : isLandfall ? '#ef4444' : isSelected ? '#06b6d4' : '#f59e0b';

    const html = `
      <div style="
        width: ${isSelected ? '18px' : '12px'}; 
        height: ${isSelected ? '18px' : '12px'}; 
        border-radius: 50%; 
        background: ${bg}; 
        border: 2px solid #ffffff; 
        transform: translate(-50%, -50%); 
        box-shadow: 0 0 ${isSelected ? '14px #06b6d4' : '4px rgba(0,0,0,0.8)'}; 
        cursor: pointer;
        transition: all 0.2s;
      "></div>
    `;
    return L.divIcon({
      html,
      className: 'waypoint-node-icon',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  const pageContent = (
    <PageContainer>
        {/* ── Page Header ── */}
        <PageHeader
          category="MINISTRY OF EARTH SCIENCES (MoES) · INDIA METEOROLOGICAL DEPARTMENT (IMD)"
          badge={
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-mono shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              CYCLONE EARLY WARNING RADAR ACTIVE · BOB-02
            </div>
          }
          icon={<Wind size={18} className="text-cyan-400" />}
          title="7-Day Cyclone Warning & Simulation System"
          subtitle="Interactive world map simulation and physics-informed early warning from Today to Day +7, powered by 0–1000m subsurface Ocean Heat Content (OHC)"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/gov')}
                className="btn-primary-cyan text-xs flex items-center gap-1.5"
              >
                <Shield size={13} className="text-yellow-400" />
                Government Advisory
              </button>
            </div>
          }
        />

        {/* ── Top Active System Threat Alert Banner ── */}
        <div className="p-4 rounded-2xl glass border border-red-500/30 bg-gradient-to-r from-red-950/40 via-orange-950/20 to-black/50 depth-shadow mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-lg">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-base tracking-tight">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Active Monitored Cyclone: Deep Threat BOB-02
                  </span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/25 text-red-300 font-mono text-[10px] font-bold border border-red-500/40">
                  76% RAPID INTENSIFICATION PROBABILITY
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                  7-DAY EARLY WARNING PROTOCOL
                </span>
              </div>
              <p className="text-xs text-sky-100/90 font-medium mt-1">
                Central Bay of Bengal ({currentStep.lat}°N, {currentStep.lon}°E) · Active Tracking: {currentStep.translationDirection} at {currentStep.translationSpeedKmh} km/h · Subsurface OHC Reservoir: 88–94 kJ/cm²
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-auto text-xs shrink-0">
            <div className="text-right">
              <span className="text-white/40 block text-[10px] uppercase font-mono">Today (Day 0)</span>
              <span className="font-mono text-yellow-400 font-bold text-sm">75 km/h (CS)</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <span className="text-white/40 block text-[10px] uppercase font-mono">Projected Peak</span>
              <span className="font-mono text-red-400 font-bold text-sm">185 km/h (ESCS)</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <span className="text-white/40 block text-[10px] uppercase font-mono">Peak Surge</span>
              <span className="font-mono text-orange-400 font-bold text-sm">+4.8 Meters</span>
            </div>
          </div>
        </div>

        {/* ── View Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-6 overflow-x-auto [scrollbar-width:none]">
          {[
            { id: 'simulation', label: '7-Day World Map Simulation & Warning Protocol', icon: Globe },
            { id: 'comparison', label: 'Past Cyclone vs Current Data Graphs', icon: BarChart2 },
            { id: 'parameters', label: 'Subsurface OHC Physics & AI Predictors', icon: Zap },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={14} className={activeTab === id ? 'text-cyan-400' : 'text-white/40'} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1: 7-DAY WORLD MAP SIMULATION & WARNING PROTOCOL
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            {/* ── 7-Day Interactive Timeline Progression Bar ── */}
            <div className="glass rounded-3xl p-5 border border-cyan-500/30 depth-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                        7-Day Cyclone Warning Forecast:
                      </span>
                      <span className="text-cyan-300 font-mono">{currentStep.dayTitle}</span>
                    </h3>
                    <p className="text-[11px] text-sky-100/90 font-medium">
                      Select any milestone or click Play to simulate cyclone evolution from Today across Day +1 to Day +7
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    <span>{isPlaying ? 'Pause' : 'Play 7-Day Simulation'}</span>
                  </button>

                  <button
                    onClick={handleResetToToday}
                    title="Reset to Day 0 (Today)"
                    className="p-1.5 rounded-xl btn-glass cursor-pointer text-white/60 hover:text-white"
                  >
                    <RotateCcw size={13} />
                  </button>

                  <div className="flex items-center glass rounded-xl border border-white/10 p-0.5 text-[10px] font-mono">
                    {[1, 2, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => setPlaySpeed(s)}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-all ${
                          playSpeed === s ? 'bg-cyan-500/30 text-cyan-300' : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 8 Day Milestone Nodes */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {SEVEN_DAY_FORECAST.map((step, idx) => {
                  const isSelected = idx === activeDayIdx;
                  return (
                    <button
                      key={step.dayId}
                      onClick={() => {
                        setActiveDayIdx(idx);
                        setIsPlaying(false);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'
                      }`}
                    >
                      {step.isRapidIntensificationTrigger && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                      )}
                      <div>
                        <span className={`text-[10px] font-mono font-bold block ${isSelected ? 'text-cyan-300' : 'text-white/50'}`}>
                          {step.dayShort}
                        </span>
                        <span className="text-[11px] font-extrabold text-white block truncate">
                          {step.category}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono flex items-center justify-between">
                        <span className={isSelected ? 'text-yellow-400 font-bold' : 'text-white/40'}>
                          {step.windSpeedKmh}k
                        </span>
                        <span className={isSelected ? 'text-orange-400' : 'text-white/30'}>
                          {step.ohc}kJ
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Main Interactive Map Simulation & Bulletin Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Interactive Map Simulation (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="glass rounded-3xl border border-cyan-500/30 depth-shadow overflow-hidden">
                  {/* Map Controls Header */}
                  <div className="p-3.5 border-b border-white/10 bg-white/95 border-b border-slate-200 text-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <IndiaFlag className="w-4 h-3 rounded-sm shadow-sm" />
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Compass size={14} className="text-cyan-400" />
                        Live Map Track &amp; Vortex Simulation
                      </span>
                    </div>

                    {/* Camera Presets & Basemap Selector */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center glass rounded-xl border border-white/10 p-0.5 text-[11px]">
                        <button
                          onClick={() => setMapPreset('regional')}
                          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                            mapPreset === 'regional' ? 'bg-cyan-500/25 text-cyan-300' : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Bay of Bengal
                        </button>
                        <button
                          onClick={() => setMapPreset('world')}
                          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                            mapPreset === 'world' ? 'bg-cyan-500/25 text-cyan-300' : 'text-white/50 hover:text-white'
                          }`}
                        >
                          World / Indian Ocean
                        </button>
                        <button
                          onClick={() => setMapPreset('landfall')}
                          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                            mapPreset === 'landfall' ? 'bg-cyan-500/25 text-cyan-300' : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Landfall Strike
                        </button>
                      </div>

                      <div className="flex items-center glass rounded-xl border border-white/10 p-0.5 text-[11px]">
                        <button
                          onClick={() => setBasemapTile('satellite')}
                          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                            basemapTile === 'satellite' ? 'bg-cyan-500/25 text-cyan-300' : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Satellite
                        </button>
                        <button
                          onClick={() => setBasemapTile('dark')}
                          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-all ${
                            basemapTile === 'dark' ? 'bg-cyan-500/25 text-cyan-300' : 'text-white/50 hover:text-white'
                          }`}
                        >
                          Dark Carto
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Leaflet Map Canvas */}
                  <div style={{ height: '480px', width: '100%', position: 'relative' }}>
                    <MapContainer
                      center={mapCenterConfig.center}
                      zoom={mapCenterConfig.zoom}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={true}
                    >
                      <MapViewController center={mapCenterConfig.center} zoom={mapCenterConfig.zoom} />

                      {/* Basemap Tile Layer */}
                      {basemapTile === 'satellite' ? (
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution="&copy; Esri &amp; NOAA"
                        />
                      ) : (
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                          attribution="&copy; CARTO &amp; OSM"
                        />
                      )}

                      {/* High OHC Thermal Fuel Reservoir Layer */}
                      {showOhcPool && (
                        <Circle
                          center={[ACTIVE_BOB_SCENARIO.ohcHotspot.lat, ACTIVE_BOB_SCENARIO.ohcHotspot.lon]}
                          radius={ACTIVE_BOB_SCENARIO.ohcHotspot.radiusMeters}
                          pathOptions={{
                            color: '#f97316',
                            fillColor: '#ea580c',
                            fillOpacity: 0.22,
                            weight: 1.5,
                            dashArray: '5 5',
                          }}
                        >
                          <LeafletTooltip direction="top">
                            <span className="text-xs font-bold text-orange-300">
                              Subsurface OHC Reservoir (&gt; 90 kJ/cm²) · Rapid Intensification Fuel Pool
                            </span>
                          </LeafletTooltip>
                        </Circle>
                      )}

                      {/* 7-Day Forecast Cone of Uncertainty (70% Confidence Envelope) */}
                      {showCone && (
                        <Polygon
                          positions={ACTIVE_BOB_SCENARIO.conePolygon}
                          pathOptions={{
                            color: '#ef4444',
                            fillColor: '#ef4444',
                            fillOpacity: 0.12,
                            weight: 1.5,
                            dashArray: '6 4',
                          }}
                        >
                          <LeafletTooltip direction="center">
                            <span className="text-xs font-semibold text-red-300">
                              70% Forecast Track Uncertainty Envelope (Today $\to$ Day +7)
                            </span>
                          </LeafletTooltip>
                        </Polygon>
                      )}

                      {/* Trajectory: Past Solid Line */}
                      <Polyline
                        positions={pastTrackPoints}
                        pathOptions={{ color: '#06b6d4', weight: 4 }}
                      />

                      {/* Trajectory: Future Dashed Line */}
                      <Polyline
                        positions={forecastTrackPoints}
                        pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '8 6' }}
                      />

                      {/* Dynamic Inflow Wind Streamlines */}
                      {showStreamlines &&
                        windStreamlines.map((pts, i) => (
                          <Polyline
                            key={`stream-${i}`}
                            positions={pts}
                            pathOptions={{
                              color: '#38bdf8',
                              weight: 1.4,
                              opacity: 0.45,
                              dashArray: '4 6',
                              className: 'animate-dash-flow',
                            }}
                          />
                        ))}

                      {/* Expanding Wind Radii (Gale & Hurricane Force Circles) */}
                      {showRadii && (
                        <>
                          {/* 34-knot Gale Radius (Outer Winds) */}
                          <Circle
                            center={[currentStep.lat, currentStep.lon]}
                            radius={currentStep.windSpeedKmh > 100 ? 240000 : 160000}
                            pathOptions={{
                              color: '#eab308',
                              fillColor: '#eab308',
                              fillOpacity: 0.08,
                              weight: 1,
                              dashArray: '4 4',
                            }}
                          >
                            <LeafletTooltip direction="right">
                              <span className="text-[11px] text-yellow-300 font-mono">
                                Gale Wind Radius (R34): ~240 km
                              </span>
                            </LeafletTooltip>
                          </Circle>

                          {/* 64-knot Hurricane Force Radius (Inner Core) */}
                          {currentStep.windSpeedKmh >= 118 && (
                            <Circle
                              center={[currentStep.lat, currentStep.lon]}
                              radius={90000}
                              pathOptions={{
                                color: '#ef4444',
                                fillColor: '#ef4444',
                                fillOpacity: 0.15,
                                weight: 1.5,
                              }}
                            >
                              <LeafletTooltip direction="left">
                                <span className="text-[11px] text-red-300 font-mono">
                                  Hurricane Core Radius (R64): ~90 km
                                </span>
                              </LeafletTooltip>
                            </Circle>
                          )}
                        </>
                      )}

                      {/* Coastal Doppler Weather Radar Sweeps */}
                      {showRadarSweeps &&
                        COASTAL_DWR_STATIONS.map((st) => (
                          <Marker
                            key={st.code}
                            position={[st.lat, st.lon]}
                            icon={createRadarSweepIcon(st)}
                          >
                            <LeafletTooltip direction="top">
                              <div className="text-xs p-1">
                                <strong>{st.name}</strong> ({st.state})<br />
                                S-Band Doppler Weather Radar (Range: {st.rangeKm} km)
                              </div>
                            </LeafletTooltip>
                          </Marker>
                        ))}

                      {/* Coastal Landfall Surge Strike Target */}
                      {showLandfallSurge && (
                        <Marker
                          position={[ACTIVE_BOB_SCENARIO.targetLandfall.lat, ACTIVE_BOB_SCENARIO.targetLandfall.lon]}
                          icon={landfallImpactIcon}
                        >
                          <LeafletTooltip direction="top">
                            <div className="text-xs p-1">
                              <strong>{ACTIVE_BOB_SCENARIO.targetLandfall.name}</strong><br />
                              Projected Landfall Surge: +{ACTIVE_BOB_SCENARIO.targetLandfall.surgeMeters}m<br />
                              Peak Wind: {ACTIVE_BOB_SCENARIO.targetLandfall.peakWindKmh} km/h
                            </div>
                          </LeafletTooltip>
                        </Marker>
                      )}

                      {/* 7-Day Waypoint Node Dots */}
                      {SEVEN_DAY_FORECAST.map((step, idx) => (
                        <Marker
                          key={step.dayId}
                          position={[step.lat, step.lon]}
                          icon={createWaypointNodeIcon(idx)}
                          eventHandlers={{
                            click: () => {
                              setActiveDayIdx(idx);
                              setIsPlaying(false);
                            },
                          }}
                        >
                          <LeafletTooltip direction="top">
                            <span className="text-xs font-bold text-white">
                              {step.dayShort}: {step.windSpeedKmh} km/h ({step.category})
                            </span>
                          </LeafletTooltip>
                        </Marker>
                      ))}

                      {/* Photorealistic Spinning Satellite Vortex Marker */}
                      {showVortex && (
                        <Marker
                          position={[currentStep.lat, currentStep.lon]}
                          icon={cycloneVortexIcon}
                          zIndexOffset={1000}
                        />
                      )}
                    </MapContainer>

                    {/* Floating Legend Overlay on Map */}
                    <div className="absolute bottom-3 left-3 z-[1000] glass rounded-xl p-2.5 border border-white/10 text-[10px] space-y-1 backdrop-blur-md">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        <span className="text-white/70">Past Track</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ml-2" />
                        <span className="text-white/70">7-Day Forecast Track</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500/50 border border-orange-400" />
                        <span className="text-white/70">OHC Reservoir (&gt;90 kJ/cm²)</span>
                      </div>
                    </div>
                  </div>

                  {/* Layer Toggles Toolbar */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-800 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-white/40 font-mono text-[10px]">Simulation Layers:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setShowVortex(!showVortex)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showVortex ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <Wind size={11} />
                        Satellite Vortex
                      </button>

                      <button
                        onClick={() => setShowStreamlines(!showStreamlines)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showStreamlines ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <Navigation size={11} />
                        Inflow
                      </button>

                      <button
                        onClick={() => setShowRadii(!showRadii)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showRadii ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <Activity size={11} />
                        Wind Radii
                      </button>

                      <button
                        onClick={() => setShowCone(!showCone)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showCone ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <Layers size={11} />
                        Cone (70%)
                      </button>

                      <button
                        onClick={() => setShowOhcPool(!showOhcPool)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showOhcPool ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <Sparkles size={11} />
                        OHC Fuel Pool
                      </button>

                      <button
                        onClick={() => setShowRadarSweeps(!showRadarSweeps)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showRadarSweeps ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <Radio size={11} />
                        Doppler DWR
                      </button>

                      <button
                        onClick={() => setShowLandfallSurge(!showLandfallSurge)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          showLandfallSurge ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'glass border-white/10 text-white/40'
                        }`}
                      >
                        <MapPin size={11} />
                        Landfall Surge
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic Official 7-Day Cyclone Warning Bulletin Card (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass rounded-3xl p-5 border border-cyan-500/30 depth-shadow space-y-4">
                  {/* Bulletin Header & Alert Tier */}
                  <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                        <IndiaFlag className="w-3.5 h-2.5 rounded-xs" />
                        IMD OFFICIAL CYCLONE BULLETIN
                      </div>
                      <h3 className="font-extrabold text-base mt-0.5">
                        <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                          {currentStep.dayTitle}
                        </span>
                      </h3>
                      <p className="text-xs text-sky-100/90 font-medium">{currentStep.categoryName}</p>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${currentStep.alertColor}`}>
                        {currentStep.alertTier}
                      </span>
                      <span className="text-[10px] font-mono text-white/40 mt-1">
                        {currentStep.lat.toFixed(1)}°N, {currentStep.lon.toFixed(1)}°E
                      </span>
                    </div>
                  </div>

                  {/* Headline */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/90 leading-relaxed">
                    <span className="text-cyan-400 font-bold mr-1.5">BULLETIN:</span>
                    {currentStep.bulletinHeadline}
                  </div>

                  {/* 4 Essential Physics Gauges */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[10px] font-mono text-white/40 uppercase block">Wind Velocity</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black font-mono text-yellow-400">{currentStep.windSpeedKmh}</span>
                        <span className="text-xs text-yellow-400/70 font-mono">km/h</span>
                      </div>
                      <span className="text-[10px] text-white/40 block">~{Math.round(currentStep.windSpeedKmh / 1.852)} knots sustained</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[10px] font-mono text-white/40 uppercase block">Central Pressure</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black font-mono text-blue-400">{currentStep.centralPressure}</span>
                        <span className="text-xs text-blue-400/70 font-mono">hPa</span>
                      </div>
                      <span className="text-[10px] text-white/40 block">Barometric eye depth</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[10px] font-mono text-white/40 uppercase block">Subsurface OHC</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black font-mono text-orange-400">{currentStep.ohc}</span>
                        <span className="text-xs text-orange-400/70 font-mono">kJ/cm²</span>
                      </div>
                      <span className="text-[10px] text-white/40 block">
                        {currentStep.ohc > 80 ? 'Above RI Threshold' : 'Decaying Heat'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[10px] font-mono text-white/40 uppercase block">Storm Surge Risk</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black font-mono text-red-400">+{currentStep.surgeMeters}</span>
                        <span className="text-xs text-red-400/70 font-mono">meters</span>
                      </div>
                      <span className="text-[10px] text-white/40 block">Above astronomical tide</span>
                    </div>
                  </div>

                  {/* Port Warning Signal Box */}
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                      <Compass size={14} className="text-cyan-400" />
                      Official Port Warning Signal: {currentStep.portSignal}
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      {currentStep.portSignalDesc}
                    </p>
                  </div>

                  {/* Marine & Fishermen Directives */}
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Waves size={14} className="text-amber-400" />
                      Fishermen &amp; Maritime Directives
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      {currentStep.fishermenWarning}
                    </p>
                  </div>

                  {/* Civil Protection & Evacuation Action */}
                  <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-red-300">
                      <AlertTriangle size={14} className="text-red-400" />
                      Disaster Management &amp; Evacuation Directive
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      {currentStep.evacuationAction}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Multi-Hazard Atmospheric Cockpit Simulator ── */}
            <CycloneCockpitSimulator scenario={ACTIVE_BOB_SCENARIO} activeWaypoint={currentStep} />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2: PAST CYCLONE DATA VS CURRENT CYCLONE DATA GRAPHS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'comparison' && (
          <div className="space-y-6">
            {/* ── Graph 1: Multi-Cyclone Intensification Curve (Line Chart) ── */}
            <div className="glass rounded-3xl p-6 border border-cyan-500/30 depth-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart2 size={18} className="text-cyan-400" />
                    <h3 className="font-black text-base tracking-tight">
                      <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                        Cyclone Intensification Trajectory: Current BOB-02 vs Historical Super Cyclones
                      </span>
                    </h3>
                  </div>
                  <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                    Comparing timeline evolution over 7-Day cycle: Today (BOB-02) against Super Cyclone Amphan (2020), Mocha (2023), Fani (2019), and Biparjoy (2023)
                  </p>
                </div>

                {/* Metric Selector Toggle (Wind Speed vs Central Pressure) */}
                <div className="flex items-center glass rounded-xl border border-white/10 p-0.5 self-start sm:self-auto text-xs">
                  <button
                    onClick={() => setComparisonMetric('wind')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      comparisonMetric === 'wind'
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Wind Speed (km/h)
                  </button>
                  <button
                    onClick={() => setComparisonMetric('pressure')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      comparisonMetric === 'pressure'
                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Central Pressure (hPa)
                  </button>
                </div>
              </div>

              {/* Line Chart */}
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={INTENSIFICATION_TIMELINE}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="dayLabel"
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11 }}
                      domain={comparisonMetric === 'wind' ? [30, 280] : [900, 1010]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020917',
                        borderColor: 'rgba(6,182,212,0.4)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />

                    {comparisonMetric === 'wind' ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="currentWind"
                          name="Today: BOB-02 (2026 Forecast)"
                          stroke="#06b6d4"
                          strokeWidth={3.5}
                          dot={{ r: 5, fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 1.5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="amphanWind"
                          name="Amphan (2020 SuCS Cat-5)"
                          stroke="#a855f7"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 3, fill: '#a855f7' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="mochaWind"
                          name="Mocha (2023 ESCS Cat-5)"
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 3, fill: '#ef4444' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="faniWind"
                          name="Fani (2019 ESCS Cat-4)"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 3, fill: '#f59e0b' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="biparjoyWind"
                          name="Biparjoy (2023 VSCS)"
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 3, fill: '#10b981' }}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="currentPressure"
                          name="Today: BOB-02 Eye Pressure (hPa)"
                          stroke="#38bdf8"
                          strokeWidth={3.5}
                          dot={{ r: 5, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1.5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="amphanPressure"
                          name="Amphan 906 hPa (2020)"
                          stroke="#a855f7"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="mochaPressure"
                          name="Mocha 918 hPa (2023)"
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="faniPressure"
                          name="Fani 932 hPa (2019)"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="biparjoyPressure"
                          name="Biparjoy 950 hPa (2023)"
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Observation & Deep Insight */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 leading-relaxed">
                <strong className="text-cyan-300">Rapid Intensification (RI) Window Analysis: </strong>
                Between <strong>Day +1 (T+24h) and Day +2 (T+48h)</strong>, today's system encounters the deep thermal pool of <strong>94 kJ/cm²</strong>. 
                Like Super Cyclone Amphan and Cyclone Mocha, this matches the thermodynamic profile where winds accelerate by over 40 km/h in 24 hours. 
                Standard SST models miss this spike because surface temperature alone does not reflect whether the subsurface column contains cold or warm water.
              </div>
            </div>

            {/* ── Graph 2: Physical Thermodynamic Engine Comparison (Bar Chart) ── */}
            <div className="glass rounded-3xl p-6 border border-white/10 depth-shadow space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-black text-base flex items-center gap-2">
                    <Zap size={16} className="text-orange-400" />
                    <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                      Physical Heat Potential &amp; Coastal Impact Comparison
                    </span>
                  </h3>
                  <p className="text-xs text-sky-100/90 font-medium mt-0.5">
                    Benchmarking Ocean Heat Content (OHC), 26°C Isotherm Depth (D26), Peak Wind, and Storm Surge
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 self-start sm:self-auto">
                  Historical Benchmarks (1998–2026)
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={CYCLONE_COMPARISONS}
                    margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="name"
                      stroke="rgba(255,255,255,0.4)"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020917',
                        borderColor: 'rgba(6,182,212,0.4)',
                        borderRadius: '12px',
                        fontSize: '11px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="ohc" name="Pre-Storm OHC (kJ/cm²)" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="d26" name="26°C Isotherm Depth (m)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="peakWind" name="Peak Wind Speed (km/h)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="surge" name="Peak Surge Height (m)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Comprehensive Direct Parameter Matrix Table ── */}
            <div className="glass rounded-3xl border border-white/10 depth-shadow overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">Direct Parameter Verification Matrix</h4>
                  <p className="text-xs text-white/40">Multi-variable physics comparison for North Indian Ocean cyclone verification</p>
                </div>
                <span className="text-xs text-cyan-400 font-mono">5 Verified Benchmarks</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-left">
                      <th className="p-3.5">Cyclone System</th>
                      <th className="p-3.5">Basin</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">OHC (kJ/cm²)</th>
                      <th className="p-3.5">SST (°C)</th>
                      <th className="p-3.5">D26 Depth</th>
                      <th className="p-3.5">Peak Wind</th>
                      <th className="p-3.5">Peak Surge</th>
                      <th className="p-3.5">Rapid Intensification</th>
                      <th className="p-3.5">Threat Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CYCLONE_COMPARISONS.map((c) => (
                      <tr
                        key={c.name}
                        className={`border-b border-white/5 transition-colors ${
                          c.isToday ? 'bg-cyan-500/10 font-semibold' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="p-3.5 text-white flex items-center gap-1.5">
                          {c.isToday && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
                          {c.fullName}
                        </td>
                        <td className="p-3.5 text-white/60">{c.basin}</td>
                        <td className="p-3.5 font-medium text-white/80">{c.category}</td>
                        <td className="p-3.5 font-mono text-orange-400 font-bold">{c.ohc} kJ/cm²</td>
                        <td className="p-3.5 font-mono text-red-400">{c.sst}°C</td>
                        <td className="p-3.5 font-mono text-cyan-400">{c.d26} m</td>
                        <td className="p-3.5 font-mono text-purple-400 font-bold">{c.peakWind} km/h</td>
                        <td className="p-3.5 font-mono text-red-400 font-bold">+{c.surge} m</td>
                        <td className="p-3.5 text-white/70">{c.riObserved}</td>
                        <td className="p-3.5">
                          <RiskBadge risk={c.riskLevel as any} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3: SUBSURFACE OHC PHYSICS & AI PREDICTORS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'parameters' && (
          <div className="space-y-6">
            <div className="glass rounded-3xl p-6 border border-cyan-500/30 depth-shadow space-y-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Zap size={18} />
                <h3 className="font-black text-base">
                  <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                    Why 0–1000m Subsurface Profile is Crucial for Cyclone Forecasting
                  </span>
                </h3>
              </div>
              <p className="text-xs text-sky-100/90 font-medium leading-relaxed max-w-4xl">
                Traditional weather satellites only observe the sea surface skin (top 1 millimeter). When a cyclone passes over water, 
                its 150+ km/h winds produce intense cyclonic suction (Ekman pumping), violently churning the upper 100 meters. 
                If warm water only exists as a thin surface skin, this upwelling immediately chills the ocean surface and extinguishes the cyclone. 
                However, if the ocean holds high <strong>Ocean Heat Content (OHC) down to 100 meters</strong>, the upwelled water remains boiling warm (&gt;26°C), 
                acting as an explosive thermodynamic afterburner that triggers <strong>Rapid Intensification (RI)</strong>.
              </p>
            </div>

            {/* 5 Physical Parameter Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PREDICTION_PARAMETERS.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-5 border ${p.border} ${p.bg} backdrop-blur-xl space-y-3 flex flex-col justify-between`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                          <Icon size={16} className={p.color} />
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 text-white/70 border border-white/10">
                          {p.role}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm">{p.name}</h4>
                      <p className="text-xs text-white/60 leading-relaxed">{p.desc}</p>
                    </div>

                    <div className="pt-3 border-t border-white/10 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Critical Threshold:</span>
                        <span className={`font-mono font-bold ${p.color}`}>{p.threshold}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subsurface Neural Reconstruction Explainer */}
            <div className="glass rounded-3xl p-6 border border-white/10 depth-shadow space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Info size={16} className="text-cyan-400" />
                <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent drop-shadow-sm">
                  How OCEANINTEL Reconstructs 0–1000m Profiles to Outperform Baseline Models
                </span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/70 leading-relaxed pt-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    1. Multi-Satellite Fusion
                  </div>
                  <p className="text-white/60">
                    Merges altimetry Sea Surface Height Anomaly (SSHA) with microwave SST and surface winds to infer subsurface thermocline displacement.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    2. Deep Neural Reconstruction
                  </div>
                  <p className="text-white/60">
                    Trained against 25 years of in-situ ARGO float profiles to solve the inverse radiative transfer equation down to 1000m with zero latency.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    3. 48-Hour RI Early Warning
                  </div>
                  <p className="text-white/60">
                    Enables disaster authorities to issue mass evacuation directives 48 hours earlier than legacy numerical weather models.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
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
