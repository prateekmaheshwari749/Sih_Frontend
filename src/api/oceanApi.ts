/**
 * oceanApi.ts
 * API service layer for the OceanBed production backend.
 *
 * Backend base URL is controlled centrally via backendConfig
 * (VITE_API_BASE_URL, default http://127.0.0.1:8000).
 *
 * Current backend routes:
 *
 *   POST /chat
 *   GET  /health
 *   GET  /models
 *   GET  /metrics/summary
 *   GET  /api/report/{name}
 *   GET  /api/surface/{date}
 *   GET  /api/heatmap/available
 *   GET  /api/heatmap/{date}/{depth_m}
 *   GET  /api/heatmap/{date}/{depth_m}/json
 *   GET  /explain/model
 *   GET  /explain/depth/{depth}
 *
 * Embedding comparison route expected by the frontend:
 *
 *   POST /api/embeddings/compare
 */

import { getBackendUrl } from './backendConfig'

export { getBackendUrl }

const getBase = () => getBackendUrl()



// ─────────────────────────────────────────────────────────────────────────────
// Dataset date range
// ─────────────────────────────────────────────────────────────────────────────

const DATASET_START =
  '2018-01-01'

const DATASET_END =
  '2026-09-18'

const DEFAULT_DATE =
  '2026-09-18'



// ─────────────────────────────────────────────────────────────────────────────
// Date helper
// ─────────────────────────────────────────────────────────────────────────────

function clampDate(
  date: string,
): string {
  if (
    !date ||
    date.length < 10
  ) {
    return DEFAULT_DATE
  }

  const safeDate =
    date.slice(0, 10)

  if (
    safeDate <
    DATASET_START
  ) {
    return DATASET_START
  }

  if (
    safeDate >
    DATASET_END
  ) {
    return DATASET_END
  }

  return safeDate
}



