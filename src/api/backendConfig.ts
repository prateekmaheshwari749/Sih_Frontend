/**
 * backendConfig.ts
 *
 * Central backend base URL configuration for OceanEmbed.
 *
 * Production / Cloudflare Pages:
 *   Set VITE_API_BASE_URL to the public backend origin
 *   (e.g. a Cloudflare Tunnel URL). Vite embeds this at build time.
 *
 * Development default:
 *   http://127.0.0.1:8000
 *
 * Local auto-discovery (dev only) also probes localhost and the Vite proxy.
 */

import { useEffect, useState } from 'react';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Resolve the configured API base URL from environment.
 * Primary: VITE_API_BASE_URL
 * Legacy fallbacks: VITE_BACKEND_URL, VITE_API_URL
 */
export function getConfiguredApiBaseUrl(): string | null {
  const envUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  return null;
}

export function getDefaultApiBaseUrl(): string {
  return getConfiguredApiBaseUrl() || DEFAULT_API_BASE_URL;
}

function getInitialCandidates(): string[] {
  const configured = getConfiguredApiBaseUrl();
  const list: string[] = [];

  if (configured) {
    list.push(configured);
  }

  // Production builds: use only the configured/default origin.
  // Do not probe localhost or the Vite dev proxy from a public site.
  if (import.meta.env.PROD) {
    if (!list.length) {
      list.push(DEFAULT_API_BASE_URL);
    }
    return list;
  }

  // Saved working URL from previous local session
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ocean_active_backend_url');
      if (saved && !list.includes(saved)) {
        list.push(saved);
      }
    } catch {
      // ignore
    }
  }

  const defaults = [
    DEFAULT_API_BASE_URL,
    '',
    'http://localhost:8000',
  ];

  // If frontend is accessed on a LAN IP, also probe backend on that host
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    defaults.push(`http://${window.location.hostname}:8000`);
  }

  for (const d of defaults) {
    if (!list.includes(d)) {
      list.push(d);
    }
  }

  return list;
}

export interface BackendStatus {
  url: string;
  isLive: boolean;
  isChecking: boolean;
  latencyMs: number | null;
  device?: string;
  cnnLoaded?: boolean;
  swinLoaded?: boolean;
  convgruLoaded?: boolean;
  error?: string | null;
  lastChecked?: string;
}

let activeBackendUrl: string = getInitialCandidates()[0] || DEFAULT_API_BASE_URL;
let currentStatus: BackendStatus = {
  url: activeBackendUrl,
  isLive: false,
  isChecking: false,
  latencyMs: null,
};

const listeners = new Set<(status: BackendStatus) => void>();

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn({ ...currentStatus });
    } catch (e) {
      console.error('[backendConfig] Listener error:', e);
    }
  }
}

/**
 * Returns the currently active backend base URL.
 * Defaults to VITE_API_BASE_URL or http://127.0.0.1:8000.
 */
export function getBackendUrl(): string {
  return activeBackendUrl || getDefaultApiBaseUrl();
}

/**
 * Manually set or override the backend URL (e.g. from user UI).
 */
export function setActiveBackendUrl(url: string) {
  activeBackendUrl = url.replace(/\/+$/, '');
  try {
    localStorage.setItem('ocean_active_backend_url', activeBackendUrl);
  } catch {
    // ignore
  }
  probeActiveBackend();
}

/**
 * Probe a specific URL to see if it responds to /health or /api/health.
 */
export async function testBackendLiveness(baseUrl: string): Promise<{
  ok: boolean;
  latencyMs: number;
  data?: Record<string, unknown>;
}> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const start = performance.now();

  const probePath = async (path: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const res = await fetch(`${cleanBase}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return { ok: true, json };
      }
      return { ok: false };
    } catch {
      clearTimeout(timeout);
      return { ok: false };
    }
  };

  const healthRes = await probePath('/health');
  const elapsed = Math.round(performance.now() - start);

  if (healthRes.ok) {
    return { ok: true, latencyMs: elapsed, data: healthRes.json as Record<string, unknown> };
  }

  const apiHealthRes = await probePath('/api/health');
  const elapsed2 = Math.round(performance.now() - start);

  if (apiHealthRes.ok) {
    return { ok: true, latencyMs: elapsed2, data: apiHealthRes.json as Record<string, unknown> };
  }

  return { ok: false, latencyMs: elapsed2 };
}

/**
 * Auto-probe candidate backend URLs and lock onto the first responsive one.
 */
export async function probeActiveBackend(): Promise<BackendStatus> {
  currentStatus = {
    ...currentStatus,
    isChecking: true,
  };
  notifyListeners();

  const activeTest = await testBackendLiveness(activeBackendUrl);
  if (activeTest.ok) {
    currentStatus = {
      url: activeBackendUrl,
      isLive: true,
      isChecking: false,
      latencyMs: activeTest.latencyMs,
      device: (activeTest.data?.device as string) ?? 'CPU / GPU',
      cnnLoaded: (activeTest.data?.cnn_loaded as boolean) ?? true,
      swinLoaded: (activeTest.data?.swin_loaded as boolean) ?? true,
      convgruLoaded: (activeTest.data?.convgru_loaded as boolean) ?? true,
      error: null,
      lastChecked: new Date().toLocaleTimeString(),
    };
    notifyListeners();
    return currentStatus;
  }

  const candidates = getInitialCandidates().filter(c => c !== activeBackendUrl);
  for (const candidate of candidates) {
    const result = await testBackendLiveness(candidate);
    if (result.ok) {
      activeBackendUrl = candidate;
      try {
        localStorage.setItem('ocean_active_backend_url', candidate);
      } catch {
        // ignore
      }

      currentStatus = {
        url: candidate,
        isLive: true,
        isChecking: false,
        latencyMs: result.latencyMs,
        device: (result.data?.device as string) ?? 'CPU / GPU',
        cnnLoaded: (result.data?.cnn_loaded as boolean) ?? true,
        swinLoaded: (result.data?.swin_loaded as boolean) ?? true,
        convgruLoaded: (result.data?.convgru_loaded as boolean) ?? true,
        error: null,
        lastChecked: new Date().toLocaleTimeString(),
      };
      notifyListeners();
      return currentStatus;
    }
  }

  currentStatus = {
    url: activeBackendUrl,
    isLive: false,
    isChecking: false,
    latencyMs: null,
    error: 'Backend is not running. Start with `uvicorn server:app --port 8000`',
    lastChecked: new Date().toLocaleTimeString(),
  };
  notifyListeners();
  return currentStatus;
}

let autoDetectorStarted = false;
export function startBackendAutoDetector() {
  if (autoDetectorStarted || typeof window === 'undefined') return;
  autoDetectorStarted = true;

  probeActiveBackend();

  setInterval(() => {
    probeActiveBackend();
  }, currentStatus.isLive ? 30000 : 5000);
}

/**
 * React hook to observe live backend connection status anywhere in the app.
 */
export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>(currentStatus);

  useEffect(() => {
    startBackendAutoDetector();

    setStatus(currentStatus);
    const handler = (newStatus: BackendStatus) => setStatus(newStatus);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    ...status,
    refresh: probeActiveBackend,
    setBackendUrl: setActiveBackendUrl,
  };
}
