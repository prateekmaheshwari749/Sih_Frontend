# SAMUDRA-AI / OceanIntel: Subsurface Ocean Digital Twin Platform
## Comprehensive Frontend Technical Documentation
**Ministry of Earth Sciences (MoES) & INCOIS | Smart India Hackathon (SIH) 2026**

---

## 1. Executive Summary & System Overview

**SAMUDRA-AI (OceanIntel)** is an advanced spatio-temporal AI digital twin and oceanographic forecasting platform. The frontend application provides interactive 3D visualizations, 2D geospatial GIS mapping, deep learning model benchmarking, vertical temperature reconstruction, cyclone trajectory tracking, and government disaster alert management for the **North Indian Ocean (5°N–30°N, 45°E–105°E)** across **15 standard oceanographic depth levels (0 m to 1000 m)**.

### Primary Objectives:
1. **Vertical Temperature Profile Reconstruction**: Reconstructing vertical subsurface temperatures (0–1000 m) from satellite-derived surface observations (SST, SSS, SSH, surface winds, and ocean currents).
2. **3D Holographic Visualization**: Real-time WebGL/Three.js interactive ocean column and global ARGO float network modeling.
3. **Multi-Model Latent Benchmarking**: Comparative analysis of CNN, Swin Transformer, ConvGRU, Graph Neural Network (GNN), and Autoencoder models using PCA latent space projection and depth-wise error metrics.
4. **Spatio-Temporal Ocean Forecasting**: 7-day predictive horizons for Mixed Layer Depth (MLD), Ocean Heat Content (OHC), and thermocline shoaling/deepening.
5. **Government & Disaster Response Portal**: Automated early-warning generation and dispatch for Marine Heatwaves (MHW), cyclone intensification hazards, and thermocline anomalies for NDMA, IMD, Coast Guard, Navy, and state SDMAs.
6. **Zero-Configuration Resilience**: Dual-mode data fetching with seamless live FastAPI backend connectivity and physics-informed offline fallback based on TEOS-10 thermodynamic formulations.

---

## 2. Technology Stack & Architecture

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Core Framework** | React | `19.2.8` | Component architecture, lazy loading, suspense |
| **Language** | TypeScript | `~6.0.2` | Strict end-to-end typing, interfaces, and data contracts |
| **Build & Dev Tool** | Vite | `8.2.2` | HMR, bundling, proxy configuration |
| **Styling & CSS** | Tailwind CSS | `4.3.3` | Tailwind v4 with custom glassmorphism and depth tokens |
| **3D Graphics** | Three.js | `0.185.1` | WebGL rendering, custom geometries, procedural shaders |
| **React 3D Bridge** | `@react-three/fiber` | `9.7.0` | Declarative Three.js scene graph in React |
| **3D Helpers** | `@react-three/drei` | `10.7.8` | OrbitControls, procedural Stars, HTML projection overlays |
| **2D GIS Maps** | Leaflet & React-Leaflet | `1.9.4` / `5.0.0` | Interactive map tiles, coordinates, bounding box overlays |
| **Charts & Metrics** | Recharts | `3.10.1` | Responsive area charts, line series, radar plots, PCA scatter |
| **Animations** | Framer Motion | `13.2.0` | Motion transitions, layout animations, hover effects |
| **Date Utilities** | `date-fns` | `4.4.0` | Date arithmetic, intervals, ISO-8601 formatting |
| **Routing** | React Router DOM | `7.18.3` | Client-side routing, route protection, lazy loading |
| **Icons** | Lucide React | `1.39.0` | Oceanographic and interface vector icons |

---

## 3. Directory Structure

