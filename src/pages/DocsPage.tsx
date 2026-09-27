import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import Navbar from '../components/Navbar';
import WaterBackground from '../components/WaterBackground';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Anchor,
  BarChart3,
  Binary,
  BookOpen,
  BrainCircuit,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  Gauge,
  Layers,
  Map,
  Network,
  Radio,
  RefreshCw,
  Ruler,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Waves,
  Wind,
} from 'lucide-react';

// ── Canonical Spatial & Depth Constants ─────────────────────────────────────
const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

const CHANNELS = [
  {
    idx: '0',
    code: 'SST',
    name: 'Sea Surface Temperature',
    unit: '°C',
    source: 'Copernicus Marine / OSTIA Satellite Radiometry',
    sensor: 'AVHRR + MODIS + SLSTR Multi-Sensor Blended L4',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '24.0°C – 32.5°C',
    role: 'Primary thermal boundary condition',
    physics: 'Reflects oceanic thermal emission at the skin/sub-skin interface. Governs air-sea latent and sensible heat fluxes, atmospheric convection, and surface layer thermal expansion.',
    reconstructionImpact: 'Provides the surface Dirichlet boundary condition for vertical heat diffusion; anchors depth 0m temperature reconstruction.',
    badgeTone: 'red' as const,
  },
  {
    idx: '1',
    code: 'SSS',
    name: 'Sea Surface Salinity',
    unit: 'PSU (Practical Salinity Units)',
    source: 'Copernicus Marine (SMOS / SMAP Calibrated)',
    sensor: 'L-Band Microwave Radiometry (SMOS MIRAS / SMAP)',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '28.0 – 37.0 PSU',
    role: 'Haline structure & density stratification',
    physics: 'Governs seawater density ρ(T, S, P). In the Bay of Bengal, heavy monsoon river runoff creates an ultra-fresh surface layer, producing strong barrier layers that trap subsurface heat.',
    reconstructionImpact: 'Prevents unphysical density inversions; helps neural network distinguish between wind-driven thermal mixing and salinity-stratified isothermal layers.',
    badgeTone: 'blue' as const,
  },
  {
    idx: '2',
    code: 'SSH / SLA',
    name: 'Sea Surface Height / Sea Level Anomaly',
    unit: 'meters (m)',
    source: 'Copernicus Multi-Mission Satellite Altimetry (Sentinel-3/6, Jason-3)',
    sensor: 'Dual-Frequency Radar Altimetry (Poseidon-4 / SRAL)',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '-0.45m to +0.45m',
    role: 'Integrated baroclinic proxy & eddy dynamics',
    physics: 'Dynamic sea level anomalies reflect vertical displacement of the main thermocline (pycnocline) via baroclinic planetary waves (Rossby & Kelvin waves) and cyclonic/anticyclonic mesoscale eddies.',
    reconstructionImpact: 'Highest single predictor of thermocline depth (D₂₀) and subsurface thermal bulge (positive SLA = deep warm pool, negative SLA = cold upwelling dome).',
    badgeTone: 'cyan' as const,
  },
  {
    idx: '3',
    code: 'CURRENT_U',
    name: 'Surface Zonal Ocean Current',
    unit: 'm/s',
    source: 'Copernicus GlobCurrent (Altimetry + Ekman Drifter)',
    sensor: 'Altimeter Geostrophic + Scatterometer Ekman Model',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '-1.8 m/s to +1.8 m/s',
    role: 'East-west horizontal thermal advection',
    physics: 'Represents zonal velocity transporting equatorial heat eastward during the spring/autumn Wyrtki Jets, and westward during northeast monsoons.',
    reconstructionImpact: 'Informs spatiotemporal advection terms in the latent embedding, tracking horizontal displacement of warm cores.',
    badgeTone: 'teal' as const,
  },
  {
    idx: '4',
    code: 'CURRENT_V',
    name: 'Surface Meridional Ocean Current',
    unit: 'm/s',
    source: 'Copernicus GlobCurrent (Altimetry + Ekman Drifter)',
    sensor: 'Altimeter Geostrophic + Scatterometer Ekman Model',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '-1.6 m/s to +1.6 m/s',
    role: 'North-south coastal & cross-equatorial advection',
    physics: 'Captures the Somali Current, Western Boundary Currents (EICC in Bay of Bengal), and coastal upwelling along the southwest coast of India and Oman.',
    reconstructionImpact: 'Resolves coastal boundary layer dynamics and vertical upwelling signatures.',
    badgeTone: 'purple' as const,
  },
  {
    idx: '5',
    code: 'WIND_U',
    name: '10m Atmospheric Zonal Wind',
    unit: 'm/s',
    source: 'ECMWF ERA5 High-Resolution Atmospheric Reanalysis',
    sensor: 'IFS Coupled Atmospheric Cycle 41r2 / Scatterometer Blended',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '-22.0 m/s to +22.0 m/s',
    role: 'Atmospheric momentum transfer & mechanical shearing',
    physics: 'Zonal surface wind stress drives zonal Ekman transport and turbulent kinetic energy (TKE) dissipation across the upper mixed layer.',
    reconstructionImpact: 'Determines mixed layer depth (MLD) entrainment rates; informs how deep surface heating is mechanically stirred.',
    badgeTone: 'emerald' as const,
  },
  {
    idx: '6',
    code: 'WIND_V',
    name: '10m Atmospheric Meridional Wind',
    unit: 'm/s',
    source: 'ECMWF ERA5 High-Resolution Atmospheric Reanalysis',
    sensor: 'IFS Coupled Atmospheric Cycle 41r2 / Scatterometer Blended',
    tensorDim: '(B, 1, 7, 101, 241)',
    normalRange: '-20.0 m/s to +20.0 m/s',
    role: 'Monsoon cross-equatorial jet forcing',
    physics: 'Drives the intense Findlater Jet during the Southwest Monsoon, forcing strong offshore Ekman upwelling in the western Arabian Sea.',
    reconstructionImpact: 'Supplies the vertical mixing magnitude that cools surface waters and elevates the thermocline near coastal margins.',
    badgeTone: 'orange' as const,
  },
] as const;

const DERIVED_PHYSICS_VARS = [
  {
    code: 'OHC / TCHP',
    name: 'Ocean Heat Content (Tropical Cyclone Heat Potential)',
    unit: 'kJ/cm² (or MJ/m²)',
    category: 'Subsurface Energy Metric',
    formula: 'OHC = ρ₀ · Cp · ∫₀^{D₂₆} [T(z) - 26] dz',
    constants: 'ρ₀ = 1025 kg/m³, Cp = 3985 J/(kg·°C)',
    threshold: '≥ 60 kJ/cm² (fuels Category 4/5 Rapid Intensification)',
    significance: 'Measures usable vertical thermal energy above the critical 26°C cyclogenesis threshold. High OHC prevents cyclonic cold-water upwelling from extinguishing storm intensification.',
    tone: 'rose' as const,
  },
  {
    code: 'MLD',
    name: 'Mixed Layer Depth',
    unit: 'meters (m)',
    category: 'Vertical Stratification',
    formula: 'Depth z where T(z) = SST - 0.2°C (or Δσ_θ = 0.03 kg/m³)',
    constants: 'Standard de Boyer Montégut / Kara criterion',
    threshold: '< 25m (Shallow / High Thermal Inertia), > 80m (Deep Mixing)',
    significance: 'Upper homogeneous layer directly influenced by atmospheric turbulent kinetic energy and mechanical wind shear. Governs the rate of oceanic heat storage and air-sea exchange.',
    tone: 'teal' as const,
  },
  {
    code: 'D₂₀',
    name: 'Depth of 20°C Isotherm (Thermocline Center)',
    unit: 'meters (m)',
    category: 'Baroclinic Marker',
    formula: 'Vertical depth z where reconstructed T(z) = 20.0°C (Cubic Spline)',
    constants: '15-level vertical interpolation root',
    threshold: '< 50m (Upwelling Dome), > 140m (Warm Pool Downwelling)',
    significance: 'Serves as the canonical proxy for the core thermocline depth, dynamic topography, and planetary Rossby/Kelvin wave propagation across the equatorial wave guide.',
    tone: 'cyan' as const,
  },
  {
    code: 'D₂₆',
    name: 'Depth of 26°C Isotherm (Cyclone Energy Ceiling)',
    unit: 'meters (m)',
    category: 'Cyclogenesis Horizon',
    formula: 'Vertical depth z where reconstructed T(z) = 26.0°C (Cubic Spline)',
    constants: '15-level vertical interpolation root',
    threshold: '> 50m indicates deep reservoir fueling Category 3+ cyclones',
    significance: 'Defines the vertical integration limit for Ocean Heat Content (OHC). Deep D₂₆ shields tropical cyclones from self-induced negative sea-surface temperature feedback.',
    tone: 'orange' as const,
  },
  {
    code: 'BLT',
    name: 'Barrier Layer Thickness',
    unit: 'meters (m)',
    category: 'Haline Stratification',
    formula: 'BLT = ILD - MLD (where ILD is Isothermal Layer Depth: T = SST - 0.2°C)',
    constants: 'Salinity-driven density stratification',
    threshold: '> 30m creates ultra-stable thermal trapping in Bay of Bengal',
    significance: 'Phenomenon where intense freshwater river discharge (Ganges-Brahmaputra) forms a thin, light surface layer, trapping heat beneath and accelerating pre-monsoon cyclone development.',
    tone: 'purple' as const,
  },
  {
    code: 'EKE',
    name: 'Eddy Kinetic Energy',
    unit: 'cm²/s²',
    category: 'Mesoscale Dynamics',
    formula: 'EKE = 0.5 · (u\'² + v\'²) = (g² / 2f²) · [(∂η\'/∂y)² + (∂η\'/∂x)²]',
    constants: 'g = 9.81 m/s², f = 2Ω sin(φ) Coriolis Parameter',
    threshold: '> 800 cm²/s² marks intense mesoscale cyclonic/anticyclonic vortex',
    significance: 'Quantifies turbulent mesoscale eddy vigor in the Arabian Sea and Bay of Bengal. Warm-core anticyclonic eddies act as deep thermal batteries for intensifying cyclones.',
    tone: 'emerald' as const,
  },
  {
    code: 'N²',
    name: 'Brunt-Väisälä Buoyancy Frequency',
    unit: 's⁻² (10⁻⁴ s⁻²)',
    category: 'Static Ocean Stability',
    formula: 'N² = - (g / ρ₀) · (∂ρ / ∂z)',
    constants: 'Seawater equation of state TEOS-10 / UNESCO',
    threshold: '> 5 × 10⁻⁴ s⁻² marks intense pycnocline stratification barrier',
    significance: 'Represents the oscillation frequency of a vertically displaced water parcel. High N² inhibits vertical turbulent mixing and confines wind energy to the surface boundary layer.',
    tone: 'blue' as const,
  },
  {
    code: 'ΔD',
    name: 'Dynamic Height Anomaly',
    unit: 'dynamic meters (dyn·m)',
    category: 'Baroclinic Geostrophy',
    formula: 'ΔD = ∫_{p₁}^{p₂} α(S, T, p) dp',
    constants: 'α = 1/ρ specific volume anomaly',
    threshold: 'Used to validate satellite SLA against reconstructed 3D mass fields',
    significance: 'Integrates specific volume anomalies across depth to derive geostrophic baroclinic current shears, matching altimetric sea level anomalies to interior mass structure.',
    tone: 'indigo' as const,
  },
];