// ─────────────────────────────────────────────────────────────────────────────
// Depth helper
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDepth(
  depth: number,
): number {
  if (
    !Number.isFinite(depth)
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.round(depth),
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Shared fetch helper
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const controller =
    new AbortController()

  const timer =
    setTimeout(() => {
      controller.abort()
    }, 120_000)

  try {
    let response: Response

    try {
      response = await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal,
        },
      )
    } catch (error) {
      // Auto-failover: If contacting 127.0.0.1 fails (e.g. CORS or loopback mismatch),
      // seamlessly retry with localhost or relative path via Vite dev proxy
      let altUrl: string | null = null
      if (url.startsWith('http://127.0.0.1:8000')) {
        altUrl = url.replace('http://127.0.0.1:8000', 'http://localhost:8000')
      } else if (url.startsWith('http://localhost:8000')) {
        altUrl = url.replace('http://localhost:8000', 'http://127.0.0.1:8000')
      }

      let fallbackRes: Response | null = null
      if (altUrl) {
        try {
          fallbackRes = await fetch(altUrl, { ...options, signal: controller.signal })
        } catch {
          // If both absolute hosts fail, try relative path via Vite dev proxy
          const rel = url.replace(/^https?:\/\/[^/]+/, '')
          if (rel && rel !== url) {
            try {
              fallbackRes = await fetch(rel, { ...options, signal: controller.signal })
            } catch {
              // ignore
            }
          }
        }
      } else {
        const rel = url.replace(/^https?:\/\/[^/]+/, '')
        if (rel && rel !== url) {
          try {
            fallbackRes = await fetch(rel, { ...options, signal: controller.signal })
          } catch {
            // ignore
          }
        }
      }

      if (fallbackRes) {
        response = fallbackRes
      } else {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          throw new Error(`Request timed out after 30 seconds: ${url}`)
        }
        if (error instanceof Error) {
          throw new Error(`Network error while contacting backend: ${error.message}`)
        }
        throw new Error(`Network error while contacting backend: ${url}`)
      }
    }

    // Smart route tolerance: if 404, check alternate route prefix (/api vs direct)
    if (response.status === 404) {
      let altRoute: string | null = null
      if (url.includes('/api/health')) altRoute = url.replace('/api/health', '/health')
      else if (url.includes('/health')) altRoute = url.replace('/health', '/api/health')
      else if (url.includes('/api/metrics/summary')) altRoute = url.replace('/api/metrics/summary', '/metrics/summary')
      else if (url.includes('/metrics/summary')) altRoute = url.replace('/metrics/summary', '/api/metrics/summary')
      else if (url.includes('/api/report/')) altRoute = url.replace('/api/report/', '/report/')
      else if (url.includes('/api/surface/')) altRoute = url.replace('/api/surface/', '/surface/')
      else if (url.includes('/api/embeddings/compare')) altRoute = url.replace('/api/embeddings/compare', '/embeddings/compare')
      else if (url.includes('/api/chat')) altRoute = url.replace('/api/chat', '/chat')
      else if (url.includes('/chat')) altRoute = url.replace('/chat', '/api/chat')

      if (altRoute && altRoute !== url) {
        const retryRes = await fetch(altRoute, {
          ...options,
          signal: controller.signal,
        }).catch(() => null)

        if (retryRes && retryRes.ok) {
          response = retryRes
        }
      }
    }

    const contentType =
      response.headers.get(
        'content-type',
      ) ?? ''

    const bodyText =
      await response
        .text()
        .catch(() => '')

    if (
      !response.ok
    ) {
      throw new Error(
        `Backend HTTP ${response.status} ${response.statusText
        }: ${bodyText.slice(
          0,
          500,
        )}`,
      )
    }

    if (
      !bodyText
    ) {
      return undefined as T
    }

    if (
      contentType.includes(
        'application/json',
      ) ||
      bodyText.trimStart().startsWith(
        '{',
      ) ||
      bodyText.trimStart().startsWith(
        '[',
      )
    ) {
      try {
        return JSON.parse(
          bodyText,
        ) as T
      } catch {
        throw new Error(
          `Backend returned invalid JSON from ${url}`,
        )
      }
    }

    /*
     * Some endpoints, especially image routes,
     * are not JSON. Those should not normally use
     * apiFetch(), but returning the text here makes
     * diagnostics much clearer.
     */
    return bodyText as T
  } finally {
    clearTimeout(timer)
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatResponse {
  reply: string
  source: string
  model: string
  grounded?: boolean
  fallback?: boolean
  groq_error?: string
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatContext {
  route?: string
  page_title?: string
  selected_date?: string
  latitude?: number
  longitude?: number
  depth_m?: number
  [key: string]: unknown
}

// src/api/oceanApi.ts

export interface OceanProfileResponse {
  success: boolean;
  date: string;
  forecast_date: string;

  input_window: {
    start: string;
    end: string;
    days: number;
  };

  requested_location: {
    latitude: number;
    longitude: number;
  };

  nearest_grid_location: {
    latitude: number;
    longitude: number;
  };

  depths_m: number[];
  temperature_C: (number | null)[];

  model: string;
}

export async function getOceanProfile(
  date: string,
  latitude: number,
  longitude: number,
): Promise<OceanProfileResponse> {

  const url =
    `${getBase()}/api/ocean/profile/` +
    `${date}/${latitude}/${longitude}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ocean profile request failed (${response.status}): ${errorText}`,
    );
  }

  return response.json();
}


export interface MetricsBlock {
  rmse_C: number | null
  mae_C: number | null
  bias_C: number | null
  correlation: number | null
}


export interface MetricsSummary {
  validation_2023: MetricsBlock

  final_test_2024_2025: MetricsBlock
}


export interface DepthwiseMetric {
  depth_m: number
  rmse_C: number
  mae_C: number
  bias_C: number
  correlation: number
  n: number
}


export interface ReportResponse {
  overall_metrics?: {
    rmse_C: number
    mae_C: number
    bias_C: number
    correlation: number
    n_valid: number
  }

  depthwise_metrics?: DepthwiseMetric[]

  [key: string]: unknown
}


export interface SurfaceResponse {
  date: string

  lat: number[]

  lon: number[]

  source: string

  variables: {
    sst: number[][]
    sss: number[][]
    ssh: number[][]
    u_wind: number[][]
    v_wind: number[][]
    current_u: number[][]
    current_v: number[][]
  }
}


