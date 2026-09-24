import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Sparkles, ArrowRight, Play, Loader2, Info, Compass,
  Layers, ChevronRight, Activity, Thermometer, Droplets, Waves,
  Wind, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw
} from 'lucide-react';
import Navbar from '../components/Navbar';
import GovFooter from '../components/GovFooter';

// ── North Indian Ocean Domain Constants ──
const LAT_MIN = 5.0;
const LAT_MAX = 30.0;
const LON_MIN = 45.0;
const LON_MAX = 105.0;

// Grid dimensions for lightweight canvas rendering
const COLS = 60;
const ROWS = 26;

interface ForecastMonthData {
  monthIndex: number;
  monthName: string;
  leadTimeLabel: string;
  targetDateStr: string;
  meanSST: number;
  minSST: number;
  maxSST: number;
  meanAnomaly: number;
  anomalyStatus: 'Normal' | 'Moderate Warm' | 'Active Heatwave' | 'Cool Phase';
  anomalyStatusColor: string;
}

// ── Mock Climatology & FNO Seasonal Forecast Engine ──
// Easily replaceable with real backend endpoint (e.g., fetch('/api/fno/seasonal'))
function generateSeasonalData(monthOffset: number): {
  sstGrid: number[][];
  climatologyGrid: number[][];
  anomalyGrid: number[][];
} {
  const sstGrid: number[][] = [];
  const climatologyGrid: number[][] = [];
  const anomalyGrid: number[][] = [];

  for (let r = 0; r < ROWS; r++) {
    const sstRow: number[] = [];
    const climRow: number[] = [];
    const anomRow: number[] = [];

    const lat = LAT_MAX - (r / (ROWS - 1)) * (LAT_MAX - LAT_MIN);

    for (let c = 0; c < COLS; c++) {
      const lon = LON_MIN + (c / (COLS - 1)) * (LON_MAX - LON_MIN);

      // Check if coordinate is land (Indian Subcontinent, Arabian Peninsula, Southeast Asia)
      const isLand = checkIsLand(lat, lon);

      if (isLand) {
        sstRow.push(NaN);
        climRow.push(NaN);
        anomRow.push(NaN);
      } else {
        // Base tropical SST gradient (warmer near equator, cooler near north & Persian Gulf in winter)
        const baseEquator = 29.8 - ((lat - 5.0) * 0.22);
        
        // Warm pool in eastern Arabian Sea / Bay of Bengal
        const warmPoolBonus = Math.sin(((lon - 70) / 30) * Math.PI) * Math.cos(((lat - 10) / 20) * Math.PI) * 1.4;
        
        // Seasonal cycle modulation based on monthOffset
        const seasonalShift = Math.cos((monthOffset * 0.5) + (lat * 0.05)) * 0.9;
        
        // Climatology (30-year normal baseline)
        const clim = +(baseEquator + (warmPoolBonus * 0.7) - (lat > 22 ? 2.1 : 0)).toFixed(2);

        // FNO AI Prediction with cross-scale spatiotemporal perturbation
        const fnoPerturbation = Math.sin((lon * 0.15) + (lat * 0.2) + (monthOffset * 1.2)) * 0.65 
                              + (monthOffset === 1 ? 0.45 : monthOffset === 2 ? 0.72 : 0.38);
        
        const predictedSst = +(clim + fnoPerturbation).toFixed(2);
        const anomaly = +(predictedSst - clim).toFixed(2);

        sstRow.push(predictedSst);
        climRow.push(clim);
        anomRow.push(anomaly);
      }
    }
    sstGrid.push(sstRow);
    climatologyGrid.push(climRow);
    anomalyGrid.push(anomRow);
  }

  return { sstGrid, climatologyGrid, anomalyGrid };
}

// Polygon & box land boundary approximation for North Indian Ocean
function checkIsLand(lat: number, lon: number): boolean {
  // Indian Peninsula
  if (lat >= 8.0 && lat <= 28.0 && lon >= 68.5 && lon <= 88.5) {
    const centerLon = 78.5;
    const halfWidth = (lat - 8.0) * 0.95 + 4.5;
    if (Math.abs(lon - centerLon) < halfWidth && lat < 24.5) return true;
    if (lat >= 24.5 && lon >= 70.0 && lon <= 89.0) return true;
  }
  // Sri Lanka
  if (lat >= 5.8 && lat <= 9.8 && lon >= 79.5 && lon <= 81.8) return true;
  // Arabian Peninsula / Middle East
  if (lon < 60.0 && lat > 14.0) return true;
  if (lon < 54.0 && lat >= 12.0) return true;
  // Southeast Asia / Myanmar / Thailand / Malacca
  if (lon > 93.0 && lat > 15.0) return true;
  if (lon > 98.0 && lat >= 5.0) return true;
  // North of 25N (Himalayas / Pakistan / Iran)
  if (lat >= 26.0 && lon < 69.0) return true;
  if (lat >= 27.5) return true;

  return false;
}