```
frontend_actual/
├── public/                     # Static assets, icons, manifest
├── src/
│   ├── api/
│   │   ├── client.ts           # Endpoint URL builder
│   │   ├── oceanApi.ts         # Central typed API service layer & fallback wrappers
│   │   └── features/
│   │       └── forecast/
│   │           └── Heatmap.tsx # Heatmap canvas renderer helper
│   ├── assets/                 # Image assets, logos, textures
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── DepthZoneCanvas.tsx    # Depth layer preview canvas
│   │   │   ├── HolographicGlobe.tsx   # 3D interactive Earth with ARGO floats
│   │   │   ├── OceanHeroCanvas.tsx    # Multi-mode hero (Globe / Column / Waves)
│   │   │   └── SubsurfaceColumn3D.tsx # 15-level vertical ocean column with ARGO CTD
│   │   ├── GlassCard.tsx       # Glassmorphism container & metric cards
│   │   ├── Navbar.tsx          # Fixed glass header with live auth & backend status
│   │   ├── PageLayout.tsx      # Adaptive ocean-depth layout with scroll darkness
│   │   ├── ProtectedRoute.tsx  # RBAC route guard (general vs government)
│   │   ├── RiskBadge.tsx       # Color-coded hazard indicator component
│   │   └── WaterEffects.tsx    # Micro-interaction particle/water effects
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Authentication, user roles, localStorage sync
│   │   └── DataContext.tsx     # Ocean data domain, observation records, alerts, physics engine
│   ├── pages/
│   │   ├── ChatPage.tsx        # "X AI" ocean intelligence assistant
│   │   ├── CyclonePage.tsx     # Cyclone track forecasting & metrics evaluation
│   │   ├── DashboardPage.tsx   # Primary KPI dashboard, animated counters, alert feeds
│   │   ├── DocsPage.tsx        # System architecture, pipeline, and API documentation
│   │   ├── ForecastPage.tsx    # 7-day subsurface temperature forecasting
│   │   ├── GovPortalPage.tsx   # NDMA / IMD emergency alert dispatch center
│   │   ├── HomePage.tsx        # Interactive hero, 3D showcases, depth zone explorer
│   │   ├── InputPage.tsx       # NetCDF (.nc) drag-and-drop parser & manual input
│   │   ├── LoginPage.tsx       # Role-based login (Analyst / Government)
│   │   ├── MapPage.tsx         # 3D temperature depth slabs with Three.js
│   │   ├── ModelComparisonPage.tsx # CNN vs Swin vs ConvGRU vs GNN vs Autoencoder
│   │   ├── ReconstructPage.tsx # Reconstruction performance, skill scores, training logs
│   │   ├── SurfacePage.tsx     # 2D satellite surface observation canvases (SST, SSS, SSH)
│   │   ├── ValidationPage.tsx  # ARGO float ground-truth validation & skill scores
│   │   └── WorldMapPage.tsx    # 2D Leaflet map with IDW temperature interpolation
│   ├── pipeline/
│   │   └── trainCycloneModel.ts# Decoupled offline feature engineering & model training
│   ├── App.css                 # Application-level styling
│   ├── App.tsx                 # Route declarations, providers, water effects
│   ├── index.css               # Tailwind v4 import, custom glass & neon utility classes
│   └── main.tsx                # React DOM root mounting
├── index.html                  # HTML5 entrypoint with Google Fonts & metadata
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # TypeScript base configuration
├── tsconfig.app.json           # Client app TS compiler options
├── tsconfig.node.json          # Vite node runtime TS compiler options
└── vite.config.ts              # Vite plugins and API reverse-proxy configuration
```

---

## 4. Routing & Role-Based Access Control (RBAC)

The application uses **React Router v7** with route splitting via `React.lazy()` and `<Suspense fallback={<PageLoader />}>`.

### Complete Route Map:

| Route | Page Component | Access Level | Description |
|---|---|---|---|
| `/` | `HomePage` | Public | Interactive 3D hero, depth zones, live counters, platform overview |
| `/login` | `LoginPage` | Public | Role selector (Analyst / Government) with instant demo credentials |
| `/dashboard` | `DashboardPage` | Public | Ocean KPIs, animated counters, risk gauges, anomaly feed |
| `/input` | `InputPage` | Public | NetCDF `.nc` multi-file upload slot parser & manual ingestion |
| `/worldmap` | `WorldMapPage` | Public | 2D Leaflet GIS map with 1° grid and IDW spatial interpolation |
| `/surface` | `SurfacePage` | Public | Satellite heatmaps for SST, SSS, SSH, U/V wind, currents |
| `/map` | `MapPage` | Public | 3D volumetric depth slabs (0–1000m) with Three.js |
| `/forecast` | `ForecastPage` | Public | 7-day predictive temperature evolution & MLD forecasting |
| `/cyclone` | `CyclonePage` | Public | Cyclone track prediction, Phase 1 metrics, model diagnostics |
| `/compare` | `ModelComparisonPage` | Public | Multi-model latent space (PCA), radar benchmarks, depth profiles |
| `/validation` | `ValidationPage` | Public | In-situ ARGO float validation tables (RMSE, MAE, Correlation) |
| `/docs` | `DocsPage` | **Protected** (Auth) | Technical architecture, pipeline specs, system status |
| `/gov` | `GovPortalPage` | **Protected** (Gov) | Emergency alert dispatch for NDMA, IMD, Navy, Coast Guard |
| `/chat` | `ChatPage` | Public | "X AI" oceanographic conversational assistant |

