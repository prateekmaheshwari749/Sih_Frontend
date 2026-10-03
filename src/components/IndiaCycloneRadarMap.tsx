import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import {
  Play,
  Pause,
  RotateCcw,
  Wind,
  Layers,
  Radio,
  AlertTriangle,
  MapPin,
  Clock,
  Sparkles,
  Compass,
  Navigation,
} from 'lucide-react';
import IndiaFlag from './IndiaFlag';
import CycloneCockpitSimulator from './CycloneCockpitSimulator';

// ── Types ──────────────────────────────────────────────────────────────────
export interface CycloneWaypoint {
  timeLabel: string;
  hourOffset: number; // e.g. -24, 0, 12, 24, 36, 48, 72
  lat: number;
  lon: number;
  category: 'D' | 'DD' | 'CS' | 'SCS' | 'VSCS' | 'ESCS' | 'SuCS';
  categoryName: string;
  windSpeedKmh: number;
  centralPressure: number;
  ohc: number; // Subsurface Ocean Heat Content in kJ/cm²
  shearKts: number;
  sst: number;
  surgeMeters: number;
  status: 'past' | 'current' | 'forecast';
}

export interface CycloneScenario {
  id: string;
  name: string;
  basin: 'Bay of Bengal' | 'Arabian Sea';
  center: [number, number];
  zoom: number;
  targetLandfall: {
    name: string;
    state: string;
    lat: number;
    lon: number;
    etaHours: number;
    surgeMeters: number;
    peakWindKmh: number;
    highRiskDistricts: string[];
  };
  waypoints: CycloneWaypoint[];
  conePolygon: [number, number][]; // 70% confidence envelope
  ohcHotspot: {
    lat: number;
    lon: number;
    radiusMeters: number;
    maxOhc: number;
  };
}

// ── Coastal IMD Doppler Weather Radar (DWR) Stations ───────────────────────
const COASTAL_DWR_STATIONS = [
  { name: 'DWR Paradip', code: 'PRD', state: 'Odisha', lat: 20.31, lon: 86.61, rangeKm: 350, frequency: 'S-Band 2.8 GHz' },
  { name: 'DWR Kolkata', code: 'KOL', state: 'West Bengal', lat: 22.57, lon: 88.36, rangeKm: 300, frequency: 'S-Band 2.8 GHz' },
  { name: 'DWR Visakhapatnam', code: 'VSK', state: 'Andhra Pradesh', lat: 17.68, lon: 83.21, rangeKm: 350, frequency: 'S-Band 2.8 GHz' },
  { name: 'DWR Chennai', code: 'CHN', state: 'Tamil Nadu', lat: 13.08, lon: 80.27, rangeKm: 350, frequency: 'S-Band 2.8 GHz' },
  { name: 'DWR Machilipatnam', code: 'MCH', state: 'Andhra Pradesh', lat: 16.18, lon: 81.13, rangeKm: 300, frequency: 'S-Band 2.8 GHz' },
  { name: 'DWR Bhuj', code: 'BHJ', state: 'Gujarat', lat: 23.24, lon: 69.66, rangeKm: 320, frequency: 'C-Band 5.6 GHz' },
];