// ── Color Mappers ──
// SST Color: 24°C (Deep Navy/Blue) -> 27°C (Cyan/Teal) -> 29°C (Yellow/Amber) -> 32°C (Vibrant Crimson)
function getSstColor(t: number): string {
  if (isNaN(t)) return '#cbd5e1'; // Clean slate-300 for land in light mode
  const min = 24.0;
  const max = 32.0;
  const norm = Math.max(0, Math.min(1, (t - min) / (max - min)));

  if (norm < 0.25) {
    const f = norm / 0.25;
    return `rgb(${Math.round(30 + 20 * f)}, ${Math.round(80 + 100 * f)}, ${Math.round(200 + 40 * f)})`;
  } else if (norm < 0.5) {
    const f = (norm - 0.25) / 0.25;
    return `rgb(${Math.round(50 + 50 * f)}, ${Math.round(180 + 40 * f)}, ${Math.round(240 - 100 * f)})`;
  } else if (norm < 0.75) {
    const f = (norm - 0.5) / 0.25;
    return `rgb(${Math.round(100 + 140 * f)}, ${Math.round(220 - 40 * f)}, ${Math.round(140 - 110 * f)})`;
  } else {
    const f = (norm - 0.75) / 0.25;
    return `rgb(${Math.round(240 + 15 * f)}, ${Math.round(180 - 140 * f)}, ${Math.round(30 - 10 * f)})`;
  }
}

