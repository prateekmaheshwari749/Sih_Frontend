import { getBackendUrl } from './backendConfig';

export const api = {
  get baseUrl() {
    return getBackendUrl();
  },

  // Health & System Checkup
  healthUrl: () => `${getBackendUrl()}/health`,
  healthApiUrl: () => `${getBackendUrl()}/api/health`,
  checkupUrl: () => `${getBackendUrl()}/checkup`,
  configUrl: () => `${getBackendUrl()}/api/config`,

  // Models, Metrics & Reports
  modelsUrl: () => `${getBackendUrl()}/models`,
  modelsApiUrl: () => `${getBackendUrl()}/api/models`,
  metricsSummaryUrl: () => `${getBackendUrl()}/metrics/summary`,
  metricsSummaryApiUrl: () => `${getBackendUrl()}/api/metrics/summary`,
  reportsListUrl: () => `${getBackendUrl()}/reports`,
  reportUrl: (name: string) => `${getBackendUrl()}/api/report/${encodeURIComponent(name)}`,

  // Production Inference & Testing
  predictUrl: () => `${getBackendUrl()}/api/predict`,
  predictTestUrl: () => `${getBackendUrl()}/api/predict/test`,

  // Heatmap routes
  heatmapUrl: (date: string, depth: number) =>
    `${getBackendUrl()}/api/heatmap/${date}/${depth}`,
  heatmapJsonUrl: (date: string, depth: number) =>
    `${getBackendUrl()}/api/heatmap/${date}/${depth}/json`,
  heatmapDataUrl: (date: string, depth: number) =>
    `${getBackendUrl()}/api/heatmap/${date}/${depth}/data`,
  heatmapAvailableUrl: () =>
    `${getBackendUrl()}/api/heatmap/available`,

  // Surface data
  surfaceUrl: (date: string) =>
    `${getBackendUrl()}/api/surface/${date}`,

  // Ocean Profile & Single Point Query
  oceanProfileUrl: (date: string, lat: number, lon: number) =>
    `${getBackendUrl()}/api/ocean/profile/${date}/${lat}/${lon}`,
  oceanValueUrl: (date: string, depth: number, lat: number, lon: number) =>
    `${getBackendUrl()}/api/ocean/value/${date}/${depth}/${lat}/${lon}`,

  // Ocean Diagnostics (D26, OHC 0-700m, TCHP)
  oceanDiagnosticsUrl: (date: string, lat: number, lon: number) =>
    `${getBackendUrl()}/api/ocean/diagnostics/${date}/${lat}/${lon}`,
  d26Url: (date: string, lat: number, lon: number) =>
    `${getBackendUrl()}/api/diagnostics/d26/${date}/${lat}/${lon}`,
  ohcUrl: (date: string, lat: number, lon: number) =>
    `${getBackendUrl()}/api/diagnostics/ohc/${date}/${lat}/${lon}`,
  tchpUrl: (date: string, lat: number, lon: number) =>
    `${getBackendUrl()}/api/diagnostics/tchp/${date}/${lat}/${lon}`,

  // Full 2D Diagnostic Maps
  ohcMapUrl: (date: string) =>
    `${getBackendUrl()}/api/diagnostics/ohc-map/${date}`,
  tchpMapUrl: (date: string) =>
    `${getBackendUrl()}/api/diagnostics/tchp-map/${date}`,
  d26MapUrl: (date: string) =>
    `${getBackendUrl()}/api/diagnostics/d26-map/${date}`,

  // Cyclone Phase-1
  phase1Url: () => `${getBackendUrl()}/api/cyclone/phase1/predict`,
  phase1ModelUrl: () => `${getBackendUrl()}/api/cyclone/phase1/model`,

  // MHW (Marine Heatwave) Production Inference
  mhwStatusUrl: () => `${getBackendUrl()}/api/mhw/status`,
  mhwConfigUrl: () => `${getBackendUrl()}/api/mhw/config`,
  mhwPredictUrl: () => `${getBackendUrl()}/api/mhw/predict`,
  mhwForecastUrl: (date: string, lead: number) =>
    `${getBackendUrl()}/api/mhw/forecast/${date}/${lead}`,
  mhwEventsUrl: (date: string) =>
    `${getBackendUrl()}/api/mhw/events/${date}`,

  // Embeddings Comparison
  embeddingsCompareUrl: () => `${getBackendUrl()}/api/embeddings/compare`,
  embeddingsStatusUrl: () => `${getBackendUrl()}/api/embeddings/status`,

  // EX-AI & Explanation Routes
  explainUrl: () => `${getBackendUrl()}/api/explain`,
  explainModelUrl: () => `${getBackendUrl()}/explain/model`,
  explainDepthUrl: (depth: number) => `${getBackendUrl()}/explain/depth/${depth}`,

  // AI Assistant Chat route
  chatUrl: () => `${getBackendUrl()}/chat`,
};

export default api;