### RBAC Implementation (`src/components/ProtectedRoute.tsx`):
- **General Analyst Access**: Allows access to scientific analysis and `/docs`.
- **Government Officer Access (`requiresGovernment: true`)**: Required to view and dispatch emergency alerts in `/gov`. If an unauthorized user navigates to `/gov`, a dedicated warning screen displays with an option to elevate credentials.

---

## 5. State Management & Data Architecture

State management is organized into two primary React Context providers wrapping the application root in `App.tsx`:

### 5.1. `AuthContext.tsx`
Manages user authentication, role assignment, and session persistence:
- **State**:
  - `user`: `{ id: string; name: string; email: string; role: 'general' | 'government' | null }`
  - `isAuthenticated`: `boolean`
  - `isGovernment`: `boolean`
- **Persistence**: Synced with `localStorage.getItem('ocean_user')`.
- **Default Test Credentials**:
  - **Ocean Analyst**: `user@ocean.gov` / `ocean123`
  - **Government Official**: `gov@ndma.gov.in` / `gov@2026`

### 5.2. `DataContext.tsx`
Central repository for oceanographic spatial domains, depth levels, profile simulations, historical records, and alerts:
- **Spatial Domain Definition**:
  - `latMin`: `5.0°N`, `latMax`: `30.0°N`
  - `lonMin`: `45.0°E`, `lonMax`: `105.0°E`
  - `resolution`: `0.25°` (standard INCOIS/GLORYS grid)
- **Standard Depth Levels (`DEPTH_LEVELS`)**:
  `[0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]` metres.
- **Physical Profile Generation (`generateProfile`)**:
  When backend inference is unreachable, an analytical thermodynamic stratification function computes vertical temperatures:
  - **Mixed Layer (0–30 m)**: Near-isothermal layer governed by wind shear and surface cooling.
  - **Thermocline Core (50–200 m)**: Steep exponential gradient modulated by Sea Surface Height (SSH) anomalies (representing mesoscale warm/cold-core eddy displacement).
  - **Abyssal Water (300–1000 m)**: Asymptotic decay approaching abyssal temperature limits (~4.8°C to 2.0°C).
  - **Ocean Heat Content (OHC)**: Numerical integration:
    $$\text{OHC} = \sum_{i=1}^{N-1} \left(\frac{T_i + T_{i-1}}{2}\right) \Delta z_i \cdot \rho \cdot c_p$$
    where $\rho = 1025\,\text{kg/m}^3$ and $c_p = 3990\,\text{J/(kg}\cdot\text{K)}$.
  - **Mixed Layer Depth (MLD)**: Computed as the depth where temperature decreases by $> 0.5^\circ\text{C}$ from surface SST.
- **Alert State Management**:
  Stores broadcast alerts, severity (`'Info' | 'Warning' | 'Critical'`), recipient lists, and acknowledgement status in `localStorage.getItem('ocean_alerts_v2')`.

---

## 6. Page-by-Page Technical Breakdown

### 6.1. Home Page (`/`)
- **Hero Canvas**: Houses `OceanHeroCanvas`, allowing users to toggle between:
  1. *Holographic Globe*: 3D Earth sphere with oceanic lat/lon graticules and real-time orbiting ARGO profiling floats.
  2. *Subsurface Column*: 3D vertical ocean column with an ascending/descending CTD sensor buoy.
  3. *Fluid Waves*: Dynamic vertex-displaced water plane mesh simulating surface swell.
- **Depth Zone Explorer**: Interactive tabbed showcase of the 5 oceanic depth zones:
  - Surface (0 m)
  - Mixed Layer (30 m)
  - Thermocline (75–200 m)
  - Mesopelagic Twilight (200–500 m)
  - Abyssal Abyss (700–1000 m)
- **Live Counter Cards**: Displays dynamic stats for active ARGO floats, grid resolution, training sample volume, and latency.

### 6.2. Dashboard Page (`/dashboard`)
- **Animated KPI Cards (`useCountUp`)**: Real-time counters for Sea Surface Temp, Salinity, SSH, Wind Speed, MLD, OHC, and Thermocline Depth.
- **Composite Risk Rating (`deriveRiskLabel`)**: Multi-variable formula scoring 0–100 evaluating cyclone heat fuel and marine heatwave danger.
- **Visualizations**:
  - Area Chart: 14-day chronological trend of SST and SSH.
  - Radial Bar: OHC capacity percentage.
  - Bar Chart: Vertical temperature decay across depth levels.
  - Anomaly Feed: Real-time warnings regarding marine heatwaves and upwelling events.

