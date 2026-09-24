import { getBackendUrl } from './backendConfig';

function getApiBase(): string {
  return getBackendUrl().replace(/\/+$/, '');
}

export interface GovernmentApiResponse<T = unknown> {
  success: boolean;
  timestamp?: string;
  request_id?: string;
  data?: T;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

export interface GovernmentStatusData {
  system?: {
    name?: string;
    version?: string;
    status?: string;
  };
  [key: string]: unknown;
}

export interface GovernmentAuditRecord {
  timestamp: string;
  action: string;
  endpoint: string;
  request_id: string;
  user?: string | null;
  status_code: number;
  details?: Record<string, unknown>;
}

export interface GovernmentAuditData {
  date: string | null;
  records: GovernmentAuditRecord[];
  record_count: number;
}

export interface GovernmentAlert {
  id?: string;
  alert_id?: string;
  timestamp?: string;
  created_at?: string;
  severity?: string;
  status?: string;
  message?: string;
  trigger?: string;
  trigger_event?: string;
  event_cells?: number;
  forecast_days?: number;
  peak_day?: string;
  source?: string;
  [key: string]: unknown;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${getApiBase()}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.headers || {}),
    },
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `Government API returned invalid JSON (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Government API request failed: HTTP ${response.status}`
    );
  }

  return payload as T;
}

/**
 * Check Government Intelligence API status.
 */
export async function getGovernmentStatus() {
  return request<GovernmentApiResponse<GovernmentStatusData>>(
    '/api/government/status'
  );
}

/**
 * Get government production indicators for a date.
 *
 * Example:
 * getGovernmentIndicators('2025-12-31')
 */
export async function getGovernmentIndicators(date: string) {
  return request<GovernmentApiResponse>(
    `/api/government/indicators/${encodeURIComponent(date)}`
  );
}

/**
 * Get government alerts for a date.
 *
 * Example:
 * getGovernmentAlerts('2025-12-31')
 */
export async function getGovernmentAlerts(date: string) {
  return request<GovernmentApiResponse>(
    `/api/government/alerts/${encodeURIComponent(date)}`
  );
}

/**
 * Get the daily government operational report.
 *
 * Example:
 * getGovernmentReport('2025-12-31')
 */
export async function getGovernmentReport(date: string) {
  return request<GovernmentApiResponse>(
    `/api/government/report/${encodeURIComponent(date)}`
  );
}

/**
 * Get backend audit records.
 *
 * Optional date can be supplied:
 * getGovernmentAudit()
 * getGovernmentAudit('2025-12-31')
 */
export async function getGovernmentAudit(date?: string) {
  const query = date
    ? `?date=${encodeURIComponent(date)}`
    : '';

  return request<GovernmentApiResponse<GovernmentAuditData>>(
    `/api/government/audit${query}`
  );
}

export { getApiBase as getGovernmentApiBase };

/** Dynamic base URL for government API calls (VITE_API_BASE_URL). */
export function getAPI_BASE(): string {
  return getApiBase();
}