const ATMOSPHERIC_VARS = [
  {
    name: 'Vertical Wind Shear (VWS: 200 hPa – 850 hPa)',
    unit: 'knots / m/s',
    importance: 'Critical for Cyclone RI',
    desc: 'Difference between upper-troposphere (200 hPa) and lower-troposphere (850 hPa) wind vectors. Low shear (< 15 kts) enables vertical alignment of the cyclone convective core, facilitating Rapid Intensification (RI).',
    tone: 'rose' as const,
  },
  {
    name: 'Mid-Tropospheric Relative Humidity (500 hPa / 700 hPa)',
    unit: '%',
    importance: 'Convective Buoyancy',
    desc: 'High mid-level moisture (> 65%) prevents dry-air intrusion into the cyclone eyewall, sustaining vigorous deep convection without downdraft collapse.',
    tone: 'blue' as const,
  },
  {
    name: 'Low-Level Relative Vorticity (850 hPa)',
    unit: '10⁻⁵ s⁻¹',
    importance: 'Cyclogenesis Spin-up',
    desc: 'Measures ambient horizontal cyclonic rotation required to aggregate convective clusters into an organized tropical depression.',
    tone: 'indigo' as const,
  },
  {
    name: 'Outgoing Longwave Radiation (OLR)',
    unit: 'W/m²',
    importance: 'Deep Convection Proxy',
    desc: 'Low OLR values (< 200 W/m²) denote high, cold cloud tops characteristic of intense tropical convective towers and storm eyewalls.',
    tone: 'purple' as const,
  },
  {
    name: 'Sea Level Pressure (SLP) & Pressure Deficit',
    unit: 'hPa (mbar)',
    importance: 'Storm Intensity Metric',
    desc: 'Central minimum pressure drop directly governs maximum sustained winds via gradient wind balance and pressure-wind relationships.',
    tone: 'emerald' as const,
  },
];

const PIPELINE_SPECS = [
  {
    step: '1. Ingestion & Harmonization',
    description: 'Daily streaming ingestion of Copernicus CMEMS, ECMWF ERA5, and OSTIA NetCDF-4 grids into spatial regularizer.',
    contract: 'Reprojected to EPSG:4326 on 0.25° × 0.25° Cartesian grid (101 Lat × 241 Lon).',
  },
  {
    step: '2. Spatial Land & Ice Masking',
    description: 'GEBCO 15-arcsecond bathymetry applied to delineate ocean basins and mask landmass with NaN padding & zero-gradient Neumann boundaries.',
    contract: '24,341 active ocean nodes out of 24,341 domain matrix cells.',
  },
  {
    step: '3. Rolling 7-Day Context Buffer',
    description: 'Temporal sliding window stacking of 7 consecutive days for all 7 surface channels.',
    contract: 'Output input tensor shape: (Batch, 7 Channels, 7 Days, 101 Lat, 241 Lon).',
  },
  {
    step: '4. Z-Score Standardization',
    description: 'Normalized using precomputed 5-year climatological mean (μ) and standard deviation (σ) per channel and grid cell.',
    contract: 'Formula: z = (x - μ_clim) / σ_clim, preventing vanishing/exploding gradients.',
  },
  {
    step: '5. Neural 3D Latent Inference',
    description: 'OceanEmbed multi-scale neural encoder reconstructs the 15 vertical depths simultaneously.',
    contract: 'Reconstructed tensor shape: (Batch, 15 Depths, 101 Lat, 241 Lon) in °C.',
  },
  {
    step: '6. Downstream Metric Synthesis',
    description: 'Automatic physical vectorization computes OHC, MLD, D20, D26, Cyclone RI, and Marine Heatwave indices.',
    contract: 'Dispatches high-priority incident payloads to Government Command Center when safety thresholds are breached.',
  },
];

const NAV_TABS = [
  { id: 'overview', label: '1. Project Genesis', icon: BookOpen },
  { id: 'parameters', label: '2. All Parameters Registry & Physics', icon: Waves },
  { id: 'models', label: '3. AI Models & Architecture', icon: BrainCircuit },
  { id: 'downstream', label: '4. Downstream Hazard Apps', icon: Activity },
  { id: 'forecast-window', label: '5. 7-Day Sliding Window', icon: CalendarDays },
  { id: 'xai', label: '6. Explainable AI (X-AI)', icon: Cpu },
  { id: 'gov-alert', label: '7. Gov Portal & High-Alert', icon: ShieldAlert },
  { id: 'rules', label: '8. Research Integrity Rules', icon: ShieldCheck },
] as const;

type TabId = (typeof NAV_TABS)[number]['id'];

// Bright Palette Tones
const colorMap = {
  cyan: {
    border: 'border-cyan-200',
    cardBorder: 'border-cyan-300/80',
    iconBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    headerAccent: 'text-cyan-800',
    highlight: 'bg-cyan-50/70',
  },
  blue: {
    border: 'border-blue-200',
    cardBorder: 'border-blue-300/80',
    iconBg: 'bg-blue-100 text-blue-800 border-blue-300',
    badge: 'bg-blue-50 text-blue-800 border-blue-300',
    headerAccent: 'text-blue-800',
    highlight: 'bg-blue-50/70',
  },
  red: {
    border: 'border-rose-200',
    cardBorder: 'border-rose-300/80',
    iconBg: 'bg-rose-100 text-rose-800 border-rose-300',
    badge: 'bg-rose-50 text-rose-800 border-rose-300',
    headerAccent: 'text-rose-800',
    highlight: 'bg-rose-50/70',
  },
  rose: {
    border: 'border-rose-200',
    cardBorder: 'border-rose-300/80',
    iconBg: 'bg-rose-100 text-rose-800 border-rose-300',
    badge: 'bg-rose-50 text-rose-800 border-rose-300',
    headerAccent: 'text-rose-800',
    highlight: 'bg-rose-50/70',
  },
  emerald: {
    border: 'border-emerald-200',
    cardBorder: 'border-emerald-300/80',
    iconBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    headerAccent: 'text-emerald-800',
    highlight: 'bg-emerald-50/70',
  },
  purple: {
    border: 'border-purple-200',
    cardBorder: 'border-purple-300/80',
    iconBg: 'bg-purple-100 text-purple-800 border-purple-300',
    badge: 'bg-purple-50 text-purple-800 border-purple-300',
    headerAccent: 'text-purple-800',
    highlight: 'bg-purple-50/70',
  },
  orange: {
    border: 'border-amber-200',
    cardBorder: 'border-amber-300/80',
    iconBg: 'bg-amber-100 text-amber-800 border-amber-300',
    badge: 'bg-amber-50 text-amber-900 border-amber-300',
    headerAccent: 'text-amber-800',
    highlight: 'bg-amber-50/70',
  },
  teal: {
    border: 'border-teal-200',
    cardBorder: 'border-teal-300/80',
    iconBg: 'bg-teal-100 text-teal-800 border-teal-300',
    badge: 'bg-teal-50 text-teal-800 border-teal-300',
    headerAccent: 'text-teal-800',
    highlight: 'bg-teal-50/70',
  },
  indigo: {
    border: 'border-indigo-200',
    cardBorder: 'border-indigo-300/80',
    iconBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    headerAccent: 'text-indigo-800',
    highlight: 'bg-indigo-50/70',
  },
};

