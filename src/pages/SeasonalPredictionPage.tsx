import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Sparkles, ArrowRight, Play, Loader2, Info, Compass,
  Layers, ChevronRight, Activity, Thermometer, Droplets, Waves,
  Wind, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw
} from 'lucide-react';
import Navbar from '../components/Navbar';
import GovFooter from '../components/GovFooter';
import {
  fetchSeasonalConfig,
  fetchSeasonalPrediction,
  fetchSeasonalStatus,
  type SeasonalConfigResponse,
  type SeasonalPredictionResponse,
} from '../api/oceanApi';

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
  meanSST: number | null;
  minSST: number | null;
  maxSST: number | null;
  meanAnomaly: number | null;
  anomalyMin: number | null;
  anomalyMax: number | null;
  anomalyStatus: 'Positive anomaly' | 'Negative anomaly' | 'Near climatology' | 'No data';
  anomalyStatusColor: string;
}

// ── Backend grid helpers ──
function monthLabel(value: string): string {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

function finiteValues(grid: number[][]): number[] {
  const values: number[] = [];
  for (const row of grid) {
    for (const value of row) {
      if (Number.isFinite(value)) values.push(value);
    }
  }
  return values;
}

function flattenBackendGrid(
  source: number[][] | undefined,
): number[][] {
  if (!source?.length || !source[0]?.length) return [];
  return source;
}

function resampleGrid(
  source: number[][],
  targetRows: number,
  targetCols: number,
): number[][] {
  if (!source.length || !source[0]?.length) {
    return Array.from({ length: targetRows }, () =>
      Array.from({ length: targetCols }, () => Number.NaN),
    );
  }

  const sourceRows = source.length;
  const sourceCols = source[0].length;

  return Array.from({ length: targetRows }, (_, r) => {
    const sourceR = Math.min(
      sourceRows - 1,
      Math.round((r / Math.max(1, targetRows - 1)) * (sourceRows - 1)),
    );

    return Array.from({ length: targetCols }, (_, c) => {
      const sourceC = Math.min(
        sourceCols - 1,
        Math.round((c / Math.max(1, targetCols - 1)) * (sourceCols - 1)),
      );
      return Number(source[sourceR]?.[sourceC]);
    });
  });
}

function getDynamicColor(
  value: number,
  min: number,
  max: number,
  cold: [number, number, number],
  hot: [number, number, number],
): string {
  if (!Number.isFinite(value)) return '#cbd5e1';

  const span = Math.max(Math.abs(max - min), 1e-6);
  const norm = Math.max(0, Math.min(1, (value - min) / span));

  const r = Math.round(cold[0] + (hot[0] - cold[0]) * norm);
  const g = Math.round(cold[1] + (hot[1] - cold[1]) * norm);
  const b = Math.round(cold[2] + (hot[2] - cold[2]) * norm);

  return `rgb(${r}, ${g}, ${b})`;
}

function getAnomalyColor(
  value: number,
  min: number,
  max: number,
): string {
  if (!Number.isFinite(value)) return '#cbd5e1';

  const absMax = Math.max(
    Math.abs(min),
    Math.abs(max),
    1e-6,
  );

  const clamped = Math.max(-absMax, Math.min(absMax, value));

  if (clamped >= 0) {
    const norm = clamped / absMax;
    return `rgb(${Math.round(255 - 35 * norm)}, ${Math.round(255 - 195 * norm)}, ${Math.round(255 - 195 * norm)})`;
  }

  const norm = Math.abs(clamped) / absMax;
  return `rgb(${Math.round(255 - 210 * norm)}, ${Math.round(255 - 155 * norm)}, ${Math.round(255 - 15 * norm)})`;
}

// ── Production seasonal FNO page ──
export default function SeasonalPredictionPage(
  { embedded = false }: { embedded?: boolean } = {},
) {
  // The production Seasonal predictor requires the final month of a complete
  // 12-month input window. The current live 2026 source has complete monthly
  // coverage through August 2026, so this is the safe default.
  const [inputEndMonth, setInputEndMonth] = useState<string>('2026-08');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [backendMessage, setBackendMessage] = useState<string>(
    'Checking Seasonal FNO backend…',
  );
  const [seasonalConfig, setSeasonalConfig] =
    useState<SeasonalConfigResponse | null>(null);
  const [seasonalResult, setSeasonalResult] =
    useState<SeasonalPredictionResponse | null>(null);
  const [seasonalError, setSeasonalError] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] =
    useState<string | null>(null);

  const [hoveredCell, setHoveredCell] = useState<{
    lat: number;
    lon: number;
    sst: number;
    anomaly: number;
  } | null>(null);

  const sstCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const anomCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Verify that the actual Seasonal FNO assets are available before inference.
  useEffect(() => {
    let cancelled = false;

    const loadBackendState = async () => {
      try {
        const status = await fetchSeasonalStatus();
        if (cancelled) return;

        setBackendReady(Boolean(status.available));
        setBackendMessage(
          status.available
            ? `Seasonal FNO ready • ${status.device ?? 'backend device'}`
            : 'Seasonal FNO assets are unavailable',
        );

        try {
          const config = await fetchSeasonalConfig();
          if (!cancelled) setSeasonalConfig(config);
        } catch (configError) {
          if (!cancelled) {
            console.warn('[Seasonal] Config request failed:', configError);
          }
        }
      } catch (error) {
        if (cancelled) return;

        setBackendReady(false);
        setBackendMessage(
          error instanceof Error
            ? error.message
            : 'Unable to reach Seasonal FNO backend',
        );
      }
    };

    void loadBackendState();

    return () => {
      cancelled = true;
    };
  }, []);

  // Map the real backend output to the three forecast month cards.
  const forecastMonths: ForecastMonthData[] = useMemo(() => {
    const months =
      seasonalResult?.forecast_months ??
      (() => {
        const base = new Date(`${inputEndMonth}-01T00:00:00`);
        return [1, 2, 3].map((offset) => {
          const date = new Date(
            base.getFullYear(),
            base.getMonth() + offset,
            1,
          );
          return `${date.getFullYear()}-${String(
            date.getMonth() + 1,
          ).padStart(2, '0')}`;
        });
      })();

    return months.map((targetMonth, index) => {
      const sstSource =
        seasonalResult?.forecast_sst_normalized?.[index]?.[0] ?? [];
      const anomalySource =
        seasonalResult?.forecast_anomaly_normalized?.[index]?.[0] ?? [];

      const sstValues = finiteValues(sstSource);
      const anomalyValues = finiteValues(anomalySource);

      const meanSST = sstValues.length
        ? sstValues.reduce((sum, value) => sum + value, 0) /
          sstValues.length
        : null;

      const meanAnomaly = anomalyValues.length
        ? anomalyValues.reduce((sum, value) => sum + value, 0) /
          anomalyValues.length
        : null;

      const anomalyMin = anomalyValues.length
        ? Math.min(...anomalyValues)
        : null;
      const anomalyMax = anomalyValues.length
        ? Math.max(...anomalyValues)
        : null;

      const anomalyStatus =
        meanAnomaly == null
          ? 'No data'
          : meanAnomaly > 0.05
            ? 'Positive anomaly'
            : meanAnomaly < -0.05
              ? 'Negative anomaly'
              : 'Near climatology';

      const anomalyStatusColor =
        anomalyStatus === 'Positive anomaly'
          ? 'text-rose-300 bg-rose-950/70 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
          : anomalyStatus === 'Negative anomaly'
            ? 'text-cyan-300 bg-cyan-950/70 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
            : anomalyStatus === 'Near climatology'
              ? 'text-slate-300 bg-slate-900/70 border-white/20'
              : 'text-slate-400 bg-slate-900/50 border-white/10';

      return {
        monthIndex: index,
        monthName: monthLabel(targetMonth),
        leadTimeLabel: `Month +${index + 1}`,
        targetDateStr: targetMonth,
        meanSST,
        minSST: sstValues.length ? Math.min(...sstValues) : null,
        maxSST: sstValues.length ? Math.max(...sstValues) : null,
        meanAnomaly,
        anomalyMin,
        anomalyMax,
        anomalyStatus,
        anomalyStatusColor,
      };
    });
  }, [inputEndMonth, seasonalResult]);

  const activeMonth = forecastMonths[selectedMonthIndex] ?? forecastMonths[0];

  const selectedSSTSource =
    seasonalResult?.forecast_sst_normalized?.[selectedMonthIndex]?.[0] ??
    [];

  const selectedAnomalySource =
    seasonalResult?.forecast_anomaly_normalized?.[selectedMonthIndex]?.[0] ??
    [];

  const sstGrid = useMemo(
    () => resampleGrid(selectedSSTSource, ROWS, COLS),
    [selectedSSTSource],
  );

  const anomalyGrid = useMemo(
    () => resampleGrid(selectedAnomalySource, ROWS, COLS),
    [selectedAnomalySource],
  );

  const sstValues = finiteValues(selectedSSTSource);
  const anomalyValues = finiteValues(selectedAnomalySource);

  const sstMin = sstValues.length ? Math.min(...sstValues) : 0;
  const sstMax = sstValues.length ? Math.max(...sstValues) : 1;
  const anomalyMin = anomalyValues.length
    ? Math.min(...anomalyValues)
    : -1;
  const anomalyMax = anomalyValues.length
    ? Math.max(...anomalyValues)
    : 1;

  // Render the real backend grids into lightweight canvases.
  useEffect(() => {
    const sstCanvas = sstCanvasRef.current;

    if (sstCanvas) {
      const ctx = sstCanvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, sstCanvas.width, sstCanvas.height);

        const cellW = sstCanvas.width / COLS;
        const cellH = sstCanvas.height / ROWS;

        for (let r = 0; r < ROWS; r += 1) {
          for (let c = 0; c < COLS; c += 1) {
            const value = sstGrid[r]?.[c] ?? Number.NaN;

            ctx.fillStyle = getDynamicColor(
              value,
              sstMin,
              sstMax,
              [25, 90, 220],
              [225, 45, 45],
            );

            ctx.fillRect(
              c * cellW,
              r * cellH,
              cellW + 0.5,
              cellH + 0.5,
            );
          }
        }
      }
    }

    const anomalyCanvas = anomCanvasRef.current;

    if (anomalyCanvas) {
      const ctx = anomalyCanvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(
          0,
          0,
          anomalyCanvas.width,
          anomalyCanvas.height,
        );

        const cellW = anomalyCanvas.width / COLS;
        const cellH = anomalyCanvas.height / ROWS;

        for (let r = 0; r < ROWS; r += 1) {
          for (let c = 0; c < COLS; c += 1) {
            const value = anomalyGrid[r]?.[c] ?? Number.NaN;

            ctx.fillStyle = getAnomalyColor(
              value,
              anomalyMin,
              anomalyMax,
            );

            ctx.fillRect(
              c * cellW,
              r * cellH,
              cellW + 0.5,
              cellH + 0.5,
            );
          }
        }
      }
    }
  }, [
    sstGrid,
    anomalyGrid,
    sstMin,
    sstMax,
    anomalyMin,
    anomalyMax,
  ]);

  const handleGenerateForecast = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setSeasonalError(null);
    setBackendMessage('Running production Seasonal FNO inference…');

    try {
      const result = await fetchSeasonalPrediction(inputEndMonth);

      if (!result.success) {
        throw new Error('Seasonal FNO backend returned success=false.');
      }

      setSeasonalResult(result);
      setBackendReady(true);
      setBackendMessage(
        `Production Seasonal FNO complete • ${result.device}`,
      );
      setSelectedMonthIndex(0);
      setLastGeneratedAt(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Seasonal FNO inference failed.';

      setSeasonalError(message);
      setBackendMessage(message);
      setSeasonalResult(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * COLS);
    const row = Math.floor((y / rect.height) * ROWS);

    if (
      row < 0 ||
      row >= ROWS ||
      col < 0 ||
      col >= COLS
    ) {
      setHoveredCell(null);
      return;
    }

    const lat = +(
      LAT_MAX -
      (row / (ROWS - 1)) * (LAT_MAX - LAT_MIN)
    ).toFixed(1);

    const lon = +(
      LON_MIN +
      (col / (COLS - 1)) * (LON_MAX - LON_MIN)
    ).toFixed(1);

    const sst = sstGrid[row]?.[col] ?? Number.NaN;
    const anomaly =
      anomalyGrid[row]?.[col] ?? Number.NaN;

    if (Number.isFinite(sst) || Number.isFinite(anomaly)) {
      setHoveredCell({
        lat,
        lon,
        sst,
        anomaly,
      });
    } else {
      setHoveredCell(null);
    }
  };

  const mainContent = (
    <div className="seasonal-shell cyclone-shell cyclone-scope dark-glass-scope text-white max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-7 w-full">

        {/* ══════════════════════════════════════════════════════════════
            1. TOP / HERO SECTION
        ══════════════════════════════════════════════════════════════ */}
        <section className="relative pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold tracking-wide uppercase backdrop-blur-md">
                <Sparkles size={13} className="text-cyan-300" />
                <span>OceanEmbed Extension &bull; Spatiotemporal FNO</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight drop-shadow-md">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                  Seasonal Ocean Prediction
                </span>
              </h1>

              <p className="text-base sm:text-lg font-bold text-sky-100">
                Production AI forecasting of North Indian Ocean temperature anomalies
              </p>

              <p className="text-xs sm:text-sm text-sky-100/80 leading-relaxed pt-1 font-medium">
                Uses the backend's 12-month normalized multi-parameter input and production 3D Spatiotemporal FNO to forecast the next 3 months.
              </p>
            </div>

            {/* Action Button & Status */}
            <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
              <div className="flex flex-col items-stretch gap-3 w-full md:w-auto">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                  Input-end month
                  <input
                    type="month"
                    value={inputEndMonth}
                    min="2019-01"
                    max="2026-08"
                    onChange={(event) => {
                      setInputEndMonth(event.target.value);
                      setSeasonalResult(null);
                      setSeasonalError(null);
                      setSelectedMonthIndex(0);
                    }}
                    className="mt-1.5 w-full md:w-48 rounded-lg border border-white/20 bg-slate-950/80 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>

                <button
                  onClick={handleGenerateForecast}
                  disabled={isGenerating || backendReady === false}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white font-black text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-cyan-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-400/40"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Running Production FNO...</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} className="fill-white text-white" />
                      <span>Run Production Forecast</span>
                    </>
                  )}
                </button>

                <div className="text-[10px] font-mono text-slate-300">
                  {backendReady === true ? '● Backend ready' : backendReady === false ? '● Backend unavailable' : '● Checking backend…'}
                  {' '} {backendMessage}
                </div>

                <div className="text-[10px] font-mono text-cyan-300/90 flex items-center gap-2 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Domain: 5°N–30°N, 45°E–105°E</span>
                  {lastGeneratedAt && (
                    <span className="text-cyan-200/80">&bull; Updated {lastGeneratedAt}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            2. INPUT → MODEL → OUTPUT CONCEPTUAL PIPELINE FLOW
        ══════════════════════════════════════════════════════════════ */}
        <section className="glass rounded-2xl p-5 sm:p-6 border border-cyan-500/30 depth-shadow">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 relative">
            
            {/* Step 1: 12 Months Input */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/10 space-y-2 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Input Feed</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">12-Month Production Input Window</h3>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                <p className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 flex flex-wrap gap-1">
                  <span className="text-red-500 dark:text-red-400">SST</span> &bull;
                  <span className="text-cyan-600 dark:text-cyan-300">SSS</span> &bull;
                  <span className="text-sky-600 dark:text-sky-300">SLA</span> &bull;
                  <span className="text-emerald-600 dark:text-emerald-400">U</span> &bull;
                  <span className="text-teal-600 dark:text-teal-300">V</span> &bull;
                  <span className="text-purple-600 dark:text-purple-300">Subsurface (0–1000m)</span>
                </p>
              </div>
            </div>

            {/* Step 2: Spatiotemporal FNO Model */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/10 space-y-2 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-cyan-400 uppercase tracking-widest block">Neural Operator</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Spatiotemporal FNO</h3>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                <p className="text-[11px] font-medium text-slate-600 dark:text-cyan-200">
                  Spatial + Temporal Learning (Fourier Neural Operator)
                </p>
              </div>
            </div>

            {/* Step 3: 3-Month Forecast */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/10 space-y-2 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Forward Output</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">3-Month SST Forecast</h3>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Lead Time: +1, +2, +3 Months continuous thermal evolution
                </p>
              </div>
            </div>

            {/* Step 4: SST Anomaly */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-white/10 space-y-2 flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block">Deviation Index</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">SST Anomaly</h3>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                <p className="text-[11px] font-mono font-medium text-slate-600 dark:text-amber-300">
                  Predicted normalized SST − monthly climatology
                </p>
              </div>
            </div>

          </div>
        </section>

        {seasonalError && (
          <section className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-black text-rose-300">Seasonal FNO inference failed</div>
              <div className="text-rose-200 mt-1">{seasonalError}</div>
            </div>
          </section>
        )}

        {seasonalResult && (
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <CheckCircle2 size={17} />
              Production Seasonal FNO result received
            </div>
            <div className="text-[11px] font-mono text-emerald-200/90">
              Model: {seasonalConfig?.model ?? seasonalResult.model} &bull;
              Input: {seasonalResult.input_months[0]} → {seasonalResult.input_months.at(-1)} &bull;
              Output: {seasonalResult.forecast_months.join(', ')} &bull;
              Device: {seasonalResult.device}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            3. FORECAST SECTION (MONTH SELECTOR + SST MAP + METRIC)
        ══════════════════════════════════════════════════════════════ */}
        <section className="glass rounded-2xl p-6 sm:p-7 border border-cyan-500/30 depth-shadow space-y-6">
          
          {/* Header & Month Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Thermometer className="text-cyan-400" size={24} />
                <span>3-Month Forecast</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Production FNO forecast field across the North Indian Ocean
              </p>
            </div>

            {/* Clean Month Selector Buttons */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-white/10">
              {forecastMonths.map((m) => (
                <button
                  key={m.monthIndex}
                  onClick={() => setSelectedMonthIndex(m.monthIndex)}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedMonthIndex === m.monthIndex
                      ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
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
              <div className="relative bg-slate-950/80 rounded-xl border border-cyan-500/20 overflow-hidden shadow-inner p-3">
                
                {/* Geographic & Domain Header Labels */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-2 px-1">
                  <span className="font-semibold text-slate-300">North Indian Ocean (5°N–30°N, 45°E–105°E)</span>
                  <span className="text-cyan-300 font-bold">{activeMonth.monthName}</span>
                </div>

                {/* Heatmap Canvas */}
                <div className="relative aspect-[60/26] w-full rounded-lg overflow-hidden border border-white/15 bg-slate-900">
                  <canvas
                    ref={sstCanvasRef}
                    width={COLS}
                    height={ROWS}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="w-full h-full image-rendering-pixelated cursor-crosshair"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {/* Empty-state overlay */}
                  {!seasonalResult && !isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-[2px]">
                      <div className="px-5 py-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 shadow-2xl text-center">
                        <div className="text-sm font-black text-white">Run the production forecast</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Backend result will populate this map with the real 101 × 241 FNO field.
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Dynamic Hover Tooltip Overlay */}
                  {hoveredCell && (
                    <div className="absolute top-2 right-2 bg-slate-950/95 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-mono shadow-2xl space-y-0.5 pointer-events-none">
                      <div className="text-slate-400 text-[10px]">
                        {hoveredCell.lat}°N, {hoveredCell.lon}°E
                      </div>
                      <div className="text-white font-bold">
                        SST: <span className="text-rose-400 text-sm font-mono">{Number.isFinite(hoveredCell.sst) ? hoveredCell.sst.toFixed(3) : '--'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lat/Lon axis indicators & Legend */}
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-300 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-semibold">Relative normalized SST</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-cyan-400 font-bold">Low</span>
                      <div className="w-28 h-2.5 rounded-full bg-gradient-to-r from-blue-600 via-teal-400 via-amber-400 to-red-600 border border-white/20" />
                      <span className="text-[10px] text-rose-400 font-bold">High</span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    Normalized backend field &bull; Hover over cells to inspect
                  </span>
                </div>
              </div>
            </div>

            {/* Beside Map: Predicted SST Metric Card (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-6 rounded-xl bg-cyan-950/30 border border-cyan-500/30 shadow-xs text-center space-y-3">
                <span className="text-xs font-mono font-black text-cyan-300 uppercase tracking-wider block">
                  Predicted SST (normalized)
                </span>

                <div className="text-5xl sm:text-6xl font-black text-white tracking-tight font-mono">
                  {activeMonth.meanSST == null ? '--' : activeMonth.meanSST.toFixed(3)}<span className="text-sm sm:text-base text-cyan-300 font-sans"> norm.</span>
                </div>

                <div className="inline-block px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 text-xs font-bold text-cyan-300">
                  Target: {activeMonth.monthName}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-cyan-500/20 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Minimum</span>
                    <span className="text-cyan-400 font-bold">{activeMonth.minSST == null ? '--' : activeMonth.minSST.toFixed(3)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-white/10">
                    <span className="text-[10px] text-slate-400 block">Maximum</span>
                    <span className="text-rose-400 font-bold">{activeMonth.maxSST == null ? '--' : activeMonth.maxSST.toFixed(3)}</span>
                  </div>
                </div>
              </div>

              {/* Real Backend Hook Note */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] text-slate-300 flex items-start gap-2">
                <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Production backend:</strong> Real Spatiotemporal FNO response, output shape <code className="text-cyan-300 text-[10px] font-bold">[3, 1, 101, 241]</code>. Physical Celsius reconstruction is intentionally not shown because the backend marks it as unverified.
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            4. ANOMALY SECTION (FORMULA + ANOMALY MAP)
        ══════════════════════════════════════════════════════════════ */}
        <section className="glass rounded-2xl p-6 sm:p-7 border border-cyan-500/30 depth-shadow space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Activity className="text-amber-400" size={24} />
                <span>SST Anomaly</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Shows the production FNO anomaly field relative to the model's train-only monthly climatology.
              </p>
            </div>

            {/* Compact Formula Visual Box */}
            <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 flex items-center gap-2.5 text-xs font-mono shadow-xs text-white">
              <span className="text-cyan-300 font-bold">Predicted normalized SST</span>
              <span className="text-amber-400 font-black">−</span>
              <span className="text-slate-300 font-bold">Monthly Climatology</span>
              <span className="text-amber-400 font-black">=</span>
              <span className="text-rose-400 font-black">SST Anomaly</span>
            </div>
          </div>

          {/* Anomaly Map & Diverging Scale */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Anomaly Map (8 cols) */}
            <div className="lg:col-span-8 space-y-2.5">
              <div className="relative bg-slate-950/80 rounded-xl border border-cyan-500/20 overflow-hidden shadow-inner p-3">
                
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-2 px-1">
                  <span className="font-semibold text-slate-300">Temperature Deviation Field</span>
                  <span className="text-amber-400 font-bold">Lead: {activeMonth.leadTimeLabel}</span>
                </div>

                {/* Canvas Anomaly Heatmap */}
                <div className="relative aspect-[60/26] w-full rounded-lg overflow-hidden border border-white/15 bg-slate-900">
                  <canvas
                    ref={anomCanvasRef}
                    width={COLS}
                    height={ROWS}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="w-full h-full image-rendering-pixelated cursor-crosshair"
                    style={{ imageRendering: 'pixelated' }}
                  />

                  {!seasonalResult && !isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-[2px]">
                      <div className="px-5 py-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 shadow-2xl text-center">
                        <div className="text-sm font-black text-white">Awaiting production anomaly field</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Run the backend FNO to populate the real forecast anomaly.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hover Anomaly Tooltip */}
                  {hoveredCell && (
                    <div className="absolute top-2 right-2 bg-slate-950/95 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-mono shadow-2xl space-y-0.5 pointer-events-none">
                      <div className="text-slate-400 text-[10px]">
                        {hoveredCell.lat}°N, {hoveredCell.lon}°E
                      </div>
                      <div className="font-bold text-white">
                        Anomaly:{' '}
                        <span className={hoveredCell.anomaly > 0 ? 'text-rose-400 text-sm font-mono' : 'text-cyan-400 text-sm font-mono'}>
                          {Number.isFinite(hoveredCell.anomaly) ? `${hoveredCell.anomaly >= 0 ? '+' : ''}${hoveredCell.anomaly.toFixed(3)}` : '--'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Diverging Scale Legend: Cooler <- Normal -> Warmer */}
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-300 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-cyan-400 font-bold">Negative</span>
                    <div className="w-32 h-2.5 rounded-full bg-gradient-to-r from-blue-600 via-white to-red-600 border border-white/20" />
                    <span className="text-[11px] text-rose-400 font-bold">Positive</span>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-400">
                    Baseline: train-only monthly climatology
                  </span>
                </div>

              </div>
            </div>

            {/* Beside Anomaly Map: Summary Card (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="p-5 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Regional Anomaly Diagnostics
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">Mean anomaly (normalized):</span>
                  <span className="text-xl font-mono font-black text-rose-400">
                    {activeMonth.meanAnomaly == null ? '--' : `${activeMonth.meanAnomaly >= 0 ? '+' : ''}${activeMonth.meanAnomaly.toFixed(3)}`}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-slate-300 font-medium">Thermal Phase:</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${activeMonth.anomalyStatusColor}`}>
                    {activeMonth.anomalyStatus}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 leading-relaxed">
                  Positive and negative anomaly values are reported in the backend's normalized model space. This page does not convert them into physical °C thresholds.
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
            <Compass size={18} className="text-cyan-400" />
            <h2 className="text-lg font-black text-white tracking-tight">
              How It Works &bull; 4-Step Scientific Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            {/* Card 01 */}
            <div className="p-4 rounded-xl glass border border-white/10 space-y-2 hover:border-cyan-500/40 transition-colors">
              <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                01
              </span>
              <h4 className="font-bold text-white text-sm">Historical Data</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ingests past 12 consecutive months of multi-satellite surface observations (SST, SSS, SLA, Winds, Currents).
              </p>
            </div>

            {/* Card 02 */}
            <div className="p-4 rounded-xl glass border border-white/10 space-y-2 hover:border-cyan-500/40 transition-colors">
              <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                02
              </span>
              <h4 className="font-bold text-white text-sm">OceanEmbed Subsurface</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reconstructs 15 vertical thermal layers (0–1000m) to capture subsurface oceanic heat content and thermal memory.
              </p>
            </div>

            {/* Card 03 */}
            <div className="p-4 rounded-xl glass border border-white/10 space-y-2 hover:border-cyan-500/40 transition-colors">
              <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                03
              </span>
              <h4 className="font-bold text-white text-sm">Spatiotemporal FNO</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fourier Neural Operator learns continuous multi-scale temporal and spatial dynamical operators across the North Indian Ocean.
              </p>
            </div>

            {/* Card 04 */}
            <div className="p-4 rounded-xl glass border border-white/10 space-y-2 hover:border-amber-500/40 transition-colors">
              <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                04
              </span>
              <h4 className="font-bold text-white text-sm">3-Month Forecast &amp; Anomaly</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
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
    <div className="min-h-screen bg-[#020b18] text-white font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-300">
      <Navbar />
      <main className="flex-1 w-full">
        {mainContent}
      </main>
      <GovFooter />
    </div>
  );
}
