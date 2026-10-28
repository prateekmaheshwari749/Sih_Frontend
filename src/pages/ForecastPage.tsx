import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Wind,
  Thermometer,
  Layers,
  Calendar,
  Activity,
  Droplets,
  Waves,
  Clock,
  RefreshCw,
  RotateCcw,
  ArrowRight,
  Cpu,
  Loader2,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';

import {
  format,
  parseISO,
} from 'date-fns';

import PageLayout, {
  PageContainer,
  PageHeader,
} from '../components/PageLayout';

import {
  fetchSurface,
  fetchHeatmapAvailable,
  getHeatmapUrl,
  fetchOceanProfile,
  getBackendUrl,
} from '../api/oceanApi';

// Date helpers. The backend availability endpoint is the source of truth for the latest date.
function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDynamicReferenceDate(customDateStr?: string): Date {
  const candidate = customDateStr ?? formatDate(new Date());
  const parsed = parseISO(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid forecast date: ${candidate}`);
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** The backend's production model takes N input days immediately before target D. */
function getRollingWindowDates(referenceDate: Date, windowDays = 7): string[] {
  return Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(referenceDate);
    date.setDate(referenceDate.getDate() - (windowDays - index));
    return formatDate(date);
  });
}

/** The saved model artifact is named for its target date D. */
function getPredictionTargetDate(referenceDate: Date): string {
  return formatDate(referenceDate);
}

const DEFAULT_REFERENCE_DATE = getDynamicReferenceDate();
const DEFAULT_ROLLING_DATES = getRollingWindowDates(DEFAULT_REFERENCE_DATE, 7);
const DEFAULT_PREDICTED_DATE = getPredictionTargetDate(DEFAULT_REFERENCE_DATE);

const DEFAULT_DEPTHS = [
  0,
  5,
  10,
  20,
  30,
  50,
  75,
  100,
  125,
  150,
  200,
  300,
  500,
  700,
  1000,
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SurfaceData {
  date: string;
  lat: number[];
  lon: number[];
  source: string;

  variables: {
    sst: number[][];
    sss: number[][];
    ssh: number[][];
    u_wind: number[][];
    v_wind: number[][];
    current_u: number[][];
    current_v: number[][];
  };
}

interface BackendHeatmapResponse {
  date?: string;
  depth_m?: number;
  depth_index?: number;

  // Normal expected field
  prediction_C?: unknown;

  // Possible backend alternatives
  prediction?: unknown;
  data?: unknown;

  // Backend may already provide a scalar summary
  mean_C?: number | null;
  min_C?: number | null;
  max_C?: number | null;

  shape?: number[];
}

interface ForecastDay {
  /** Calendar date represented by this UI step. */
  date: string;
  /** Actual surface dataset date used for telemetry. */
  surfaceDate: string;
  surface: SurfaceData;
  isPrediction: boolean;
}

interface ProfilePoint {
  depth: number;
  temperature: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function flattenNumeric(
  value: unknown,
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: number[] = [];

  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (
      typeof item === 'number' &&
      Number.isFinite(item)
    ) {
      result.push(item);
    }
  };

  value.forEach(visit);

  return result;
}

function average(
  values: number[],
): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

function averageGrid(
  values?: number[][],
): number {
  return average(
    flattenNumeric(values),
  );
}

function vectorMagnitude(
  u: number,
  v: number,
): number {
  return Math.sqrt(
    u * u + v * v,
  );
}

function tempColor(
  temperature: number,
): string {
  const n = Math.max(
    0,
    Math.min(
      1,
      (temperature - 2) / 27,
    ),
  );

  if (n < 0.25) return '#1e40af';
  if (n < 0.5) return '#06b6d4';
  if (n < 0.75) return '#fbbf24';

  return '#ef4444';
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart tooltip
// ─────────────────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: any) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  return (
    <div className="bg-white/95 rounded-xl border border-slate-200 p-3 text-xs shadow-xl space-y-1 backdrop-blur-xl">
      <p className="text-slate-900 font-bold font-mono mb-1">
        {label}
      </p>

      {payload.map(
        (item: any) => (
          <p
            key={item.dataKey}
            className="font-mono font-semibold"
            style={{
              color: item.color,
            }}
          >
            {item.name}:{' '}
            {typeof item.value === 'number'
              ? item.value.toFixed(2)
              : item.value}
          </p>
        ),
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini temperature column
// ─────────────────────────────────────────────────────────────────────────────

function DepthColumn({
  values,
}: {
  values: ProfilePoint[];
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-cyan-400/40">

      {values.map(
        item => (
          <div
            key={item.depth}
            title={`${item.depth}m: ${item.temperature.toFixed(2)}°C`}
            style={{
              background:
                tempColor(
                  item.temperature,
                ),
              height: '16px',
            }}
          />
        ),
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const outputSectionRef = useRef<HTMLDivElement | null>(null);
  const [
    rollingDates,
    setRollingDates,
  ] = useState<string[]>(
    DEFAULT_ROLLING_DATES,
  );

  const [
    predictedDate,
    setPredictedDate,
  ] = useState<string>(
    DEFAULT_PREDICTED_DATE,
  );
const [latestObservationDate, setLatestObservationDate] =
  useState('');

const [latestModelOutputDate, setLatestModelOutputDate] =
  useState('');

// Used to detect when the backend generates a newer output.
const latestModelOutputDateRef = useRef('');
  const [inputWindowDays, setInputWindowDays] = useState(7);
  const [
    referenceDateStr,
    setReferenceDateStr,
  ] = useState<string>(() => {
    const d = DEFAULT_REFERENCE_DATE;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [
    depths,
    setDepths,
  ] = useState<number[]>(
    DEFAULT_DEPTHS,
  );

  const [
    days,
    setDays,
  ] = useState<ForecastDay[]>([]);

  // The final index is the saved forecast target D. Its surface reference is
  // the last historical input only; the target variables come from model output.
  const [
    selectedDay,
    setSelectedDay,
  ] = useState(7);

  const [
    selectedDepth,
    setSelectedDepth,
  ] = useState(100);

  const [
    profileData,
    setProfileData,
  ] = useState<ProfilePoint[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    profileError,
    setProfileError,
  ] = useState<string | null>(
    null,
  );

  const [
    heatmapRefreshKey,
    setHeatmapRefreshKey,
  ] = useState(() => Date.now());

  // ───────────────────────────────────────────────────────────────────────────
  // Load real backend data
  // ───────────────────────────────────────────────────────────────────────────

  async function loadBackendData(customStartDate?: string) {
    try {
      setLoading(true);
      setError(null);

      const metadata = await fetchHeatmapAvailable();
      const availability = metadata as unknown as {
        input_window_days?: number;
        depths_m?: number[];
        available_dates?: string[];
        latest_observation_date?: string | null;
        latest_model_output_date?: string | null;
        live_availability?: {
          surface?: { dates?: string[]; latest_date?: string | null };
          subsurface_temperature?: { dates?: string[]; latest_date?: string | null };
        };
      };

      const surfaceDates = (availability.live_availability?.surface?.dates ?? [])
        .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      const outputDates = [
        ...new Set(
          (availability.live_availability?.subsurface_temperature?.dates ??
            availability.available_dates ?? [])
            .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)),
        ),
      ].sort();

      const latestOutput =
        availability.latest_model_output_date ??
        availability.live_availability?.subsurface_temperature?.latest_date ??
        outputDates[outputDates.length - 1] ??
        null;
      const latestObservation =
        availability.latest_observation_date ??
        availability.live_availability?.surface?.latest_date ??
        null;

      if (!latestOutput) {
        throw new Error(
          'The backend did not report any completed model-output dates.',
        );
      }

      setLatestObservationDate(latestObservation ?? 'Unavailable');
      setLatestModelOutputDate(latestOutput);
      latestModelOutputDateRef.current = latestOutput;

      const windowDays = Math.max(
        1,
        Math.floor(availability.input_window_days ?? 7),
      );
      setInputWindowDays(windowDays);

      // The selected date is a model-output/forecast target date D, not the last input day.
      const requestedDate = (customStartDate || latestOutput).slice(0, 10);
      let targetDate = requestedDate;

      if (targetDate.startsWith('2026-')) {
        // Never request a target beyond the newest saved output. If the selected
        // target is missing, step back to the newest output with valid input files.
        const candidates = (outputDates.length ? outputDates : [latestOutput])
          .filter(date => date <= targetDate)
          .reverse();
        const surfaceDateSet = new Set(surfaceDates);
        const validTarget = candidates.find(candidate => {
          const candidateDate = parseISO(candidate);
          if (Number.isNaN(candidateDate.getTime())) return false;
          const inputs = getRollingWindowDates(candidateDate, windowDays);
          return inputs.every(date =>
            !date.startsWith('2026-') || surfaceDateSet.has(date),
          );
        });

        if (!validTarget) {
          throw new Error(
            `No saved model output has a complete ${windowDays}-day input window on or before ${requestedDate}.`,
          );
        }
        targetDate = validTarget;
      } else if (targetDate > latestOutput) {
        targetDate = latestOutput;
      }

      const targetDateObject = getDynamicReferenceDate(targetDate);
      const formattedRefStr = formatDate(targetDateObject);
      const rolling = getRollingWindowDates(targetDateObject, windowDays);
      const predictionTargetDate = getPredictionTargetDate(targetDateObject);

      setReferenceDateStr(formattedRefStr);
      setRollingDates(rolling);
      setPredictedDate(predictionTargetDate);

      const backendDepths =
        Array.isArray(availability.depths_m) && availability.depths_m.length
          ? availability.depths_m
          : DEFAULT_DEPTHS;
      setDepths(backendDepths);
      setSelectedDepth(currentDepth =>
        backendDepths.includes(currentDepth)
          ? currentDepth
          : backendDepths[Math.floor(backendDepths.length / 2)] ?? 100,
      );

      console.log('[ForecastPage] Availability:', {
        latestObservation,
        latestOutput,
        selectedTarget: formattedRefStr,
        inputWindowDays: windowDays,
        inputDates: rolling,
        predictionTarget: predictionTargetDate,
      });

      // Request only real historical input dates. The target is loaded from the
      // saved model output via the profile/heatmap endpoints, not /api/surface.
      const loadedSurfaces = await Promise.all(
        rolling.map(async date => {
          const surface = await fetchSurface(date);
          if (!surface || !surface.variables) {
            throw new Error(`Backend returned no surface variables for ${date}.`);
          }
          return { date, surface: surface as SurfaceData };
        }),
      );

      const inputDays: ForecastDay[] = loadedSurfaces.map(item => ({
        date: item.date,
        surfaceDate: item.date,
        surface: item.surface,
        isPrediction: false,
      }));
      const latestInput = inputDays[inputDays.length - 1];

      if (!latestInput) {
        throw new Error('Backend returned no final input day for model inference.');
      }

      const backendDays: ForecastDay[] = [
        ...inputDays,
        {
          date: predictionTargetDate,
          surfaceDate: latestInput.date,
          // The target only has subsurface temperature output. Keep this reference
          // for input provenance; do not label its surface variables as target observations.
          surface: latestInput.surface,
          isPrediction: true,
        },
      ];

      setDays(backendDays);
      setHeatmapRefreshKey(Date.now());
      setSelectedDay(windowDays);
    } catch (err) {
      console.error('[ForecastPage] Live forecast loading failed:', err);
      setDays([]);
      setProfileData([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load the live forecast data.',
      );
    } finally {
      setLoading(false);
    }
  }

  // Refresh only when the backend reports a newer completed output.
  useEffect(() => {
    void loadBackendData();

    const checkForNewOutput = async () => {
      try {
        const metadata = await fetchHeatmapAvailable();
        const availability = metadata as unknown as {
          latest_observation_date?: string | null;
          latest_model_output_date?: string | null;
          available_dates?: string[];
          live_availability?: {
            surface?: { latest_date?: string | null };
            subsurface_temperature?: {
              dates?: string[];
              latest_date?: string | null;
            };
          };
        };
        const observedThrough =
          availability.latest_observation_date ??
          availability.live_availability?.surface?.latest_date;
        if (observedThrough) setLatestObservationDate(observedThrough);
        const outputDates = (
          availability.live_availability?.subsurface_temperature?.dates ??
          availability.available_dates ?? []
        ).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
        const newest =
          availability.latest_model_output_date ??
          availability.live_availability?.subsurface_temperature?.latest_date ??
          outputDates[outputDates.length - 1] ??
          '';

        if (newest && newest !== latestModelOutputDateRef.current) {
          console.log('[ForecastPage] New completed model output detected:', newest);
          await loadBackendData();
        }
      } catch (availabilityError) {
        console.warn('[ForecastPage] Availability check failed:', availabilityError);
      }
    };

    const intervalId = window.setInterval(() => {
      void checkForNewOutput();
    }, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkForNewOutput();
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Active backend data
  // ───────────────────────────────────────────────────────────────────────────

  const safeSelectedDay =
    Math.min(
      selectedDay,
      Math.max(
        0,
        days.length - 1,
      ),
    );

  const activeDay =
    days[safeSelectedDay] ??
    null;

  const activeSurface =
    activeDay?.surface ??
    null;

  // ───────────────────────────────────────────────────────────────────────────
  // Real surface variables
  // ───────────────────────────────────────────────────────────────────────────

  const activeSst =
    averageGrid(
      activeSurface?.variables?.sst,
    );

  const activeSss =
    averageGrid(
      activeSurface?.variables?.sss,
    );

  const activeSsh =
    averageGrid(
      activeSurface?.variables?.ssh,
    );

  const activeUWind =
    averageGrid(
      activeSurface?.variables?.u_wind,
    );

  const activeVWind =
    averageGrid(
      activeSurface?.variables?.v_wind,
    );

  const activeCurrentU =
    averageGrid(
      activeSurface?.variables?.current_u,
    );

  const activeCurrentV =
    averageGrid(
      activeSurface?.variables?.current_v,
    );

  const activeWindSpeed =
    vectorMagnitude(
      activeUWind,
      activeVWind,
    );

  const activeCurrentSpeed =
    vectorMagnitude(
      activeCurrentU,
      activeCurrentV,
    );

  const modelSurfaceTemperature =
    profileData.find(
      item => item.depth === 0,
    )?.temperature ?? null;

  const activeLatitude =
    activeSurface?.lat?.length
      ? average(
          activeSurface.lat,
        )
      : 17.5;

  const activeLongitude =
    activeSurface?.lon?.length
      ? average(
          activeSurface.lon,
        )
      : 75.0;

  // The domain centre (17.5N, 75E) is over land in India, so it is not
  // guaranteed to be a valid ocean cell after the backend ocean mask is applied.
  // Use a fixed, exact 0.25° ocean-grid point for the model profile.
  // 15.00N, 80.00E lies in the Bay of Bengal and is on the model grid.
const profileLatitude = 15.0;
const profileLongitude = 81.0;
  // ───────────────────────────────────────────────────────────────────────────
  // REAL backend model depth profile
  // ───────────────────────────────────────────────────────────────────────────

  async function loadProfile(
    date: string,
  ) {
    try {
      setProfileLoading(true);
      setProfileError(null);
      setProfileData([]);

      console.log(
        `[ForecastPage] Loading REAL CNN + Swin + 7-day ConvGRU profile for ${date}`,
      );

      // This endpoint reads the real model prediction generated by the backend.
      // No synthetic/physics-guided profile is used here.
      const response =
        await fetchOceanProfile(
          date,
          profileLatitude,
          profileLongitude,
        );

      if (
        !response ||
        response.success === false ||
        !Array.isArray(response.depths_m) ||
        !Array.isArray(response.temperature_C)
      ) {
        throw new Error(
          `Backend returned an invalid model profile for ${date}.`,
        );
      }

      const result: ProfilePoint[] =
        response.depths_m
          .map((depth, index) => ({
            depth,
            temperature:
              response.temperature_C[index],
          }))
          .filter(
            (
              item,
            ): item is ProfilePoint =>
              typeof item.temperature === 'number' &&
              Number.isFinite(item.temperature),
          );

      if (!result.length) {
        throw new Error(
          `Backend returned no finite model temperatures for ${date}.`,
        );
      }

      setProfileData(result);
    } catch (err) {
      console.error(
        '[ForecastPage] Real model profile request failed:',
        err,
      );

      // Never fabricate model values when the backend fails.
      setProfileData([]);
      setProfileError(
        err instanceof Error
          ? err.message
          : 'Failed to load the real model depth profile.',
      );
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (!activeDay) {
      return;
    }

    loadProfile(
      activeDay.isPrediction
        ? referenceDateStr
        : activeDay.date,
    );
  }, [
    activeDay?.date,
    activeDay?.isPrediction,
    referenceDateStr,
    profileLatitude,
    profileLongitude,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Current production heatmap URL
  // ───────────────────────────────────────────────────────────────────────────

  const inferenceDate =
    activeDay
      ? (activeDay.isPrediction
        ? referenceDateStr
        : activeDay.date)
      : referenceDateStr;

  const heatmapUrl =
    activeDay
      ? `${getHeatmapUrl(
          inferenceDate,
          selectedDepth,
        )}?v=${heatmapRefreshKey}`
      : '';

  // ───────────────────────────────────────────────────────────────────────────
  // REAL backend surface trend
  // ───────────────────────────────────────────────────────────────────────────

  const trendData =
    useMemo(
      () =>
        days.filter(day => !day.isPrediction).map((day, idx) => {
          const surface =
            day.surface;

          const sst =
            averageGrid(
              surface?.variables?.sst,
            );

          const ssh =
            averageGrid(
              surface?.variables?.ssh,
            );

          const wind =
            vectorMagnitude(
              averageGrid(
                surface?.variables?.u_wind,
              ),
              averageGrid(
                surface?.variables?.v_wind,
              ),
            );

          const current =
            vectorMagnitude(
              averageGrid(
                surface?.variables?.current_u,
              ),
              averageGrid(
                surface?.variables?.current_v,
              ),
            );

          return {
            date: day?.date
              ? format(
                  parseISO(
                    day.date,
                  ),
                  'MMM d',
                )
              : `Day ${idx + 1}`,
            SST: +sst.toFixed(2),
            SSH: +ssh.toFixed(2),
            Wind: +wind.toFixed(2),
            Current:
              +current.toFixed(2),
          };
        }),
      [days],
    );

  // ───────────────────────────────────────────────────────────────────────────
  // Loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <PageHeader
            category="SPATIO-TEMPORAL FORECAST"
            badge={
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border-2 border-[#005088] text-[#005088] text-xs font-mono font-bold shadow-md">
                <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                LOADING OCEANBED DATA...
              </div>
            }
            title="7-Day Subsurface Temperature Forecast"
            subtitle="Loading production model parameters and 15-depth temporal projections from backend..."
            icon={
              <Calendar
                size={18}
                className="text-cyan-400"
              />
            }
          />

          <div className="bg-white border-2 border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center shadow-md">
            <Loader2
              size={36}
              className="text-[#005088] animate-spin mb-4"
            />
            <p className="text-slate-900 font-black text-lg">
              Connecting to production backend...
            </p>
            <p className="text-slate-600 font-medium text-xs mt-2">
              Loading backend surface data and model metadata
            </p>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Error state
  // ───────────────────────────────────────────────────────────────────────────

  if (
    error ||
    !activeDay ||
    !activeSurface
  ) {
    return (
      <PageLayout>
        <PageContainer>
          <PageHeader
            category="SPATIO-TEMPORAL FORECAST"
            badge={
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border-2 border-red-500 text-red-200 text-xs font-mono font-bold shadow-md">
                <AlertTriangle size={14} className="text-red-400" />
                BACKEND OFFLINE
              </div>
            }
            title="7-Day Subsurface Temperature Forecast"
            subtitle="Backend connection error · unable to stream ConvGRU temporal projections"
            icon={
              <Calendar
                size={18}
                className="text-cyan-400"
              />
            }
          />

          <div className="bg-white border-2 border-red-300 rounded-2xl p-8 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle
                size={24}
                className="text-red-400"
              />
              <h2 className="text-lg font-black text-slate-900">
                Could not load forecast data
              </h2>
            </div>

            <p className="text-sm text-red-700 mb-4 font-medium">
              {error || 'The backend did not return the required data.'}
            </p>

            <p className="text-xs text-slate-600 font-mono mb-5">
              Backend: {getBackendUrl()}
            </p>

            <button
              onClick={() => loadBackendData()}
              className="btn-primary-cyan"
            >
              <RefreshCw size={14} />
              Retry Connection
            </button>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main UI
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          category="SPATIO-TEMPORAL PROGNOSTIC ENGINE"
          badge={
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border-2 border-cyan-400 text-cyan-200 text-xs font-mono font-bold shadow-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              {inputWindowDays} HISTORICAL INPUT DAYS → FORECAST TARGET
            </div>
          }
          icon={<Calendar size={18} className="text-cyan-400" />}
          title="7-Day Subsurface Temperature Forecast"
          subtitle={`CNN + Swin + ConvGRU · ${inputWindowDays} historical input days (${rollingDates[0]} → ${rollingDates[rollingDates.length - 1]}) · forecast target: ${predictedDate}`}
          actions={
            <div className="flex items-center gap-2">


            </div>
          }
        />

        {/* Live-data availability note */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <h3 className="font-bold text-sm">Live Data Availability</h3>
          <p className="mt-1 text-sm leading-6">
            Surface observations are available through <strong>{latestObservationDate || 'checking availability'}</strong>.
            Saved subsurface-temperature model outputs are available through <strong>{latestModelOutputDate || 'checking availability'}</strong>.
            This page loads the latest completed target by default and uses the backend-reported {inputWindowDays}-day input window before that target.
            Dates after the latest available output are not treated as observed data or shown as completed predictions. Marine heatwave and seasonal products are shown only where their outputs exist; cyclone predictions are currently unavailable.
          </p>
        </div>

        {/* Backend status */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold font-mono">
                  ConvGRU Sliding Window Pipeline Active
                </span>
              </div>
              <p className="text-sm text-slate-700 font-medium">
                Active Input Dataset:{' '}
                <span className="text-[#005088] font-semibold font-mono">
                  {activeSurface.source}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {getBackendUrl()}
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Saved model output: <span className="font-mono font-semibold text-[#005088] break-all">
                  {predictedDate.startsWith('2026-')
                    ? `data/live_2026/outputs/temperature/${predictedDate}/subsurface_temperature_15depth.pt`
                    : `Historical model inference for ${predictedDate}`}
                </span>
              </p>
            </div>

            <button
              onClick={() => loadBackendData()}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:text-[#005088] hover:bg-slate-50 transition cursor-pointer bg-white shadow-sm"
            >
              <RefreshCw size={14} />
              Refresh Backend Data
            </button>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            {
              label: 'Historical Window',
              value: `${inputWindowDays} Days (Input Context)`,
            },
            {
              label: 'Model Prediction',
              value: 'Forecast Target',
            },
            {
              label: 'Last Input Date',
              value: rollingDates[rollingDates.length - 1] ?? '—',
            },
            {
              label: 'Prediction Output',
              value: predictedDate,
            },
            {
              label: 'Depth Layers',
              value: `${depths.length} (${Math.min(...depths)}–${Math.max(...depths)}m)`,
            },
            {
              label: 'Model Architecture',
              value: 'CNN + Swin + ConvGRU',
            },
          ].map(
            ({
              label,
              value,
            }) => (
              <div
                key={label}
                className="rounded-xl px-3.5 py-2 border border-slate-200 bg-white text-xs shadow-sm"
              >
                <span className="text-slate-600 font-medium">
                  {label}:{' '}
                </span>
                <span className="text-[#005088] font-bold font-mono">
                  {value}
                </span>
              </div>
            ),
          )}
        </div>

        {/* ── 1. HISTORICAL 6-DAY INPUT SEQUENCE ──────────────── */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 mb-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005088] shadow-sm">
                <Clock size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                    {inputWindowDays} Historical Input Days
                  </h3>
                  <span className="text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-[#005088] border border-blue-200 shadow-sm">
                    MODEL INPUT CONTEXT
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Sequential ocean observations supplied to the production model input window
                </p>
              </div>
            </div>

            {/* Date Picker & Reset Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm">
                <span className="text-[#005088] font-bold uppercase tracking-wider text-[11px]">
                  Target Date:
                </span>
                <input
                  type="date"
                  min="2018-01-07"
                  max={latestModelOutputDate || undefined}
                  value={referenceDateStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      loadBackendData(e.target.value);
                    }
                  }}
                  className="bg-transparent text-slate-900 font-black text-xs font-mono outline-none cursor-pointer"
                  title="Select reference/target date"
                />
              </div>

            </div>
          </div>

          {/* Historical input cards reported by the backend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {rollingDates.map((dateStr, idx) => {
              const isSelected = safeSelectedDay === idx;
              const dayObj = days[idx];
              const sstVal = dayObj?.surface?.variables?.sst ? averageGrid(dayObj.surface.variables.sst) : null;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(idx)}
                  className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-cyan-400 bg-[#0f2147] scale-[1.03] shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                      : 'border-slate-700/90 bg-[#060e1f] hover:border-cyan-400/70 hover:bg-[#0c1834] shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="bg-slate-200 text-slate-700 border border-slate-300 font-black px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider">
                      INPUT
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] font-bold">
                      Day {idx + 1}
                    </span>
                  </div>

                  <span className="text-lg font-black text-slate-900 font-mono tracking-tight mt-0.5">
                    {format(parseISO(dateStr), 'MMM dd')}
                  </span>

                  <span className="text-xs font-mono text-slate-600 font-bold">
                    {dateStr}
                  </span>

                  <div
                    className="mt-0.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono font-black text-xs shadow-sm"
                    style={{ color: sstVal !== null ? tempColor(sstVal) : '#64748b' }}
                  >
                    {sstVal !== null ? `${sstVal.toFixed(1)}°C` : '—'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── VISUAL PIPELINE BRIDGE (MODEL CONVGRU) ──────────────── */}
        <div className="flex items-center justify-center my-3">
          <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-mono text-slate-700">
            <span className="font-bold text-slate-700">{inputWindowDays} Input Days ({rollingDates[0]} → {rollingDates[rollingDates.length - 1]})</span>
            <ArrowRight size={14} className="text-cyan-400 animate-pulse" />
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-blue-50 border border-blue-200 font-black text-[#005088]">
              <Cpu size={13} className="text-cyan-400" />
              ConvGRU Prognostic Model
            </div>
            <ArrowRight size={14} className="text-cyan-400 animate-pulse" />
            <span className="font-bold text-[#005088]">Forecast Target ({predictedDate})</span>
          </div>
        </div>

        {/* ── 2. MODEL PREDICTION OUTPUT (7TH DAY TARGET) ──────────────── */}
        <div ref={outputSectionRef} className="bg-white rounded-2xl p-6 border-2 border-[#005088] mb-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005088] shadow-sm">
                <Activity size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
                    Model Prediction Output
                  </h2>
                  <span className="text-[11px] font-mono font-black px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#005088] shadow-sm">
                    PREDICTED
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  Deep ConvGRU spatio-temporal projection using the backend-reported {inputWindowDays}-day input window
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005088] bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Predicted Target Date: {predictedDate}</span>
            </div>
          </div>

          {/* Single Prediction Target Card */}
          {days[inputWindowDays] && (
            <div
              onClick={() => setSelectedDay(inputWindowDays)}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                safeSelectedDay === inputWindowDays
                  ? 'border-cyan-300 bg-white shadow-[0_6px_24px_rgba(14,165,233,0.12)]'
                  : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/30 shadow-sm'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 text-[#005088] flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] font-mono text-[#005088] font-bold uppercase">OUTPUT</span>
                    <span className="text-xs font-black text-[#005088]">TARGET</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                        {format(parseISO(predictedDate), 'MMMM dd, yyyy')}
                      </span>
                      <span className="text-xs font-black font-mono px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm">
                        PREDICTED TARGET
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono mt-1 font-medium">
                      Subsurface 15-Layer Thermal Reconstruction for Date: {predictedDate}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase">Model SST (0m)</span>
                    <span className="text-[#005088] font-black text-base">
                      {modelSurfaceTemperature !== null ? `${modelSurfaceTemperature.toFixed(2)}°C` : '—'}
                    </span>
                  </div>

                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase">Last Input SSH (Observed)</span>
                    <span className="text-emerald-700 font-black text-base">
                      {averageGrid(days[inputWindowDays - 1]?.surface?.variables?.ssh).toFixed(1)} cm
                    </span>
                  </div>

                  <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase">Last Input Wind (Observed)</span>
                    <span className="text-amber-700 font-black text-base">
                      {vectorMagnitude(
                        averageGrid(days[inputWindowDays - 1]?.surface?.variables?.u_wind),
                        averageGrid(days[inputWindowDays - 1]?.surface?.variables?.v_wind)
                      ).toFixed(1)} m/s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main data grid */}
        <div id="forecast-visual-output" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 scroll-mt-6">
          {/* Heatmap */}
          <div className="rounded-2xl p-6 border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Layers size={16} className="text-cyan-400" />
                  Model-Generated Temperature Heatmap
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  {safeSelectedDay === inputWindowDays ? `Forecast Target · ${predictedDate}` : `Historical Input Day (Day ${safeSelectedDay + 1}) · ${activeDay?.date ?? ''}`}
                </p>
              </div>

              <select
                value={selectedDepth}
                onChange={event =>
                  setSelectedDepth(
                    Number(event.target.value),
                  )
                }
                className="bg-white border border-slate-300 text-slate-900 font-mono text-xs rounded-xl px-3 py-1.5 shadow-sm outline-none cursor-pointer"
              >
                {depths.map(depth => (
                  <option key={depth} value={depth}>
                    {depth} m
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
              <img
                key={heatmapUrl}
                src={heatmapUrl}
                alt={`${selectedDepth}m model-generated temperature heatmap`}
                className="w-full h-auto min-h-[320px] object-contain"
                loading="eager"
                onError={event => {
                  event.currentTarget.style.display = 'none';
                  const errorBox = event.currentTarget.parentElement?.querySelector('.heatmap-error') as HTMLElement | null;
                  if (errorBox) {
                    errorBox.style.display = 'flex';
                  }
                }}
              />

              <div className="heatmap-error hidden min-h-[320px] items-center justify-center text-center p-6 bg-slate-950/95">
                <div>
                  <p className="text-amber-300 text-sm font-bold mb-2">
                    Heatmap visualization stream for forecast {predictedDate}
                  </p>
                  <p className="text-slate-200 text-xs font-mono">
                    Depth layer: {selectedDepth}m · Model-generated ConvGRU spatio-temporal field
                  </p>
                  <p className="text-cyan-400 text-xs font-mono mt-2 break-all bg-black/70 p-2 rounded border border-white/15">
                    {heatmapUrl}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-3 text-xs text-slate-600 font-mono font-semibold">
              <span className="text-[#005088] font-bold">{safeSelectedDay === inputWindowDays ? predictedDate : activeDay.date}</span>
              <span>{selectedDepth} m</span>
              <span className="text-emerald-700">ConvGRU Model</span>
            </div>
          </div>

          {/* Depth profile */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              Model Depth Profile (0–1000m)
            </h2>
            <p className="text-xs text-slate-600 mb-1 font-medium">
              Thermal reconstruction for {safeSelectedDay === inputWindowDays ? predictedDate : activeDay.date}
            </p>
            <p className="text-[11px] text-slate-500 mb-4 font-mono">
              Representative ocean grid point: {profileLatitude.toFixed(2)}°N, {profileLongitude.toFixed(2)}°E
            </p>

            {profileLoading ? (
              <div className="h-[320px] flex flex-col items-center justify-center">
                <Loader2 size={28} className="text-cyan-400 animate-spin mb-3" />
                <p className="text-xs text-slate-600 font-medium">Loading depth profile...</p>
              </div>
            ) : profileError ? (
              <div className="h-[320px] flex flex-col items-center justify-center text-center px-4">
                <AlertTriangle size={26} className="text-red-400 mb-3" />
                <p className="text-xs text-red-300">{profileError}</p>
              </div>
            ) : profileData.length === 0 ? (
              <div className="h-[320px] flex items-center justify-center">
                <p className="text-xs text-slate-600">No profile data returned</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={profileData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    type="number"
                    domain={['auto', 'auto']}
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    label={{
                      value: 'Temperature (°C)',
                      fill: '#475569',
                      fontSize: 10,
                      position: 'insideBottom',
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="depth"
                    reversed
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={{ fill: '#06b6d4', r: 3.5 }}
                    name="Model Temperature (°C)"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Backend surface data */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                Surface Observations &amp; Telemetry
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'SST',
                    value: `${activeSst.toFixed(2)} °C`,
                    icon: Thermometer,
                    className: 'text-red-400 font-bold',
                  },
                  {
                    label: 'SSS',
                    value: `${activeSss.toFixed(2)} PSU`,
                    icon: Droplets,
                    className: 'text-blue-400 font-bold',
                  },
                  {
                    label: 'SSH',
                    value: `${activeSsh.toFixed(2)} cm`,
                    icon: Waves,
                    className: 'text-cyan-300 font-bold',
                  },
                  {
                    label: 'Wind',
                    value: `${activeWindSpeed.toFixed(2)} m/s`,
                    icon: Wind,
                    className: 'text-emerald-400 font-bold',
                  },
                  {
                    label: 'Current',
                    value: `${activeCurrentSpeed.toFixed(2)} m/s`,
                    icon: Activity,
                    className: 'text-purple-400 font-bold',
                  },
                  {
                    label: 'Latitude',
                    value: `${activeLatitude.toFixed(2)}°N`,
                    icon: MapPin,
                    className: 'text-cyan-200 font-bold',
                  },
                ].map(({ label, value, icon: Icon, className }) => (
                  <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mb-1">
                      <Icon size={12} className="text-cyan-400" />
                      {label}
                    </div>
                    <p className={`font-mono text-sm ${className}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">
                <p className="text-[11px] text-slate-600 font-medium">Data Pipeline Source</p>
                <p className="text-xs text-cyan-700 font-mono font-bold mt-0.5 break-all">
                  {activeSurface.source}
                </p>
              </div>
            </div>

            {/* Mini profile column */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                Subsurface Temperature Profile (15 Depth Layers)
              </h3>

              {profileData.length > 0 ? (
                <div className="grid grid-cols-[70px_1fr] gap-4 items-center">
                  <DepthColumn values={profileData} />
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                    {profileData.map(item => (
                      <div key={item.depth} className="flex justify-between text-xs font-mono py-0.5 border-b border-slate-100">
                        <span className="text-slate-700 font-semibold">{item.depth}m</span>
                        <span className="font-bold" style={{ color: tempColor(item.temperature) }}>
                          {item.temperature.toFixed(2)}°C
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-600 py-8 text-center">
                  Profile unavailable
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Backend surface trend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-1">
              SST / SSH Spatio-Temporal Evolution
            </h3>
            <p className="text-xs text-slate-600 mb-4 font-medium">
              {inputWindowDays}-day input sequence leading into the saved forecast target
            </p>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="SST"
                  stroke="#ef4444"
                  fill="rgba(239,68,68,0.25)"
                  strokeWidth={2.5}
                  name="SST (°C)"
                />
                <Area
                  type="monotone"
                  dataKey="SSH"
                  stroke="#06b6d4"
                  fill="rgba(6,182,212,0.2)"
                  strokeWidth={2}
                  name="SSH (cm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-1">
              Wind &amp; Current Dynamic Vectors
            </h3>
            <p className="text-xs text-slate-600 mb-4 font-medium">
              Kinematic forcing across the 7-day temporal window
            </p>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Wind"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ fill: '#22c55e', r: 3.5 }}
                  name="Wind (m/s)"
                />
                <Line
                  type="monotone"
                  dataKey="Current"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: '#a855f7', r: 3.5 }}
                  name="Current (m/s)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical input & prediction-target heatmap thumbnails */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 mb-6 shadow-sm">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-1">
            <Layers size={16} className="text-cyan-400" />
            Sequential Model Heatmap Snapshots ({inputWindowDays} Input Days + 1 Prediction Target)
          </h2>
          <p className="text-xs text-slate-600 mb-5 font-medium">
            2D horizontal thermal slice at depth {selectedDepth} m across the input window and target
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {days.map((day, index) => {
              const isPred = day.isPrediction;
              const dayInferenceDate = isPred ? referenceDateStr : day.date;
              const imageUrl = `${getHeatmapUrl(dayInferenceDate, selectedDepth)}?v=${heatmapRefreshKey}`;
              const fallbackUrl = `${getHeatmapUrl(referenceDateStr, selectedDepth)}?v=${heatmapRefreshKey}`;

              return (
                <button
                  key={`${day.date}-${selectedDepth}`}
                  onClick={() => setSelectedDay(index)}
                  className={`overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
                    safeSelectedDay === index
                      ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 scale-[1.02]'
                      : isPred
                      ? 'border-cyan-500/80 bg-cyan-950/50 hover:border-cyan-400'
                      : 'border-slate-700/80 bg-[#060e1f] hover:border-slate-500'
                  }`}
                >
                  <div className="bg-black/60 aspect-[1.8/1] flex items-center justify-center relative overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={`${selectedDepth}m heatmap for ${day.date}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== fallbackUrl) {
                          e.currentTarget.src = fallbackUrl;
                        }
                      }}
                    />
                  </div>

                  <div className="px-2.5 py-2 bg-white border-t border-slate-200 text-left">
                    <p className={`text-[10px] font-mono font-bold ${isPred ? 'text-[#005088]' : 'text-slate-600'}`}>
                      {isPred ? 'PREDICTED TARGET' : `INPUT (Day ${index + 1})`}
                    </p>
                    <p className="text-xs text-slate-900 font-bold font-mono">
                      {format(parseISO(day.date), 'MMM dd')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {depths.map(depth => (
              <button
                key={depth}
                onClick={() => setSelectedDepth(depth)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                  selectedDepth === depth
                    ? 'border-cyan-400 bg-cyan-500/30 text-cyan-200 shadow-sm'
                    : 'border-slate-700 bg-[#050b18] text-slate-300 hover:border-slate-500'
                }`}
              >
                {depth}m
              </button>
            ))}
          </div>
        </div>

        {/* Backend summary table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              Input Window &amp; Forecast Target Telemetry Summary
            </h3>
            <p className="text-xs text-slate-200 mt-1 font-medium">
              Multi-parameter oceanic observation variables and 24-hour neural forecast
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  {['Sequence Step', 'Calendar Date', 'SST (°C)', 'SSS (PSU)', 'SSH (cm)', 'Wind (m/s)', 'Current (m/s)', 'Source'].map(
                    heading => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-slate-800 font-bold whitespace-nowrap text-xs font-mono uppercase tracking-wider"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {days.map((day, index) => {
                  const surface = day.surface;
                  const sst = day.isPrediction ? Number.NaN : averageGrid(surface?.variables?.sst);
                  const sss = day.isPrediction ? Number.NaN : averageGrid(surface?.variables?.sss);
                  const ssh = day.isPrediction ? Number.NaN : averageGrid(surface?.variables?.ssh);
                  const wind = day.isPrediction ? Number.NaN : vectorMagnitude(
                    averageGrid(surface?.variables?.u_wind),
                    averageGrid(surface?.variables?.v_wind)
                  );
                  const current = day.isPrediction ? Number.NaN : vectorMagnitude(
                    averageGrid(surface?.variables?.current_u),
                    averageGrid(surface?.variables?.current_v)
                  );
                  const isPred = index === inputWindowDays;

                  return (
                    <tr
                      key={day.date}
                      onClick={() => setSelectedDay(index)}
                      className={`border-b border-slate-200 cursor-pointer transition-all ${
                        safeSelectedDay === index
                          ? 'bg-cyan-500/25 font-semibold'
                          : isPred
                          ? 'bg-cyan-950/40 hover:bg-cyan-900/40'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                        {isPred ? (
                          <span className="text-[#005088] font-black px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                            ★ PREDICTED TARGET
                          </span>
                        ) : (
                          <span className="text-slate-700 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            INPUT (Day {index + 1})
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-900 font-mono font-black whitespace-nowrap text-xs">
                        {format(parseISO(day.date), 'MMM dd, yyyy')}
                      </td>

                      <td
                        className="px-4 py-3 font-mono font-bold text-sm"
                        style={{ color: tempColor(sst) }}
                      >
                        {Number.isFinite(sst) ? `${sst.toFixed(2)}°C` : '—'}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-blue-700">
                        {Number.isFinite(sss) ? sss.toFixed(2) : '—'}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-[#005088]">
                        {Number.isFinite(ssh) ? ssh.toFixed(2) : '—'}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                        {Number.isFinite(wind) ? wind.toFixed(2) : '—'}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-purple-700">
                        {Number.isFinite(current) ? current.toFixed(2) : '—'}
                      </td>

                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                        {isPred ? `${surface.source} · latest input ${day.surfaceDate}` : surface.source}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
}