// ── Historical & Active Scenarios (North Indian Ocean) ──────────────────────
const SCENARIOS: CycloneScenario[] = [
  {
    id: 'BOB-02',
    name: 'Active Alert: BOB-02 (Rapid Intensification)',
    basin: 'Bay of Bengal',
    center: [17.5, 85.5],
    zoom: 5,
    targetLandfall: {
      name: 'Dhamra / Paradip',
      state: 'Odisha & West Bengal',
      lat: 20.9,
      lon: 87.0,
      etaHours: 42,
      surgeMeters: 4.8,
      peakWindKmh: 175,
      highRiskDistricts: ['Jagatsinghpur', 'Kendrapara', 'Bhadrak', 'Balasore', 'Purba Medinipur'],
    },
    waypoints: [
      { timeLabel: 'T-24h', hourOffset: -24, lat: 11.5, lon: 90.8, category: 'D', categoryName: 'Depression', windSpeedKmh: 45, centralPressure: 1000, ohc: 82, shearKts: 14, sst: 29.8, surgeMeters: 0.5, status: 'past' },
      { timeLabel: 'T-12h', hourOffset: -12, lat: 13.1, lon: 89.2, category: 'DD', categoryName: 'Deep Depression', windSpeedKmh: 56, centralPressure: 994, ohc: 86, shearKts: 11, sst: 30.1, surgeMeters: 1.0, status: 'past' },
      { timeLabel: 'T+0h (Now)', hourOffset: 0, lat: 14.8, lon: 87.2, category: 'CS', categoryName: 'Cyclonic Storm', windSpeedKmh: 75, centralPressure: 988, ohc: 91, shearKts: 8.5, sst: 30.4, surgeMeters: 1.8, status: 'current' },
      { timeLabel: 'T+12h', hourOffset: 12, lat: 16.5, lon: 86.0, category: 'SCS', categoryName: 'Severe Cyclonic Storm', windSpeedKmh: 105, centralPressure: 978, ohc: 93, shearKts: 7.2, sst: 30.5, surgeMeters: 2.6, status: 'forecast' },
      { timeLabel: 'T+24h', hourOffset: 24, lat: 18.2, lon: 85.4, category: 'VSCS', categoryName: 'Very Severe Cyclonic Storm', windSpeedKmh: 138, centralPressure: 962, ohc: 89, shearKts: 6.8, sst: 30.2, surgeMeters: 3.5, status: 'forecast' },
      { timeLabel: 'T+36h', hourOffset: 36, lat: 19.8, lon: 85.8, category: 'ESCS', categoryName: 'Extremely Severe CS', windSpeedKmh: 168, centralPressure: 948, ohc: 82, shearKts: 8.0, sst: 29.8, surgeMeters: 4.4, status: 'forecast' },
      { timeLabel: 'T+48h', hourOffset: 48, lat: 20.8, lon: 86.8, category: 'ESCS', categoryName: 'Peak Threat Pre-Landfall', windSpeedKmh: 175, centralPressure: 942, ohc: 75, shearKts: 9.5, sst: 29.3, surgeMeters: 4.8, status: 'forecast' },
      { timeLabel: 'T+72h (Landfall)', hourOffset: 72, lat: 21.5, lon: 87.5, category: 'VSCS', categoryName: 'Coastal Inundation Landfall', windSpeedKmh: 135, centralPressure: 966, ohc: 52, shearKts: 16.0, sst: 28.5, surgeMeters: 3.8, status: 'forecast' },
    ],
    conePolygon: [
      [14.8, 87.2],
      [16.2, 84.8],
      [18.0, 83.9],
      [19.9, 84.1],
      [21.1, 85.2],
      [22.2, 86.5],
      [22.4, 88.6],
      [21.2, 89.2],
      [19.8, 88.0],
      [17.8, 87.4],
      [16.2, 87.8],
      [14.8, 87.2],
    ],
    ohcHotspot: {
      lat: 17.5,
      lon: 86.2,
      radiusMeters: 380000,
      maxOhc: 94,
    },
  },
  {
    id: 'AMPHAN',
    name: 'Super Cyclone Amphan (Historical Cat-5)',
    basin: 'Bay of Bengal',
    center: [18.0, 86.5],
    zoom: 5,
    targetLandfall: {
      name: 'Sundarbans / Digha',
      state: 'West Bengal',
      lat: 21.7,
      lon: 88.3,
      etaHours: 36,
      surgeMeters: 5.5,
      peakWindKmh: 260,
      highRiskDistricts: ['South 24 Parganas', 'North 24 Parganas', 'Purba Medinipur', 'Kolkata'],
    },
    waypoints: [
      { timeLabel: 'T-24h', hourOffset: -24, lat: 10.5, lon: 86.5, category: 'CS', categoryName: 'Cyclonic Storm', windSpeedKmh: 80, centralPressure: 990, ohc: 104, shearKts: 10, sst: 30.5, surgeMeters: 1.2, status: 'past' },
      { timeLabel: 'T-12h', hourOffset: -12, lat: 12.2, lon: 86.3, category: 'VSCS', categoryName: 'Very Severe CS', windSpeedKmh: 145, centralPressure: 968, ohc: 110, shearKts: 7, sst: 30.8, surgeMeters: 2.8, status: 'past' },
      { timeLabel: 'T+0h (Super Peak)', hourOffset: 0, lat: 14.1, lon: 86.3, category: 'SuCS', categoryName: 'Super Cyclonic Storm', windSpeedKmh: 260, centralPressure: 906, ohc: 112, shearKts: 5.2, sst: 31.0, surgeMeters: 5.5, status: 'current' },
      { timeLabel: 'T+24h', hourOffset: 24, lat: 17.2, lon: 86.8, category: 'ESCS', categoryName: 'Extremely Severe CS', windSpeedKmh: 215, centralPressure: 932, ohc: 98, shearKts: 8.5, sst: 30.2, surgeMeters: 5.0, status: 'forecast' },
      { timeLabel: 'T+48h', hourOffset: 48, lat: 20.2, lon: 87.7, category: 'ESCS', categoryName: 'Pre-Landfall Track', windSpeedKmh: 185, centralPressure: 945, ohc: 84, shearKts: 12.0, sst: 29.5, surgeMeters: 4.8, status: 'forecast' },
      { timeLabel: 'T+72h (Landfall)', hourOffset: 72, lat: 21.7, lon: 88.3, category: 'VSCS', categoryName: 'Sundarbans Landfall', windSpeedKmh: 155, centralPressure: 958, ohc: 58, shearKts: 18.0, sst: 28.7, surgeMeters: 4.2, status: 'forecast' },
    ],
    conePolygon: [
      [14.1, 86.3],
      [15.8, 85.0],
      [18.0, 85.2],
      [20.5, 86.2],
      [22.2, 87.0],
      [22.6, 89.6],
      [21.0, 90.0],
      [18.8, 88.8],
      [16.2, 88.0],
      [14.1, 86.3],
    ],
    ohcHotspot: {
      lat: 15.0,
      lon: 86.5,
      radiusMeters: 420000,
      maxOhc: 112,
    },
  },
  {
    id: 'FANI',
    name: 'Extremely Severe Cyclone Fani (Odisha Landfall)',
    basin: 'Bay of Bengal',
    center: [16.5, 85.0],
    zoom: 5,
    targetLandfall: {
      name: 'Puri Coast',
      state: 'Odisha',
      lat: 19.8,
      lon: 85.8,
      etaHours: 24,
      surgeMeters: 4.5,
      peakWindKmh: 215,
      highRiskDistricts: ['Puri', 'Khordha', 'Cuttack', 'Jagatsinghpur', 'Ganjam'],
    },
    waypoints: [
      { timeLabel: 'T-24h', hourOffset: -24, lat: 9.8, lon: 88.0, category: 'SCS', categoryName: 'Severe CS', windSpeedKmh: 100, centralPressure: 982, ohc: 92, shearKts: 12, sst: 30.1, surgeMeters: 1.5, status: 'past' },
      { timeLabel: 'T-12h', hourOffset: -12, lat: 12.5, lon: 85.5, category: 'VSCS', categoryName: 'Very Severe CS', windSpeedKmh: 150, centralPressure: 960, ohc: 96, shearKts: 8.5, sst: 30.4, surgeMeters: 2.8, status: 'past' },
      { timeLabel: 'T+0h (Now)', hourOffset: 0, lat: 15.2, lon: 84.8, category: 'ESCS', categoryName: 'Extremely Severe CS', windSpeedKmh: 195, centralPressure: 937, ohc: 98, shearKts: 7.0, sst: 30.5, surgeMeters: 4.0, status: 'current' },
      { timeLabel: 'T+24h (Landfall)', hourOffset: 24, lat: 19.8, lon: 85.8, category: 'ESCS', categoryName: 'Puri Landfall Strike', windSpeedKmh: 185, centralPressure: 944, ohc: 72, shearKts: 14.0, sst: 29.2, surgeMeters: 4.5, status: 'forecast' },
      { timeLabel: 'T+48h', hourOffset: 48, lat: 22.8, lon: 87.5, category: 'CS', categoryName: 'Inland Weakening', windSpeedKmh: 80, centralPressure: 986, ohc: 35, shearKts: 22.0, sst: 27.5, surgeMeters: 1.0, status: 'forecast' },
    ],
    conePolygon: [
      [15.2, 84.8],
      [16.8, 83.5],
      [18.8, 84.0],
      [20.5, 84.5],
      [23.2, 86.0],
      [23.5, 89.0],
      [20.8, 87.5],
      [18.5, 86.2],
      [16.5, 85.9],
      [15.2, 84.8],
    ],
    ohcHotspot: {
      lat: 16.0,
      lon: 85.2,
      radiusMeters: 360000,
      maxOhc: 98,
    },
  },
  {
    id: 'BIPARJOY',
    name: 'Very Severe Cyclone Biparjoy (Arabian Sea)',
    basin: 'Arabian Sea',
    center: [20.0, 67.5],
    zoom: 5,
    targetLandfall: {
      name: 'Jakhau Port / Kutch',
      state: 'Gujarat',
      lat: 23.2,
      lon: 68.6,
      etaHours: 30,
      surgeMeters: 3.5,
      peakWindKmh: 165,
      highRiskDistricts: ['Kutch', 'Devbhumi Dwarka', 'Jamnagar', 'Morbi', 'Porbandar'],
    },
    waypoints: [
      { timeLabel: 'T-24h', hourOffset: -24, lat: 14.5, lon: 66.5, category: 'VSCS', categoryName: 'Very Severe CS', windSpeedKmh: 130, centralPressure: 970, ohc: 82, shearKts: 11, sst: 30.0, surgeMeters: 2.0, status: 'past' },
      { timeLabel: 'T-12h', hourOffset: -12, lat: 17.0, lon: 67.0, category: 'VSCS', categoryName: 'Very Severe CS', windSpeedKmh: 155, centralPressure: 958, ohc: 85, shearKts: 9.0, sst: 30.2, surgeMeters: 2.8, status: 'past' },
      { timeLabel: 'T+0h (Now)', hourOffset: 0, lat: 19.5, lon: 67.4, category: 'VSCS', categoryName: 'Recurving Towards Gujarat', windSpeedKmh: 160, centralPressure: 955, ohc: 85, shearKts: 8.5, sst: 29.8, surgeMeters: 3.2, status: 'current' },
      { timeLabel: 'T+24h', hourOffset: 24, lat: 21.8, lon: 68.0, category: 'VSCS', categoryName: 'Approaching Saurashtra', windSpeedKmh: 140, centralPressure: 965, ohc: 74, shearKts: 12.0, sst: 29.2, surgeMeters: 3.5, status: 'forecast' },
      { timeLabel: 'T+48h (Landfall)', hourOffset: 48, lat: 23.2, lon: 68.6, category: 'VSCS', categoryName: 'Jakhau Port Landfall', windSpeedKmh: 125, centralPressure: 974, ohc: 60, shearKts: 16.0, sst: 28.5, surgeMeters: 3.5, status: 'forecast' },
    ],
    conePolygon: [
      [19.5, 67.4],
      [20.5, 66.0],
      [22.0, 66.5],
      [23.8, 67.2],
      [24.5, 69.8],
      [23.2, 70.2],
      [21.5, 69.0],
      [20.2, 68.4],
      [19.5, 67.4],
    ],
    ohcHotspot: {
      lat: 18.5,
      lon: 67.2,
      radiusMeters: 320000,
      maxOhc: 85,
    },
  },
];