// Anomaly Color: -1.5°C (Cool Navy Blue) -> 0.0°C (Neutral Clean White) -> +1.5°C (Warm Crimson Red)
function getAnomalyColor(a: number): string {
  if (isNaN(a)) return '#cbd5e1'; // Land in light mode
  const clamped = Math.max(-1.5, Math.min(1.5, a));
  const norm = (clamped + 1.5) / 3.0; // 0 to 1

  if (norm < 0.5) {
    const f = norm / 0.5; // 0 (cold royal blue) to 1 (neutral clean white)
    const r = Math.round(37 + (255 - 37) * f);
    const g = Math.round(99 + (255 - 99) * f);
    const b = Math.round(235 + (255 - 235) * f);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const f = (norm - 0.5) / 0.5; // 0 (neutral white) to 1 (hot crimson red)
    const r = Math.round(255 - (255 - 220) * f);
    const g = Math.round(255 - (255 - 38) * f);
    const b = Math.round(255 - (255 - 38) * f);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function SeasonalPredictionPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ lat: number; lon: number; sst: number; anomaly: number } | null>(null);

  const sstCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const anomCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Month configurations
  const forecastMonths: ForecastMonthData[] = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + offset, 1);
      const monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      const leadTimeLabel = `Month +${offset + 1}`;
      
      const meanSST = offset === 0 ? 28.74 : offset === 1 ? 28.42 : 27.91;
      const minSST = offset === 0 ? 25.1 : offset === 1 ? 24.8 : 24.2;
      const maxSST = offset === 0 ? 31.2 : offset === 1 ? 30.9 : 30.4;
      const meanAnomaly = offset === 0 ? +0.58 : offset === 1 ? +0.72 : +0.41;

      return {
        monthIndex: offset,
        monthName,
        leadTimeLabel,
        targetDateStr: d.toISOString().slice(0, 7),
        meanSST,
        minSST,
        maxSST,
        meanAnomaly,
        anomalyStatus: meanAnomaly > 0.6 ? 'Active Heatwave' : meanAnomaly > 0.3 ? 'Moderate Warm' : 'Normal',
        anomalyStatusColor: meanAnomaly > 0.6 
          ? 'text-rose-800 bg-rose-50 border-rose-200' 
          : 'text-amber-800 bg-amber-50 border-amber-200'
      };
    });
  }, []);

  const activeMonth = forecastMonths[selectedMonthIndex];

  // Compute 2D gridded values
  const { sstGrid, climatologyGrid, anomalyGrid } = useMemo(() => {
    return generateSeasonalData(selectedMonthIndex + 1);
  }, [selectedMonthIndex]);

  // Render SST & Anomaly Canvases
  useEffect(() => {
    // 1. Draw SST Canvas
    const sstCanvas = sstCanvasRef.current;
    if (sstCanvas) {
      const ctx = sstCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, sstCanvas.width, sstCanvas.height);
        const cellW = sstCanvas.width / COLS;
        const cellH = sstCanvas.height / ROWS;

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const val = sstGrid[r][c];
            ctx.fillStyle = getSstColor(val);
            ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }

    // 2. Draw Anomaly Canvas
    const anomCanvas = anomCanvasRef.current;
    if (anomCanvas) {
      const ctx = anomCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, anomCanvas.width, anomCanvas.height);
        const cellW = anomCanvas.width / COLS;
        const cellH = anomCanvas.height / ROWS;

        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const val = anomalyGrid[r][c];
            ctx.fillStyle = getAnomalyColor(val);
            ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }
  }, [sstGrid, anomalyGrid]);

  // Trigger Forecast Generation
  const handleGenerateForecast = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setLastGeneratedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1100);
  };

  // Canvas Mouse Move Handler for Hover Coordinates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * COLS);
    const row = Math.floor((y / rect.height) * ROWS);

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      const lat = +(LAT_MAX - (row / (ROWS - 1)) * (LAT_MAX - LAT_MIN)).toFixed(1);
      const lon = +(LON_MIN + (col / (COLS - 1)) * (LON_MAX - LON_MIN)).toFixed(1);
      const sst = sstGrid[row][col];
      const anomaly = anomalyGrid[row][col];

      if (!isNaN(sst)) {
        setHoveredCell({ lat, lon, sst, anomaly });
      } else {
        setHoveredCell(null);
      }
    }
  };

  const mainContent = (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-7 w-full text-slate-800">

        {/* ══════════════════════════════════════════════════════════════
            1. TOP / HERO SECTION
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/30 text-white text-xs font-mono font-bold tracking-wide uppercase backdrop-blur-md">
                <Sparkles size={13} className="text-cyan-300" />
                <span>OceanEmbed Extension &bull; Spatiotemporal FNO</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight drop-shadow-md">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                  Seasonal Ocean Prediction
                </span>
              </h1>

              <p className="text-base sm:text-lg font-bold text-sky-100">
                AI-powered forecasting of North Indian Ocean temperature
              </p>

              <p className="text-xs sm:text-sm text-sky-100/90 leading-relaxed pt-1 font-medium">
                Uses historical surface and OceanEmbed subsurface ocean information to predict Sea Surface Temperature (SST) for the next 3 months.
              </p>
            </div>

            {/* Action Button & Status */}
            <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
              <button
                onClick={handleGenerateForecast}
                disabled={isGenerating}
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-sky-50 active:scale-95 text-[#005088] font-black text-sm tracking-wide flex items-center gap-2.5 transition-all shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-[#005088]" />
                    <span>Computing Spatiotemporal FNO...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} className="fill-[#005088] text-[#005088]" />
                    <span>Generate Forecast</span>
                  </>
                )}
              </button>

              <div className="text-[11px] font-mono text-sky-200/90 flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Domain: 5°N–30°N, 45°E–105°E</span>
                {lastGeneratedAt && (
                  <span className="text-sky-300/80">&bull; Updated {lastGeneratedAt}</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            2. INPUT → MODEL → OUTPUT CONCEPTUAL PIPELINE FLOW
        ══════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 relative">
            
            {/* Step 1: 12 Months Input */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block">Input Feed</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900">12 Months of Ocean Data</h3>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-[11px] font-mono font-bold text-slate-600 flex flex-wrap gap-1">
                  <span className="text-red-700">SST</span> &bull;
                  <span className="text-blue-700">SSS</span> &bull;
                  <span className="text-cyan-800">SLA</span> &bull;
                  <span className="text-emerald-800">U</span> &bull;
                  <span className="text-teal-800">V</span> &bull;
                  <span className="text-purple-800">Subsurface (0–1000m)</span>
                </p>
              </div>
            </div>

            {/* Step 2: Spatiotemporal FNO Model */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#005088] uppercase tracking-widest block">Neural Operator</span>
                <h3 className="font-black text-sm sm:text-base text-[#005088]">Spatiotemporal FNO</h3>
              </div>
              <div className="pt-2 border-t border-blue-200">
                <p className="text-[11px] font-bold text-[#005088]">
                  Spatial + Temporal Learning (Fourier Neural Operator)
                </p>
              </div>
            </div>

            {/* Step 3: 3-Month Forecast */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-widest block">Forward Output</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900">3-Month SST Forecast</h3>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-[11px] text-slate-500">
                  Lead Time: +1, +2, +3 Months continuous thermal evolution
                </p>
              </div>
            </div>

            {/* Step 4: SST Anomaly */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-widest block">Deviation Index</span>
                <h3 className="font-black text-sm sm:text-base text-amber-900">SST Anomaly</h3>
              </div>
              <div className="pt-2 border-t border-amber-200">
                <p className="text-[11px] font-mono font-bold text-amber-800">
                  Predicted SST − Climatology
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            3. FORECAST SECTION (MONTH SELECTOR + SST MAP + METRIC)
        ══════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
          
          {/* Header & Month Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Thermometer className="text-[#005088]" size={24} />
                <span>3-Month Forecast</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Predicted Sea Surface Temperature (SST) field across North Indian Ocean
              </p>
            </div>

            {/* Clean Month Selector Buttons */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {forecastMonths.map((m) => (
                <button
                  key={m.monthIndex}
                  onClick={() => setSelectedMonthIndex(m.monthIndex)}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedMonthIndex === m.monthIndex
                      ? 'bg-[#005088] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Calendar size={13} />
                  <span>{m.leadTimeLabel}</span>
                  <span className="hidden md:inline text-[11px] opacity-80">({m.monthName.split(' ')[0]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Grid: SST Map + Metric Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* SST Map Representation (8 cols) */}
            <div className="lg:col-span-8 space-y-2.5">
              <div className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner p-3">
                
                {/* Geographic & Domain Header Labels */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-2 px-1">
                  <span className="font-semibold">North Indian Ocean (5°N–30°N, 45°E–105°E)</span>
                  <span className="text-[#005088] font-bold">{activeMonth.monthName}</span>
                </div>

                {/* Heatmap Canvas */}
                <div className="relative aspect-[60/26] w-full rounded-lg overflow-hidden border border-slate-300 bg-slate-200">
                  <canvas
                    ref={sstCanvasRef}
                    width={COLS}
                    height={ROWS}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="w-full h-full image-rendering-pixelated cursor-crosshair"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {/* Dynamic Hover Tooltip Overlay */}
                  {hoveredCell && (
                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-md border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-mono shadow-md space-y-0.5 pointer-events-none">
                      <div className="text-slate-500 text-[10px]">
                        {hoveredCell.lat}°N, {hoveredCell.lon}°E
                      </div>
                      <div className="text-slate-800 font-bold">
                        SST: <span className="text-red-700 text-sm font-mono">{hoveredCell.sst.toFixed(2)}°C</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lat/Lon axis indicators & Legend */}
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-600 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-semibold">Scale (°C):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-blue-700 font-bold">24°C</span>
                      <div className="w-28 h-2.5 rounded-full bg-gradient-to-r from-blue-600 via-teal-400 via-amber-400 to-red-600 border border-slate-300" />
                      <span className="text-[10px] text-red-700 font-bold">32°C</span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    Grey = Land Mask &bull; Hover over cells to inspect
                  </span>
                </div>
              </div>
            </div>

            {/* Beside Map: Predicted SST Metric Card (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-6 rounded-xl bg-blue-50/60 border border-blue-200 shadow-xs text-center space-y-3">
                <span className="text-xs font-mono font-black text-[#005088] uppercase tracking-wider block">
                  Predicted Mean SST
                </span>

                <div className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight font-mono">
                  {activeMonth.meanSST.toFixed(1)}<span className="text-2xl sm:text-3xl text-[#005088] font-sans">°C</span>
                </div>

                <div className="inline-block px-3 py-1 rounded-full bg-white border border-blue-200 text-xs font-bold text-[#005088]">
                  Target: {activeMonth.monthName}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-blue-200 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Min Basin</span>
                    <span className="text-blue-700 font-bold">{activeMonth.minSST}°C</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Peak Warm Pool</span>
                    <span className="text-red-700 font-bold">{activeMonth.maxSST}°C</span>
                  </div>
                </div>
              </div>

              {/* Real Backend Hook Note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <Info size={14} className="text-[#005088] shrink-0 mt-0.5" />
                <span>
                  <strong>Developer Hook:</strong> Gridded tensor data feeds from Spatiotemporal FNO inference output (<code className="text-[#005088] text-[10px] font-bold">shape: [3, 101, 241]</code>).
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            4. ANOMALY SECTION (FORMULA + ANOMALY MAP)
        ══════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Activity className="text-amber-700" size={24} />
                <span>SST Anomaly</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Shows how the predicted temperature differs from the normal temperature for that month.
              </p>
            </div>

            {/* Compact Formula Visual Box */}
            <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2.5 text-xs font-mono shadow-xs">
              <span className="text-[#005088] font-bold">Predicted SST</span>
              <span className="text-amber-800 font-black">−</span>
              <span className="text-slate-700 font-bold">Monthly Climatology</span>
              <span className="text-amber-800 font-black">=</span>
              <span className="text-rose-700 font-black">SST Anomaly</span>
            </div>
          </div>

          {/* Anomaly Map & Diverging Scale */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Anomaly Map (8 cols) */}
            <div className="lg:col-span-8 space-y-2.5">
              <div className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner p-3">
                
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-2 px-1">
                  <span className="font-semibold">Temperature Deviation Field</span>
                  <span className="text-amber-800 font-bold">Lead: {activeMonth.leadTimeLabel}</span>
                </div>

                {/* Canvas Anomaly Heatmap */}
                <div className="relative aspect-[60/26] w-full rounded-lg overflow-hidden border border-slate-300 bg-slate-200">
                  <canvas
                    ref={anomCanvasRef}
                    width={COLS}
                    height={ROWS}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="w-full h-full image-rendering-pixelated cursor-crosshair"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {/* Hover Anomaly Tooltip */}
                  {hoveredCell && (
                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-md border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-mono shadow-md space-y-0.5 pointer-events-none">
                      <div className="text-slate-500 text-[10px]">
                        {hoveredCell.lat}°N, {hoveredCell.lon}°E
                      </div>
                      <div className="font-bold text-slate-800">
                        Anomaly:{' '}
                        <span className={hoveredCell.anomaly > 0 ? 'text-red-700 text-sm font-mono' : 'text-blue-700 text-sm font-mono'}>
                          {hoveredCell.anomaly > 0 ? `+${hoveredCell.anomaly.toFixed(2)}` : hoveredCell.anomaly.toFixed(2)}°C
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Diverging Scale Legend: Cooler <- Normal -> Warmer */}
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-700 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-blue-700 font-bold">Cooler (-1.5°C)</span>
                    <div className="w-32 h-2.5 rounded-full bg-gradient-to-r from-blue-600 via-white to-red-600 border border-slate-300" />
                    <span className="text-[11px] text-red-700 font-bold">Warmer (+1.5°C)</span>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-500">
                    Baseline: 30-Year Monthly Climatology
                  </span>
                </div>

              </div>
            </div>

            {/* Beside Anomaly Map: Summary Card (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider block">
                  Regional Anomaly Diagnostics
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Mean Anomaly:</span>
                  <span className="text-xl font-mono font-black text-rose-700">
                    +{activeMonth.meanAnomaly.toFixed(2)}°C
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-600 font-medium">Thermal Phase:</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${activeMonth.anomalyStatusColor}`}>
                    {activeMonth.anomalyStatus}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                  Positive anomalies over +0.5°C signal elevated risk of Marine Heatwaves (MHW) and intensified cyclogenesis energy in the Bay of Bengal &amp; Arabian Sea.
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            5. SMALL "HOW IT WORKS" 4-STEP PROCESS SECTION
        ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-[#005088]" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              How It Works &bull; 4-Step Scientific Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            {/* Card 01 */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-blue-300 transition-colors">
              <span className="text-xs font-mono font-black text-[#005088] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                01
              </span>
              <h4 className="font-bold text-slate-900 text-sm">Historical Data</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ingests past 12 consecutive months of multi-satellite surface observations (SST, SSS, SLA, Winds, Currents).
              </p>
            </div>

            {/* Card 02 */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-blue-300 transition-colors">
              <span className="text-xs font-mono font-black text-[#005088] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                02
              </span>
              <h4 className="font-bold text-slate-900 text-sm">OceanEmbed Subsurface</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Reconstructs 15 vertical thermal layers (0–1000m) to capture subsurface oceanic heat content and thermal memory.
              </p>
            </div>

            {/* Card 03 */}
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 shadow-xs space-y-2">
              <span className="text-xs font-mono font-black text-white bg-[#005088] px-2 py-0.5 rounded">
                03
              </span>
              <h4 className="font-bold text-[#005088] text-sm">Spatiotemporal FNO</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fourier Neural Operator learns continuous multi-scale temporal and spatial dynamical operators across the North Indian Ocean.
              </p>
            </div>

            {/* Card 04 */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-amber-300 transition-colors">
              <span className="text-xs font-mono font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                04
              </span>
              <h4 className="font-bold text-slate-900 text-sm">3-Month Forecast &amp; Anomaly</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Outputs forward 3-month SST projections and compares with historical monthly climatology to isolate thermal anomalies.
              </p>
            </div>

          </div>
        </section>
    </div>
  );

  if (embedded) {
    return mainContent;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col selection:bg-blue-100 selection:text-[#005088]">
      <Navbar />
      <main className="flex-1 w-full">
        {mainContent}
      </main>
      <GovFooter />
    </div>
  );
}
