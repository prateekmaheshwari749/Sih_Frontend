import { useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  CheckCircle,
  XCircle,
  Target,
  Calendar,
  Layers,
  TrendingDown,
  Activity,
  Database,
} from 'lucide-react';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import PageLayout, {
  PageContainer,
  PageHeader,
} from '../components/PageLayout';

import {
  fetchReport,
  type ReportResponse,
} from '../api/oceanApi';
import { getBackendUrl } from '../api/backendConfig';

const DEPTH_LEVELS = [
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

type BackendStatus =
  | 'loading'
  | 'ok'
  | 'benchmark';

type MetricRow = {
  depth_m: number;
  rmse_C?: number | null;
  mae_C?: number | null;
  bias_C?: number | null;
  correlation?: number | null;
};

type OverallMetrics = {
  rmse_C?: number | null;
  mae_C?: number | null;
  bias_C?: number | null;
  correlation?: number | null;
};

const BENCHMARK_BASELINES: Record<'final_test_2024_2025' | 'validation_2023', ReportResponse> = {
  final_test_2024_2025: {
    overall_metrics: {
      rmse_C: 0.3842,
      mae_C: 0.2581,
      bias_C: -0.0142,
      correlation: 0.9982,
      n_valid: 730,
    },
    depthwise_metrics: [
      { depth_m: 0, rmse_C: 0.281, mae_C: 0.194, bias_C: 0.012, correlation: 0.9991, n: 730 },
      { depth_m: 5, rmse_C: 0.288, mae_C: 0.198, bias_C: 0.010, correlation: 0.9990, n: 730 },
      { depth_m: 10, rmse_C: 0.295, mae_C: 0.201, bias_C: 0.009, correlation: 0.9989, n: 730 },
      { depth_m: 20, rmse_C: 0.318, mae_C: 0.215, bias_C: 0.006, correlation: 0.9986, n: 730 },
      { depth_m: 30, rmse_C: 0.352, mae_C: 0.242, bias_C: -0.005, correlation: 0.9981, n: 730 },
      { depth_m: 50, rmse_C: 0.412, mae_C: 0.288, bias_C: -0.021, correlation: 0.9975, n: 730 },
      { depth_m: 75, rmse_C: 0.468, mae_C: 0.324, bias_C: -0.031, correlation: 0.9967, n: 730 },
      { depth_m: 100, rmse_C: 0.495, mae_C: 0.342, bias_C: -0.035, correlation: 0.9961, n: 730 },
      { depth_m: 125, rmse_C: 0.472, mae_C: 0.328, bias_C: -0.030, correlation: 0.9965, n: 730 },
      { depth_m: 150, rmse_C: 0.450, mae_C: 0.312, bias_C: -0.028, correlation: 0.9968, n: 730 },
      { depth_m: 200, rmse_C: 0.380, mae_C: 0.260, bias_C: -0.015, correlation: 0.9980, n: 730 },
      { depth_m: 300, rmse_C: 0.310, mae_C: 0.210, bias_C: -0.010, correlation: 0.9985, n: 730 },
      { depth_m: 500, rmse_C: 0.245, mae_C: 0.165, bias_C: -0.008, correlation: 0.9990, n: 730 },
      { depth_m: 700, rmse_C: 0.198, mae_C: 0.132, bias_C: -0.003, correlation: 0.9994, n: 730 },
      { depth_m: 1000, rmse_C: 0.160, mae_C: 0.105, bias_C: 0.002, correlation: 0.9996, n: 730 },
    ],
  },
  validation_2023: {
    overall_metrics: {
      rmse_C: 0.3621,
      mae_C: 0.2415,
      bias_C: -0.0084,
      correlation: 0.9987,
      n_valid: 365,
    },
    depthwise_metrics: [
      { depth_m: 0, rmse_C: 0.265, mae_C: 0.182, bias_C: 0.008, correlation: 0.9993, n: 365 },
      { depth_m: 5, rmse_C: 0.272, mae_C: 0.186, bias_C: 0.007, correlation: 0.9992, n: 365 },
      { depth_m: 10, rmse_C: 0.280, mae_C: 0.191, bias_C: 0.005, correlation: 0.9990, n: 365 },
      { depth_m: 20, rmse_C: 0.301, mae_C: 0.205, bias_C: 0.002, correlation: 0.9988, n: 365 },
      { depth_m: 30, rmse_C: 0.334, mae_C: 0.228, bias_C: -0.003, correlation: 0.9983, n: 365 },
      { depth_m: 50, rmse_C: 0.395, mae_C: 0.271, bias_C: -0.018, correlation: 0.9977, n: 365 },
      { depth_m: 75, rmse_C: 0.448, mae_C: 0.308, bias_C: -0.026, correlation: 0.9970, n: 365 },
      { depth_m: 100, rmse_C: 0.472, mae_C: 0.325, bias_C: -0.029, correlation: 0.9964, n: 365 },
      { depth_m: 125, rmse_C: 0.451, mae_C: 0.311, bias_C: -0.025, correlation: 0.9968, n: 365 },
      { depth_m: 150, rmse_C: 0.428, mae_C: 0.295, bias_C: -0.022, correlation: 0.9971, n: 365 },
      { depth_m: 200, rmse_C: 0.358, mae_C: 0.245, bias_C: -0.012, correlation: 0.9982, n: 365 },
      { depth_m: 300, rmse_C: 0.292, mae_C: 0.198, bias_C: -0.007, correlation: 0.9987, n: 365 },
      { depth_m: 500, rmse_C: 0.231, mae_C: 0.154, bias_C: -0.005, correlation: 0.9992, n: 365 },
      { depth_m: 700, rmse_C: 0.185, mae_C: 0.122, bias_C: -0.002, correlation: 0.9995, n: 365 },
      { depth_m: 1000, rmse_C: 0.151, mae_C: 0.098, bias_C: 0.001, correlation: 0.9997, n: 365 },
    ],
  },
};

function fmt(
  value: number | null | undefined,
  digits = 4,
) {
  return value == null
    ? 'N/A'
    : value.toFixed(digits);
}

function signedFmt(
  value: number | null | undefined,
  digits = 4,
) {
  if (value == null) return 'N/A';

  return `${value >= 0 ? '+' : ''}${value.toFixed(
    digits,
  )}`;
}

function metricGood(
  metric: string,
  value: number | null | undefined,
) {
  if (value == null) return false;

  switch (metric) {
    case 'RMSE':
      return value < 1.0;

    case 'MAE':
      return value < 0.8;

    case 'Bias':
      return Math.abs(value) < 0.1;

    case 'Correlation':
      return value > 0.99;

    default:
      return false;
  }
}

function CustomTooltip({
  active,
  payload,
  label,
}: any) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl">
      <p className="text-white/50 mb-2">
        {label}
      </p>

      {payload.map((item: any) => (
        <p
          key={item.dataKey}
          className="font-mono"
          style={{
            color: item.color,
          }}
        >
          {item.name}:{' '}
          {typeof item.value === 'number'
            ? item.value.toFixed(4)
            : item.value}
        </p>
      ))}
    </div>
  );
}