### 6.3. Input Page (`/input`)
- **NetCDF File Ingestion**: Drag-and-drop slots for five required oceanographic variables:
  1. `SST` (`analysed_sst`, `thetao`, etc.)
  2. `SSS` (`sea_surface_salinity`, `so`, etc.)
  3. `SSH` (`adt`, `zos`, `sla`, etc.)
  4. `Currents` (`ugos`, `vgos`, `uo`, `vo`)
  5. `Winds` (`u10`, `v10`, `uas`, `vas`)
- **Deterministic Parser (`simulateNcParse`)**: Validates NetCDF variable schemas, extracts geospatial coordinates, and populates the vertical reconstruction pipeline.
- **Manual Parameter Input**: Form controls to manually test custom anomalies.
- **Historical Ingestion Table**: Paginated log of previously uploaded datasets.

### 6.4. World Map Page (`/worldmap`)
- **Leaflet 2D GIS Integration**:
  - CartoDB Dark Matter base tile layer.
  - Bounding rectangle demarcating the North Indian Ocean domain (5°N–30°N, 45°E–105°E).
  - 25×60 (1° resolution) cell grid overlay.
- **Inverse Distance Weighting (IDW)**: Computes spatial interpolation across observation stations to render smooth temperature gradients on the map.
- **Click-to-Inspect**: Clicking any coordinate displays estimated surface temperature, nearest ARGO float, and an instant link to view its 3D depth profile.

### 6.5. Surface Observation Page (`/surface`)
- **High-Performance 2D Canvas Heatmaps**: Renders full 0.25° grid arrays directly using HTML5 Canvas pixels for optimal frame rates.
- **Variable Selector**: Toggles between SST (°C), SSS (PSU), SSH (cm), U-wind (m/s), and V-wind (m/s).
- **Temporal Scrubber**: Calendar date navigator from 2018 to 2025.
- **Point Sampling**: Hover and click handlers providing exact coordinate readings and localized variable summaries.

### 6.6. 3D Depth Profile Map (`/map`)
- **Three.js Volumetric Column**: Built using `@react-three/fiber` and `@react-three/drei`.
- **15 Floating Depth Slabs**:
  - Each slab represents one standard depth level.
  - Slabs are dynamically textured using procedurally generated 2D canvas temperature heatmaps.
  - Slabs respond to mouse hover with elevation highlights, thickness scaling, and depth annotations.
- **Thermocline Boundary Marker**: Visual indicator highlighting the zone of maximum temperature change ($dT/dz$).

### 6.7. Forecast Page (`/forecast`)
- **7-Day Predictive Horizon**: Displays projected subsurface temperature evolutions.
- **Dual-Mode Visualizer**:
  - Fetches pre-computed spatial slices from `/api/heatmap/{date}/{depth}`.
  - Time-series line charts tracking MLD shoaling and OHC accumulation over the 7-day forecast window.
- **Spatial Anomaly Detection**: Highlights impending marine heatwave hotspots.

### 6.8. Cyclone Tracking & Phase 1 Page (`/cyclone`)
- **IMD Cyclone Track Analysis**: Spatio-temporal evaluation of cyclone trajectories correlated with subsurface Ocean Heat Content.
- **Performance Evaluation Tab**:
  - Validation (2023) vs Final Test (2024–2025) comparison.
  - Model grading badges (Excellent: RMSE < 0.5°C, Good: RMSE < 1.0°C).
- **Radar Distribution & Error Breakdown**: Radar charts displaying MAE and bias across geographic quadrants.

### 6.9. Multi-Model Comparison Page (`/compare`)
- **Comprehensive Benchmarking Across 5 Deep Learning Paradigms**:
  1. **CNN (Convolutional Neural Network)**: Baseline spatial feature extraction.
  2. **Swin Transformer**: Shifted-window hierarchical self-attention.
  3. **ConvGRU**: Recurrent spatiotemporal feature modeling.
  4. **Graph Neural Network (GNN)**: Non-Euclidean unstructured oceanic mesh modeling.
  5. **Autoencoder**: 8-dimensional bottleneck latent representation.
