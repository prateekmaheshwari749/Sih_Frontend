/**
 * BackendStatusBanner.tsx
 *
 * Global persistent banner that monitors connectivity to the
 * OceanBed production backend (VITE_API_BASE_URL / local default).
 *
 * - Polls GET /health every 10 seconds
 * - Shows a red banner when the backend is unreachable
 * - Shows a brief green "reconnected" flash on recovery
 * - Mounts in App.tsx outside <Routes> so it persists across pages
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import { getBackendUrl, getDefaultApiBaseUrl } from '../api/backendConfig';

type ConnectionState =
  | 'checking'   // initial / re-checking
  | 'connected'  // backend OK
  | 'reconnected' // just came back — show flash
  | 'offline';   // cannot reach backend

const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 4_000;
const RECONNECTED_FLASH_MS = 3_500;

function healthProbeUrls(): string[] {
  const primary = getBackendUrl().replace(/\/+$/, '');
  const fallback = getDefaultApiBaseUrl().replace(/\/+$/, '');
  const urls = [`${primary}/health`];

  if (fallback !== primary) {
    urls.push(`${fallback}/health`);
  }

  // Local-only alternate host (dev convenience)
  if (!import.meta.env.PROD && primary.includes('127.0.0.1')) {
    urls.push(primary.replace('127.0.0.1', 'localhost') + '/health');
  } else if (!import.meta.env.PROD && primary.includes('localhost')) {
    urls.push(primary.replace('localhost', '127.0.0.1') + '/health');
  }

  return [...new Set(urls)];
}

async function probeBackend(): Promise<{ ok: boolean; status?: string; detail?: string; url?: string }> {
  for (const url of healthProbeUrls()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        let status: string | undefined;
        try {
          const data = await res.json();
          status = data?.status;
        } catch {
          status = 'ok';
        }
        return { ok: true, status, url };
      }

      clearTimeout(timer);
      return { ok: false, detail: `HTTP ${res.status} from backend`, url };
    } catch {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    detail: `Cannot reach ${getBackendUrl() || getDefaultApiBaseUrl()}`,
  };
}

export default function BackendStatusBanner() {
  const [state, setState] = useState<ConnectionState>('checking');
  const [isChecking, setIsChecking] = useState(false);
  const [detail, setDetail] = useState<string>('');
  const [dismissed, setDismissed] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(getDefaultApiBaseUrl());
  const prevStateRef = useRef<ConnectionState>('checking');
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = async () => {
    setIsChecking(true);
    setState(prev => {
      prevStateRef.current = prev;
      return prev === 'offline' ? 'offline' : prev;
    });

    const result = await probeBackend();
    setIsChecking(false);
    setDisplayUrl(getBackendUrl() || getDefaultApiBaseUrl());

    if (result.ok) {
      const wasOffline = prevStateRef.current === 'offline';
      setState(wasOffline ? 'reconnected' : 'connected');
      setDismissed(false);
      setDetail('');

      if (wasOffline) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          setState('connected');
        }, RECONNECTED_FLASH_MS);
      }
    } else {
      setState('offline');
      setDismissed(false);
      setDetail(result.detail ?? 'Backend unreachable');
    }
  };

  const forceRetry = () => {
    setState('checking');
    check();
  };

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  if (state === 'reconnected') {
    return (
      <div
        style={{ zIndex: 99999 }}
        className="fixed top-0 left-0 right-0 flex items-center justify-center gap-2.5 px-4 py-2.5 bg-emerald-500/95 backdrop-blur-sm shadow-lg shadow-emerald-900/30 border-b border-emerald-400/40 animate-slide-down"
      >
        <CheckCircle size={15} className="text-white shrink-0" />
        <span className="text-white text-sm font-semibold">
          ✓ OceanBed backend reconnected — {displayUrl}
        </span>
      </div>
    );
  }

  if (state === 'offline' && !dismissed) {
    return (
      <div
        style={{ zIndex: 99999 }}
        className="fixed top-0 left-0 right-0 animate-slide-down"
      >
        <div className="bg-red-950/95 backdrop-blur-md border-b border-red-500/40 shadow-xl shadow-red-900/40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-start gap-3">
            <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 mt-0.5">
              <WifiOff size={15} className="text-red-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-red-300 font-bold text-sm">
                  BACKEND NOT CONNECTED
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                  {displayUrl}
                </span>
              </div>
              <p className="text-red-400/80 text-xs mt-1 leading-relaxed">
                {detail || 'Cannot reach the OceanBed production API server. Start the backend with'}{' '}
                {!detail && (
                  <code className="bg-red-900/50 px-1 rounded font-mono">
                    python server.py
                  </code>
                )}
                {detail && (
                  <>
                    {' '}— Start it with{' '}
                    <code className="bg-red-900/50 px-1 rounded font-mono">python server.py</code>
                  </>
                )}
              </p>
              <p className="text-red-500/60 text-[11px] mt-0.5">
                Pages will use physics-guided fallback data until connection is restored.
                Retrying every {POLL_INTERVAL_MS / 1000}s…
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
<button
  onClick={forceRetry}
  title="Retry connection now"
  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold transition-all"
  style={{ color: '#ffffff' }}
>
  <RefreshCw
    size={12}
    className={isChecking ? 'animate-spin' : ''}
    style={{ color: '#ffffff' }}
  />
  <span style={{ color: '#ffffff' }}>Retry</span>
</button>
              <button
                onClick={() => setDismissed(true)}
                title="Dismiss"
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-500/15 text-red-500/60 hover:text-red-300 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
        </div>
      </div>
    );
  }

  if (state === 'connected') {
    return (
      <div
        style={{ zIndex: 99999 }}
        className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-emerald-500/20 text-emerald-400/70 text-[10px] font-mono pointer-events-none"
      >
        <Wifi size={9} />
        BACKEND ONLINE
      </div>
    );
  }

  if (state === 'checking') {
    return (
      <div
        style={{ zIndex: 99999 }}
        className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-yellow-500/20 text-yellow-400/70 text-[10px] font-mono pointer-events-none"
      >
        <AlertTriangle size={9} className="animate-pulse" />
        CONNECTING…
      </div>
    );
  }

  return null;
}