function Card({
  title,
  icon: Icon,
  children,
  tone = 'blue',
  className = '',
  action,
}: {
  title: string;
  icon: any;
  children: ReactNode;
  tone?: keyof typeof colorMap;
  className?: string;
  action?: ReactNode;
}) {
  const t = colorMap[tone];
  return (
    <section className={`rounded-2xl border ${t.cardBorder} bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_12px_40px_rgba(15,23,42,0.1)] transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between px-6 pt-6 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${t.iconBg} shadow-sm shrink-0`}>
            <Icon size={20} />
          </div>
          <h2 className={`text-lg font-black tracking-tight ${t.headerAccent}`}>{title}</h2>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Pill({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: keyof typeof colorMap;
}) {
  const t = colorMap[tone];
  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-mono font-bold shadow-xs ${t.badge}`}>
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  color = 'text-blue-600',
}: {
  label: string;
  value: string;
  icon: typeof BookOpen;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 hover:bg-white hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-mono font-bold text-slate-500">
        <Icon size={14} className={color} />
        {label}
      </div>
      <div className="mt-1.5 text-sm font-black text-slate-900 break-words">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OVERVIEW & GENESIS TAB
// ─────────────────────────────────────────────────────────────────────────────
function OverviewSection() {
  return (
    <div className="space-y-6">
      <Card title="Project Genesis & Master Problem Definition" icon={BookOpen} tone="blue">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Project Code" value="OceanIntel / SIH26066" icon={ClipboardCheck} color="text-blue-600" />
          <Stat label="Sponsoring Ministry" value="Ministry of Earth Sciences (MoES)" icon={ShieldCheck} color="text-emerald-600" />
          <Stat label="Nodal R&D Body" value="INCOIS, Hyderabad" icon={Building2} color="text-indigo-600" />
          <Stat label="Geographic Domain" value="North Indian Ocean (5°N–30°N, 45°E–105°E)" icon={Map} color="text-cyan-600" />
        </div>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-800">
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 text-slate-900 font-medium">
            <strong className="text-blue-900 font-bold block mb-1">🌊 The &ldquo;Blind Ocean&rdquo; Bottleneck:</strong>
            Operational satellite constellations (microwave radiometers, radar scatterometers, altimeters) capture only the ultra-thin surface skin layer (microns to a few meters). Yet over <strong>90% of the ocean&rsquo;s thermal energy, momentum, and circulation heat storage</strong> are contained in the <strong>subsurface column from 0m down to 1000m</strong>. In-situ profilers (such as ARGO buoys) are sparse and provide measurements only every 5 to 10 days.
          </div>
          <p>
            <strong className="text-slate-950 font-bold">The OceanIntel AI Solution:</strong> We created an end-to-end deep learning framework (<strong>OceanEmbed</strong>) that solves this inverse hydrodynamic problem. By processing <strong>7 continuous surface parameters</strong> across a <strong>7-day rolling window</strong>, OceanIntel inverts surface signatures into full 3D temperature fields at <strong>15 vertical depths down to 1000m</strong> across the entire North Indian Ocean at <strong>0.25° grid resolution</strong>.
          </p>
        </div>
      </Card>

      <Card title="End-to-End System Architecture (Head-to-Tail Pipeline)" icon={Network} tone="indigo">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-stretch">
          {[
            {
              step: 'Step 01',
              title: 'Ingestion Engine',
              desc: 'Continuous daily streaming of Copernicus Marine SST/SSS/SSH, ECMWF ERA5 10m Winds, Surface Currents, and ARGO Buoy Telemetry.',
              icon: Database,
              color: 'text-blue-700 bg-blue-50 border-blue-200',
            },
            {
              step: 'Step 02',
              title: 'Harmonization',
              desc: 'NetCDF automated QA/QC, NaN scrubbing, interpolation onto standard 0.25° grid (101×241 nodes), and z-score normalization.',
              icon: Ruler,
              color: 'text-teal-700 bg-teal-50 border-teal-200',
            },
            {
              step: 'Step 03',
              title: 'Deep AI Models',
              desc: 'Swin-CNN 3D subsurface inversion + Spatiotemporal Fourier Neural Operator (FNO) + Coupled XGBoost cyclone tracker.',
              icon: BrainCircuit,
              color: 'text-purple-700 bg-purple-50 border-purple-200',
            },
            {
              step: 'Step 04',
              title: 'Downstream Ops',
              desc: 'TCHP 0–1000m thermal budget, Rapid Intensification (RI) triggers, Marine Heatwave radar, and 7-day sliding forecast window.',
              icon: Activity,
              color: 'text-amber-800 bg-amber-50 border-amber-200',
            },
            {
              step: 'Step 05',
              title: 'Gov Command',
              desc: 'Automated Red Alert dispatch to /government portal, NDMA/IMD emergency bulletins, Great Danger Port Signals (VIII–XI), and NDRF routing.',
              icon: ShieldAlert,
              color: 'text-rose-700 bg-rose-50 border-rose-200',
            },
          ].map((item, i) => (
            <div key={item.step} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4.5 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between text-xs font-mono font-black text-indigo-700 mb-2">
                  <span>{item.step}</span>
                  <item.icon size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">{item.desc}</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-400">PHASE {i + 1}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Spatial Grid Contract" icon={Map} tone="cyan">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-600 font-semibold">Latitude Range</span>
              <span className="font-mono text-slate-900 font-black">5.0°N to 30.0°N (101 points)</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-600 font-semibold">Longitude Range</span>
              <span className="font-mono text-slate-900 font-black">45.0°E to 105.0°E (241 points)</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-600 font-semibold">Horizontal Resolution</span>
              <span className="font-mono text-cyan-700 font-black">0.25° × 0.25° (~27 km)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Total Grid Nodes</span>
              <span className="font-mono text-slate-900 font-black">24,341 active cells</span>
            </div>
          </div>
        </Card>

        <Card title="Dataset Lineage & Splits" icon={CalendarDays} tone="purple">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-600 font-semibold">Training Period</span>
              <span className="font-mono text-purple-700 font-black">2018–2022 (5 full years)</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-600 font-semibold">Validation Tuning</span>
              <span className="font-mono text-indigo-700 font-black">2023 (Hyperparameters)</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-600 font-semibold">Test Benchmark</span>
              <span className="font-mono text-emerald-700 font-black">2024–2025 (Holdout)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-semibold">Live Operational</span>
              <span className="font-mono text-blue-700 font-black">2026 (Forward streaming)</span>
            </div>
          </div>
        </Card>

        <Card title="Dual Ground Truth Validation" icon={CheckCircle2} tone="emerald">
          <div className="space-y-3 text-xs leading-relaxed">
            <p className="text-slate-700 font-medium">
              Model performance is verified against two independent scientific standards:
            </p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <span className="font-mono text-xs text-emerald-900 font-bold block mb-1">1. GLORYS12V1 Reanalysis</span>
              <span className="text-slate-700 font-normal">Copernicus 1/12° 3D reanalysis assimilation serving as continuous gridded target field.</span>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
              <span className="font-mono text-xs text-blue-900 font-bold block mb-1">2. In-Situ ARGO Floats</span>
              <span className="text-slate-700 font-normal">CTD sensor physical profiles from autonomous drifting floats across the Arabian Sea & Bay of Bengal.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ALL PARAMETERS REGISTRY & ADVANCED OCEANOGRAPHIC PHYSICS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ParametersSection() {
  const [filter, setFilter] = useState<'all' | 'surface' | 'depths' | 'derived' | 'atmospheric' | 'pipeline'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParam, setSelectedParam] = useState<string | null>(null);

  // Consolidated Master Specifications Table Data
  const masterParams = useMemo(() => {
    const list = [
      ...CHANNELS.map((c) => ({
        code: c.code,
        name: c.name,
        category: 'Surface Input (7-Ch Tensor)',
        unit: c.unit,
        source: c.source,
        sensor: c.sensor,
        range: c.normalRange,
        formula: `Channel C${c.idx} · Ingested daily over 7-day sliding context`,
        impact: c.reconstructionImpact,
        tone: c.badgeTone,
      })),
      {
        code: '15-Depth T(z)',
        name: 'Vertical Temperature Profile (0–1000m)',
        category: 'Subsurface 3D Output',
        unit: '°C',
        source: 'OceanEmbed Neural Reconstructed Tensor',
        sensor: 'GLORYS12V1 / ARGO In-Situ CTD Benchmarked',
        range: '4.2°C – 31.8°C (Depth Stratified)',
        formula: 'T(z) at [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m]',
        impact: 'Full 3D baroclinic ocean state for thermal analysis and hazard forecasting',
        tone: 'teal' as const,
      },
      ...DERIVED_PHYSICS_VARS.map((d) => ({
        code: d.code,
        name: d.name,
        category: 'Derived Physics Diagnostic',
        unit: d.unit,
        source: 'Computed from Reconstructed 3D Field',
        sensor: 'Physics-Informed OceanEngine Vectorizer',
        range: d.threshold,
        formula: d.formula,
        impact: d.significance,
        tone: d.tone,
      })),
      ...ATMOSPHERIC_VARS.map((a) => ({
        code: a.name.split(' (')[0],
        name: a.name,
        category: 'Atmospheric Forcing (ERA5)',
        unit: a.unit,
        source: 'ECMWF ERA5 Atmospheric Reanalysis',
        sensor: 'IFS Coupled Atmospheric Model Cycle 41r2',
        range: a.importance,
        formula: a.desc,
        impact: a.importance,
        tone: a.tone,
      })),
    ];

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.formula.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
              <Database size={12} className="text-blue-600" />
              SYSTEM PARAMETER ENCYCLOPEDIA
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              20+ CANONICAL METRICS
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Complete Parameter Registry & Physical Foundations</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Technical documentation of 7 surface input tensors, 15 vertical depth layers, 8 derived oceanographic indices, and coupled ERA5 atmospheric forcing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search parameter, equation, sensor..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 flex-wrap">
            {(
              [
                { id: 'all', label: 'All Registry' },
                { id: 'surface', label: 'Surface (7)' },
                { id: 'depths', label: 'Depths (15)' },
                { id: 'derived', label: 'Derived Physics (8)' },
                { id: 'atmospheric', label: 'Atmospheric (5)' },
                { id: 'pipeline', label: 'Data Pipeline' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION A: MASTER SPECIFICATIONS MATRIX ──────────────────────── */}
      {(filter === 'all' || searchQuery.trim().length > 0) && (
        <Card title="Master Parameter Specifications & Mathematical Formulations Matrix" icon={TableIconWrapper} tone="blue">
          <p className="text-sm text-slate-700 mb-4 leading-relaxed">
            Consolidated architectural reference for all parameters ingested, reconstructed, or computed in the OceanIntel pipeline. Click any parameter row to inspect governing equations and sensors.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-xs">

              <thead>

                
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-mono font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">Code</th>
                  <th className="py-3 px-3.5">Full Designation</th>
                  <th className="py-3 px-3.5">Domain / Category</th>
                  <th className="py-3 px-3.5">Unit & Range</th>
                  <th className="py-3 px-3.5">Governing Equation / Tensor Shape</th>
                  <th className="py-3 px-3.5">Source / Sensor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterParams.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedParam(selectedParam === item.code ? null : item.code)}
                    className={`hover:bg-blue-50/60 cursor-pointer transition-colors ${
                      selectedParam === item.code ? 'bg-blue-50/90 font-medium' : ''
                    }`}
                  >
                    <td className="py-3 px-3.5 font-mono font-black text-blue-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      {item.code}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-3.5 text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-800">{item.unit}</td>
                    <td className="py-3 px-3.5 font-mono text-slate-700 text-[11px] max-w-xs truncate" title={item.formula}>
                      {item.formula}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 font-medium">{item.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── SECTION B: THE 7 CANONICAL SURFACE INPUT VARIABLES ─────────────── */}
      {(filter === 'all' || filter === 'surface') && (
        <Card title="The 7 Canonical Surface Input Variables (Copernicus & ECMWF)" icon={Waves} tone="blue">
          <p className="text-sm text-slate-700 mb-5 leading-relaxed">
            Every daily inference sample ingests exactly 7 surface variables spanning a 7-day rolling historical context window, generating the input tensor <code className="text-blue-900 bg-blue-100 px-2 py-0.5 rounded font-mono font-bold border border-blue-200">(Batch, 7 Channels, 7 Days, 101 Lat, 241 Lon)</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CHANNELS.map((ch) => (
              <div key={ch.idx} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-3.5 hover:border-blue-400 hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-mono text-xs font-black flex items-center justify-center shadow-xs">
                      C{ch.idx}
                    </span>
                    <div>
                      <span className="font-mono text-lg font-black text-slate-900">{ch.code}</span>
                      <span className="text-xs text-slate-500 font-mono block">Tensor Dim: {ch.tensorDim}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone={ch.badgeTone}>{ch.unit}</Pill>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">Range: {ch.normalRange}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">{ch.name}</h4>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    <span className="font-bold text-slate-700">Sensor:</span> {ch.sensor}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    <span className="font-bold text-slate-700">Data Source:</span> {ch.source}
                  </p>
                </div>

                <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-800 leading-relaxed shadow-xs">
                  <strong className="text-blue-900 font-bold block mb-0.5">Physical Significance: </strong>
                  {ch.physics}
                </div>

                <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3 text-xs text-slate-800 leading-relaxed">
                  <strong className="text-blue-950 font-bold block mb-0.5">Neural Model Impact: </strong>
                  {ch.reconstructionImpact}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECTION C: THE 15 RECONSTRUCTED DEPTH LEVELS (0m TO 1000m) ──────── */}
      {(filter === 'all' || filter === 'depths') && (
        <Card title="The 15 Reconstructed Depth Levels (0m to 1000m)" icon={Gauge} tone="teal">
          <p className="text-sm text-slate-700 mb-5 leading-relaxed">
            The target output tensor maps to 15 standard vertical levels <code className="text-teal-900 bg-teal-100 px-2 py-0.5 rounded font-mono font-bold border border-teal-200">(Batch, 15 Depths, 101 Lat, 241 Lon)</code>. Vertical sampling is densely concentrated in the upper 200m where 80% of the thermal gradient and thermocline inflection occur:
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2.5">
            {DEPTHS.map((d, i) => (
              <div key={d} className="rounded-2xl border border-teal-300 bg-teal-50/70 p-3.5 text-center hover:bg-white hover:border-teal-500 hover:shadow-sm transition-all">
                <span className="text-[10px] font-mono text-teal-800 font-extrabold block mb-1">Level {i + 1}</span>
                <span className="text-xl font-black text-slate-900 block">{d} m</span>
                <span className="text-[10px] text-slate-600 font-semibold block mt-1">
                  {d <= 50 ? 'Mixed Layer' : d <= 200 ? 'Thermocline' : 'Abyss'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-teal-200 bg-white p-4.5 space-y-2 shadow-xs">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                0m – 50m (Epipelagic)
              </span>
              <h4 className="text-sm font-bold text-slate-900">Surface Mixed Layer</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Governed by turbulent wind stirring, diurnal solar penetration, and latent/sensible air-sea fluxes. Directly couples to satellite SST radiometry.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-white p-4.5 space-y-2 shadow-xs">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                75m – 200m (Thermocline)
              </span>
              <h4 className="text-sm font-bold text-slate-900">Main Thermocline Core</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Contains the critical 26°C (D₂₆) and 20°C (D₂₀) isothermal horizons. This is the primary heat reservoir fueling cyclonic rapid intensification and planetary baroclinic waves.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-white p-4.5 space-y-2 shadow-xs">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                300m – 1000m (Mesopelagic)
              </span>
              <h4 className="text-sm font-bold text-slate-900">Intermediate & Deep Abyss</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Thermally stable deep water mass with low temporal variance, anchored by hydrostatic balance and abyssal meridional overturning circulation.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── SECTION D: DERIVED OCEANOGRAPHIC DIAGNOSTICS & PHYSICS ────────── */}
      {(filter === 'all' || filter === 'derived') && (
        <Card title="Derived Oceanographic Diagnostic Parameters & Governing Formulations" icon={Activity} tone="rose">
          <p className="text-sm text-slate-700 mb-5 leading-relaxed">
            The reconstructed 15-level 3D temperature tensor is transformed in real time by our physics-informed diagnostic vectorizer to extract key operational indices for cyclone intensification, marine heatwave detection, and emergency warning:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DERIVED_PHYSICS_VARS.map((v) => (
              <div key={v.code} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-3.5 hover:border-rose-400 hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-rose-900 bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-xl">
                      {v.code}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">{v.category}</span>
                  </div>
                  <Pill tone={v.tone}>{v.unit}</Pill>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">{v.name}</h4>
                  <div className="mt-2 rounded-xl bg-white border border-slate-200 p-3 font-mono text-xs font-bold text-slate-900 shadow-xs">
                    <span className="text-slate-500 font-mono text-[10px] block mb-0.5">Governing Equation:</span>
                    {v.formula}
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3 text-xs text-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-amber-900">
                    <ShieldAlert size={13} className="text-amber-700" />
                    Operational Critical Threshold:
                  </div>
                  <p className="font-semibold text-amber-950">{v.threshold}</p>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900 font-bold">Physical Role: </strong>
                  {v.significance}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECTION E: COUPLED ATMOSPHERIC FORCING (ERA5) ─────────────────── */}
      {(filter === 'all' || filter === 'atmospheric') && (
        <Card title="Coupled Atmospheric Environmental Variables (ECMWF ERA5)" icon={Wind} tone="orange">
          <p className="text-sm text-slate-700 mb-5 leading-relaxed">
            In addition to ocean surface parameters, our cyclone prediction and seasonal forecasting engines assimilate multi-level atmospheric variables from ECMWF ERA5 to assess vertical stability, environmental shear, and moisture flux:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ATMOSPHERIC_VARS.map((v) => (
              <div key={v.name} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-3 hover:bg-white hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">{v.name}</h4>
                  <Pill tone={v.tone}>{v.unit}</Pill>
                </div>
                <div className="inline-block px-3 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 font-mono text-xs font-bold">
                  {v.importance}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">{v.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── SECTION F: DATA PIPELINES & NORMALIZATION CONTRACTS ──────────── */}
      {(filter === 'all' || filter === 'pipeline') && (
        <Card title="End-to-End Ingestion, Quality Control & Normalization Pipeline" icon={Binary} tone="purple">
          <p className="text-sm text-slate-700 mb-5 leading-relaxed">
            To guarantee physical realism and neural convergence, every operational data payload traverses a rigorous 6-stage ingestion and transformation pipeline:
          </p>

          <div className="space-y-3.5">
            {PIPELINE_SPECS.map((step, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-purple-300 hover:shadow-sm transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-mono text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{step.step}</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pl-8">{step.description}</p>
                </div>
                <div className="shrink-0 bg-purple-50 border border-purple-200 px-3.5 py-2 rounded-xl text-xs font-mono text-purple-900 font-semibold md:max-w-md">
                  <span className="font-bold text-purple-950 block text-[10px] uppercase">Specification Contract:</span>
                  {step.contract}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function TableIconWrapper({ size, className }: { size?: number; className?: string }) {
  return <Database size={size} className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI MODELS & ARCHITECTURES TAB
// ─────────────────────────────────────────────────────────────────────────────
function ModelsSection() {
  return (
    <div className="space-y-6">
      <Card title="OceanEmbed Subsurface Reconstruction Architecture" icon={BrainCircuit} tone="purple">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 text-sm text-slate-800 leading-relaxed">
            <p className="text-base font-medium">
              The primary subsurface reconstruction model, <strong>OceanEmbed</strong>, solves an ill-posed inverse problem: mapping 2D surface boundary dynamics into a 3D baroclinic temperature profile. To achieve high accuracy across both turbulent eddies and basin-scale Rossby waves, we engineered and benchmarked four distinct neural paradigms:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-1.5">
                <h4 className="text-sm font-bold text-purple-900">1. Baseline 3D CNN</h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Spatiotemporal 3D convolutions with residual blocks. Effective at learning local isotropic mixing and Ekman pumping heuristics, but limited in receptive field for planetary waves.
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-1.5">
                <h4 className="text-sm font-bold text-blue-900">2. Hierarchical Swin Transformer</h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Shifted-window multi-head self-attention. Captures long-range teleconnections between the Arabian Sea and Bay of Bengal with linear computational complexity O(N).
                </p>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-1.5">
                <h4 className="text-sm font-bold text-teal-900">3. ConvGRU Recurrent Net</h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Combines spatial convolution with gated recurrent units across the 7-day rolling window to model oceanic thermal inertia and memory retention.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-1.5">
                <h4 className="text-sm font-bold text-emerald-900">4. Spatial Graph Neural Net (GNN)</h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Encodes irregular bathymetric boundary meshes, straits (Palk Strait, Strait of Malacca), and continental shelf slopes where standard Euclidean grids distort.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4.5 space-y-3">
            <h4 className="text-xs font-mono font-black uppercase text-blue-800 tracking-wider">Canonical Tensor Contract</h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-600 font-bold">Input Dimensions</span>
                <span className="text-blue-900 font-black">(B, 7, 7, 101, 241)</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-600 font-bold">Output Dimensions</span>
                <span className="text-teal-900 font-black">(B, 15, 101, 241)</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-600 font-bold">Latent Channels</span>
                <span className="text-slate-900 font-black">128–256 filters</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-600 font-bold">Loss Function</span>
                <span className="text-slate-900 font-bold">MAE + λ_∇ + λ_PINN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">Optimizer</span>
                <span className="text-slate-900 font-bold">AdamW (Cosine Decay)</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-blue-100 border border-blue-200 p-2.5 text-xs text-blue-950 leading-relaxed font-medium">
              <strong>Physics Penalty:</strong> Monotonicity loss L_density = max(0, ∂ρ/∂z) strictly suppresses unphysical inverted thermal profiles.
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="3D Spatiotemporal Fourier Neural Operator (FNO)" icon={Compass} tone="indigo">
          <p className="text-xs font-mono text-indigo-700 font-black mb-2">SEASONAL CLIMATE FORECAST ENGINE</p>
          <div className="space-y-3.5 text-sm text-slate-800 leading-relaxed">
            <p>
              Standard neural networks operate on fixed discrete grids. For our <strong>3-Month Continuous Seasonal Forecast</strong>, we deployed a <strong>Spatiotemporal Fourier Neural Operator (FNO)</strong> that learns mappings between infinite-dimensional function spaces.
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-mono text-xs text-cyan-300 shadow-md">
              {'K(v)(x) = F⁻¹( R · F(v) )(x) + W · v(x)'}
            </div>
            <p className="text-xs text-slate-700">
              • <strong>Spectral Convolutions:</strong> Computes global integral kernels in Fourier frequency space, making it zero-shot resolution-invariant and exceptionally fast at projecting forward monthly SST anomalies.
            </p>
            <p className="text-xs text-slate-700">
              • <strong>Autoregressive Rollout:</strong> Ingests 12 months of standardized oceanic conditions to forecast Month+1, Month+2, and Month+3 anomaly departures from 30-year climatology.
            </p>
          </div>
        </Card>

        <Card title="Coupled XGBoost Cyclone Formation & Intensity Predictor" icon={Wind} tone="orange">
          <p className="text-xs font-mono text-amber-800 font-black mb-2">RAPID INTENSIFICATION (RI) CLASSIFIER</p>
          <div className="space-y-3 text-sm text-slate-800 leading-relaxed">
            <p>
              To predict cyclogenesis and explosive storm intensification, we couple an ensemble of Gradient-Boosted Decision Trees (XGBoost) with our reconstructed subsurface thermal outputs.
            </p>
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <strong className="text-slate-900 font-bold">Input Feature Vector: </strong>
                <span className="text-slate-700">TCHP, D₂₆, MLD, 850hPa Vorticity, 200–850hPa Shear, 500hPa RH, SST, and Historical Storm Track Waypoint Trajectory.</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <strong className="text-slate-900 font-bold">RI Definition: </strong>
                <span className="text-slate-700">Binary classification of ≥ 30 knots (~55 km/h) increase in maximum sustained surface wind speed within a 24-hour window.</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <strong className="text-slate-900 font-bold">Track Progression: </strong>
                <span className="text-slate-700">Autoregressive trajectory regression predicting storm center latitude, longitude, and translation speed out to 7 days ahead.</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOWNSTREAM HAZARD APPLICATIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function DownstreamSection() {
  return (
    <div className="space-y-6">
      <Card title="Application 1: Cyclone Prediction & Rapid Intensification (RI)" icon={Wind} tone="rose">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3.5 text-sm text-slate-800 leading-relaxed">
            <p className="text-base font-medium">
              Traditional cyclone forecasting relies solely on Sea Surface Temperature (SST ≥ 26.5°C). However, SST alone is a notoriously poor predictor of storm intensification because intense cyclonic winds create extreme turbulent mixing that dredges up cold subsurface water (the &ldquo;cold wake&rdquo; effect), self-limiting the storm.
            </p>
            <p>
              <strong>The Ocean Heat Engine:</strong> When a tropical cyclone traverses an ocean region with deep warm water, vertical mixing dredges up warm water instead of cold water, feeding an uninterrupted torrent of latent heat into the eyewall. This triggers <strong>Rapid Intensification (RI)</strong>.
            </p>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-rose-300 space-y-2 shadow-md">
              <div className="font-bold text-white text-sm">Tropical Cyclone Heat Potential (TCHP) Formula:</div>
              <div className="text-sm font-bold text-amber-300">{'TCHP = ρ · Cp · ∫₀ᴰ²⁶ [T(z) - 26°C] dz  [kJ/cm²]'}</div>
              <div className="text-[11px] text-slate-300">
                {'Where ρ = 1025 kg/m³ (seawater density), Cp = 3993 J/(kg·K) (specific heat capacity), and D₂₆ is the depth of the 26°C isotherm.'}
              </div>
            </div>
            <p className="text-sm text-slate-900 font-semibold p-3 rounded-xl bg-rose-50 border border-rose-200">
              <strong>The 80 kJ/cm² Critical Threshold:</strong> Ocean regions with TCHP &gt; 80 kJ/cm² combined with low vertical wind shear (&lt; 15 kts) trigger our model&rsquo;s <span className="text-rose-800 font-black uppercase">Rapid Intensification Warning</span>, alerting meteorologists up to 72 hours before explosive deepening occurs.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4.5 space-y-3">
            <h4 className="text-xs font-mono font-black uppercase text-rose-800 tracking-wider">Cyclone Warning Deliverables</h4>
            <div className="space-y-2.5 text-xs text-slate-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-rose-600 mt-0.5 shrink-0" />
                <span><strong className="text-slate-900 font-bold">7-Day Dynamic Track Simulation:</strong> Predicted storm coordinates, forward speed, and cone of uncertainty.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-rose-600 mt-0.5 shrink-0" />
                <span><strong className="text-slate-900 font-bold">Storm Surge Inundation:</strong> Coastal peak surge height (1.2m to 5.0m) calculated from central pressure and coastal bathymetry.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-rose-600 mt-0.5 shrink-0" />
                <span><strong className="text-slate-900 font-bold">Port Warning Signals:</strong> Automated assignment of Indian Port Signals I through XI (e.g. Signal VIII Great Danger).</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-rose-600 mt-0.5 shrink-0" />
                <span><strong className="text-slate-900 font-bold">Fishermen Bulletins:</strong> High-seas exclusion zones and wave setup alerts.</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Application 2: Ocean Heat Content & Marine Heatwaves (MHW)" icon={Flame} tone="orange">
          <div className="space-y-3 text-sm text-slate-800 leading-relaxed">
            <p>
              Using reconstructed 0–1000m profiles, OceanIntel continuously monitors vertical thermal budgets across the Arabian Sea and Bay of Bengal:
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <strong className="text-amber-900 font-bold block mb-1">OHC₇₀₀ (0–700m Heat Content):</strong>
                <p className="text-slate-700">Measures total accumulated thermal energy: {'OHC = ρ · Cp · ∫₀⁷⁰⁰ T(z) dz'} in GJ/m², tracking decadal climate warming trends.</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <strong className="text-amber-900 font-bold block mb-1">D₂₆ & D₂₀ Isothermal Horizons:</strong>
                <p className="text-slate-700">Tracks depth variations of warm water pools. Depressions in D₂₀ identify downwelling anticyclonic eddies that trap immense heat.</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <strong className="text-amber-900 font-bold block mb-1">Marine Heatwave (MHW) Severity Tracker:</strong>
                <p className="text-slate-700">Implements the Hobday et al. international standard: temperatures exceeding the 90th percentile climatological threshold for ≥ 5 consecutive days. Categorizes events into Moderate (Cat I), Strong (Cat II), Severe (Cat III), and Extreme (Cat IV), calculating Degree Heating Weeks (DHW) for coral reef bleaching risk.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Application 3: Seasonal Ocean Climate Forecasting" icon={Compass} tone="indigo">
          <div className="space-y-3 text-sm text-slate-800 leading-relaxed">
            <p>
              Powered by our Spatiotemporal Fourier Neural Operator (FNO), OceanIntel provides 3-month forward climate projections:
            </p>
            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
                <strong className="text-indigo-900 font-bold block mb-1">Indian Ocean Dipole (IOD / DMI):</strong>
                <p className="text-slate-700">Computes the Dipole Mode Index (DMI) — the SST anomaly difference between the Western Equatorial Indian Ocean (50°E–70°E, 10°S–10°N) and Southeastern Equatorial Indian Ocean (90°E–110°E, 10°S–0°N). Vital for predicting summer monsoon rainfall over the Indian subcontinent.</p>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
                <strong className="text-indigo-900 font-bold block mb-1">Subsurface Thermocline Memory:</strong>
                <p className="text-slate-700">Unlike atmospheric forecasts that lose skill after 10–14 days, subsurface ocean heat features slow thermal inertia, allowing FNO to project seasonal SST departures months in advance.</p>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
                <strong className="text-indigo-900 font-bold block mb-1">Monsoon Thermal Priming:</strong>
                <p className="text-slate-700">Tracks pre-monsoon Arabian Sea mini warm pools (SST &gt; 30.5°C) that govern the timing and strength of the monsoon onset vortex over Kerala.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 7-DAY SLIDING WINDOW TAB
// ─────────────────────────────────────────────────────────────────────────────
function ForecastWindowSection() {
  return (
    <div className="space-y-6">
      <Card title="The 7-Day Sliding Window Forecast Engine" icon={CalendarDays} tone="cyan">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 text-sm text-slate-800 leading-relaxed">
            <p className="text-base font-medium">
              On the <strong>Forecast Page</strong>, OceanIntel operationalizes a dynamic <strong>7-Day Sliding Window</strong> temporal architecture. Instead of treating days as isolated static snapshots, the system leverages rolling temporal context to enforce physical continuity across time.
            </p>
            <div className="rounded-xl border border-cyan-300 bg-cyan-50/70 p-4 space-y-2 text-slate-900">
              <h4 className="text-xs font-mono font-black text-cyan-900 uppercase">Window Decomposition & Rollout</h4>
              <p className="text-xs leading-relaxed">
                • <strong>6-Day Historical Memory [T-6, T-5, &hellip;, T-1]:</strong> Captures the prior trajectory of wind-driven vertical mixing, sea level anomalies, and thermal advection.
              </p>
              <p className="text-xs leading-relaxed">
                • <strong>Reference Day T+0 (Today):</strong> Canonical anchor state combining the latest satellite radiometry passes and observational telemetry.
              </p>
              <p className="text-xs leading-relaxed">
                • <strong>Autoregressive Forward Horizon [T+1 &hellip; T+7]:</strong> At each forward step t, the newly reconstructed surface and subsurface temperature fields are fed back into the temporal buffer while dropping the oldest day, rolling the 7-day window forward step-by-step.
              </p>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>Uncertainty Cone Propagation:</strong> As the sliding window advances from Day +1 to Day +7, physical variance naturally increases due to accumulated atmospheric forcing uncertainty. The UI renders dynamic confidence intervals and anomaly bounds (± σ) reflecting this physical reality.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4.5 space-y-3">
            <h4 className="text-xs font-mono font-black uppercase text-cyan-900 tracking-wider">Sliding Window Timeline</h4>
            <div className="space-y-2 text-xs font-mono">
              {[
                { day: 'T-6 to T-1', role: 'Historical Lookback', color: 'text-slate-600', badge: 'Context' },
                { day: 'T+0 (Today)', role: 'Current Analysis', color: 'text-blue-700', badge: 'Ground Truth' },
                { day: 'T+1 (+24h)', role: 'Short-range Forecast', color: 'text-teal-700', badge: 'High Skill' },
                { day: 'T+2 (+48h)', role: 'RI Watch Window', color: 'text-amber-700', badge: 'Warning' },
                { day: 'T+3 (+72h)', role: 'Pre-Landfall Alert', color: 'text-rose-700', badge: 'Critical' },
                { day: 'T+4 to T+7', role: 'Medium-range Trajectory', color: 'text-purple-700', badge: 'Envelope' },
              ].map((step) => (
                <div key={step.day} className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <div>
                    <span className={`font-black ${step.color}`}>{step.day}</span>
                    <span className="text-[10px] text-slate-500 block">{step.role}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-xs">
                    {step.badge}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-cyan-100/60 border border-cyan-200 p-2.5 text-[11px] text-cyan-950 font-medium">
              Interactive Scrubber on the Forecast page allows one-click time stepping across all 8 temporal slices.
            </div>
          </div>
        </div>
      </Card>

      <Card title="Dynamic Thermal Delta & Anomaly Divergence" icon={TrendingUp} tone="teal">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-1.5">1. Thermal Delta (ΔT(z))</h4>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              Computes daily temperature change relative to Day 0: ΔT(z) = T_forecast(z) - T_day0(z). Instantly flags rapid cooling from cyclone upwelling wakes or thermal accumulation under marine heatwaves.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-1.5">2. Thermocline Shift (ΔD₂₆)</h4>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              Quantifies whether the 26°C isotherm is shoaling (surfacing) or deepening over the 7-day window, providing direct physical insight into vertical mass transport.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <h4 className="text-sm font-bold text-slate-900 mb-1.5">3. Storm Track Coupling</h4>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              The 7-day sliding window on the Forecast page dynamically locks with the 7-day forward cyclone track on the Cyclone page, providing synchronized atmospheric-oceanic visualization.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. EXPLAINABLE AI (X-AI) TAB
// ─────────────────────────────────────────────────────────────────────────────
function XaiSection() {
  return (
    <div className="space-y-6">
      <Card title="Explainable AI (X-AI) & Physics Constraints" icon={Cpu} tone="purple">
        <div className="space-y-4 text-sm text-slate-800 leading-relaxed">
          <p className="text-base font-medium">
            In mission-critical ocean intelligence and disaster mitigation, black-box deep learning models are insufficient. Operational meteorologists, port authorities, and naval commanders require verifiable explanations of <em>why</em> a model predicts rapid intensification or a sudden thermocline collapse.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4.5 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <BarChart3 size={18} />
              </div>
              <h4 className="text-sm font-bold text-purple-950">SHAP Feature Attribution</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Applies game-theoretic Shapley values (SHAP) and Integrated Gradients to quantify exact marginal contributions of each input channel (SST, SSS, SSH, Winds, Currents) to depth-wise predictions.
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4.5 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck size={18} />
              </div>
              <h4 className="text-sm font-bold text-blue-950">Physics-Informed Losses (PINN)</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Penalizes unphysical thermodynamic violations during training: enforces vertical heat diffusion continuity and strictly forbids gravitational instability (∂ρ / ∂z &lt; 0).
              </p>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4.5 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <Sliders size={18} />
              </div>
              <h4 className="text-sm font-bold text-teal-950">Counterfactual Sliders</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Allows researchers to test &ldquo;what-if&rdquo; scenarios: e.g. artificially cooling SST by 1.0°C or increasing vertical wind shear by 10 kts to evaluate real-time recalculation of cyclone RI probability.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Feature Attribution Rankings Across Vertical Depth Regimes" icon={Layers} tone="blue">
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-mono font-bold">
                <th className="py-3 px-4">Vertical Depth Zone</th>
                <th className="py-3 px-4">Dominant Predictor</th>
                <th className="py-3 px-4">Relative SHAP Weight</th>
                <th className="py-3 px-4">Physical Mechanism Explained</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr className="hover:bg-blue-50/40">
                <td className="py-3 px-4 font-bold text-slate-900">Surface Layer (0–20m)</td>
                <td className="py-3 px-4 font-mono font-bold text-blue-800">SST + 10m Wind Speed</td>
                <td className="py-3 px-4 font-mono font-black text-emerald-700">58% Total SHAP</td>
                <td className="py-3 px-4 text-slate-700">Direct radiative solar heating and mechanical wind stirring of the skin layer.</td>
              </tr>
              <tr className="hover:bg-blue-50/40">
                <td className="py-3 px-4 font-bold text-slate-900">Thermocline Core (50–150m)</td>
                <td className="py-3 px-4 font-mono font-bold text-blue-800">SSH / SLA + SSS</td>
                <td className="py-3 px-4 font-mono font-black text-emerald-700">64% Total SHAP</td>
                <td className="py-3 px-4 text-slate-700">Altimetry SLA directly mirrors the vertical stretching/compression of the main thermocline; salinity controls barrier layers.</td>
              </tr>
              <tr className="hover:bg-blue-50/40">
                <td className="py-3 px-4 font-bold text-slate-900">Intermediate Ocean (200–500m)</td>
                <td className="py-3 px-4 font-mono font-bold text-blue-800">SSH + Surface Currents</td>
                <td className="py-3 px-4 font-mono font-black text-emerald-700">52% Total SHAP</td>
                <td className="py-3 px-4 text-slate-700">Geostrophic transport and planetary Rossby wave propagation across the basin.</td>
              </tr>
              <tr className="hover:bg-blue-50/40">
                <td className="py-3 px-4 font-bold text-slate-900">Deep Abyss (700–1000m)</td>
                <td className="py-3 px-4 font-mono font-bold text-blue-800">Climatological Prior + SLA</td>
                <td className="py-3 px-4 font-mono font-black text-emerald-700">45% Total SHAP</td>
                <td className="py-3 px-4 text-slate-700">Thermally stable deep water mass with low temporal variance, anchored by hydrostatic balance.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GOV PORTAL & HIGH-ALERT DISPATCH TAB
// ─────────────────────────────────────────────────────────────────────────────
function GovAlertSection() {
  return (
    <div className="space-y-6">
      <Card title="Government & Emergency Operations Command Center (/government)" icon={ShieldAlert} tone="rose">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 text-sm text-slate-800 leading-relaxed">
            <p className="text-base font-medium">
              The <strong>Government Operations Portal (/government)</strong> is OceanIntel's mission-critical administrative console designed for MoES, INCOIS, the National Disaster Management Authority (NDMA), state disaster commissioners (SDMA), and the Indian Coast Guard.
            </p>
            <p>
              It transforms raw scientific deep-learning predictions into standardized, actionable civil protection protocols, automated port hazard signals, evacuation priority matrices, and official emergency bulletins.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { tier: 'Blue Advisory', time: '120h Lead', role: 'Pre-Cyclone Watch', color: 'text-blue-900 border-blue-300 bg-blue-50' },
                { tier: 'Yellow Watch', time: '72h Lead', role: 'Depression / Storm Alert', color: 'text-amber-900 border-amber-300 bg-amber-50' },
                { tier: 'Orange Warning', time: '48h Lead', role: 'Severe Cyclonic Storm', color: 'text-orange-900 border-orange-300 bg-orange-50' },
                { tier: 'Red Emergency', time: '24h / Landfall', role: 'RI / Catastrophic Strike', color: 'text-rose-900 border-rose-300 bg-rose-50' },
              ].map((t) => (
                <div key={t.tier} className={`rounded-xl border p-3.5 text-center shadow-xs ${t.color}`}>
                  <span className="text-[10px] font-mono font-bold block">{t.time}</span>
                  <span className="text-sm font-black block my-1">{t.tier}</span>
                  <span className="text-[10px] text-slate-700 font-semibold block">{t.role}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4.5 space-y-3">
            <h4 className="text-xs font-mono font-black uppercase text-rose-800 tracking-wider">Command Capabilities</h4>
            <div className="space-y-2 text-xs text-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-rose-600" />
                <span>Multi-agency authenticated role access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-rose-600" />
                <span>One-click IMD/NDMA standard PDF export</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-rose-600" />
                <span>Port signal dispatcher (Signals I through XI)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-rose-600" />
                <span>NDRF troop staging coordinate tracker</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-rose-600" />
                <span>Immutable cryptographic audit trail</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="How Cyclone High Alert Automatically Escalates to the Government Portal" icon={Radio} tone="orange">
        <div className="space-y-4">
          <p className="text-base text-slate-800 leading-relaxed font-medium">
            The heart of OceanIntel's operational defense system is an <strong>automated, event-driven cross-page escalation pipeline</strong>. When the Cyclone Prediction engine detects extreme threat conditions, it does not wait for manual user reporting—it immediately synchronizes with the Government Operations command center:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            {[
              {
                step: 'Step 1: Detection Trigger',
                title: 'Cyclone Page Detection',
                desc: 'When the simulation on the Cyclone page registers TCHP > 80 kJ/cm² coupled with low shear (< 15 kts) OR reaches Category VSCS/ESCS/Super Cyclone (winds > 140 km/h).',
                icon: AlertTriangle,
                badge: 'isRapidIntensificationTrigger',
                color: 'text-amber-800 bg-amber-50 border-amber-300',
              },
              {
                step: 'Step 2: Sync Protocol',
                title: 'Emergency Broadcast',
                desc: 'The client-state and backend alert service emit an emergency event dispatching storm coordinates, peak storm surge, and estimated time to landfall (TTL).',
                icon: RefreshCw,
                badge: 'gov_active_protocol',
                color: 'text-teal-800 bg-teal-50 border-teal-300',
              },
              {
                step: 'Step 3: Portal Elevation',
                title: 'Gov Page Elevated',
                desc: 'The /government portal instantly elevates the active status to Red Warning / Emergency Action, illuminating critical banner alerts and overriding normal operations.',
                icon: ShieldAlert,
                badge: 'Severity: CRITICAL',
                color: 'text-rose-800 bg-rose-50 border-rose-300',
              },
              {
                step: 'Step 4: Civil Defense',
                title: 'Forces Mobilized',
                desc: 'Automatically dispatches Great Danger Port Signals (Signals VIII, IX, X, XI) to major ports (Paradip, Vizag, Dhamra), and maps NDRF battalion deployment zones.',
                icon: Anchor,
                badge: 'NDMA Dispatched',
                color: 'text-emerald-800 bg-emerald-50 border-emerald-300',
              },
            ].map((s) => (
              <div key={s.step} className="rounded-xl border border-slate-200 bg-white p-4.5 flex flex-col justify-between hover:shadow-md hover:border-amber-400 transition-all">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-black text-amber-900 mb-2">
                    <span>{s.step}</span>
                    <s.icon size={16} />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">{s.title}</h4>
                  <p className="text-xs text-slate-700 leading-relaxed mb-3">{s.desc}</p>
                </div>
                <div className="pt-2.5 border-t border-slate-100">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 block truncate">
                    {s.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4.5 text-xs text-slate-800 leading-relaxed shadow-xs">
            <strong className="text-rose-900 font-black uppercase tracking-wider block mb-1 text-sm">Example Operational Scenario:</strong>
            At <strong>Day +2 (RI Trigger)</strong> on the Cyclone Prediction page, cyclone winds intensify from 105 km/h to 145 km/h over a 94 kJ/cm² ocean heat reservoir. The system flags <code className="text-rose-900 bg-rose-200 px-1.5 py-0.5 rounded font-bold">isRapidIntensificationTrigger = true</code>. Instantly, the Government page switches to <strong>Signal VI Danger</strong>, prepares mandatory evacuation notices for low-lying coastal dwellings within 5 km of the shoreline, and alerts 28 NDRF and 40 SDRF disaster teams for immediate forward staging.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. RESEARCH INTEGRITY & RULES TAB
// ─────────────────────────────────────────────────────────────────────────────
function RulesSection() {
  return (
    <div className="space-y-6">
      <Card title="Scientific Integrity & Non-Fabrication Protocol" icon={ShieldCheck} tone="emerald">
        <div className="space-y-4 text-sm text-slate-800 leading-relaxed">
          <p className="text-base font-medium">
            OceanIntel operates under strict scientific reproducibility standards mandated by MoES research guidelines. AI models deployed within this platform must conform to rigorous validation criteria:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4.5 space-y-2">
              <h4 className="text-xs font-black text-emerald-900 font-mono uppercase tracking-wider">Permitted Reporting</h4>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />Empirically measured benchmark metrics (RMSE, MAE, R², Bias, Correlation) documented in official evaluation logs.</li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />Strict separation between experimental architectures, proposed prototypes, and certified operational releases.</li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />Transparent citation of third-party reanalyses and datasets (GLORYS12V1, ERA5, ARGO).</li>
              </ul>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4.5 space-y-2">
              <h4 className="text-xs font-black text-rose-900 font-mono uppercase tracking-wider">Strict Prohibitions</h4>
              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex gap-2"><AlertOctagon size={16} className="text-rose-700 mt-0.5 shrink-0" />Never synthesize or extrapolate unsupported numerical skill scores without underlying dataset runs.</li>
                <li className="flex gap-2"><AlertOctagon size={16} className="text-rose-700 mt-0.5 shrink-0" />Never blur the boundary between historical training data (2018–2022) and live forward operational data (2026).</li>
                <li className="flex gap-2"><AlertOctagon size={16} className="text-rose-700 mt-0.5 shrink-0" />Never suppress physical inconsistencies or violate hydrodynamic conservation principles.</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Numerical Precision" icon={Gauge} tone="teal">
          <p className="text-xs text-slate-700 leading-relaxed font-normal">
            All numerical predictions output floating-point values rounded to standard meteorological precision: SST/Subsurface T to 0.01°C, Salinity to 0.01 PSU, and Wind Speeds to 0.1 m/s.
          </p>
        </Card>
        <Card title="Independent Buoy Evaluation" icon={Database} tone="blue">
          <p className="text-xs text-slate-700 leading-relaxed font-normal">
            In-situ ARGO profiling floats provide uncompromised independent ground truth. ARGO profiles collected during the 2024–2025 holdout period are never included in neural network backpropagation.
          </p>
        </Card>
        <Card title="Operational Separation" icon={Calendar} tone="purple">
          <p className="text-xs text-slate-700 leading-relaxed font-normal">
            Year 2026 data is exclusively designated as live operational streaming telemetry. It is strictly segmented from historical test suites to prevent future-data contamination.
          </p>
        </Card>
      </div>

      <Card title="Research Citation & Project Attribution" icon={BookOpen} tone="cyan">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">GLORYS Global Ocean Reanalysis (CMEMS)</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Target training dataset referenced under Copernicus Marine Service Product ID: GLOBAL_MULTIYEAR_PHY_001_030.
            </p>
          </div>
          <a
            href="https://doi.org/10.48670/moi-00021"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-100 px-4 py-2 text-xs font-bold text-cyan-900 hover:bg-cyan-200 transition-all shrink-0"
          >
            DOI 10.48670/moi-00021
            <ExternalLink size={14} />
          </a>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DOCS PAGE COMPONENT (BRIGHT THEME DEFAULT WITH CRISP CONTRAST)
// ─────────────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const handleQuickJump = (tabId: TabId) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen font-sans text-slate-900 relative">
      {/* Ocean Background */}
      <WaterBackground />

      {/* Global Application Navigation Bar */}
      <Navbar />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Master Header */}
        <header className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200/90 shadow-[0_12px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3.5 py-1 text-xs font-mono font-bold text-blue-800 shadow-xs">
                  <BookOpen size={13} className="text-blue-600" />
                  SIH26066 · MASTER SYSTEM SPECIFICATION
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-mono font-bold text-emerald-800 shadow-xs">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  MOES / INCOIS RESEARCH BENCHMARK
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-50 px-3.5 py-1 text-xs font-mono font-bold text-purple-800 shadow-xs">
                  <Cpu size={13} className="text-purple-600" />
                  FULL 0–1000M 3D RECONSTRUCTION
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
                OceanIntel System Documentation
              </h1>
              <p className="text-sm sm:text-base text-slate-700 max-w-4xl leading-relaxed font-medium">
                End-to-end technical reference: 7-parameter surface inputs, 15-level subsurface 3D reconstruction (OceanEmbed), 3-month Spatiotemporal FNO seasonal forecasting, multi-hazard cyclone RI and marine heatwave diagnostics, 7-day sliding window temporal engine, Explainable AI (X-AI), and automated emergency escalation to the Government Operations Command Center.
              </p>
            </div>

            {/* Quick Stat Header Metrics */}
            <div className="grid grid-cols-2 gap-2.5 min-w-[320px]">
              <Stat label="Spatial Domain" value="North Indian Ocean" icon={Map} color="text-blue-600" />
              <Stat label="Spatial Grid" value="0.25° × 0.25°" icon={Ruler} color="text-teal-600" />
              <Stat label="Surface Channels" value="7 Parameters" icon={Waves} color="text-cyan-600" />
              <Stat label="Vertical Depths" value="15 Levels (1000m)" icon={Gauge} color="text-purple-600" />
            </div>
          </div>
        </header>

        {/* Navigation Bar */}
        <nav className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl p-2 shadow-sm overflow-x-auto">
          <div className="flex min-w-max gap-1.5">
            {NAV_TABS.map(({ id, label, icon: TabIcon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <TabIcon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab Content Rendering */}
        <main className="transition-opacity duration-300">
          {activeTab === 'overview' && <OverviewSection />}
          {activeTab === 'parameters' && <ParametersSection />}
          {activeTab === 'models' && <ModelsSection />}
          {activeTab === 'downstream' && <DownstreamSection />}
          {activeTab === 'forecast-window' && <ForecastWindowSection />}
          {activeTab === 'xai' && <XaiSection />}
          {activeTab === 'gov-alert' && <GovAlertSection />}
          {activeTab === 'rules' && <RulesSection />}
        </main>

        {/* Operational Footer Notice */}
        <footer className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">OceanIntel Comprehensive Research & Operational Specification</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Developed for the Ministry of Earth Sciences (MoES) and INCOIS under Smart India Hackathon (SIH26066). All physical parameters, equations, neural architectures, and emergency dispatch workflows described herein are fully implemented across the active OceanIntel codebase.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => handleQuickJump('overview')}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Back to Top
              </button>
              <button
                onClick={() => handleQuickJump('gov-alert')}
                className="px-3.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors"
              >
                Gov Protocol →
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