- **PCA Latent Space Projection**: In-browser Covariance Matrix computation and Eigenvector projection to visualize multi-model latent representations in 2D space.
- **Comparative Metrics**: Radar distribution of model parameters, inference latency, memory footprint, and depth-wise RMSE degradation.

### 6.10. Validation Page (`/validation`)
- **ARGO In-Situ Comparison**: Tabular breakdown of reconstructed temperatures against physical ARGO float profiling buoys.
- **Standardized Metrics per Depth Level**:
  - Root Mean Square Error (RMSE in °C)
  - Mean Absolute Error (MAE in °C)
  - Mean Bias Error (Bias in °C)
  - Pearson Correlation Coefficient ($r$)
- **GLORYS12V1 Reference Reanalysis Benchmark**: Side-by-side verification against Mercator Ocean International global reanalysis.

### 6.11. Docs Page (`/docs`)
- **Architecture Specification**: 6-tier system diagram (Data Ingestion, Storage, ML Pipeline, Inference API, Frontend, and Government Alerts).
- **Pipeline Details**: Explains the offline training workflow (`cron: 0 2 * * * IST`) and feature engineering parameters.
- **Live System Status**: Monitors API latency, GPU device status, loaded model weights, and Redis cache health.

### 6.12. Government Portal (`/gov`)
- **Emergency Dispatch Interface**: Secure broadcast tool for NDMA, IMD New Delhi, IMD Chennai, Naval Command, Coast Guard, and Coastal State Disaster Management Authorities (Tamil Nadu, Andhra Pradesh, Odisha, West Bengal).
- **Severity Classification**: `Info`, `Warning`, `Critical`.
- **Automated Threshold Triggers**: Automatically highlights alerts when calculated Ocean Heat Content or SST anomalies exceed emergency thresholds.
- **Audit Log**: Chronological record of issued advisories and recipient acknowledgements.

### 6.13. Conversational AI Assistant (`/chat`)
- **"X AI" Assistant**: Natural language oceanographic chatbot.
- **Direct Backend Coupling**: Dispatches queries to `POST /chat` with Markdown rendering.
- **Quick-Prompt Buttons**: Pre-configured queries regarding thermocline dynamics, cyclone risk factors, satellite embedding architecture, and active marine warnings.

---

## 7. 3D Graphics & Canvas Engine (`src/components/3d/`)

### 7.1. Holographic Globe (`HolographicGlobe.tsx`)
- **Coordinate Transformation**: Implements spherical trigonometry to convert latitude and longitude into 3D Cartesian coordinates:
  $$x = -R \cdot \sin(\phi) \cdot \cos(\theta)$$
  $$y = R \cdot \cos(\phi)$$
  $$z = R \cdot \sin(\phi) \cdot \sin(\theta)$$
  where $\phi = (90^\circ - \text{lat}) \cdot \frac{\pi}{180}$ and $\theta = (\text{lon} + 180^\circ) \cdot \frac{\pi}{180}$.
- **Procedural Canvas Texture**: Dynamically generates a $2048 \times 1024$ canvas texture containing latitude/longitude graticules, continental coastlines, and equator markings.
- **ARGO Floats**: Instances 3D floating markers with HTML tooltips projecting float ID, water temperature, salinity, and observation depth.

### 7.2. Ocean Hero Canvas (`OceanHeroCanvas.tsx`)
- Orchestrates camera transitions, starfield background (`<Stars />`), and lighting configurations.
- Hosts the `OceanWaveFluid` component: a $48 \times 48$ vertex plane mesh whose vertex heights ($z$) are continuously displaced inside `useFrame` via harmonic wave functions.

### 7.3. Subsurface Column 3D (`SubsurfaceColumn3D.tsx`)
- Renders an interactive vertical cylinder from $y = 1.8$ (0 m) to $y = -1.8$ (1000 m).
- An animated ARGO CTD profiling float continuously ascends and descends along the column, updating depth and temperature readings dynamically.

---

## 8. API Service Layer & Backend Integration

The frontend communicates with a Python/FastAPI backend running on port 8000.