export interface HealthResponse {
  status: string
  device: string
  cnn_loaded: boolean
  swin_loaded: boolean
  convgru_loaded: boolean

  /*
   * Optional fields because your newer
   * backend /health response may include them.
   */
  ocean_mask_exists?: boolean
  backend_checks_pass?: boolean

  torch?: {
    installed?: boolean
    version?: string
    cuda_available?: boolean
    cuda_version?: string | null
    gpu_name?: string | null

    [key: string]: unknown
  }

  [key: string]: unknown
}


export interface HeatmapAvailableResponse {
  depths_m: number[]
  input_window_days: number
  input_shape: number[]
  output_shape: number[]
  variables: string[]
  available_dates?: string[]
}


/**
 * Flexible JSON response for the production heatmap endpoint.
 *
 * Your frontend now safely supports:
 *
 *   prediction_C
 *   prediction
 *   data
 *   mean_C
 *   min_C
 *   max_C
 *
 * The backend may return a 2D grid, 1D array,
 * or an already-computed scalar.
 */
export interface HeatmapJsonResponse {
  success?: boolean
  date?: string
  forecast_date?: string
  depth_m?: number
  depth_index?: number
  lat?: number[]
  lon?: number[]
  values_C?: number[][]
  prediction_C?: unknown
  prediction?: unknown
  data?: unknown
  shape?: number[]
  input_window?: {
    start?: string
    end?: string
    days?: number
  }
  grid_shape?: number[]
  min_C?: number | null
  max_C?: number | null
  mean_C?: number | null
  finite_fraction?: number
  units?: string
  [key: string]: unknown
}



// ─────────────────────────────────────────────────────────────────────────────
// Embedding comparison types
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingPoint {
  x: number;
  y: number;
  z?: number;
  label?: string;
  depth?: number;
  date?: string;
  [key: string]: unknown;
}

export interface EmbeddingResult {
  model: string;
  status?: string;
  experimental?: boolean;
  feature_shape?: number[];
  embedding_shape?: number[];
  embedding_dimension?: number;
  samples?: number;
  dates?: string[];
  embeddings?: number[][];
  coordinates?: number[][];
  explained_variance?: number[];
  pooling?: string;
  coordinates_method?: string;
  message?: string;
  points?: EmbeddingPoint[];
  [key: string]: unknown;
}

export interface EmbeddingCompareRequest {
  models?: string[];
  method?: string;
  depth_m?: number;
  date?: string;
  limit?: number;
}

export interface EmbeddingCompareResponse {
  success?: boolean;
  date?: string;
  input_window?: {
    start?: string;
    end?: string;
    days?: number;
  };
  input_shape?: number[];
  method?: string;
  requested_models?: string[];
  results?: EmbeddingResult[];
  comparison?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /chat
 */
export async function sendChat(
  message: string,
  history: ChatHistoryMessage[] = [],
  context: ChatContext = {},
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(
    `${getBase()}/chat`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        message,
        history,
        context,
      }),
    },
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /health
 */