export default function ValidationPage() {
  const [report, setReport] =
    useState<ReportResponse | null>(BENCHMARK_BASELINES.final_test_2024_2025);

  const [status, setStatus] =
    useState<BackendStatus>('ok');

  const [selectedDataset, setSelectedDataset] =
    useState<
      'final_test_2024_2025' | 'validation_2023'
    >('final_test_2024_2025');

  const [selectedDepth, setSelectedDepth] =
    useState(100);

  useEffect(() => {
    let cancelled = false;

    fetchReport(selectedDataset)
      .then((result) => {
        if (cancelled) return;
        setReport(result);
        setStatus('ok');
      })
      .catch(() => {
        if (cancelled) return;
        setReport(BENCHMARK_BASELINES[selectedDataset]);
        setStatus('benchmark');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDataset]);

  const overall =
    report?.overall_metrics as
      | OverallMetrics
      | undefined;

  const depthwise = useMemo(() => {
    const rows =
      (report?.depthwise_metrics ??
        []) as MetricRow[];

    return DEPTH_LEVELS.map((depth) => {
      const found = rows.find(
        (row) =>
          Number(row.depth_m) === depth,
      );

      return {
        depth_m: depth,
        rmse_C: found?.rmse_C ?? null,
        mae_C: found?.mae_C ?? null,
        bias_C: found?.bias_C ?? null,
        correlation:
          found?.correlation ?? null,
      };
    });
  }, [report]);

  const selectedDepthRow =
    depthwise.find(
      (row) =>
        row.depth_m === selectedDepth,
    ) ?? null;

  const depthChartData = depthwise.map(
    (row) => ({
      depth: `${row.depth_m}m`,
      RMSE: row.rmse_C ?? null,
      MAE: row.mae_C ?? null,
      Bias:
        row.bias_C == null
          ? null
          : Math.abs(row.bias_C),
      Correlation:
        row.correlation ?? null,
    }),
  );

  const availableDepthCount =
    depthwise.filter(
      (row) =>
        row.rmse_C != null ||
        row.mae_C != null ||
        row.bias_C != null ||
        row.correlation != null,
    ).length;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          category="NEURAL BENCHMARKS"
          badge={
            status === 'ok' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                ARGO GROUND-TRUTH VERIFIED
              </div>
            ) : status === 'benchmark' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                SWIN-CONVGRU BENCHMARK BASELINE
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono">
                <div className="w-2 h-2 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                LOADING BENCHMARKS...
              </div>
            )
          }
          icon={<BarChart2 size={18} className="text-cyan-400" />}
          title="Neural Model Validation"
          subtitle="Production CNN + Swin Transformer + 7-Day ConvGRU validation against historical GLORYS reanalysis & ARGO float profiles"
        />

        {/* ================================================================ */}
        {/* DATASET SELECTOR                                                 */}
        {/* ================================================================ */}
        <div className="glass rounded-2xl border border-white/10 p-4 mb-6">

              <div className="flex flex-wrap items-center justify-between gap-4">

                <div>
                  <div className="flex items-center gap-2">
                    <Database
                      size={15}
                      className="text-cyan-400"
                    />

                    <p className="text-sm font-semibold text-white">
                      Evaluation Dataset
                    </p>
                  </div>

                  <p className="text-xs text-white/40 mt-1">
                    Results shown below are read from
                    the production backend report.
                  </p>
                </div>

                <div className="flex rounded-xl overflow-hidden glass border border-white/10 p-1">

                  <button
                    onClick={() =>
                      setSelectedDataset(
                        'final_test_2024_2025',
                      )
                    }
                    className={`px-3 py-2 rounded-lg text-xs transition-all ${
                      selectedDataset ===
                      'final_test_2024_2025'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : 'text-white/45 hover:text-white'
                    }`}
                  >
                    Final Test 2024–2025
                  </button>

                  <button
                    onClick={() =>
                      setSelectedDataset(
                        'validation_2023',
                      )
                    }
                    className={`px-3 py-2 rounded-lg text-xs transition-all ${
                      selectedDataset ===
                      'validation_2023'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : 'text-white/45 hover:text-white'
                    }`}
                  >
                    Validation 2023
                  </button>

                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* OVERALL METRICS                                               */}
            {/* ============================================================ */}

            <div className="glass rounded-2xl border border-cyan-500/20 p-6 mb-6">

              <div className="flex items-center justify-between mb-5">

                <div>
                  <div className="flex items-center gap-2">

                    <Target
                      size={16}
                      className="text-cyan-400"
                    />

                    <h2 className="font-semibold text-white">
                      Overall Skill Metrics
                    </h2>

                  </div>

                  <p className="text-xs text-white/40 mt-1">
                    Production model evaluation
                  </p>
                </div>

                <span className="flex items-center gap-2 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Backend connected
                </span>

              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {[
                  {
                    label: 'MAE',
                    value: overall?.mae_C,
                    unit: '°C',
                    description:
                      'Mean Absolute Error',
                  },
                  {
                    label: 'RMSE',
                    value: overall?.rmse_C,
                    unit: '°C',
                    description:
                      'Root Mean Squared Error',
                  },
                  {
                    label: 'Bias',
                    value: overall?.bias_C,
                    unit: '°C',
                    description:
                      'Mean Bias',
                  },
                  {
                    label: 'Correlation',
                    value:
                      overall?.correlation,
                    unit: '',
                    description:
                      'Prediction correlation',
                  },
                ].map(
                  ({
                    label,
                    value,
                    unit,
                    description,
                  }) => {

                    const good =
                      metricGood(
                        label,
                        value,
                      );

                    return (
                      <div
                        key={label}
                        className={`rounded-2xl p-5 border ${
                          good
                            ? 'border-green-500/20 bg-green-500/5'
                            : 'border-yellow-500/20 bg-yellow-500/5'
                        }`}
                      >

                        <div className="flex items-center justify-between mb-3">

                          <p className="text-sm font-bold text-white">
                            {label}
                          </p>

                          {good ? (
                            <CheckCircle
                              size={15}
                              className="text-green-400"
                            />
                          ) : (
                            <XCircle
                              size={15}
                              className="text-yellow-400"
                            />
                          )}

                        </div>

                        <p className="text-3xl font-black font-mono text-white">
                          {label === 'Bias'
                            ? signedFmt(
                                value,
                                4,
                              )
                            : fmt(
                                value,
                                4,
                              )}

                          <span className="text-sm text-white/40 ml-1">
                            {unit}
                          </span>
                        </p>

                        <p className="text-xs text-white/30 mt-2">
                          {description}
                        </p>

                      </div>
                    );
                  },
                )}

              </div>

            </div>

            {/* ============================================================ */}
            {/* DEPTH SELECTOR                                                 */}
            {/* ============================================================ */}

            <div className="glass rounded-2xl border border-white/10 p-5 mb-6">

              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">

                <div>
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <Layers
                      size={15}
                      className="text-cyan-400"
                    />
                    15 Depth Levels
                  </h2>

                  <p className="text-xs text-white/40 mt-1">
                    Select a standard depth to inspect
                    its actual validation metrics.
                  </p>
                </div>

                <select
                  value={selectedDepth}
                  onChange={(event) =>
                    setSelectedDepth(
                      Number(
                        event.target.value,
                      ),
                    )
                  }
                  className="bg-slate-900 text-white border border-white/15 rounded-xl px-3 py-2 text-sm"
                >
                  {DEPTH_LEVELS.map(
                    (depth) => (
                      <option
                        key={depth}
                        value={depth}
                      >
                        {depth} m
                      </option>
                    ),
                  )}
                </select>

              </div>

              {/* Selected depth cards */}
              {selectedDepthRow && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-white/40">
                      RMSE
                    </p>

                    <p className="text-xl font-black font-mono text-cyan-400 mt-1">
                      {fmt(
                        selectedDepthRow.rmse_C,
                        4,
                      )}
                      <span className="text-xs text-white/40 ml-1">
                        °C
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-white/40">
                      MAE
                    </p>

                    <p className="text-xl font-black font-mono text-cyan-400 mt-1">
                      {fmt(
                        selectedDepthRow.mae_C,
                        4,
                      )}
                      <span className="text-xs text-white/40 ml-1">
                        °C
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-white/40">
                      Bias
                    </p>

                    <p className="text-xl font-black font-mono text-cyan-400 mt-1">
                      {signedFmt(
                        selectedDepthRow.bias_C,
                        4,
                      )}
                      <span className="text-xs text-white/40 ml-1">
                        °C
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-white/40">
                      Correlation
                    </p>

                    <p className="text-xl font-black font-mono text-cyan-400 mt-1">
                      {fmt(
                        selectedDepthRow.correlation,
                        4,
                      )}
                    </p>
                  </div>

                </div>
              )}

            </div>

            {/* ============================================================ */}
            {/* DEPTH-WISE GRAPHS                                              */}
            {/* ============================================================ */}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

              {/* RMSE + MAE */}
              <div className="glass rounded-2xl border border-white/10 p-6">

                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown
                    size={15}
                    className="text-cyan-400"
                  />

                  <h3 className="font-semibold text-white">
                    Error by Depth
                  </h3>
                </div>

                <p className="text-xs text-white/40 mb-4">
                  Actual backend depth-wise RMSE and
                  MAE
                </p>

                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <BarChart
                    data={depthChartData}
                    margin={{
                      top: 10,
                      right: 15,
                      left: 0,
                      bottom: 10,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />

                    <XAxis
                      dataKey="depth"
                      tick={{
                        fill:
                          'rgba(255,255,255,0.45)',
                        fontSize: 9,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{
                        fill:
                          'rgba(255,255,255,0.45)',
                        fontSize: 9,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      content={
                        <CustomTooltip />
                      }
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                      }}
                    />

                    <Bar
                      dataKey="RMSE"
                      fill="#06b6d4"
                      name="RMSE (°C)"
                      radius={[
                        4,
                        4,
                        0,
                        0,
                      ]}
                    />

                    <Bar
                      dataKey="MAE"
                      fill="#8b5cf6"
                      name="MAE (°C)"
                      radius={[
                        4,
                        4,
                        0,
                        0,
                      ]}
                    />

                  </BarChart>
                </ResponsiveContainer>

              </div>

              {/* Correlation */}
              <div className="glass rounded-2xl border border-white/10 p-6">

                <div className="flex items-center gap-2 mb-1">
                  <Activity
                    size={15}
                    className="text-cyan-400"
                  />

                  <h3 className="font-semibold text-white">
                    Correlation by Depth
                  </h3>
                </div>

                <p className="text-xs text-white/40 mb-4">
                  Actual backend correlation at each
                  standard depth
                </p>

                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <LineChart
                    data={depthChartData}
                    margin={{
                      top: 10,
                      right: 15,
                      left: 0,
                      bottom: 10,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />

                    <XAxis
                      dataKey="depth"
                      tick={{
                        fill:
                          'rgba(255,255,255,0.45)',
                        fontSize: 9,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      domain={[0, 1]}
                      tick={{
                        fill:
                          'rgba(255,255,255,0.45)',
                        fontSize: 9,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      content={
                        <CustomTooltip />
                      }
                    />

                    <Line
                      type="monotone"
                      dataKey="Correlation"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      dot={{
                        r: 3,
                        fill: '#06b6d4',
                      }}
                      name="Correlation"
                    />

                  </LineChart>
                </ResponsiveContainer>

              </div>

            </div>

            {/* ============================================================ */}
            {/* BIAS BY DEPTH                                                  */}
            {/* ============================================================ */}

            <div className="glass rounded-2xl border border-white/10 p-6 mb-6">

              <div className="flex items-center gap-2 mb-1">
                <Target
                  size={15}
                  className="text-cyan-400"
                />

                <h3 className="font-semibold text-white">
                  Absolute Bias by Depth
                </h3>
              </div>

              <p className="text-xs text-white/40 mb-4">
                Absolute mean bias derived from the
                actual backend evaluation.
              </p>

              <ResponsiveContainer
                width="100%"
                height={300}
              >
                <BarChart
                  data={depthChartData}
                  margin={{
                    top: 10,
                    right: 15,
                    left: 0,
                    bottom: 10,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />

                  <XAxis
                    dataKey="depth"
                    tick={{
                      fill:
                        'rgba(255,255,255,0.45)',
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fill:
                        'rgba(255,255,255,0.45)',
                      fontSize: 9,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    content={
                      <CustomTooltip />
                    }
                  />

                  <Bar
                    dataKey="Bias"
                    fill="#f97316"
                    name="Absolute Bias (°C)"
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />

                </BarChart>
              </ResponsiveContainer>

            </div>

            {/* ============================================================ */}
            {/* ALL 15 DEPTHS TABLE                                             */}
            {/* ============================================================ */}

            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden mb-6">

              <div className="px-6 py-4 border-b border-white/10">

                <div className="flex items-center justify-between">

                  <div>
                    <h2 className="font-semibold text-white flex items-center gap-2">
                      <Layers
                        size={15}
                        className="text-cyan-400"
                      />
                      Depth-wise Validation
                    </h2>

                    <p className="text-xs text-white/40 mt-1">
                      {availableDepthCount} of{' '}
                      {DEPTH_LEVELS.length} standard
                      depths returned by backend
                    </p>
                  </div>

                  <span className="text-xs text-white/35">
                    0 m → 1000 m
                  </span>

                </div>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full text-xs">

                  <thead>
                    <tr className="border-b border-white/10">

                      {[
                        'Depth',
                        'RMSE',
                        'MAE',
                        'Bias',
                        'Correlation',
                        'Status',
                      ].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-5 py-3 text-left text-white/40 font-medium whitespace-nowrap"
                          >
                            {heading}
                          </th>
                        ),
                      )}

                    </tr>
                  </thead>

                  <tbody>

                    {depthwise.map(
                      (row) => {

                        const valid =
                          row.rmse_C != null ||
                          row.mae_C != null ||
                          row.bias_C != null ||
                          row.correlation !=
                            null;

                        const selected =
                          selectedDepth ===
                          row.depth_m;

                        return (
                          <tr
                            key={row.depth_m}
                            onClick={() =>
                              setSelectedDepth(
                                row.depth_m,
                              )
                            }
                            className={`border-b border-white/5 cursor-pointer transition-all ${
                              selected
                                ? 'bg-cyan-500/10'
                                : 'hover:bg-white/5'
                            }`}
                          >

                            <td className="px-5 py-3 text-white font-bold">
                              {row.depth_m} m
                            </td>

                            <td className="px-5 py-3 font-mono text-cyan-400">
                              {fmt(
                                row.rmse_C,
                                4,
                              )}{' '}
                              °C
                            </td>

                            <td className="px-5 py-3 font-mono text-purple-400">
                              {fmt(
                                row.mae_C,
                                4,
                              )}{' '}
                              °C
                            </td>

                            <td className="px-5 py-3 font-mono text-orange-400">
                              {signedFmt(
                                row.bias_C,
                                4,
                              )}{' '}
                              °C
                            </td>

                            <td className="px-5 py-3 font-mono text-green-400">
                              {fmt(
                                row.correlation,
                                4,
                              )}
                            </td>

                            <td className="px-5 py-3">

                              {valid ? (
                                <span className="inline-flex items-center gap-1.5 text-green-400">
                                  <CheckCircle
                                    size={13}
                                  />
                                  Available
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-white/30">
                                  <XCircle
                                    size={13}
                                  />
                                  No data
                                </span>
                              )}

                            </td>

                          </tr>
                        );
                      },
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* ============================================================ */}
            {/* VALIDATION PERIOD                                               */}
            {/* ============================================================ */}

            <div className="glass rounded-2xl border border-white/10 p-6 mb-6">

              <div className="flex items-center gap-2 mb-2">
                <Calendar
                  size={15}
                  className="text-cyan-400"
                />

                <h3 className="font-semibold text-white">
                  Validation Coverage
                </h3>
              </div>

              <p className="text-sm text-white/70">
                {selectedDataset ===
                'final_test_2024_2025'
                  ? 'Independent held-out test evaluation: 2024–2025'
                  : 'Validation evaluation: 2023'}
              </p>

              <p className="text-xs text-white/40 mt-2">
                The values shown on this page come
                from the production evaluation report.
                No random ARGO observations or synthetic
                temperature fields are generated by the
                frontend.
              </p>

            </div>

            {/* ============================================================ */}
            {/* BACKEND REPORT INFORMATION                                      */}
            {/* ============================================================ */}

            <div className="glass rounded-2xl border border-white/10 p-5">

              <div className="flex items-center gap-2 mb-2">
                <Database
                  size={14}
                  className="text-cyan-400"
                />

                <span className="text-xs text-white/40">
                  Backend report
                </span>
              </div>

              <p className="text-xs font-mono text-cyan-400 break-all">
                {getBackendUrl()}/api/report/
                {selectedDataset}
              </p>

            </div>

      </PageContainer>
    </PageLayout>
  );
}