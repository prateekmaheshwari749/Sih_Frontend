import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Bell,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Server,
  Database,
  Calendar,
} from 'lucide-react';

import PageLayout, { SectionHeader } from '../components/PageLayout';

import {
  getGovernmentStatus,
  getGovernmentAlerts,
  getGovernmentReport,
  getGovernmentAudit,
  getGovernmentApiBase,
  type GovernmentApiResponse,
  type GovernmentAlert,
  type GovernmentAuditRecord,
} from '../api/governmentApi';

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  });
}

function extractArray<T>(
  value: unknown,
  keys: string[]
): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;

    for (const key of keys) {
      if (Array.isArray(object[key])) {
        return object[key] as T[];
      }
    }
  }

  return [];
}

export default function GovPortalPage() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [apiChecking, setApiChecking] = useState(true);

  const [apiStatus, setApiStatus] =
    useState<GovernmentApiResponse | null>(null);

  const [selectedDate, setSelectedDate] =
    useState('2025-12-31');

  const [alerts, setAlerts] =
    useState<GovernmentAlert[]>([]);

  const [auditRecords, setAuditRecords] =
    useState<GovernmentAuditRecord[]>([]);

  const [report, setReport] =
    useState<GovernmentApiResponse | null>(null);

  const [loadingOperations, setLoadingOperations] =
    useState(false);

  const [loadingAudit, setLoadingAudit] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [activeTab, setActiveTab] =
    useState<'alerts' | 'report' | 'audit'>('alerts');

  /*
   * ---------------------------------------------------------
   * GOVERNMENT API STATUS
   * ---------------------------------------------------------
   */

  const checkStatus = useCallback(async () => {
    setApiChecking(true);

    try {
      const response = await getGovernmentStatus();

      setApiStatus(response);
      setApiOnline(response.success === true);
    } catch (err) {
      setApiOnline(false);
      setApiStatus(null);

      setError(
        err instanceof Error
          ? err.message
          : 'Government API unavailable'
      );
    } finally {
      setApiChecking(false);
    }
  }, []);

  /*
   * ---------------------------------------------------------
   * AUDIT LOG
   * ---------------------------------------------------------
   */

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);

    try {
      const response = await getGovernmentAudit();

      const records = extractArray<GovernmentAuditRecord>(
        response.data,
        ['records', 'audit_records']
      );

      setAuditRecords(records);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load government audit records'
      );
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  /*
   * ---------------------------------------------------------
   * ALERTS + REPORT
   * ---------------------------------------------------------
   */

  const loadOperations = useCallback(async () => {
    setLoadingOperations(true);
    setError(null);

    try {
      const [alertsResponse, reportResponse] =
        await Promise.all([
          getGovernmentAlerts(selectedDate),
          getGovernmentReport(selectedDate),
        ]);

      const alertRecords =
        extractArray<GovernmentAlert>(
          alertsResponse.data,
          ['alerts', 'items', 'records']
        );

      setAlerts(alertRecords);
      setReport(reportResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load government operational data'
      );
    } finally {
      setLoadingOperations(false);
    }
  }, [selectedDate]);

  /*
   * ---------------------------------------------------------
   * INITIAL LOAD
   * ---------------------------------------------------------
   */

  useEffect(() => {
    void checkStatus();
    void loadAudit();
  }, [checkStatus, loadAudit]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  /*
   * ---------------------------------------------------------
   * DERIVED DATA
   * ---------------------------------------------------------
   */

  const activeAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const status = String(
        alert.status ?? ''
      ).toUpperCase();

      return (
        status === 'ACTIVE' ||
        status === 'OPEN' ||
        status === ''
      );
    });
  }, [alerts]);

  const highPriorityAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const severity = String(
        alert.severity ?? ''
      ).toUpperCase();

      return [
        'CRITICAL',
        'SEVERE',
        'HIGH',
      ].includes(severity);
    });
  }, [alerts]);

  const reportData =
    report?.data ?? {};

  /*
   * ---------------------------------------------------------
   * REFRESH
   * ---------------------------------------------------------
   */

  const refreshAll = async () => {
    setError(null);

    await Promise.all([
      checkStatus(),
      loadAudit(),
      loadOperations(),
    ]);
  };

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        <SectionHeader
          title="National Ocean Emergency & Disaster Command"
          subtitle="Government operations console connected to the OceanEmbed Government Intelligence API"
          icon={
            <Shield
              size={18}
              className="text-amber-500"
            />
          }
        />

        {/* ------------------------------------------------ */}
        {/* TOP CONTROLS */}
        {/* ------------------------------------------------ */}

        <div className="flex flex-wrap items-center gap-3 mb-6">

          <div className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-bold text-xs sm:text-sm shadow-xs flex items-center gap-1.5">
            <Shield size={14} className="text-amber-600" />
            Government Officer Access
          </div>

          <div className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm shadow-xs flex items-center">
            <span>Production API:</span>
            <span className="text-[#005088] font-mono font-bold ml-1.5">
              {getGovernmentApiBase()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={
              apiChecking ||
              loadingAudit ||
              loadingOperations
            }
            className="ml-auto px-4 py-2 rounded-xl border border-cyan-300 hover:border-cyan-500 bg-white hover:bg-cyan-50 text-[#005088] font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              size={14}
              className={
                apiChecking ||
                loadingAudit ||
                loadingOperations
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>
        </div>

        {/* ------------------------------------------------ */}
        {/* API STATUS */}
        {/* ------------------------------------------------ */}

        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">

          <div className="flex flex-wrap items-center gap-3">

            <span
              className={`w-3.5 h-3.5 rounded-full ${
                apiOnline === true
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : apiOnline === false
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                    : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              }`}
            />

            <span className="font-bold text-sm text-slate-900">
              Government Intelligence API:
            </span>

            <span
              className={`font-mono text-xs font-bold px-3 py-1 rounded-full border shadow-xs ${
                apiOnline === true
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : apiOnline === false
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              {apiChecking
                ? 'CONNECTING'
                : apiOnline
                  ? 'ONLINE'
                  : 'OFFLINE'}
            </span>

            {apiStatus?.request_id && (
              <span className="text-xs text-slate-700 font-mono font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 ml-auto">
                request {apiStatus.request_id}
              </span>
            )}
          </div>

          {apiStatus?.timestamp && (
            <p className="text-xs text-slate-600 mt-2.5 flex items-center gap-1.5">
              <span>Last API response:</span>
              <span className="text-slate-900 font-bold font-mono">
                {formatTimestamp(apiStatus.timestamp)}
              </span>
            </p>
          )}
        </div>

        {/* ------------------------------------------------ */}
        {/* ERROR */}
        {/* ------------------------------------------------ */}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">

            <div className="flex items-start gap-2.5">

              <AlertTriangle
                size={18}
                className="shrink-0 mt-0.5 text-rose-600"
              />

              <div>
                <p className="font-bold text-rose-900">
                  Government API request issue
                </p>

                <p className="mt-1 text-rose-700 text-xs sm:text-sm font-medium">
                  {error}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ------------------------------------------------ */}
        {/* DATE */}
        {/* ------------------------------------------------ */}

        <div className="mb-6 flex flex-wrap items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">

          <Calendar
            size={18}
            className="text-[#005088]"
          />

          <label
            htmlFor="government-date"
            className="text-sm font-bold text-slate-900"
          >
            Operational date
          </label>

          <input
            id="government-date"
            type="date"
            value={selectedDate}
            min="2018-01-01"
            max="2025-12-31"
            onChange={(event) =>
              setSelectedDate(event.target.value)
            }
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 font-mono font-bold shadow-xs outline-none focus:border-[#005088] focus:ring-2 focus:ring-cyan-500/20"
          />

          <span className="text-xs font-medium text-slate-500">
            Data is requested directly from the FastAPI Government Intelligence API.
          </span>
        </div>

        {/* ------------------------------------------------ */}
        {/* SUMMARY CARDS */}
        {/* ------------------------------------------------ */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-md transition-all">

            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3 shadow-xs">
              <Bell size={18} />
            </div>

            <p className="text-3xl sm:text-4xl font-black text-rose-600 tracking-tight">
              {activeAlerts.length}
            </p>

            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1.5">
              Active API Alerts
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-md transition-all">

            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-xs">
              <AlertTriangle size={18} />
            </div>

            <p className="text-3xl sm:text-4xl font-black text-amber-600 tracking-tight">
              {highPriorityAlerts.length}
            </p>

            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1.5">
              High/Critical Alerts
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-md transition-all">

            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-[#005088] mb-3 shadow-xs">
              <FileText size={18} />
            </div>

            <p className="text-3xl sm:text-4xl font-black text-[#005088] tracking-tight">
              {auditRecords.length}
            </p>

            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1.5">
              Backend Audit Records
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-md transition-all">

            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
              <Server size={18} />
            </div>

            <p className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
              {apiOnline === true ? 'OK' : '—'}
            </p>

            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1.5">
              Government API
            </p>
          </div>
        </div>

        {/* ------------------------------------------------ */}
        {/* TABS */}
        {/* ------------------------------------------------ */}

        <div className="flex gap-1.5 p-1.5 rounded-2xl border border-slate-200 bg-slate-100 mb-6 w-fit shadow-xs">

          {[
            {
              id: 'alerts' as const,
              label: 'Alert Feed',
              icon: Bell,
            },
            {
              id: 'report' as const,
              label: 'Daily Report',
              icon: FileText,
            },
            {
              id: 'audit' as const,
              label: 'Audit Log',
              icon: Database,
            },
          ].map(
            ({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === id
                    ? 'bg-white text-[#005088] border border-slate-200 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            )
          )}
        </div>

        {/* ================================================= */}
        {/* ALERT TAB */}
        {/* ================================================= */}

        {activeTab === 'alerts' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden">

            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">

              <div>
                <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Bell
                    size={17}
                    className="text-rose-600"
                  />
                  Government Alert Feed
                </h2>

                <p className="text-xs font-mono text-slate-500 mt-1">
                  Real response from /api/government/alerts/{selectedDate}
                </p>
              </div>

              <span className="text-xs font-mono font-bold text-[#005088] bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full shadow-xs">
                {alerts.length} API record(s)
              </span>
            </div>

            {loadingOperations ? (
              <div className="p-12 text-center text-slate-600">

                <RefreshCw
                  size={24}
                  className="animate-spin mx-auto mb-3 text-[#005088]"
                />

                <span className="font-semibold text-sm">Loading government alerts...</span>
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-12 text-center">

                <CheckCircle2
                  size={36}
                  className="text-emerald-500 mx-auto mb-3"
                />

                <p className="text-base font-bold text-slate-900">
                  No alerts returned by the API.
                </p>

                <p className="text-xs text-slate-500 mt-1.5">
                  This is the actual API result.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">

                {alerts.map((alert, index) => {

                  const severity =
                    String(
                      alert.severity ??
                        'UNCLASSIFIED'
                    );

                  const status =
                    String(
                      alert.status ??
                        'ACTIVE'
                    );

                  const isHighPriority = [
                    'CRITICAL',
                    'SEVERE',
                    'HIGH',
                  ].includes(severity.toUpperCase());

                  return (
                    <div
                      key={
                        alert.id ??
                        alert.alert_id ??
                        index
                      }
                      className="p-6 hover:bg-slate-50/50 transition-colors"
                    >

                      <div className="flex flex-wrap items-center gap-2.5 mb-3">

                        <span
                          className={`px-3 py-1 rounded-full border text-xs font-bold font-mono shadow-xs ${
                            isHighPriority
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-amber-300 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {severity}
                        </span>

                        <span className="px-3 py-1 rounded-full border border-slate-200 bg-slate-100 text-slate-700 font-bold font-mono text-xs">
                          {status}
                        </span>

                        {alert.source && (
                          <span className="text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                            Source: {String(alert.source)}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                        {alert.message ??
                          `Government alert returned for ${selectedDate}.`}
                      </p>

                      <div className="flex flex-wrap gap-3 mt-4 text-xs">

                        {alert.event_cells !==
                          undefined && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                            <span className="text-slate-500 font-semibold">Event cells:</span>
                            <span className="text-cyan-800 font-black font-mono text-sm">
                              {String(alert.event_cells)}
                            </span>
                          </div>
                        )}

                        {alert.forecast_days !==
                          undefined && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                            <span className="text-slate-500 font-semibold">Forecast days:</span>
                            <span className="text-amber-800 font-black font-mono text-sm">
                              {String(alert.forecast_days)}
                            </span>
                          </div>
                        )}

                        {alert.peak_day && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                            <span className="text-slate-500 font-semibold">Peak day:</span>
                            <span className="text-emerald-800 font-black font-mono text-sm">
                              {String(alert.peak_day)}
                            </span>
                          </div>
                        )}

                        {(alert.timestamp ||
                          alert.created_at) && (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                            <Clock size={13} className="text-[#005088]" />
                            <span className="text-slate-900 font-bold font-mono">
                              {formatTimestamp(
                                String(
                                  alert.timestamp ??
                                    alert.created_at
                                )
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ================================================= */}
        {/* REPORT TAB */}
        {/* ================================================= */}

        {activeTab === 'report' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden">

            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70">

              <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">

                <FileText
                  size={17}
                  className="text-[#005088]"
                />

                Daily Government Operational Report
              </h2>

              <p className="text-xs font-mono text-slate-500 mt-1">
                Real response from /api/government/report/{selectedDate}
              </p>
            </div>

            {loadingOperations ? (
              <div className="p-12 text-center text-slate-600">

                <RefreshCw
                  size={24}
                  className="animate-spin mx-auto mb-3 text-[#005088]"
                />

                <span className="font-semibold text-sm">Loading report...</span>
              </div>
            ) : (
              <div className="p-6 space-y-5">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">

                    <Activity
                      size={18}
                      className="text-emerald-600 mb-2"
                    />

                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Report success
                    </p>

                    <p className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                      {report?.success
                        ? 'YES'
                        : 'NO'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 shadow-xs">

                    <Database
                      size={18}
                      className="text-[#005088] mb-2"
                    />

                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Request ID
                    </p>

                    <p className="text-sm font-mono font-black text-[#005088] break-all mt-0.5">
                      {report?.request_id ??
                        '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">

                    <Clock
                      size={18}
                      className="text-amber-600 mb-2"
                    />

                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Generated
                    </p>

                    <p className="text-sm font-mono font-black text-amber-800 mt-0.5">
                      {formatTimestamp(
                        report?.timestamp
                      )}
                    </p>
                  </div>
                </div>

                <pre className="overflow-auto max-h-[520px] rounded-xl border border-slate-200 bg-slate-900 text-cyan-300 p-5 text-xs font-mono leading-relaxed shadow-inner">
                  {JSON.stringify(
                    reportData,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </section>
        )}

        {/* ================================================= */}
        {/* AUDIT TAB */}
        {/* ================================================= */}

        {activeTab === 'audit' && (
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden">

            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/70">

              <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">

                <FileText
                  size={17}
                  className="text-[#005088]"
                />

                Backend Audit Log
              </h2>

              <p className="text-xs font-mono text-slate-500 mt-1">
                Real records returned by GET /api/government/audit
              </p>
            </div>

            {loadingAudit ? (
              <div className="p-12 text-center text-slate-600">

                <RefreshCw
                  size={24}
                  className="animate-spin mx-auto mb-3 text-[#005088]"
                />

                <span className="font-semibold text-sm">Loading backend audit records...</span>
              </div>
            ) : auditRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-600 font-medium">
                No audit records returned by the backend.
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full text-xs">

                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">

                      <th className="px-4 py-3.5 text-left text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        Timestamp
                      </th>

                      <th className="px-4 py-3.5 text-left text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        Action
                      </th>

                      <th className="px-4 py-3.5 text-left text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        Endpoint
                      </th>

                      <th className="px-4 py-3.5 text-left text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        Status
                      </th>

                      <th className="px-4 py-3.5 text-left text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        Request ID
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {[...auditRecords]
                      .reverse()
                      .map(
                        (
                          record,
                          index
                        ) => (
                          <tr
                            key={`${record.request_id ?? 'record'}-${index}`}
                            className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                          >

                            <td className="px-4 py-3 text-slate-800 font-mono font-bold whitespace-nowrap">
                              {formatTimestamp(
                                record.timestamp
                              )}
                            </td>

                            <td className="px-4 py-3">

                              <span className="px-2.5 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-[#005088] font-bold font-mono text-[11px] shadow-xs">
                                {record.action ??
                                  '—'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-slate-800 font-mono text-xs font-semibold max-w-[360px] truncate">
                              {record.endpoint ??
                                '—'}
                            </td>

                            <td className="px-4 py-3">

                              <span
                                className={`px-2.5 py-1 rounded-full border font-mono font-bold text-xs shadow-xs ${
                                  record.status_code ===
                                  200
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-rose-200 bg-rose-50 text-rose-800'
                                }`}
                              >
                                {record.status_code ??
                                  '—'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-[#005088] font-mono font-bold whitespace-nowrap">
                              {record.request_id ??
                                '—'}
                            </td>

                          </tr>
                        )
                      )}

                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------ */}
        {/* FOOTER */}
        {/* ------------------------------------------------ */}

        <div className="mt-6 flex items-center gap-2.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">

          <Activity size={14} className="text-[#005088] shrink-0" />

          <span>
            This portal reads operational data directly from the FastAPI Government Intelligence API.
            No synthetic ocean measurements are created by this page.
          </span>

        </div>

      </div>
    </PageLayout>
  );
}