export async function fetchHealth(): Promise<HealthResponse> {
  // Pipeline A can be CPU/GPU intensive. Prefer the lightweight liveness
  // endpoint so the frontend can still determine whether FastAPI is alive.
  try {
    return await apiFetch<HealthResponse>(`${getBase()}/health/live`)
  } catch (liveError) {
    try {
      return await apiFetch<HealthResponse>(`${getBase()}/health`)
    } catch (healthError) {
      try {
        return await apiFetch<HealthResponse>(`${getBase()}/api/health`)
      } catch {
        throw liveError instanceof Error ? liveError : healthError
      }
    }
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /metrics/summary
 */
export async function fetchMetricsSummary(): Promise<MetricsSummary> {
  return apiFetch<MetricsSummary>(
    `${getBase()}/metrics/summary`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Validation reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/report/{name}
 *
 * Supported:
 *
 *   validation_2023
 *   final_test_2024_2025
 */
export async function fetchReport(
  name: string,
): Promise<ReportResponse> {
  if (!name) {
    throw new Error(
      'Report name cannot be empty.',
    )
  }

  return apiFetch<ReportResponse>(
    `${getBase()}/api/report/${encodeURIComponent(
      name,
    )}`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Surface data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/surface/{date}
 *
 * Returns:
 *
 *   SST
 *   SSS
 *   SSH
 *   U/V wind
 *   U/V currents
 */
export async function fetchSurface(
  date: string,
): Promise<SurfaceResponse> {
  const safeDate =
    clampDate(date)

  return apiFetch<SurfaceResponse>(
    `${getBase()}/api/surface/${safeDate}`,
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// OceanEmbed Integrated Cyclone Forecast
// ─────────────────────────────────────────────────────────────────────────────

export interface CycloneModelForecastPoint {
  horizon_h: number
  latitude: number
  longitude: number
  wind: number
  pressure: number
}

export interface CycloneModelForecastResponse {
  status: string
  model?: {
    name?: string
    checkpoint_epoch?: number | null
    checkpoint_val_loss?: number | null
  }
  sample?: {
    sample_id?: string
    storm_id?: string
    issue_date?: string
    issue_position?: {
      latitude: number
      longitude: number
    }
  }
  forecast: CycloneModelForecastPoint[]
}

/**
 * POST /api/cyclone/forecast
 *
 * Runs the real OceanEmbed Integrated Cyclone V1 model for a
 * historical issue date. The backend selects the matching training
 * sample using storm_id + issue_date + split.
 */
export async function fetchCycloneForecast(
  payload: {
    storm_id: string
    issue_date: string
    split?: string
  },
): Promise<CycloneModelForecastResponse> {
  return apiFetch<CycloneModelForecastResponse>(
    `${getBase()}/api/cyclone/forecast`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Heatmap metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/heatmap/available
 *
 * Returns available:
 *
 *   depths
 *   dates
 *   model input/output shapes
 *   variables
 */
export async function fetchHeatmapAvailable(): Promise<HeatmapAvailableResponse> {
  return apiFetch<HeatmapAvailableResponse>(
    `${getBase()}/api/heatmap/available`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Heatmap image URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the URL for the production-model
 * heatmap PNG.
 *
 * Example:
 *
 *   http://127.0.0.1:8000/api/heatmap/2025-01-01/100
 */
export function getHeatmapUrl(
  date: string,
  depth: number,
): string {
  const safeDate =
    clampDate(date)

  const safeDepth =
    normalizeDepth(depth)

  return (
    `${getBase()}/api/heatmap/` +
    `${safeDate}/` +
    `${safeDepth}`
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Heatmap JSON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/heatmap/{date}/{depth_m}/json
 *
 * Returns production model prediction data.
 */
export async function fetchHeatmapJson(
  date: string,
  depth: number,
): Promise<HeatmapJsonResponse> {
  const safeDate =
    clampDate(date)

  const safeDepth =
    normalizeDepth(depth)

  return apiFetch<HeatmapJsonResponse>(
    `${getBase()}/api/heatmap/${safeDate}/${safeDepth}/json`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Model information
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /models
 */
export async function fetchModelInfo(): Promise<
  Record<string, unknown>
> {
  return apiFetch<
    Record<string, unknown>
  >(
    `${getBase()}/models`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDING COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/embeddings/compare
 *
 * Main API call used by the Embedding Compare frontend.
 */
export async function compareEmbeddings(
  request: EmbeddingCompareRequest = {},
): Promise<EmbeddingCompareResponse> {
  const safeModels =
    request.models &&
      request.models.length > 0
      ? request.models
      : [
        'cnn',
        'swin',
        'gnn',
        'autoencoder',
      ]

  const safeMethod =
    request.method ?? 'pca'

  const payload: Record<
    string,
    unknown
  > = {
    models: safeModels,
    method: safeMethod,
  }

  if (
    request.depth_m !== undefined
  ) {
    payload.depth_m =
      normalizeDepth(
        request.depth_m,
      )
  }

  if (
    request.date
  ) {
    payload.date =
      clampDate(
        request.date,
      )
  }

  if (
    request.limit !== undefined
  ) {
    const safeLimit =
      Math.max(
        1,
        Math.round(
          request.limit,
        ),
      )

    payload.limit =
      safeLimit
  }

  return apiFetch<EmbeddingCompareResponse>(
    `${getBase()}/api/embeddings/compare`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify(
        payload,
      ),
    },
  )
}


/**
 * GET /api/embeddings/compare
 */
export async function fetchEmbeddingComparison(): Promise<EmbeddingCompareResponse> {
  return apiFetch<EmbeddingCompareResponse>(
    `${getBase()}/api/embeddings/compare`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Model explanation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /explain/model
 */
export async function fetchModelExplanation(): Promise<
  Record<string, unknown>
> {
  return apiFetch<
    Record<string, unknown>
  >(
    `${getBase()}/explain/model`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Depth explanation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /explain/depth/{depth}
 */
export async function fetchDepthExplanation(
  depth: number,
): Promise<Record<string, unknown>> {
  const safeDepth =
    normalizeDepth(depth)

  return apiFetch<
    Record<string, unknown>
  >(
    `${getBase()}/explain/depth/${safeDepth}`,
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Backend connectivity check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience helper for pages that only need to
 * verify that the backend is reachable.
 *
 * GET /health
 */
export async function checkBackendConnection(): Promise<boolean> {
  try {
    await fetchHealth()
    return true
  } catch (error) {
    console.error(
      '[oceanApi] Backend connection failed:',
      error,
    )

    return false
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// Prediction & Cyclone Phase-1 Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/predict
 */
export async function fetchPredict(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(
    `${getBase()}/api/predict`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )
}

/**
 * POST /api/cyclone/phase1/predict
 */
export async function fetchCyclonePhase1(
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(
    `${getBase()}/api/cyclone/phase1/predict`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cyclone Historical Track
// ─────────────────────────────────────────────────────────────────────────────

export interface CycloneHistoricalTrackPoint {
  date: string
  latitude: number
  longitude: number
  observation_time?: string
  wind?: number
  pressure?: number
}

export interface CycloneHistoricalTrackResponse {
  status: string
  storm_id: string
  split: string
  count: number
  track: CycloneHistoricalTrackPoint[]
}

/**
 * GET /api/cyclone/track/{storm_id}
 *
 * Returns the real historical daily track for a cyclone.
 */
export async function fetchCycloneHistoricalTrack(
  stormId: string,
  split: string = 'test',
): Promise<CycloneHistoricalTrackResponse> {
  if (!stormId.trim()) {
    throw new Error('Storm ID cannot be empty.')
  }

  return apiFetch<CycloneHistoricalTrackResponse>(
    `${getBase()}/api/cyclone/track/${encodeURIComponent(stormId)}?split=${encodeURIComponent(split)}`,
  )
}


export interface HistoricalCycloneCandidate {
  storm_id: string
  date: string
  latitude: number
  longitude: number
  split: string
  observation_time?: string
  wind?: number
  pressure?: number
}

export interface HistoricalCyclonesByDateResponse {
  status: string
  date: string
  count: number
  cyclones: HistoricalCycloneCandidate[]
}

/**
 * GET /api/cyclone/historical/by-date?date=YYYY-MM-DD
 *
 * Searches the prepared historical cyclone datasets without requiring
 * the user to know a storm ID.
 */
export async function fetchHistoricalCyclonesByDate(
  date: string,
): Promise<HistoricalCyclonesByDateResponse> {
  const safeDate = date.trim().slice(0, 10)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) {
    throw new Error('Historical date must use YYYY-MM-DD format.')
  }

  return apiFetch<HistoricalCyclonesByDateResponse>(
    `${getBase()}/api/cyclone/historical/by-date?date=${encodeURIComponent(safeDate)}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared api URL map
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  get baseUrl() {
    return getBackendUrl()
  },

  heatmapUrl: (date: string, depth: number) =>
    `${getBase()}/api/heatmap/${date}/${depth}`,

  heatmapAvailableUrl: () =>
    `${getBase()}/api/heatmap/available`,

  phase1Url: () =>
    `${getBase()}/api/cyclone/phase1/predict`,

  surfaceUrl: (date: string) =>
    `${getBase()}/api/surface/${date}`,

  predictUrl: () =>
    `${getBase()}/api/predict`,

  healthUrl: () =>
    `${getBase()}/health`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline A — real raw-file upload / inspection / execution
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineASlot = 'sst' | 'sss' | 'ssh' | 'currents' | 'winds';

export interface PipelineAFileInspection {
  filename?: string;
  format?: string;
  size_bytes?: number;
  variables?: string[];
  dimensions?: Record<string, number>;
  coordinates?: Record<string, unknown>;
  units?: Record<string, string>;
  time?: {
    coordinate?: string;
    start?: string;
    end?: string;
    count?: number;
  } | null;
  statistics?: Record<string, {
    finite_count?: number;
    missing_or_nonfinite_count?: number;
    mean?: number | null;
    min?: number | null;
    max?: number | null;
  }>;
  warnings?: string[];
  errors?: string[];
  hdf5_datasets?: Array<{
    name: string;
    shape: number[];
    dtype: string;
  }>;
}

export interface PipelineAInspectResponse {
  success: boolean;
  job_id: string;
  target_date?: string | null;
  files: Record<PipelineASlot, PipelineAFileInspection>;
  required_slots: PipelineASlot[];
}

export interface PipelineAUploadResponse {
  success: boolean;
  job_id: string;
  status: string;
  selected_dates: string[];
  files: Record<PipelineASlot, PipelineAFileInspection>;
  pipeline: string;
  version: string;
}

export interface PipelineAStatusResponse {
  success: boolean;
  job_id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | string;
  current_stage: string;
  stage_status: Record<string, string>;
  selected_dates?: string[];
  files?: Record<PipelineASlot, PipelineAFileInspection>;
  started_at?: string;
  finished_at?: string | null;
  error?: string | null;
  log_tail?: string;
  result?: PipelineARunResponse;
  [key: string]: unknown;
}

export async function inspectPipelineAFile(
  slot: PipelineASlot,
  file: File,
  targetDate?: string,
): Promise<PipelineAInspectResponse> {
  const form = new FormData();
  form.append(slot, file, file.name);
  if (targetDate) form.append('target_date', targetDate);

  return apiFetch<PipelineAInspectResponse>(
    `${getBase()}/api/pipeline_a/inspect`,
    {
      method: 'POST',
      body: form,
    },
  );
}

export async function uploadPipelineA(
  files: Partial<Record<PipelineASlot, File>>,
  targetDate?: string,
): Promise<PipelineAUploadResponse> {
  const form = new FormData();

  (Object.entries(files) as [PipelineASlot, File | undefined][]).forEach(
    ([slot, file]) => {
      if (file) form.append(slot, file, file.name);
    },
  );

  if (targetDate) form.append('target_date', targetDate);
  form.append('validation_scope', 'fixture');

  return apiFetch<PipelineAUploadResponse>(
    `${getBase()}/api/pipeline_a/upload`,
    {
      method: 'POST',
      body: form,
    },
  );
}

export async function fetchPipelineAStatus(
  jobId: string,
): Promise<PipelineAStatusResponse> {
  return apiFetch<PipelineAStatusResponse>(
    `${getBase()}/api/pipeline_a/status/${encodeURIComponent(jobId)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline A Execution & Specifications
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineARunResponse {
  status: string;
  pipeline: string;
  version: string;
  job_id: string;
  started_at: string;
  finished_at: string;
  target_date: string;
  stages: Record<string, any>;
  validation_summary: {
    total: number;
    passed: number;
    failed: number;
    compliance_score_percent: number;
  };
  prediction_output: {
    date: string;
    mean_sst_C: number;
    mean_sss_PSU: number;
    mean_ssh_cm: number;
    mean_tchp_kJ_cm2: number;
    d26_depth_m: number;
    depth_profile: { depth: number; temperature_C: number; uncertainty_C?: number }[];
  };
  [key: string]: unknown;
}

export async function runPipelineA(payload?: Record<string, unknown>): Promise<PipelineARunResponse> {
  try {
    return await apiFetch<PipelineARunResponse>(`${getBase()}/api/pipeline_a/run`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  } catch {
    return apiFetch<PipelineARunResponse>(`${getBase()}/api/pipeline/run`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  }
}

export async function fetchPipelineASpecs(): Promise<Record<string, unknown>> {
  try {
    return await apiFetch<Record<string, unknown>>(`${getBase()}/api/pipeline_a/specs`);
  } catch {
    return apiFetch<Record<string, unknown>>(`${getBase()}/api/pipeline/specs`);
  }
}




// ─────────────────────────────────────────────────────────────────────────────
// Seasonal Ocean Forecasting — production FNO
// ─────────────────────────────────────────────────────────────────────────────

export interface SeasonalAssetStatusResponse {
  success: boolean;
  available: boolean;
  checkpoint_exists: boolean;
  normalization_exists: boolean;
  climatology_exists: boolean;
  monthly_dataset_exists: boolean;
  manifest_exists?: boolean;
  config_exists?: boolean;
  training_summary_exists?: boolean;
  checkpoint?: string;
  normalization?: string;
  climatology_root?: string;
  monthly_dataset_root?: string;
  device?: string;
  input_shape?: number[];
  output_shape?: number[];
  embedding_dimension?: number;
  [key: string]: unknown;
}

export interface SeasonalConfigResponse {
  success: boolean;
  model: string;
  checkpoint: string;
  input_shape: [number, number, number, number];
  output_shape: [number, number, number, number];
  forecast_months: number;
  channel_count: number;
  architecture?: Record<string, unknown>;
  training_period?: string;
  validation_period?: string;
  test_period?: string;
  normalization?: string;
  reconstruction?: string;
  [key: string]: unknown;
}

export interface SeasonalPredictionRequest {
  input_end_month: string;
}

export interface SeasonalGrid {
  lat: number[];
  lon: number[];
}

export interface SeasonalNormalization {
  type?: string;
  stats_file?: string;
  sst_train_mean?: number;
  sst_train_std?: number;
  [key: string]: unknown;
}

export interface SeasonalPredictionResponse {
  success: boolean;
  model: string;
  input_end_month: string;
  input_months: string[];
  forecast_months: string[];
  input_shape: [number, number, number, number];
  output_shape: [number, number, number, number];

  // Backend intentionally does not claim verified physical Celsius output.
  forecast_sst_C: null | number[][][][];
  forecast_sst_normalized: number[][][][];

  forecast_anomaly_normalized: number[][][][];

  device: string;
  checkpoint: string;

  grid: SeasonalGrid;

  normalization?: SeasonalNormalization;

  forecast_units?: string;
  forecast_sst_C_note?: string;
  climatology?: {
    source?: string;
    root?: string;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

function normalizeSeasonalMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) {
    throw new Error(`Invalid seasonal month "${value}". Expected YYYY-MM.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(`Invalid seasonal month "${value}". Expected YYYY-MM.`);
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export async function fetchSeasonalStatus(): Promise<SeasonalAssetStatusResponse> {
  return apiFetch<SeasonalAssetStatusResponse>(
    `${getBase()}/api/seasonal/status`,
  );
}

export async function fetchSeasonalConfig(): Promise<SeasonalConfigResponse> {
  return apiFetch<SeasonalConfigResponse>(
    `${getBase()}/api/seasonal/config`,
  );
}

export async function fetchSeasonalPrediction(
  inputEndMonth: string,
): Promise<SeasonalPredictionResponse> {
  const safeMonth = normalizeSeasonalMonth(inputEndMonth);

  return apiFetch<SeasonalPredictionResponse>(
    `${getBase()}/api/seasonal/predict`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input_end_month: safeMonth,
      } satisfies SeasonalPredictionRequest),
    },
  );
}

export interface OceanDiagnosticMapResponse {
  success: boolean;
  date: string;
  lat: number[];
  lon: number[];
  values: number[][];
  units: string;
  input_window?: { start: string; end: string; days: number };
  grid_shape?: [number, number] | number[];
  diagnostic?: string;
}

export async function fetchOceanDiagnosticMap(
  date: string,
  metric: 'tchp' | 'ohc' | 'd26',
): Promise<OceanDiagnosticMapResponse> {
  const safeDate = clampDate(date);
  const endpoint =
    metric === 'tchp'
      ? `/api/diagnostics/tchp-map/${safeDate}`
      : metric === 'ohc'
        ? `/api/diagnostics/ohc-map/${safeDate}`
        : `/api/diagnostics/d26-map/${safeDate}`;

  const raw = await apiFetch<Record<string, unknown>>(`${getBase()}${endpoint}`);
  const rawValues =
    metric === 'tchp'
      ? raw.values_kJ_cm2
      : metric === 'ohc'
        ? raw.values_GJ_m2
        : raw.values_m;

  if (!Array.isArray(raw.lat) || !Array.isArray(raw.lon) || !Array.isArray(rawValues)) {
    throw new Error('Backend returned an invalid diagnostic map payload.');
  }

  return {
    success: raw.success !== false,
    date: String(raw.date ?? safeDate),
    lat: raw.lat.map(Number),
    lon: raw.lon.map(Number),
    values: (rawValues as unknown[]).map((row) =>
      Array.isArray(row)
        ? row.map((value) => (value == null ? Number.NaN : Number(value)))
        : [],
    ),
    units: String(raw.units ?? (metric === 'tchp' ? 'kJ/cm²' : metric === 'ohc' ? 'GJ/m²' : 'm')),
    input_window:
      raw.input_window && typeof raw.input_window === 'object'
        ? (raw.input_window as { start: string; end: string; days: number })
        : undefined,
    grid_shape: Array.isArray(raw.grid_shape) ? (raw.grid_shape as number[]) : undefined,
    diagnostic: typeof raw.diagnostic === 'string' ? raw.diagnostic : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ocean Profile & Deep Subsurface Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

export interface OceanProfileResponse {
  success: boolean;
  date: string;
  forecast_date: string;
  input_window: { start: string; end: string; days: number };
  requested_location: { latitude: number; longitude: number };
  nearest_grid_location: { latitude: number; longitude: number };
  depths_m: number[];
  temperature_C: (number | null)[];
  model: string;
}

export interface OceanDiagnosticsResponse {
  success: boolean;
  date: string;
  forecast_date: string;
  requested_location: { latitude: number; longitude: number };
  nearest_grid_location: { latitude: number; longitude: number };
  input_window?: { start: string; end: string; days: number };
  surface_temperature_C: number | null;
  depths_m: number[];
  temperature_profile_C: (number | null)[];
  d26?: { d26_depth_m: number | null; reference_temperature_C: number };
  ohc_0_700?: { ohc_0_700_GJ_m2: number | null; formula: string };
  tchp?: { tchp_kJ_cm2: number | null; formula: string };
}

export async function fetchOceanProfile(
  date: string,
  latitude: number,
  longitude: number
): Promise<OceanProfileResponse> {
  const safeDate = clampDate(date);
  return apiFetch<OceanProfileResponse>(
    `${getBase()}/api/ocean/profile/${safeDate}/${latitude}/${longitude}`
  );
}

export async function fetchOceanDiagnostics(
  date: string,
  latitude: number,
  longitude: number
): Promise<OceanDiagnosticsResponse> {
  const safeDate = clampDate(date);
  return apiFetch<OceanDiagnosticsResponse>(
    `${getBase()}/api/ocean/diagnostics/${safeDate}/${latitude}/${longitude}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live 5-Category Embeddings API (Folder & Thermocline Stores)
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveBackendFolderEmbeddingsResponse {
  success: boolean;
  source: string;
  count: number;
  embedding_dimension: number;
  categories: string[];
  models: any[];
}

export interface LiveBackendThermoclineResponse {
  success: boolean;
  source: string;
  count: number;
  embedding_dimension: number;
  categories: string[];
  models: any[];
}

export async function fetchLiveFolderEmbeddings(): Promise<LiveBackendFolderEmbeddingsResponse> {
  return apiFetch<LiveBackendFolderEmbeddingsResponse>(`${getBase()}/api/folder-embeddings/frontend`);
}

export async function fetchLiveThermoclineEmbeddings(): Promise<LiveBackendThermoclineResponse> {
  return apiFetch<LiveBackendThermoclineResponse>(`${getBase()}/api/thermocline/embeddings/frontend`);
}

export async function fetchRawFolderEmbeddingVector(index: number): Promise<{ embedding: number[]; point_2d: [number, number] }> {
  return apiFetch(`${getBase()}/api/folder-embeddings/embedding/${index}`);
}

