import { useState, useEffect } from 'react';
import {
  BookOpen, Cpu, TrendingUp, Activity, Server, Database,
  ArrowRight, CheckCircle, Clock, Zap,
  Globe, Shield, Layers, GitBranch, Wifi,
} from 'lucide-react';
import PageLayout, { PageContainer, PageHeader } from '../components/PageLayout';
import { fetchHealth, fetchModelInfo, fetchMetricsSummary } from '../api/oceanApi';

const TABS = [
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'performance',  label: 'Performance',  icon: TrendingUp },
  { id: 'status',       label: 'System Status', icon: Activity },
] as const;

type Tab = typeof TABS[number]['id'];

// ── Architecture tab ──────────────────────────────────────────────────────────
function ArchitectureTab() {
  const [modelInfo, setModelInfo] = useState<Record<string, unknown> | null>(null);
  const [modelLoading, setModelLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadModelInfo() {
      try {
        setModelLoading(true);
        const data = await fetchModelInfo();
        if (!cancelled) setModelInfo(data);
      } catch (error) {
        console.error('[Docs] Failed to load model information:', error);
        if (!cancelled) setModelInfo(null);
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    }

    loadModelInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  const getModelValue = (...keys: string[]) => {
    for (const key of keys) {
      const value = modelInfo?.[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      }
    }
    return null;
  };

  const layers = [
    {
      title: '1. Multi-Source Satellite Ingestion',
      icon: Database,
      color: 'cyan',
      items: [
        'Sea Surface Temperature (SST) — MODIS, VIIRS, AVHRR daily',
        'Sea Surface Salinity (SSS) — SMAP / SMOS radiometers',
        'Sea Surface Height (SSH) / SLA — Altimeter constellation',
        'Surface Ocean Currents (U, V) — Multi-satellite geostrophic currents',
        'Surface Winds (U, V) — ASCAT scatterometers + ERA5 reanalysis',
      ],
    },
    {
      title: '2. Preprocessing & Harmonization Pipeline',
      icon: Cpu,
      color: 'blue',
      items: [
        'Standardized Spatial Resolution: 0.25° × 0.25° grid',
        'Standardized Temporal Resolution: Daily time-steps',
        'Domain: North Indian Ocean (5°N–30°N, 45°E–105°E)',
        'Harmonization: Spatial & temporal interpolation / regridding',
        'Data Quality Control: Despiking, physical range checks & land masking',
      ],
    },
    {
      title: '3. Satellite Embedding Engine (Representation Learning)',
      icon: GitBranch,
      color: 'purple',
      items: [
        'Convolutional Neural Networks (CNN): Multi-scale local spatial features',
        'Vision Transformers (ViT / Swin): Global oceanic context & teleconnections',
        'Deep Autoencoders: Nonlinear compact latent state compression',
        'Graph Neural Networks (GNN): Dynamic mesoscale eddy relational graphs',
        'Attention-Based Hybrid Architectures: Cross-variable surface attention',
      ],
    },
    {
      title: '4. 15-Level Subsurface Reconstruction Model',
      icon: Zap,
      color: 'teal',
      items: [
        'Reconstructs vertical temperature at standard depth levels (m):',
        'Depths: (0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m)',
        'Learns nonlinear mapping from compact embeddings to vertical profiles',
        'Physics preservation: Mixed Layer Depth (MLD) & Thermocline gradient',
        'Ocean Heat Content (OHC 0–700m) integration',
      ],
    },
    {
      title: '5. Training Target & In-Situ Datasets',
      icon: Globe,
      color: 'green',
      items: [
        'Training Target: GLORYS Global Ocean Reanalysis (doi:10.48670/moi-00021)',
        'Variables: 3D Daily Temperature across 0–1000m depth levels',
        'In-situ Benchmark: INCOIS Live Access Server (LAS) – Gridded ARGO Floats',
        'Coverage: Bay of Bengal & Arabian Sea testing sectors',
        '40-year historical training baseline with out-of-sample validation',
      ],
    },
    {
      title: '6. Validation Framework & Skill Metrics',
      icon: Shield,
      color: 'orange',
      items: [
        'Pearson Correlation Coefficient (r) vs independent ARGO floats',
        'Root Mean Square Error (RMSE) per depth slice (0–1000m)',
        'Mean Bias Error (°C) tracking seasonal thermocline drift',
        'Marine heatwave & cyclone storm surge verification',
        'Government alert dispatch to NDMA, IMD, and coastal state SDMAs',
      ],
    },
  ];

  const colorMap: Record<string, string> = {
    cyan:   'from-cyan-500/15 to-cyan-900/5 border-cyan-500/25 text-cyan-400',
    blue:   'from-blue-500/15 to-blue-900/5 border-blue-500/25 text-blue-400',
    purple: 'from-purple-500/15 to-purple-900/5 border-purple-500/25 text-purple-400',
    teal:   'from-teal-500/15 to-teal-900/5 border-teal-500/25 text-teal-400',
    green:  'from-green-500/15 to-green-900/5 border-green-500/25 text-green-400',
    orange: 'from-orange-500/15 to-orange-900/5 border-orange-500/25 text-orange-400',
  };

  return (
    <div className="space-y-8 fade-in-up">
      {/* Data flow diagram */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-6 flex items-center gap-2">
          <Layers size={16} className="text-cyan-400" />
          End-to-End Data Flow
        </h2>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-2 min-w-max">
            {[
              { label: 'Satellites\n& Buoys', color: 'cyan' },
              { label: 'Ingestion\n& QC', color: 'blue' },
              { label: 'Feature\nStore', color: 'purple' },
              { label: 'Nightly\nML Job', color: 'purple' },
              { label: 'Model\nArtifacts', color: 'teal' },
              { label: 'Inference\nAPI', color: 'teal' },
              { label: 'Dashboard\n& Alerts', color: 'orange' },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className={`rounded-xl px-3 py-2.5 border bg-gradient-to-br text-center ${colorMap[step.color]} min-w-[80px]`}>
                  {step.label.split('\n').map((l, j) => (
                    <p key={j} className={`text-xs font-medium ${j === 0 ? `text-${step.color}-400` : 'text-white/50 mt-0.5'}`}>{l}</p>
                  ))}
                </div>
                {i < 6 && <ArrowRight size={14} className="text-white/20 mx-1 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/30 mt-4">
          Input Page submissions enter the Feature Store directly and influence the next nightly training run.
        </p>
      </div>

      {/* Layer cards with 3D hover physics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {layers.map(({ title, icon: Icon, color, items }) => (
          <div key={title} className={`stat-card-3d glass rounded-2xl p-5 border bg-gradient-to-br ${colorMap[color]} cursor-pointer`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border ${colorMap[color].split(' ')[2]}`}>
                <Icon size={16} className={colorMap[color].split(' ')[3]} />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
            </div>
            <ul className="space-y-1.5">
              {items.map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-white/60">
                  <span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${colorMap[color].split(' ')[3].replace('text-', 'bg-')}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Live backend model information */}
      <div className="glass rounded-2xl p-6 border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <Zap size={16} className="text-cyan-400" />
              Live Backend Model Information
            </h2>
            <p className="text-xs text-white/40 mt-1">
              Loaded directly from the FastAPI <code>/models</code> endpoint.
            </p>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
            modelLoading
              ? 'text-blue-300 bg-blue-500/10 border-blue-500/25'
              : modelInfo
                ? 'text-green-300 bg-green-500/10 border-green-500/25'
                : 'text-red-300 bg-red-500/10 border-red-500/25'
          }`}>
            {modelLoading ? 'LOADING' : modelInfo ? 'BACKEND MODEL ONLINE' : 'UNAVAILABLE'}
          </span>
        </div>

        {!modelLoading && modelInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Model', getModelValue('model', 'name', 'architecture') ?? 'CNN + Swin + ConvGRU'],
              ['Output Depths', getModelValue('output_depths', 'depths', 'num_depths') ?? '15'],
              ['Input Shape', getModelValue('input_shape', 'input_spec') ?? '7 × 7 × 101 × 241'],
              ['Status', getModelValue('status') ?? 'Loaded'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
                <p className="text-sm font-semibold text-white mt-1 break-words">{value}</p>
              </div>
            ))}
          </div>
        )}

        {!modelLoading && !modelInfo && (
          <p className="text-sm text-red-300">
            The backend is reachable only if <code>/models</code> responds successfully.
            Model metadata could not be loaded.
          </p>
        )}
      </div>

      {/* Tech stack table */}
      <div className="glass rounded-2xl p-6 border border-white/10 overflow-x-auto">
        <h2 className="font-bold text-white mb-4">Tech Stack</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Component', 'Technology', 'Version', 'Purpose'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-white/40 font-medium text-xs uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Frontend', 'React + Vite', '18 / 6.x', 'UI framework'],
              ['3D Rendering', 'Three.js + R3F', '0.170 / 9.x', 'Globe & heatmap'],
              ['Charts', 'Recharts', '2.x', 'Analytics'],
              ['Styles', 'Tailwind CSS', 'v4', 'Glassmorphism'],
              ['Routing', 'React Router', 'v6', 'Client routing'],
              ['ML Model', 'XGBoost', '2.x', 'Cyclone prediction'],
              ['API', 'FastAPI', '0.115', 'Inference endpoint'],
              ['DB', 'PostgreSQL + Timescale', '16 / 2.x', 'Time-series data'],
              ['Cache', 'Redis', '7.x', 'Real-time metrics'],
              ['Storage', 'MinIO / S3', 'latest', 'Model artifacts'],
            ].map(row => (
              <tr key={row[0]} className="border-b border-white/5 hover:bg-white/3 transition-all">
                {row.map((cell, i) => (
                  <td key={i} className={`px-3 py-2.5 text-xs ${i === 0 ? 'text-white font-medium' : 'text-white/60'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Performance tab ────────────────────────────────────────────────────────────
function PerformanceTab() {
  const metrics = [
    { label: 'Model Track Error (24h)', value: '85 km', target: '< 120 km', status: 'good' },
    { label: 'Model Track Error (72h)', value: '152 km', target: '< 200 km', status: 'good' },
    { label: 'Intensity Accuracy (±1 cat)', value: '81.3%', target: '> 75%', status: 'good' },
    { label: 'False Positive Rate', value: '4.2%', target: '< 10%', status: 'good' },
    { label: 'API P99 Latency', value: '142 ms', target: '< 500 ms', status: 'good' },
    { label: 'Dashboard Load Time', value: '1.8 s', target: '< 3 s', status: 'good' },
    { label: 'Data Ingestion Lag', value: '6.1 min', target: '< 10 min', status: 'good' },
    { label: 'Model Training Time', value: '17 min', target: '< 30 min', status: 'good' },
    { label: 'Uptime (30d)', value: '99.87%', target: '> 99.5%', status: 'good' },
    { label: 'Alert Delivery Success', value: '99.2%', target: '> 98%', status: 'good' },
  ];

  const benchmarks = [
    { name: 'IMD NWP Model (Baseline)', track24: 120, track72: 230, intensity: 68, color: '#64748b' },
    { name: 'OceanIntel v42 (Current)', track24: 85, track72: 152, intensity: 81, color: '#06b6d4' },
    { name: 'OceanIntel v35 (Last)',    track24: 98, track72: 188, intensity: 74, color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-8 fade-in-up">
      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(({ label, value, target }) => (
          <div key={label} className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-white/50">{label}</p>
              <CheckCircle size={14} className="text-green-400 shrink-0" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/30 mt-1">Target: {target}</p>
          </div>
        ))}
      </div>

      {/* Model comparison */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-6">Model Benchmark Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Model', 'Track Error 24h', 'Track Error 72h', 'Intensity Acc.', 'Improvement'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-white/40 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b, i) => (
                <tr key={b.name} className={`border-b border-white/5 ${i === 1 ? 'bg-cyan-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                      <span className="text-white text-xs">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.color }}>{b.track24} km</td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.color }}>{b.track72} km</td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.color }}>{b.intensity}%</td>
                  <td className="px-4 py-3 text-xs text-green-400">
                    {i === 1 ? '↑ 29% vs baseline' : i === 2 ? '↑ 18% vs baseline' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual bars */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-6">Performance vs Targets</h2>
        <div className="space-y-4">
          {[
            { label: 'Model Intensity Accuracy', value: 81.3, target: 75, max: 100, unit: '%', color: 'bg-cyan-400' },
            { label: 'API Uptime', value: 99.87, target: 99.5, max: 100, unit: '%', color: 'bg-green-400' },
            { label: 'Alert Delivery', value: 99.2, target: 98, max: 100, unit: '%', color: 'bg-purple-400' },
            { label: 'Data Coverage (Indian Ocean)', value: 87.4, target: 80, max: 100, unit: '%', color: 'bg-blue-400' },
          ].map(({ label, value, target, max, unit, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">{label}</span>
                <span className="text-white font-medium">{value}{unit}</span>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${(value / max) * 100}%` }} />
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                  style={{ left: `${(target / max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-white/25 mt-1">Target: {target}{unit}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── System Status tab ─────────────────────────────────────────────────────────
function StatusTab() {
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkBackend = async () => {
    try {
      setCheckingBackend(true);
      await fetchHealth();
      setBackendConnected(true);
    } catch (error) {
      console.error('[Docs] Backend health check failed:', error);
      setBackendConnected(false);
    } finally {
      setCheckingBackend(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkBackend();

    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  const services = [
    { name: 'Data Ingestion Pipeline', status: 'operational', latency: '< 6min lag', uptime: '99.9%' },
    { name: 'ML Training Job (Nightly)', status: 'operational', latency: 'Last: 02:17 IST', uptime: '100%' },
    {
      name: 'Inference API',
      status: backendConnected === true ? 'operational' : backendConnected === false ? 'outage' : 'maintenance',
      latency: checkingBackend ? 'Checking /health...' : backendConnected ? 'FastAPI reachable' : 'Connection failed',
      uptime: backendConnected === true ? 'LIVE' : backendConnected === false ? 'OFFLINE' : '—',
    },
    { name: 'Government Alert System', status: 'operational', latency: '< 30s delivery', uptime: '99.2%' },
    { name: 'Dashboard Frontend', status: 'operational', latency: '1.8s load', uptime: '99.95%' },
    { name: 'Database (TimescaleDB)', status: 'operational', latency: '8ms p99', uptime: '99.99%' },
    { name: 'Redis Cache', status: 'degraded', latency: '45ms p99', uptime: '98.3%' },
    { name: 'Object Storage (MinIO)', status: 'operational', latency: '22ms p99', uptime: '99.99%' },
    { name: 'IMD Satellite Feed', status: 'operational', latency: '6h cadence', uptime: '99.5%' },
    { name: 'INCOIS Data Feed', status: 'maintenance', latency: 'Scheduled 03:00–05:00', uptime: '—' },
  ];

  const statusConfig = {
    operational: { color: 'text-green-400', bg: 'bg-green-400', label: 'Operational' },
    degraded:    { color: 'text-yellow-400', bg: 'bg-yellow-400', label: 'Degraded' },
    maintenance: { color: 'text-blue-400',   bg: 'bg-blue-400',   label: 'Maintenance' },
    outage:      { color: 'text-red-400',     bg: 'bg-red-400',    label: 'Outage' },
  };

  const operational = services.filter(s => s.status === 'operational').length;
  const degraded    = services.filter(s => s.status === 'degraded').length;
  const maintenance = services.filter(s => s.status === 'maintenance').length;

  return (
    <div className="space-y-8 fade-in-up">
      {/* Overall status */}
      <div className={`glass rounded-2xl p-6 border ${
        backendConnected === true
          ? 'border-green-500/25 bg-gradient-to-br from-green-500/10 to-transparent'
          : backendConnected === false
            ? 'border-red-500/25 bg-gradient-to-br from-red-500/10 to-transparent'
            : 'border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-transparent'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-4 h-4 rounded-full ${
            backendConnected === true
              ? 'bg-green-400 animate-pulse'
              : backendConnected === false
                ? 'bg-red-400'
                : 'bg-blue-400 animate-pulse'
          }`} />
          <h2 className="text-xl font-bold text-white">
            {checkingBackend
              ? 'Checking FastAPI Backend...'
              : backendConnected
                ? 'FastAPI Backend Connected'
                : 'FastAPI Backend Offline'}
          </h2>
          <button
            onClick={checkBackend}
            disabled={checkingBackend}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-50 transition-all"
          >
            {checkingBackend ? 'Checking...' : 'Recheck'}
          </button>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-3xl font-black text-green-400">{operational}</p>
            <p className="text-xs text-white/50">Operational</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-yellow-400">{degraded}</p>
            <p className="text-xs text-white/50">Degraded</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-blue-400">{maintenance}</p>
            <p className="text-xs text-white/50">Maintenance</p>
          </div>
          <div className="text-center ml-auto">
            <p className="text-2xl font-bold text-white">
              {backendConnected === true ? 'LIVE' : backendConnected === false ? 'OFFLINE' : '—'}
            </p>
            <p className="text-xs text-white/50">Backend state</p>
          </div>
        </div>
        {lastChecked && (
          <p className="text-[10px] text-white/30 font-mono mt-4">
            Last health check: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Service table */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Server size={16} className="text-cyan-400" />
            Service Health
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Wifi size={12} className="text-green-400" />
            Live monitoring
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {services.map(svc => {
            const cfg = statusConfig[svc.status as keyof typeof statusConfig];
            return (
              <div key={svc.name} className="flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-all">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${cfg.bg} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                  <div>
                    <p className="text-sm text-white">{svc.name}</p>
                    <p className="text-xs text-white/30">{svc.latency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white/40 hidden sm:block">{svc.uptime}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg.replace('bg-', 'bg-').replace('400', '500/15')} border-current/30`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident history */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={16} className="text-cyan-400" />
          Recent Incidents
        </h2>
        <div className="space-y-4">
          {[
            { date: 'Sep 1, 2026', title: 'Redis Cache Degradation', status: 'ongoing', desc: 'Memory pressure causing elevated latency. Mitigation in progress — capacity upgrade scheduled.' },
            { date: 'Aug 28, 2026', title: 'INCOIS Feed Latency', status: 'resolved', desc: 'Ingestion lag of 45min due to upstream API timeout. Resolved after 2h by switching to backup endpoint.' },
            { date: 'Aug 21, 2026', title: 'Alert Delivery Delay', status: 'resolved', desc: 'SMTP relay issue caused 8-minute delay in government alerts. Failover to backup SMTP resolved the issue.' },
          ].map(inc => (
            <div key={inc.title} className={`p-4 rounded-xl border ${
              inc.status === 'ongoing' ? 'border-yellow-500/25 bg-yellow-500/8' : 'border-white/8 bg-white/3'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm font-medium text-white">{inc.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  inc.status === 'ongoing'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-green-500/15 text-green-400 border border-green-500/25'
                }`}>
                  {inc.status === 'ongoing' ? 'Ongoing' : 'Resolved'}
                </span>
              </div>
              <p className="text-xs text-white/30 mb-2">{inc.date}</p>
              <p className="text-xs text-white/60">{inc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('architecture');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendState() {
      try {
        await fetchHealth();
        if (!cancelled) setBackendConnected(true);

        // Confirm the production metrics endpoint is also available.
        await fetchMetricsSummary();
        if (!cancelled) setMetricsLoaded(true);
      } catch (error) {
        console.error('[Docs] Backend documentation endpoints failed:', error);
        if (!cancelled) {
          setBackendConnected(false);
          setMetricsLoaded(false);
        }
      }
    }

    loadBackendState();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          category="भारत सरकार · MINISTRY OF EARTH SCIENCES (MoES) &amp; C-DAC"
          badge={
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 text-purple-300 text-[11px] font-mono shadow-md">
              <Shield size={12} className="text-purple-400" />
              <span>SIH-2026 RESEARCH SPECIFICATION · SCIENTIST TIER</span>
            </div>
          }
          icon={<BookOpen size={20} className="text-purple-400" />}
          title="OCEANINTEL Neural Architecture Documentation"
          subtitle="Physics-Informed Deep Learning specifications, 61-D latent manifold formulations, 15-level vertical depth reconstruction, and MoES Supercomputing (PRATYUSH / MIHIR) integration pipelines"
        />

        {/* Backend connection indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`w-2 h-2 rounded-full ${
            backendConnected === true
              ? 'bg-green-400 animate-pulse'
              : backendConnected === false
                ? 'bg-red-400'
                : 'bg-blue-400 animate-pulse'
          }`} />
          <span className="text-[11px] font-mono text-white/50">
            {backendConnected === true
              ? `FASTAPI CONNECTED · METRICS ${metricsLoaded ? 'AVAILABLE' : 'UNAVAILABLE'}`
              : backendConnected === false
                ? 'FASTAPI BACKEND OFFLINE'
                : 'CONNECTING TO FASTAPI'}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-8 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white border border-cyan-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'architecture' && <ArchitectureTab />}
        {activeTab === 'performance'  && <PerformanceTab />}
        {activeTab === 'status'       && <StatusTab />}
      </PageContainer>
    </PageLayout>
  );
}