### 8.1. Reverse Proxy Configuration (`vite.config.ts`)
To eliminate CORS issues during development, Vite proxies all `/api/*` traffic:
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
  },
}
```

### 8.2. Endpoint Mapping (`src/api/oceanApi.ts` & `src/api/client.ts`)
| Method | Frontend Method | Backend Route | Description |
|---|---|---|---|
| `POST` | `sendChat(msg)` | `/chat` | Conversational query to the oceanographic AI |
| `GET` | `fetchHealth()` | `/health` | Backend status, GPU info, and loaded PyTorch models |
| `GET` | `fetchMetricsSummary()`| `/metrics/summary` | Validation (2023) and Test (2024–2025) summary stats |
| `GET` | `fetchReport(name)` | `/api/report/{name}` | Depth-wise RMSE, MAE, and correlation metrics |
| `GET` | `fetchSurface(date)` | `/api/surface/{date}`| Gridded SST, SSS, SSH, and wind matrices |
| `GET` | `fetchHeatmapAvailable()` | `/api/heatmap/available`| Available dates, depths, and tensor shapes |
| `GET` | `fetchHeatmapJson(d, z)` | `/api/heatmap/{date}/{depth}/json` | Gridded temperature predictions at depth |
| `POST` | `compareEmbeddings(req)`| `/api/embeddings/compare`| PCA projection of multi-model latent embeddings |
| `GET` | `fetchModelExplanation()`| `/explain/model` | Feature attribution and explainability scores |
| `GET` | `fetchDepthExplanation(z)`| `/explain/depth/{depth}`| Depth-specific neural sensitivity analysis |

### 8.3. Offline Resilience & Auto-Fallback
All API calls in `oceanApi.ts` include automatic timeout and error handling. If the backend is offline:
- The UI transparently transitions to **calibrated oceanographic fallback mode**.
- Fallback data is calculated using realistic empirical values from the North Indian Ocean climatological atlas (WOA18 / GLORYS).
- The presentation and all interactive features continue to function seamlessly.

---

## 9. Styling & Design System

The application utilizes a dark oceanic design system engineered in `src/index.css`:

### 9.1. Color Palette
- **Abyss Background**: `#020917`
- **Deep Ocean Base**: `#03192f`
- **Cyan Glow / Accent**: `#06b6d4` (`rgb(6, 182, 212)`)
- **Marine Blue**: `#3b82f6` (`rgb(59, 130, 246)`)
- **Thermocline Gold**: `#fbbf24`
- **Surface Heat Red**: `#ef4444`

### 9.2. Glassmorphism Utilities
- `.glass`: Translucent surface with $16\text{px}$ blur, subtle borders, and soft shadows.
- `.glass-strong`: Higher contrast surface with $24\text{px}$ blur for modal menus.
- `.glass-dark`: Dark tinted glass with $20\text{px}$ blur used for the fixed top navbar.
- `.card-3d`: 3D hover transformation with depth elevation (`translateY(-4px) rotateX(2deg)`).
- `.glow-cyan`, `.glow-blue`, `.glow-purple`: Ambient neon shadow rings for highlighting status indicators.

### 9.3. Scroll-Linked Depth Darkening (`PageLayout.tsx`)
As the user scrolls down any page, an overlay gradually increases its opacity up to 82%:
$$\text{Opacity} = \min\left(\frac{\text{scrollY}}{\text{maxScroll}}, 1\right) \times 0.82$$
This simulates descending from the sunlit epipelagic zone into the deep ocean abyss.

---

## 10. Developer Guide & Setup

### Prerequisites:
- Node.js `v18.0.0` or higher
- npm `v9.0.0` or higher

### Installation & Launch:
```bash
# 1. Clone repository and navigate to project folder
cd frontend_actual

# 2. Install dependencies
npm install

# 3. Launch Vite development server
npm run dev
```
The server will start at: `http://localhost:5173` (accessible locally or across LAN via `--host`).

### Production Build:
```bash
# Type check and build production bundle into /dist
npm run build

# Preview production build locally
npm run preview
```

### Environment Overrides (Optional):
If your backend is hosted remotely, create a `.env` file in the root directory:
```env
VITE_BACKEND_URL=http://your-remote-server-ip:8000
```

---

## 11. Summary of Key Achievements

1. **Complete Oceanographic Digital Twin**: High-fidelity reconstruction of subsurface parameters across all 15 operational depth layers.
2. **Cutting-Edge WebGL Graphics**: Seamless combination of 3D globe and ocean column simulations with real-time ARGO float monitoring.
3. **Multi-Model AI Comparison**: Direct benchmarking of 5 distinct deep learning architectures with PCA latent space projection.
4. **Disaster Readiness**: Fully integrated early-warning alert system for government agencies.
5. **Zero-Crash Reliability**: Designed with robust offline fallback ensuring flawless operation under any presentation condition.

---
*© 2026 Ministry of Earth Sciences (MoES) | INCOIS | Smart India Hackathon (SIH)*