// ── Map Controller to re-center on scenario switch ─────────────────────────
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function IndiaCycloneRadarMap() {
  const [selectedScenario, setSelectedScenario] = useState<CycloneScenario>(SCENARIOS[0]);
  const [currentStep, setCurrentStep] = useState<number>(2); // Default to T+0h (Now)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 4x

  // Layer Toggles
  const [showVortex, setShowVortex] = useState<boolean>(true);
  const [showRadarSweeps, setShowRadarSweeps] = useState<boolean>(true);
  const [showCone, setShowCone] = useState<boolean>(true);
  const [showOhcHotspot, setShowOhcHotspot] = useState<boolean>(true);
  const [showLandfallSurge, setShowLandfallSurge] = useState<boolean>(true);
  const [showTrackPoints, setShowTrackPoints] = useState<boolean>(true);
  const [showStreamlines, setShowStreamlines] = useState<boolean>(true);

  const activeWaypoint = selectedScenario.waypoints[currentStep] || selectedScenario.waypoints[0];
  const timerRef = useRef<number | null>(null);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 1800 / playSpeed;
      timerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= selectedScenario.waypoints.length - 1) {
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
  }, [isPlaying, playSpeed, selectedScenario.waypoints.length]);

  const handleScenarioChange = (scenario: CycloneScenario) => {
    setSelectedScenario(scenario);
    // Find index of T+0h
    const nowIdx = scenario.waypoints.findIndex((w) => w.hourOffset === 0);
    setCurrentStep(nowIdx >= 0 ? nowIdx : 0);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (!isPlaying && currentStep >= selectedScenario.waypoints.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    const nowIdx = selectedScenario.waypoints.findIndex((w) => w.hourOffset === 0);
    setCurrentStep(nowIdx >= 0 ? nowIdx : 0);
  };

  // Trajectory polylines
  const pastPathCoords = useMemo(() => {
    const slice = selectedScenario.waypoints.slice(0, currentStep + 1);
    return slice.map((w) => [w.lat, w.lon] as [number, number]);
  }, [selectedScenario, currentStep]);

  const futurePathCoords = useMemo(() => {
    const slice = selectedScenario.waypoints.slice(currentStep);
    return slice.map((w) => [w.lat, w.lon] as [number, number]);
  }, [selectedScenario, currentStep]);

  // Dynamic atmospheric inflow streamlines spiraling into the cyclone eye
  const windStreamlines = useMemo(() => {
    const { lat, lon } = activeWaypoint;
    const lines: [number, number][][] = [];
    const numArms = 12;
    const radiusDeg = 4.0;

    for (let i = 0; i < numArms; i++) {
      const baseAngle = (i * 2 * Math.PI) / numArms;
      const pts: [number, number][] = [];
      const steps = 7;
      for (let s = steps; s >= 0; s--) {
        const frac = s / steps;
        const r = radiusDeg * frac;
        // Inflow spiral: angle increases as radius decreases (counter-clockwise spin)
        const angle = baseAngle + (1 - frac) * 1.7;
        const ptLat = lat + r * Math.sin(angle);
        const ptLon = lon + r * Math.cos(angle) * 1.06;
        pts.push([ptLat, ptLon]);
      }
      lines.push(pts);
    }
    return lines;
  }, [activeWaypoint]);

  // ── Custom Leaflet Icons ──────────────────────────────────────────────────
  // 1. Spinning Animated Cyclone Vortex Marker (Photorealistic Satellite Cloud Imagery)
  const cycloneVortexIcon = useMemo(() => {
    const isExtreme = activeWaypoint.windSpeedKmh >= 160;
    const isSuper = activeWaypoint.windSpeedKmh >= 220;
    const isSevere = activeWaypoint.windSpeedKmh >= 105;

    const spinClass = isSuper
      ? 'animate-cyclone-vortex-extreme'
      : isExtreme
      ? 'animate-cyclone-vortex-fast'
      : 'animate-cyclone-vortex';

    const coreColor = isSuper ? '#a855f7' : isExtreme ? '#ef4444' : isSevere ? '#f97316' : '#06b6d4';

    // Scale storm diameter realistically by intensity (Depression ~200px, Super Cyclone ~280px)
    const stormSize = isSuper ? 285 : isExtreme ? 255 : isSevere ? 225 : 195;
    const eyeSize = isSuper ? 46 : isExtreme ? 42 : isSevere ? 38 : 34;

    const html = `
      <div style="position: relative; width: ${stormSize}px; height: ${stormSize}px; transform: translate(-50%, -50%); pointer-events: none;">
        <!-- Natural Atmospheric Cloud Shadow Cast on Deep Ocean Surface -->
        <div style="position: absolute; inset: 12px; border-radius: 50%; background: radial-gradient(circle, rgba(2, 9, 23, 0.75) 45%, rgba(2, 9, 23, 0.3) 75%, transparent 100%); filter: blur(14px); transform: translate(8px, 14px); pointer-events: none;"></div>

        <!-- Photorealistic INSAT-3D / NOAA Satellite Cloud Canopy (Hardware-Accelerated Counter-Clockwise Vortex) -->
        <div class="${spinClass}" style="position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: center center;">
          <img 
            src="/cyclone_satellite_vortex.webp" 
            alt="Meteorological Satellite Cyclone Cloud Canopy"
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
              filter: drop-shadow(0 0 20px ${coreColor}) brightness(1.08) contrast(1.06);
              pointer-events: none;
              user-select: none;
              display: block;
            "
          />
        </div>

        <!-- Convective Eyewall Thermal Pulse & Radial Infrared Heating Ring -->
        <div class="animate-eyewall-pulse" style="position: absolute; top: 50%; left: 50%; width: ${eyeSize * 2.2}px; height: ${eyeSize * 2.2}px; margin-top: -${eyeSize * 1.1}px; margin-left: -${eyeSize * 1.1}px; border-radius: 50%; background: radial-gradient(circle, transparent 40%, ${coreColor}40 70%, transparent 95%); pointer-events: none; mix-blend-mode: screen;"></div>

        <!-- Eyewall Convective Lightning Discharges in Deep Hot Towers -->
        <svg viewBox="0 0 100 100" class="animate-lightning-branch" style="position: absolute; top: 22%; left: 24%; width: 34px; height: 34px; pointer-events: none; z-index: 6;">
          <path d="M 18 2 L 10 16 L 16 18 L 8 32 L 14 20 L 8 18 Z" fill="#fde047" stroke="#ffffff" stroke-width="0.5" filter="drop-shadow(0 0 8px #facc15)" />
        </svg>
        <svg viewBox="0 0 100 100" class="animate-lightning-branch" style="position: absolute; bottom: 24%; right: 26%; width: 30px; height: 30px; pointer-events: none; animation-delay: 1.8s; z-index: 6;">
          <path d="M 20 2 L 12 14 L 18 16 L 10 30 L 15 18 L 9 17 Z" fill="#38bdf8" stroke="#ffffff" stroke-width="0.5" filter="drop-shadow(0 0 8px #38bdf8)" />
        </svg>

        <!-- Calm Cyclone Eye Core (IMD Category & Barometric Pressure Telemetry Hub) -->
        <div class="animate-eyewall-pulse" style="position: absolute; top: 50%; left: 50%; width: ${eyeSize}px; height: ${eyeSize}px; margin-top: -${eyeSize / 2}px; margin-left: -${eyeSize / 2}px; border-radius: 50%; background: radial-gradient(circle, #020917 40%, #081b33 75%, ${coreColor} 100%); border: 2px solid rgba(255, 255, 255, 0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 24px ${coreColor}, inset 0 0 10px rgba(0,0,0,0.9); z-index: 7;">
          <span style="font-size: ${eyeSize > 40 ? '11px' : '9.5px'}; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">${activeWaypoint.category}</span>
          <span style="font-size: ${eyeSize > 40 ? '8.5px' : '7.5px'}; font-family: monospace; color: #fef08a; font-weight: 700; line-height: 1; margin-top: 1.5px;">${activeWaypoint.centralPressure}hPa</span>
        </div>

        <!-- Floating Live Telemetry Pill -->
        <div style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); white-space: nowrap; background: rgba(2, 9, 23, 0.94); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 6px; padding: 2.5px 8px; font-family: monospace; font-size: 9.5px; font-weight: 700; color: #38bdf8; box-shadow: 0 4px 14px rgba(0,0,0,0.7); z-index: 8;">
          ${activeWaypoint.windSpeedKmh} km/h • OHC: ${activeWaypoint.ohc} kJ
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'cyclone-marker-container',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, [activeWaypoint]);

  // 2. Coastal Doppler Weather Radar (DWR) Sweep Marker
  const createRadarSweepIcon = useCallback((station: (typeof COASTAL_DWR_STATIONS)[0]) => {
    const html = `
      <div style="position: relative; width: 90px; height: 90px; transform: translate(-50%, -50%); pointer-events: none;">
        <!-- Expanding Doppler Sonar Pulse Wave -->
        <div class="animate-radar-pulse" style="position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid rgba(16, 185, 129, 0.7); pointer-events: none;"></div>
        <!-- Rotating 360 Sweep Beam -->
        <div class="animate-radar-sweep" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: conic-gradient(from 0deg, rgba(6, 182, 212, 0) 0deg, rgba(6, 182, 212, 0.35) 300deg, rgba(16, 185, 129, 0.85) 360deg);"></div>
        <!-- Concentric Range Rings -->
        <div style="position: absolute; inset: 12px; border-radius: 50%; border: 1px solid rgba(6, 182, 212, 0.45);"></div>
        <div style="position: absolute; inset: 26px; border-radius: 50%; border: 1px dashed rgba(6, 182, 212, 0.3);"></div>
        <!-- Center DWR Dome Dot -->
        <div style="position: absolute; top: 50%; left: 50%; width: 10px; height: 10px; margin-top: -5px; margin-left: -5px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; box-shadow: 0 0 10px #10b981;"></div>
        <!-- Station Label -->
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

  // 3. Coastal Landfall Impact Marker
  const landfallImpactIcon = useMemo(() => {
    const { targetLandfall } = selectedScenario;
    const html = `
      <div style="position: relative; width: 80px; height: 80px; transform: translate(-50%, -50%); pointer-events: none;">
        <!-- Dual Expanding Inundation Shockwave Rings -->
        <div class="animate-surge-ring" style="position: absolute; inset: 0; border-radius: 50%; border: 3px solid #ef4444; background: rgba(239, 68, 68, 0.2);"></div>
        <div class="animate-surge-ring" style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid #f97316; animation-delay: 1.1s;"></div>
        <!-- Center Target Hazard Pin -->
        <div style="position: absolute; top: 50%; left: 50%; width: 22px; height: 22px; margin-top: -11px; margin-left: -11px; border-radius: 50%; background: #dc2626; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px #ef4444;">
          <span style="font-size: 11px;">⚠️</span>
        </div>
        <!-- Strike Inundation Banner -->
        <div style="position: absolute; top: 105%; left: 50%; transform: translateX(-50%); background: rgba(220, 38, 38, 0.95); border: 1px solid #fecaca; border-radius: 6px; padding: 2px 6px; font-size: 8px; font-weight: 800; color: #ffffff; white-space: nowrap; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.7);">
          LANDFALL ZONE<br/>
          Surge: +${targetLandfall.surgeMeters}m
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'landfall-impact-container',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }, [selectedScenario]);

  // Waypoint small marker icon
  const createWaypointIcon = (w: CycloneWaypoint, index: number) => {
    const isSelected = index === currentStep;
    const isLandfall = index === selectedScenario.waypoints.length - 1;
    const bg = isLandfall ? '#dc2626' : w.status === 'past' ? '#64748b' : isSelected ? '#06b6d4' : '#f59e0b';

    const html = `
      <div style="width: ${isSelected ? '16px' : '10px'}; height: ${isSelected ? '16px' : '10px'}; border-radius: 50%; background: ${bg}; border: 2px solid #ffffff; transform: translate(-50%, -50%); box-shadow: 0 0 ${isSelected ? '10px #06b6d4' : '4px rgba(0,0,0,0.6)'}; cursor: pointer; transition: all 0.2s;"></div>
    `;

    return L.divIcon({
      html,
      className: 'waypoint-dot-container',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  return (
    <div className="radar-map-panel rounded-3xl overflow-hidden border border-cyan-500/30 mb-10 shadow-2xl">
      {/* ── Top Command Bar (Scenario Selectors, MoES Banner, HUD) ── */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-[#020917] via-[#04162e] to-[#020917] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Branding & Scenario Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <IndiaFlag className="w-5 h-3.5 rounded-sm shadow-sm" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono font-bold tracking-wider">
              <Radio size={12} className="text-red-400 animate-pulse" />
              LIVE DOPPLER RADAR &amp; PREDICTION CONSOLE
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {SCENARIOS.map((s) => {
              const active = s.id === selectedScenario.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleScenarioChange(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/50'
                      : 'glass border-white/10 text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {s.id === 'BOB-02' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 animate-ping" />}
                  {s.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Storm Classification Pill */}
        <div className="flex items-center gap-3 self-start lg:self-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs">
            <span className="text-white/50">Current Basin:</span>
            <span className="font-bold text-cyan-300">{selectedScenario.basin}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs">
            <span className="text-white/50">Intensity:</span>
            <span className="font-bold text-orange-400">{activeWaypoint.categoryName}</span>
          </div>
        </div>
      </div>

      {/* ── Main Map Canvas with Floating HUDs ── */}
      <div className="relative w-full" style={{ height: '620px' }}>
        <MapContainer
          center={selectedScenario.center}
          zoom={selectedScenario.zoom}
          style={{ height: '100%', width: '100%', background: '#020917' }}
          scrollWheelZoom={true}
          doubleClickZoom={false}
        >
          <MapViewController center={selectedScenario.center} zoom={selectedScenario.zoom} />

          {/* CartoDB High-Contrast Dark Basemap */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a> | IMD &amp; MoES'
            maxZoom={18}
          />

          {/* 1. Subsurface Ocean Heat Content (OHC) Fuel Reservoir Heatmap Plume */}
          {showOhcHotspot && (
            <Circle
              center={[selectedScenario.ohcHotspot.lat, selectedScenario.ohcHotspot.lon]}
              radius={selectedScenario.ohcHotspot.radiusMeters}
              pathOptions={{
                color: '#f97316',
                weight: 1.5,
                dashArray: '6 6',
                fillColor: '#f97316',
                fillOpacity: 0.22,
              }}
            >
              <LeafletTooltip direction="top" opacity={0.95}>
                <div className="text-xs p-1">
                  <p className="font-bold text-orange-400">Subsurface OHC Heat Engine Reservoir</p>
                  <p className="text-[10px] text-white/80">Depth 0–700m Integrated Heat: &gt; {selectedScenario.ohcHotspot.maxOhc} kJ/cm²</p>
                  <p className="text-[10px] text-cyan-300">Fuels Rapid Cyclone Intensification</p>
                </div>
              </LeafletTooltip>
            </Circle>
          )}

          {/* 2. IMD 70% Confidence Cone of Uncertainty Polygon */}
          {showCone && (
            <Polygon
              positions={selectedScenario.conePolygon}
              pathOptions={{
                color: '#ef4444',
                weight: 1.5,
                dashArray: '5 5',
                fillColor: '#ef4444',
                fillOpacity: 0.12,
              }}
            >
              <LeafletTooltip sticky direction="center" opacity={0.9}>
                <span className="text-xs font-bold text-red-300">
                  IMD 70% Confidence Swath (Cone of Uncertainty)
                </span>
              </LeafletTooltip>
            </Polygon>
          )}

          {/* 3. Trajectory Lines (Past Solid, Forecast Glowing Dash) */}
          {pastPathCoords.length > 1 && (
            <Polyline
              positions={pastPathCoords}
              pathOptions={{
                color: '#38bdf8',
                weight: 3.5,
                opacity: 0.85,
              }}
            />
          )}

          {futurePathCoords.length > 1 && (
            <Polyline
              positions={futurePathCoords}
              pathOptions={{
                color: '#facc15',
                weight: 3,
                dashArray: '8 6',
                opacity: 0.9,
              }}
            />
          )}

          {/* 3.1 Dynamic Inflow Wind Streamlines (Particle Vector Field) */}
          {showStreamlines &&
            windStreamlines.map((pts, idx) => (
              <Polyline
                key={`stream-${idx}`}
                positions={pts}
                pathOptions={{
                  color: idx % 3 === 0 ? '#38bdf8' : idx % 3 === 1 ? '#06b6d4' : '#67e8f9',
                  weight: 1.8,
                  opacity: 0.6,
                  dashArray: '6 8',
                  className: 'animate-dash-flow',
                }}
              />
            ))}

          {/* 4. Coastal Doppler Weather Radar (DWR) Stations */}
          {showRadarSweeps &&
            COASTAL_DWR_STATIONS.map((station) => (
              <Marker
                key={station.code}
                position={[station.lat, station.lon]}
                icon={createRadarSweepIcon(station)}
              >
                <LeafletTooltip direction="top" offset={[0, -10]} opacity={0.95}>
                  <div className="text-xs p-1">
                    <p className="font-bold text-emerald-400">{station.name}</p>
                    <p className="text-[10px] text-white/70">{station.state} · Range: {station.rangeKm} km</p>
                    <p className="text-[10px] text-cyan-300">{station.frequency} Doppler Surveillance</p>
                  </div>
                </LeafletTooltip>
              </Marker>
            ))}

          {/* 5. Coastal Landfall Impact Zone Alert */}
          {showLandfallSurge && (
            <Marker
              position={[selectedScenario.targetLandfall.lat, selectedScenario.targetLandfall.lon]}
              icon={landfallImpactIcon}
            >
              <LeafletTooltip direction="top" offset={[0, -15]} opacity={0.95}>
                <div className="text-xs p-1.5 space-y-1">
                  <p className="font-bold text-red-400">Projected Landfall Zone: {selectedScenario.targetLandfall.name}</p>
                  <p className="text-white/80">State: {selectedScenario.targetLandfall.state}</p>
                  <p className="text-white/80">Peak Wind: <strong className="text-yellow-400">{selectedScenario.targetLandfall.peakWindKmh} km/h</strong></p>
                  <p className="text-white/80">Storm Surge Inundation: <strong className="text-red-400">+{selectedScenario.targetLandfall.surgeMeters} meters</strong></p>
                  <p className="text-[10px] text-red-300">High Risk Districts: {selectedScenario.targetLandfall.highRiskDistricts.join(', ')}</p>
                </div>
              </LeafletTooltip>
            </Marker>
          )}

          {/* 6. Waypoints Along Path */}
          {showTrackPoints &&
            selectedScenario.waypoints.map((w, idx) => (
              <Marker
                key={w.timeLabel}
                position={[w.lat, w.lon]}
                icon={createWaypointIcon(w, idx)}
                eventHandlers={{
                  click: () => setCurrentStep(idx),
                }}
              >
                <LeafletTooltip direction="top" offset={[0, -5]} opacity={0.95}>
                  <div className="text-xs p-1 font-mono">
                    <p className="font-bold text-white">{w.timeLabel} · {w.categoryName}</p>
                    <p className="text-yellow-400">{w.windSpeedKmh} km/h · {w.centralPressure} hPa</p>
                    <p className="text-orange-400">Subsurface OHC: {w.ohc} kJ/cm²</p>
                  </div>
                </LeafletTooltip>
              </Marker>
            ))}

          {/* 7. THE CRAZY ANIMATED CYCLONE VORTEX */}
          {showVortex && (
            <Marker
              position={[activeWaypoint.lat, activeWaypoint.lon]}
              icon={cycloneVortexIcon}
              zIndexOffset={1000}
            />
          )}
        </MapContainer>

        {/* ── Top-Left Floating HUD: Real-Time IMD Telemetry ── */}
        <div className="absolute top-4 left-4 z-[1000] pointer-events-auto max-w-xs w-full glass-dark p-4 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[11px] font-mono font-bold text-red-400">IMD CYCLONE BULLETIN</span>
            </div>
            <span className="text-[10px] font-mono text-white/50">{activeWaypoint.timeLabel}</span>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-white/40 uppercase font-mono">Designation &amp; Basin</p>
              <h4 className="text-sm font-black text-white truncate">{selectedScenario.name}</h4>
              <p className="text-[11px] text-cyan-400 font-semibold">{activeWaypoint.categoryName} ({activeWaypoint.category})</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-xs">
              <div>
                <span className="text-[10px] text-white/40 block">Max Sustained Wind</span>
                <span className="font-bold text-yellow-400 text-sm">{activeWaypoint.windSpeedKmh} <span className="text-[10px] font-normal text-white/50">km/h</span></span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Central Pressure</span>
                <span className="font-bold text-blue-400 text-sm">{activeWaypoint.centralPressure} <span className="text-[10px] font-normal text-white/50">hPa</span></span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Subsurface OHC</span>
                <span className="font-bold text-orange-400 text-sm">{activeWaypoint.ohc} <span className="text-[10px] font-normal text-white/50">kJ/cm²</span></span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block">Projected Surge</span>
                <span className="font-bold text-red-400 text-sm">+{activeWaypoint.surgeMeters} <span className="text-[10px] font-normal text-white/50">m</span></span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-[10px] text-white/60 flex items-center justify-between">
              <span>Eye Location:</span>
              <span className="font-mono text-cyan-300 font-bold">{activeWaypoint.lat.toFixed(1)}°N, {activeWaypoint.lon.toFixed(1)}°E</span>
            </div>
          </div>
        </div>

        {/* ── Top-Right Floating HUD: NDMA Coastal Defense Directives ── */}
        <div className="absolute top-4 right-4 z-[1000] pointer-events-auto hidden md:block max-w-xs w-full glass-dark p-4 rounded-2xl border border-amber-500/30 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-white/10">
            <AlertTriangle size={14} className="text-amber-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold text-amber-300">NDMA COASTAL DEFENSE DIRECTIVE</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/50">Strike Target:</span>
              <span className="font-bold text-white text-right">{selectedScenario.targetLandfall.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Target State:</span>
              <span className="font-bold text-cyan-300">{selectedScenario.targetLandfall.state}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50">Landfall Surge Alert:</span>
              <span className="font-bold text-red-400">+{selectedScenario.targetLandfall.surgeMeters}m Inundation</span>
            </div>
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-[10px] text-white/40 font-mono mb-1">High-Risk Evacuation Districts:</p>
              <div className="flex flex-wrap gap-1">
                {selectedScenario.targetLandfall.highRiskDistricts.map((d) => (
                  <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-300 font-mono">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Interactive Animation Playback & Scrubber Controls ── */}
      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 text-slate-800 border-t border-white/10">
        <div className="flex flex-col gap-4">
          {/* Time Scrubber Slider with Milestones */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Clock size={13} />
                72-Hour Forecast Progression: <strong className="text-white font-mono">{activeWaypoint.timeLabel}</strong>
              </span>
              <span className="text-[11px] font-mono text-white/50">
                Lat: {activeWaypoint.lat.toFixed(1)}°N · Lon: {activeWaypoint.lon.toFixed(1)}°E
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={selectedScenario.waypoints.length - 1}
              step={1}
              value={currentStep}
              onChange={(e) => {
                setCurrentStep(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
            />

            {/* Waypoint markers under slider */}
            <div className="flex justify-between mt-1 text-[10px] font-mono text-white/40 px-1">
              {selectedScenario.waypoints.map((w, idx) => (
                <button
                  key={w.timeLabel}
                  onClick={() => { setCurrentStep(idx); setIsPlaying(false); }}
                  className={`hover:text-white transition-colors cursor-pointer ${
                    idx === currentStep ? 'text-cyan-400 font-bold scale-110' : ''
                  }`}
                >
                  {w.timeLabel.replace('T', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Bar: Play/Pause, Speed, and Layer Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayPause}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isPlaying ? 'Pause Animation' : 'Play 72h Forecast'}</span>
              </button>

              <button
                onClick={handleReset}
                title="Reset to T+0h"
                className="p-2 rounded-xl btn-glass cursor-pointer"
              >
                <RotateCcw size={14} />
              </button>

              {/* Speed Multiplier */}
              <div className="flex items-center glass rounded-xl border border-white/10 p-0.5">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaySpeed(s)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      playSpeed === s ? 'bg-cyan-500/30 text-cyan-300' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Layer Toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-white/40 font-mono hidden xl:inline">Radar Layers:</span>

              <button
                onClick={() => setShowVortex(!showVortex)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showVortex ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <Wind size={12} />
                Vortex
              </button>

              <button
                onClick={() => setShowRadarSweeps(!showRadarSweeps)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showRadarSweeps ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <Radio size={12} />
                Doppler DWR
              </button>

              <button
                onClick={() => setShowCone(!showCone)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showCone ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <Layers size={12} />
                Cone (70%)
              </button>

              <button
                onClick={() => setShowOhcHotspot(!showOhcHotspot)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showOhcHotspot ? 'bg-orange-500/15 border-orange-500/40 text-orange-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <Sparkles size={12} />
                OHC Plume
              </button>

              <button
                onClick={() => setShowLandfallSurge(!showLandfallSurge)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showLandfallSurge ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <MapPin size={12} />
                Landfall Surge
              </button>

              <button
                onClick={() => setShowTrackPoints(!showTrackPoints)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showTrackPoints ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <Compass size={12} />
                Waypoints
              </button>

              <button
                onClick={() => setShowStreamlines(!showStreamlines)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  showStreamlines ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'glass border-white/10 text-white/40'
                }`}
              >
                <Navigation size={12} />
                Wind Inflow
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Multi-Hazard Atmospheric Cockpit & Storm Surge Wave-Tank ── */}
      <CycloneCockpitSimulator scenario={selectedScenario} activeWaypoint={activeWaypoint} />
    </div>
  );
}
