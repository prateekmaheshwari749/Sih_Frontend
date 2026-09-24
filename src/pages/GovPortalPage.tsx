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
              className="text-yellow-400"
            />
          }
        />

        {/* ------------------------------------------------ */}
        {/* TOP CONTROLS */}
        {/* ------------------------------------------------ */}

        <div className="flex flex-wrap items-center gap-3 mb-6">

          <div className="px-4 py-2 rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-300 text-sm">
            Government Officer Access
          </div>

          <div className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white/60 text-sm">
            Production API:{' '}
            <span className="text-white">
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
            className="ml-auto px-4 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm flex items-center gap-2 disabled:opacity-50"
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

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">

          <div className="flex flex-wrap items-center gap-3">

            <span
              className={`w-3 h-3 rounded-full ${
                apiOnline === true
                  ? 'bg-green-400'
                  : apiOnline === false
                    ? 'bg-red-400'
                    : 'bg-yellow-400'
              }`}
            />

            <span className="font-mono text-sm text-white/80">
              Government Intelligence API:
            </span>

            <span
              className={`font-mono text-sm font-semibold ${
                apiOnline === true
                  ? 'text-green-400'
                  : apiOnline === false
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }`}
            >
              {apiChecking
                ? 'CONNECTING'
                : apiOnline
                  ? 'ONLINE'
                  : 'OFFLINE'}
            </span>

            {apiStatus?.request_id && (
              <span className="text-xs text-white/30 ml-auto font-mono">
                request {apiStatus.request_id}
              </span>
            )}
          </div>

          {apiStatus?.timestamp && (
            <p className="text-xs text-white/35 mt-2">
              Last API response:{' '}
              {formatTimestamp(apiStatus.timestamp)}
            </p>
          )}
        </div>

        {/* ------------------------------------------------ */}
        {/* ERROR */}
        {/* ------------------------------------------------ */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

            <div className="flex items-start gap-2">

              <AlertTriangle
                size={16}
                className="shrink-0 mt-0.5"
              />

              <div>
                <p className="font-semibold">
                  Government API request issue
                </p>

                <p className="mt-1 text-red-300/70">
                  {error}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ------------------------------------------------ */}
        {/* DATE */}
        {/* ------------------------------------------------ */}

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">

          <Calendar
            size={16}
            className="text-cyan-400"
          />

          <label
            htmlFor="government-date"
            className="text-sm text-white/60"
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
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          />

          <span className="text-xs text-white/35">
            Data is requested directly from the FastAPI
            Government Intelligence API.
          </span>
        </div>

        {/* ------------------------------------------------ */}
        {/* SUMMARY CARDS */}
        {/* ------------------------------------------------ */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">

            <Bell
              size={18}
              className="text-red-400 mb-3"
            />

            <p className="text-3xl font-black text-white">
              {activeAlerts.length}
            </p>

            <p className="text-xs text-white/50 mt-1">
              Active API Alerts
            </p>
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">

            <AlertTriangle
              size={18}
              className="text-orange-400 mb-3"
            />

            <p className="text-3xl font-black text-white">
              {highPriorityAlerts.length}
            </p>

            <p className="text-xs text-white/50 mt-1">
              High/Critical Alerts
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">

            <FileText
              size={18}
              className="text-cyan-400 mb-3"
            />

            <p className="text-3xl font-black text-white">
              {auditRecords.length}
            </p>

            <p className="text-xs text-white/50 mt-1">
              Backend Audit Records
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">

            <Server
              size={18}
              className="text-green-400 mb-3"
            />

            <p className="text-3xl font-black text-white">
              {apiOnline === true ? 'OK' : '—'}
            </p>

            <p className="text-xs text-white/50 mt-1">
              Government API
            </p>
          </div>
        </div>

        {/* ------------------------------------------------ */}
        {/* TABS */}
        {/* ------------------------------------------------ */}

        <div className="flex gap-1 p-1 rounded-xl border border-white/10 bg-white/5 mb-6 w-fit">

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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
                  activeTab === id
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/25'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          )}
        </div>

        {/* ================================================= */}
        {/* ALERT TAB */}
        {/* ================================================= */}

        {activeTab === 'alerts' && (
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">

            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">

              <div>
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Bell
                    size={16}
                    className="text-red-400"
                  />
                  Government Alert Feed
                </h2>

                <p className="text-xs text-white/40 mt-1">
                  Real response from{' '}
                  /api/government/alerts/{selectedDate}
                </p>
              </div>

              <span className="text-xs text-white/40">
                {alerts.length} API record(s)
              </span>
            </div>

            {loadingOperations ? (
              <div className="p-10 text-center text-white/40">

                <RefreshCw
                  size={20}
                  className="animate-spin mx-auto mb-3"
                />

                Loading government alerts...
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-10 text-center">

                <CheckCircle2
                  size={30}
                  className="text-green-400 mx-auto mb-3"
                />

                <p className="text-white/60">
                  No alerts returned by the API.
                </p>

                <p className="text-xs text-white/30 mt-1">
                  This is the actual API result.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">

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

                  return (
                    <div
                      key={
                        alert.id ??
                        alert.alert_id ??
                        index
                      }
                      className="p-6"
                    >

                      <div className="flex flex-wrap items-center gap-2 mb-3">

                        <span className="px-2 py-1 rounded-full border border-red-500/25 bg-red-500/10 text-red-300 text-xs">
                          {severity}
                        </span>

                        <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/60 text-xs">
                          {status}
                        </span>

                        {alert.source && (
                          <span className="text-xs text-white/30">
                            Source:{' '}
                            {String(alert.source)}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-white/80 leading-relaxed">
                        {alert.message ??
                          `Government alert returned for ${selectedDate}.`}
                      </p>

                      <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/40">

                        {alert.event_cells !==
                          undefined && (
                          <span>
                            Event cells:{' '}
                            {String(
                              alert.event_cells
                            )}
                          </span>
                        )}

                        {alert.forecast_days !==
                          undefined && (
                          <span>
                            Forecast days:{' '}
                            {String(
                              alert.forecast_days
                            )}
                          </span>
                        )}

                        {alert.peak_day && (
                          <span>
                            Peak day:{' '}
                            {String(
                              alert.peak_day
                            )}
                          </span>
                        )}

                        {(alert.timestamp ||
                          alert.created_at) && (
                          <span className="flex items-center gap-1">

                            <Clock size={12} />

                            {formatTimestamp(
                              String(
                                alert.timestamp ??
                                  alert.created_at
                              )
                            )}
                          </span>
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
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">

            <div className="px-6 py-4 border-b border-white/10">

              <h2 className="font-semibold text-white flex items-center gap-2">

                <FileText
                  size={16}
                  className="text-cyan-400"
                />

                Daily Government Operational Report
              </h2>

              <p className="text-xs text-white/40 mt-1">
                Real response from{' '}
                /api/government/report/{selectedDate}
              </p>
            </div>

            {loadingOperations ? (
              <div className="p-10 text-center text-white/40">

                <RefreshCw
                  size={20}
                  className="animate-spin mx-auto mb-3"
                />

                Loading report...
              </div>
            ) : (
              <div className="p-6 space-y-5">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <div className="rounded-xl border border-white/10 bg-black/10 p-4">

                    <Activity
                      size={16}
                      className="text-cyan-400 mb-2"
                    />

                    <p className="text-xs text-white/40">
                      Report success
                    </p>

                    <p className="text-lg font-semibold text-white">
                      {report?.success
                        ? 'YES'
                        : 'NO'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/10 p-4">

                    <Database
                      size={16}
                      className="text-green-400 mb-2"
                    />

                    <p className="text-xs text-white/40">
                      Request ID
                    </p>

                    <p className="text-sm font-mono text-white break-all">
                      {report?.request_id ??
                        '—'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/10 p-4">

                    <Clock
                      size={16}
                      className="text-yellow-400 mb-2"
                    />

                    <p className="text-xs text-white/40">
                      Generated
                    </p>

                    <p className="text-sm text-white">
                      {formatTimestamp(
                        report?.timestamp
                      )}
                    </p>
                  </div>
                </div>

                <pre className="overflow-auto max-h-[520px] rounded-xl border border-white/10 bg-black/20 p-5 text-xs text-white/70">
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
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">

            <div className="px-6 py-4 border-b border-white/10">

              <h2 className="font-semibold text-white flex items-center gap-2">

                <FileText
                  size={16}
                  className="text-cyan-400"
                />

                Backend Audit Log
              </h2>

              <p className="text-xs text-white/40 mt-1">
                Real records returned by{' '}
                GET /api/government/audit
              </p>
            </div>

            {loadingAudit ? (
              <div className="p-10 text-center text-white/40">

                <RefreshCw
                  size={20}
                  className="animate-spin mx-auto mb-3"
                />

                Loading backend audit records...
              </div>
            ) : auditRecords.length === 0 ? (
              <div className="p-10 text-center text-white/40">
                No audit records returned by the backend.
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full text-xs">

                  <thead>
                    <tr className="border-b border-white/10">

                      <th className="px-4 py-3 text-left text-white/40 font-medium">
                        Timestamp
                      </th>

                      <th className="px-4 py-3 text-left text-white/40 font-medium">
                        Action
                      </th>

                      <th className="px-4 py-3 text-left text-white/40 font-medium">
                        Endpoint
                      </th>

                      <th className="px-4 py-3 text-left text-white/40 font-medium">
                        Status
                      </th>

                      <th className="px-4 py-3 text-left text-white/40 font-medium">
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
                            className="border-b border-white/5 hover:bg-white/5"
                          >

                            <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                              {formatTimestamp(
                                record.timestamp
                              )}
                            </td>

                            <td className="px-4 py-3">

                              <span className="px-2 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                                {record.action ??
                                  '—'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-white/50 max-w-[360px] truncate">
                              {record.endpoint ??
                                '—'}
                            </td>

                            <td className="px-4 py-3">

                              <span
                                className={
                                  record.status_code ===
                                  200
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                }
                              >
                                {record.status_code ??
                                  '—'}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-white/40 font-mono whitespace-nowrap">
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

        <div className="mt-6 flex items-center gap-2 text-xs text-white/30">

          <Activity size={12} />

          This portal reads operational data directly
          from the FastAPI Government Intelligence API.
          No synthetic ocean measurements are created
          by this page.

        </div>

      </div>
    </PageLayout>
  );
}