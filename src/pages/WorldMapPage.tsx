import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
  Rectangle,
  CircleMarker,
  Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, RotateCcw,
  ArrowRight, Info, Grid3X3,Calendar,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Layers, X, Compass, Search,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { useData, DOMAIN } from '../contexts/DataContext';
import { format, parseISO } from 'date-fns';

// ── Fix Leaflet default marker icon ──────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ── Grid constants: 25 rows (1° lat) × 60 cols (1° lon) ──────────────────────
const GRID_LAT_STEPS = 25;   // 5°N → 30°N  in 1° steps
const GRID_LON_STEPS = 60;   // 45°E → 105°E in 1° steps
const GRID_LAT_RES = (DOMAIN.latMax - DOMAIN.latMin) / GRID_LAT_STEPS;  // 1°
const GRID_LON_RES = (DOMAIN.lonMax - DOMAIN.lonMin) / GRID_LON_STEPS;  // 1°

// Nearest-record IDW for SST at a lat/lon (for colour coding)
function idwSST(
  records: ReturnType<typeof useData>['records'],
  lat: number,
  lon: number,
): number {
  if (!records.length) return 28;
  let ws = 0, wt = 0;
  for (const r of records) {
    const d = Math.hypot(r.lat - lat, r.lon - lon) + 0.01;
    const w = 1 / (d * d);
    ws += w * r.inputs.sst;
    wt += w;
  }
  return ws / wt;
}

// Temperature → RGBA colour (same scale as rest of app)
function sstToRgba(sst: number, alpha = 0.35): string {
  const n = Math.max(0, Math.min(1, (sst - 24) / 8));
  if (n < 0.33) {
    const t = n / 0.33;
    const r = Math.round(30 + (6 - 30) * t);
    const g = Math.round(64 + (182 - 64) * t);
    const b = Math.round(175 + (212 - 175) * t);
    return `rgba(${r},${g},${b},${alpha})`;
  } else if (n < 0.66) {
    const t = (n - 0.33) / 0.33;
    const r = Math.round(6 + (251 - 6) * t);
    const g = Math.round(182 + (191 - 182) * t);
    const b = Math.round(212 + (36 - 212) * t);
    return `rgba(${r},${g},${b},${alpha})`;
  } else {
    const t = (n - 0.66) / 0.34;
    const r = Math.round(251 + (239 - 251) * t);
    const g = Math.round(191 + (68 - 191) * t);
    const b = Math.round(36 + (68 - 36) * t);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}

// ── Pre-build grid cells (static geometry, only lon/lat math) ────────────────
function buildGridCells() {
  const cells: { lat: number; lon: number; bounds: L.LatLngBoundsLiteral }[] = [];
  for (let row = 0; row < GRID_LAT_STEPS; row++) {
    for (let col = 0; col < GRID_LON_STEPS; col++) {
      const south = DOMAIN.latMin + row * GRID_LAT_RES;
      const north = south + GRID_LAT_RES;
      const west = DOMAIN.lonMin + col * GRID_LON_RES;
      const east = west + GRID_LON_RES;
      const centerLat = +(south + GRID_LAT_RES / 2).toFixed(4);
      const centerLon = +(west + GRID_LON_RES / 2).toFixed(4);
      cells.push({
        lat: centerLat,
        lon: centerLon,
        bounds: [[south, west], [north, east]],
      });
    }
  }
  return cells;
}

const GRID_CELLS = buildGridCells();   // computed once at module load

// ── Grid overlay component (inside MapContainer) ─────────────────────────────
function NIOGrid({
  records,
  onCellClick,
  onCellDoubleClick,
  hoveredCell,
  setHoveredCell,
  showGrid,
}: {
  records: ReturnType<typeof useData>['records'];
  onCellClick: (lat: number, lon: number) => void;
  onCellDoubleClick?: (lat: number, lon: number) => void;
  hoveredCell: string | null;
  setHoveredCell: (k: string | null) => void;
  showGrid: boolean;
}) {
  if (!showGrid) return null;

  return (
    <>
      {GRID_CELLS.map(cell => {
        const key = `${cell.lat},${cell.lon}`;
        const sst = idwSST(records, cell.lat, cell.lon);
        const isHovered = hoveredCell === key;

        return (
          <Rectangle
            key={key}
            bounds={cell.bounds}
            pathOptions={{
              color: isHovered ? '#ffffff' : 'rgba(255,255,255,0.25)',
              weight: isHovered ? 1.5 : 0.5,
              fillColor: sstToRgba(sst, 0),   // transparent fill normally
              fillOpacity: isHovered ? 0.45 : 0.08,
              ...(isHovered && { fillColor: sstToRgba(sst, 1) }),
            }}
            eventHandlers={{
              click: () => onCellClick(cell.lat, cell.lon),
              dblclick: () => (onCellDoubleClick ? onCellDoubleClick(cell.lat, cell.lon) : onCellClick(cell.lat, cell.lon)),
              mouseover: () => setHoveredCell(key),
              mouseout: () => setHoveredCell(null),
            }}
          >
            <LeafletTooltip sticky direction="top" offset={[0, -4]}>
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-white">
                  {cell.lat.toFixed(2)}°N · {cell.lon.toFixed(2)}°E
                </p>
                <p>SST ≈ <span style={{ color: sstToRgba(sst, 1).replace(/,[^,]+\)/, ',1)') }}>
                  {sst.toFixed(1)}°C
                </span></p>
                <p className="text-cyan-400 text-[10px] font-semibold">Click to select · Double-click → Surface Obs</p>
              </div>
            </LeafletTooltip>
          </Rectangle>
        );
      })}
    </>
  );
}

// ── NIO bounding box ──────────────────────────────────────────────────────────
const NIO_BOUNDS: L.LatLngBoundsLiteral = [
  [DOMAIN.latMin, DOMAIN.lonMin],
  [DOMAIN.latMax, DOMAIN.lonMax],
];

// ── Preset locations ──────────────────────────────────────────────────────────
const PRESETS = [
  { name: 'Bay of Bengal (Centre)', lat: 15.0, lon: 88.0 },
  { name: 'Arabian Sea (Centre)', lat: 17.0, lon: 65.0 },
  { name: 'Lakshadweep Sea', lat: 11.0, lon: 73.0 },
  { name: 'Gulf of Mannar', lat: 8.8, lon: 79.0 },
  { name: 'Andaman Sea', lat: 12.5, lon: 95.0 },
  { name: 'BoB — Near Bangladesh Coast', lat: 20.5, lon: 90.0 },
  { name: 'Arabian Sea — Off Mumbai', lat: 18.0, lon: 69.5 },
  { name: 'Indian Ocean South', lat: 6.0, lon: 75.0 },
];

// ── Bathymetry & Land Evaluation ──────────────────────────────────────────────
export interface BathymetryResult {
  isLand: boolean;
  isShallow: boolean;
  depthMeters: number;
  locationName: string;
  isValidGrid: boolean;
  statusMessage: string;
}

export function evaluateBathymetry(lat: number, lon: number): BathymetryResult {
  if (lat < 5 || lat > 30 || lon < 45 || lon > 105) {
    return {
      isLand: true,
      isShallow: true,
      depthMeters: 0,
      locationName: 'Outside NIO Domain',
      isValidGrid: false,
      statusMessage: 'Coordinates fall outside the North Indian Ocean domain (5°N–30°N, 45°E–105°E).',
    };
  }

  // 1. Mainland India bounding approximation
  const isIndiaMainland = (
    (lat >= 8.2 && lat <= 22.0 && lon >= 72.8 && lon <= 88.5 && !(lat <= 15 && lon >= 80.5) && !(lat >= 16 && lon >= 85.5 && lat <= 20)) ||
    (lat > 22.0 && lat <= 30.0 && lon >= 68.5 && lon <= 89.5) ||
    (lat >= 20.5 && lat <= 24.5 && lon >= 68.5 && lon <= 73.0)
  );

  // 2. Arabian Peninsula / Iran / Pakistan
  const isArabiaOrIran = (
    (lat >= 12.0 && lon <= 55.0) ||
    (lat >= 22.0 && lon <= 62.0) ||
    (lat >= 24.5 && lon <= 68.5)
  );

  // 3. Myanmar / Thailand / Malay Peninsula / Sumatra
  const isSoutheastAsia = (
    (lat >= 9.5 && lon >= 97.5) ||
    (lat >= 15.0 && lon >= 94.5) ||
    (lat >= 20.0 && lon >= 91.8) ||
    (lat < 6.0 && lon >= 95.0)
  );

  // 4. Sri Lanka
  const isSriLanka = (lat >= 5.8 && lat <= 9.8 && lon >= 79.5 && lon <= 81.9);

  const isLand = isIndiaMainland || isArabiaOrIran || isSoutheastAsia || isSriLanka;

  if (isLand) {
    return {
      isLand: true,
      isShallow: true,
      depthMeters: 0,
      locationName: 'Continental Landmass',
      isValidGrid: false,
      statusMessage: 'Invalid Grid: Selected coordinate is on continental land. Please select an ocean grid cell.',
    };
  }

  let depth = 3200;
  let isShallow = false;

  if (lat > 20.8 && lon >= 87.0 && lon <= 91.8) {
    depth = 80 + Math.round((21.8 - lat) * 400);
    isShallow = depth < 1000;
  } else if (lat >= 20.0 && lat <= 23.0 && lon >= 69.0 && lon <= 73.0) {
    depth = 75;
    isShallow = true;
  } else if (lat >= 8.5 && lat <= 10.5 && lon >= 78.5 && lon <= 80.2) {
    depth = 35;
    isShallow = true;
  } else if (lat > 23.5 && lon < 60.0) {
    depth = 150;
    isShallow = true;
  } else if (
    (lon >= 72.0 && lon <= 73.5 && lat >= 9.0 && lat <= 19.0) ||
    (lon >= 79.8 && lon <= 81.2 && lat >= 11.0 && lat <= 16.0) ||
    (lon >= 84.5 && lon <= 86.5 && lat >= 18.0 && lat <= 20.5)
  ) {
    depth = 420;
    isShallow = depth < 1000;
  } else {
    if (lon < 77) {
      depth = 3300 + Math.round((20 - Math.abs(lat - 14)) * 40);
    } else {
      depth = 2900 + Math.round((18 - Math.abs(lat - 13)) * 50);
    }
    isShallow = false;
  }

  const locName = lon < 77
    ? (lat > 15 ? 'Arabian Sea (North Basin)' : 'Arabian Sea (Central Basin)')
    : (lat > 14 ? 'Bay of Bengal (Central Basin)' : 'South Bay of Bengal / Equatorial NIO');

  if (isShallow) {
    return {
      isLand: false,
      isShallow: true,
      depthMeters: depth,
      locationName: `${locName} (Continental Shelf)`,
      isValidGrid: false,
      statusMessage: `Invalid Grid: Ocean bathymetry is ${depth}m (< 1000m). Reconstruction requires deep ocean (≥ 1000m) to resolve the 15 standard depth levels (0–1000m).`,
    };
  }

  return {
    isLand: false,
    isShallow: false,
    depthMeters: depth,
    locationName: `${locName} (Deep Ocean Basin)`,
    isValidGrid: true,
    statusMessage: `Valid Deep Ocean Grid point (~${depth}m bathymetry). Standard 15-level (0–1000m) reconstruction fully supported.`,
  };
}

// ── Click handler (inside MapContainer) ──────────────────────────────────────
function ClickHandler({
  onMapClick,
  onMapDoubleClick,
}: {
  onMapClick: (lat: number, lon: number) => void;
  onMapDoubleClick?: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      const orig = e.originalEvent as MouseEvent | PointerEvent | undefined;
      const target = orig?.target as HTMLElement | null;
      if (target && target.closest('button, input, select, textarea, .leaflet-control, [data-no-map-click]')) {
        return;
      }
      onMapClick(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4));
    },
    dblclick(e) {
      const orig = e.originalEvent as MouseEvent | PointerEvent | undefined;
      const target = orig?.target as HTMLElement | null;
      if (target && target.closest('button, input, select, textarea, .leaflet-control, [data-no-map-click]')) {
        return;
      }
      if (onMapDoubleClick) {
        onMapDoubleClick(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4));
      }
    },
  });
  return null;
}

// ── Leaflet map resizer helper ───────────────────────────────────────────────
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// ── Leaflet camera flyer helper ──────────────────────────────────────────────
function MapFlyTo({ targetPos }: { targetPos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetPos) {
      map.flyTo(targetPos, Math.max(map.getZoom(), 6), { duration: 1 });
    }
  }, [targetPos, map]);
  return null;
}

// ── Leaflet view reset helper ────────────────────────────────────────────────
function ResetViewController({ resetTrigger }: { resetTrigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (resetTrigger > 0) {
      map.flyTo([17, 75], 5, { duration: 1 });
    }
  }, [resetTrigger, map]);
  return null;
}

// ── Nearest record finder ─────────────────────────────────────────────────────
function findNearest(
  records: ReturnType<typeof useData>['records'],
  lat: number, lon: number,
) {
  if (!records.length) return null;
  let best = records[0], bestDist = Infinity;
  for (const r of records) {
    const d = Math.hypot(r.lat - lat, r.lon - lon);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return { record: best, dist: +bestDist.toFixed(2) };
}

// ── Top-right Map Controls (Zoom, Reset View, Legend) ─────────────────────────
function TopRightMapControls({
  onReset,
  showLegend,
  setShowLegend,
}: {
  onReset: () => void;
  showLegend: boolean;
  setShowLegend: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      data-no-map-click="true"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      className="absolute top-4 right-4 sm:right-6 z-[1000] pointer-events-auto flex flex-col items-end gap-2 select-none"
    >
      {/* Legend Popover Card */}
      {showLegend && (
        <div
          data-no-map-click="true"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-3.5 w-64 text-xs text-slate-700 space-y-2 mb-1 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 font-bold text-slate-800">
            <span>Map Legend</span>
            <button
              onClick={e => {
                e.stopPropagation();
                setShowLegend(false);
              }}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-dashed border-2 border-yellow-400 inline-block shrink-0" />
              <span>NIO Study Domain Border</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm border border-cyan-400 bg-cyan-400/20 inline-block shrink-0" />
              <span>1°×1° Spatial Grid (Click = Select)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-white shadow-xs inline-block shrink-0" />
              <span>Moored Buoy / Data Station</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white shadow-xs inline-block shrink-0" />
              <span>Preset Location Target</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow-xs inline-block shrink-0" />
              <span>Selected Pin Marker</span>
            </div>
          </div>
        </div>
      )}

      {/* Row of Controls in Top Right */}
      <div
        data-no-map-click="true"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className="flex items-center gap-2"
      >
        {/* Reset to NIO domain button */}
        <button
          onClick={e => {
            e.stopPropagation();
            map.flyTo([17, 75], 5, { duration: 1 });
            onReset();
          }}
          className="p-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl text-slate-700 hover:text-[#005088] hover:bg-white transition-all cursor-pointer flex items-center justify-center h-10 w-10"
          title="Reset View to NIO Domain"
        >
          <Compass size={18} />
        </button>

        {/* Legend toggle button */}
        <button
          onClick={e => {
            e.stopPropagation();
            setShowLegend(s => !s);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-md border shadow-xl text-xs font-semibold transition-all cursor-pointer h-10 ${
            showLegend
              ? 'bg-[#005088] text-white border-[#005088]'
              : 'bg-white/95 text-slate-700 hover:text-[#005088] hover:bg-white border-slate-200'
          }`}
          title="Toggle Map Legend"
        >
          <Layers size={15} />
          <span className="hidden sm:inline">Legend</span>
        </button>

        {/* Zoom In / Out Controls */}
        <div
          data-no-map-click="true"
          onClick={e => e.stopPropagation()}
          className="flex items-center bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl overflow-hidden h-10 divide-x divide-slate-100"
        >
          <button
            onClick={e => {
              e.stopPropagation();
              map.zoomIn();
            }}
            className="w-9 h-10 flex items-center justify-center text-slate-700 hover:text-[#005088] hover:bg-slate-50 text-base font-bold transition-colors cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              map.zoomOut();
            }}
            className="w-9 h-10 flex items-center justify-center text-slate-700 hover:text-[#005088] hover:bg-slate-50 text-base font-bold transition-colors cursor-pointer"
            title="Zoom Out"
          >
            &minus;
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorldMapPage() {
  const { records } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);

  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [latError, setLatError] = useState('');
  const [lonError, setLonError] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem('ocean_shared_date') || '2023-12-31';
  });

  // Synchronize pin and target from URL query parameters (e.g. from Surface Obs "View on Map")
  useEffect(() => {
    const latParam = searchParams.get('lat');
    const lonParam = searchParams.get('lon');
    const dateParam = searchParams.get('date');

    if (latParam && lonParam) {
      const lat = parseFloat(latParam);
      const lon = parseFloat(lonParam);
      if (!isNaN(lat) && !isNaN(lon)) {
        setPin({ lat, lon });
        setFlyTarget([lat, lon]);
        setLatInput(lat.toFixed(2));
        setLonInput(lon.toFixed(2));
        setLatError('');
        setLonError('');
      }
    }
    if (dateParam) {
      setSelectedDate(dateParam);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('ocean_shared_date', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (pin) {
      localStorage.setItem('ocean_shared_lat', String(pin.lat));
      localStorage.setItem('ocean_shared_lon', String(pin.lon));
    }
  }, [pin]);

  // Floating controls toggles
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  const inDomain = pin
    ? pin.lat >= DOMAIN.latMin && pin.lat <= DOMAIN.latMax
    && pin.lon >= DOMAIN.lonMin && pin.lon <= DOMAIN.lonMax
    : false;

  const nearest = pin ? findNearest(records, pin.lat, pin.lon) : null;

  // Evaluate bathymetry and validity whenever pin changes
  const bathyStatus = useMemo(() => pin ? evaluateBathymetry(pin.lat, pin.lon) : null, [pin]);

  // Unique station locations
  const stations = useMemo(() => {
    const seen = new Set<string>();
    return records.filter(r => {
      const k = `${r.lat.toFixed(1)},${r.lon.toFixed(1)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }, [records]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setPin({ lat, lon });
    setFlyTarget([lat, lon]);
    setLatInput(lat.toString());
    setLonInput(lon.toString());
    setLatError(''); setLonError('');
  }, []);

  const handleCellClick = useCallback((lat: number, lon: number) => {
    setPin({ lat, lon });
    setFlyTarget([lat, lon]);
    setLatInput(lat.toString());
    setLonInput(lon.toString());
    setLatError(''); setLonError('');
  }, []);

  const handleCellDoubleClick = useCallback((lat: number, lon: number) => {
    navigate(`/surface?lat=${lat}&lon=${lon}&date=${selectedDate}`);
  }, [navigate, selectedDate]);

  const applyManual = useCallback(() => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    let ok = true;
    if (isNaN(lat) || lat < -90 || lat > 90) { setLatError('Must be −90 to 90'); ok = false; } else setLatError('');
    if (isNaN(lon) || lon < -180 || lon > 180) { setLonError('Must be −180 to 180'); ok = false; } else setLonError('');
    if (ok) {
      setPin({ lat, lon });
      setFlyTarget([lat, lon]);
    }
  }, [latInput, lonInput]);

  // Leaflet CSS adjustments
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'leaflet-dark-override';
    style.textContent = `
      .leaflet-container { background: #0a3d62 !important; cursor: crosshair !important; font-family: inherit; }
      .leaflet-control-zoom { border: none !important; box-shadow: 0 4px 14px rgba(0,0,0,0.15) !important; border-radius: 14px !important; overflow: hidden; margin-right: 18px !important; margin-bottom: 20px !important; }
      .leaflet-control-zoom a { background: rgba(255,255,255,0.92) !important; color: #005088 !important; border-color: rgba(0,0,0,0.06) !important; font-weight: bold; width: 34px !important; height: 34px !important; line-height: 34px !important; }
      .leaflet-control-zoom a:hover { background: #fff !important; color: #0284c7 !important; }
      .leaflet-control-attribution { background: rgba(255,255,255,0.75) !important; color: #475569 !important; font-size: 10px; border-radius: 6px; padding: 2px 6px; margin: 4px; backdrop-filter: blur(8px); }
      .leaflet-control-attribution a { color: #005088 !important; }
      .leaflet-popup-content-wrapper { background: rgba(15,23,42,0.94) !important; border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 16px !important; backdrop-filter: blur(16px); color: white !important; box-shadow: 0 16px 40px rgba(0,0,0,0.4) !important; }
      .leaflet-popup-tip { background: rgba(15,23,42,0.94) !important; }
      .leaflet-popup-close-button { color: rgba(255,255,255,0.6) !important; font-size:16px !important; top:8px !important; right:10px !important; }
      .leaflet-popup-close-button:hover { color: white !important; }
      .leaflet-tooltip { background: rgba(15,23,42,0.92) !important; border: 1px solid rgba(6,182,212,0.4) !important; color: white !important; border-radius: 8px !important; font-size: 11px; backdrop-filter: blur(10px); box-shadow: 0 4px 16px rgba(0,0,0,0.5); padding: 6px 10px !important; }
      .leaflet-tooltip::before { border-top-color: rgba(6,182,212,0.4) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('leaflet-dark-override')?.remove(); };
  }, []);

  return (
    <PageLayout fullHeight showFooter={false}>
      <div className="relative w-full h-full flex-1 min-h-0 overflow-hidden select-none">

        {/* =========================================================================
            1. FULL-SCREEN LEAFLET MAP
           ========================================================================= */}
        <MapContainer
          center={[17, 75]}
          zoom={5}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          scrollWheelZoom
          doubleClickZoom={false}
          zoomControl={false}
        >
          {/* Map helper hooks */}
          <MapResizer />
          <MapFlyTo targetPos={flyTarget} />
          <ResetViewController resetTrigger={resetTrigger} />

          {/* Top-Right Map Controls (Reset View, Legend, Zoom In/Out) */}
          <TopRightMapControls
            onReset={() => setResetTrigger(t => t + 1)}
            showLegend={showLegend}
            setShowLegend={setShowLegend}
          />

          {/* Satellite imagery */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            maxZoom={18}
          />
          {/* Labels overlay */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            attribution=""
            maxZoom={18}
            opacity={0.65}
          />

          {/* ── NIO Domain border (yellow dashed) ── */}
          <Rectangle
            bounds={NIO_BOUNDS}
            pathOptions={{
              color: '#facc15',
              weight: 2.5,
              dashArray: '8 5',
              fillOpacity: 0,
            }}
          >
            <LeafletTooltip sticky={false} direction="top">
              NIO Study Domain · 5°N–30°N, 45°E–105°E
            </LeafletTooltip>
          </Rectangle>

          {/* ── 25×60 Clickable grid ── */}
          <NIOGrid
            records={records}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
            hoveredCell={hoveredCell}
            setHoveredCell={setHoveredCell}
            showGrid={showGrid}
          />

          {/* ── Data station markers ── */}
          {stations.map(r => (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lon]}
              radius={7}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#06b6d4',
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <LeafletTooltip>
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-white">{r.location}</p>
                  <p>SST: <span className="text-red-400">{r.inputs.sst.toFixed(1)}°C</span></p>
                  <p>SSS: <span className="text-blue-400">{r.inputs.sss.toFixed(1)} PSU</span></p>
                  <p>SSH: <span className="text-cyan-400">{r.inputs.ssh.toFixed(1)} cm</span></p>
                  <p>MLD: <span className="text-purple-400">{r.mld.toFixed(0)} m</span></p>
                  <p className="text-white/40">{format(parseISO(r.date), 'MMM d, yyyy')}</p>
                </div>
              </LeafletTooltip>
            </CircleMarker>
          ))}

          {/* ── Preset orange markers ── */}
          {PRESETS.map(p => (
            <CircleMarker
              key={p.name}
              center={[p.lat, p.lon]}
              radius={6}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#f97316',
                fillOpacity: 0.9,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  setPin({ lat: p.lat, lon: p.lon });
                  setFlyTarget([p.lat, p.lon]);
                  setLatInput(String(p.lat));
                  setLonInput(String(p.lon));
                }
              }}
            >
              <LeafletTooltip>
                <span className="text-xs font-medium">{p.name}</span>
              </LeafletTooltip>
            </CircleMarker>
          ))}

          {/* ── Selected pin ── */}
          {pin && (
            <Marker position={[pin.lat, pin.lon]} icon={redIcon}>
              <Popup>
                <div className="text-sm space-y-2 min-w-[220px]">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <MapPin size={13} className="text-cyan-400" />
                    Selected Point
                  </p>
                  <div className="space-y-1 text-xs">
                    <p className="text-white/70">Lat: <span className="text-cyan-400 font-mono">{pin.lat}°N</span></p>
                    <p className="text-white/70">Lon: <span className="text-cyan-400 font-mono">{pin.lon}°E</span></p>
                    <p className="text-white/70">Bathymetry: <span className={bathyStatus?.isValidGrid ? 'text-cyan-400 font-mono font-bold' : 'text-red-400 font-mono font-bold'}>
                      {bathyStatus?.isLand ? 'Continental Land (0m)' : `~${bathyStatus?.depthMeters}m`}
                    </span></p>
                    <p className={bathyStatus?.isValidGrid ? 'text-emerald-400 font-semibold text-[11px]' : 'text-red-400 font-semibold text-[11px]'}>
                      {bathyStatus?.isValidGrid ? '✓ Valid Deep Ocean (≥1000m)' : '⚠️ Invalid: Land or Shallow (<1000m)'}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          <ClickHandler
            onMapClick={handleMapClick}
            onMapDoubleClick={handleCellDoubleClick}
          />
        </MapContainer>


        {/* =========================================================================
            2. PRESET LOCATIONS CARD (LEFT OF MAP, MATCHING SCREENSHOT)
           ========================================================================= */}
        {presetsOpen ? (
          <div
            data-no-map-click="true"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            className="absolute top-4 left-4 z-[1000] w-[285px] sm:w-[315px] pointer-events-auto flex flex-col max-h-[calc(100vh-120px)] animate-in fade-in slide-in-from-left-4 duration-200"
          >
            <div className="bg-[#f0f4f9]/92 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl p-3.5 sm:p-4 flex flex-col overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200/60">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 shadow-2xs">
                    <MapPin size={13} className="fill-amber-400 text-amber-600" />
                  </div>
                  <h2 className="font-bold text-slate-800 text-[15px] tracking-tight">
                    Preset Locations
                  </h2>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setPresetsOpen(false);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
                  title="Hide Preset Locations"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Presets List */}
              <div className="mt-3 space-y-2 overflow-y-auto pr-1 max-h-[calc(100vh-190px)] scrollbar-thin">
                {PRESETS.map(p => {
                  const isSelected = pin?.lat === p.lat && pin?.lon === p.lon;
                  return (
                    <button
                      key={p.name}
                      onClick={e => {
                        e.stopPropagation();
                        setPin({ lat: p.lat, lon: p.lon });
                        setFlyTarget([p.lat, p.lon]);
                        setLatInput(String(p.lat));
                        setLonInput(String(p.lon));
                        setLatError('');
                        setLonError('');
                      }}
                      className={`w-full text-left p-3.5 px-4 rounded-2xl transition-all cursor-pointer block ${
                        isSelected
                          ? 'bg-blue-50/90 border-2 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                          : 'bg-white hover:bg-white/95 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-200'
                      }`}
                    >
                      <span className={`font-bold block text-[13px] leading-snug ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                        {p.name}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                        {p.lat}°N, {p.lon}°E
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Left Side Dock Button to reopen Preset Locations anytime */
          <button
            data-no-map-click="true"
            onClick={e => {
              e.stopPropagation();
              setPresetsOpen(true);
            }}
            className="absolute top-24 left-0 z-[1000] pointer-events-auto flex items-center gap-2.5 py-3 px-3.5 rounded-r-2xl bg-white/95 backdrop-blur-xl border-y border-r border-slate-200 shadow-2xl text-slate-800 font-bold text-xs hover:bg-white hover:text-[#005088] transition-all cursor-pointer group animate-in fade-in slide-in-from-left-2 duration-150"
            title="Open Preset Locations"
          >
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 shadow-2xs group-hover:scale-110 transition-transform">
              <MapPin size={12} className="fill-amber-400 text-amber-600" />
            </div>
            <span className="font-bold text-xs tracking-tight">Preset Locations</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-mono text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
              {PRESETS.length}
            </span>
            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}


        {/* =========================================================================
            3. TOP SEARCH & QUICK CONTROLS BAR (GOOGLE MAPS STYLE)
           ========================================================================= */}
        <div
          data-no-map-click="true"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          className={`absolute top-4 z-[1000] pointer-events-auto transition-all duration-300 ${
            presetsOpen ? 'left-4 sm:left-[340px] right-4 sm:right-auto' : 'left-4 right-4 sm:right-auto'
          }`}
        >
          <div className="bg-white/92 backdrop-blur-xl border border-white/80 shadow-lg rounded-2xl p-2 px-3 flex flex-wrap items-center gap-2 text-xs text-slate-700">
            {/* Quick Presets Toggle Button in Top Bar */}
            <button
              onClick={e => {
                e.stopPropagation();
                setPresetsOpen(p => !p);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                presetsOpen
                  ? 'bg-blue-50 border-blue-300 text-[#005088]'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
              title={presetsOpen ? 'Hide Preset Locations' : 'Show Preset Locations'}
            >
              <MapPin size={13} className="text-amber-500 fill-amber-500/20" />
              <span>Presets</span>
            </button>

            <div className="h-4 w-px bg-slate-200" />

            {/* Search inputs */}
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
              <Search size={14} className="text-[#005088]" />
              <span className="hidden md:inline">Coordinates:</span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={latInput}
                onChange={e => {
                  const val = e.target.value;
                  setLatInput(val);
                  const lat = parseFloat(val);
                  const lon = parseFloat(lonInput);
                  if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    setPin({ lat, lon });
                    setFlyTarget([lat, lon]);
                    setLatError('');
                    setLonError('');
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && applyManual()}
                placeholder="Lat °N"
                step="0.1"
                className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800 font-mono text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input
                type="number"
                value={lonInput}
                onChange={e => {
                  const val = e.target.value;
                  setLonInput(val);
                  const lat = parseFloat(latInput);
                  const lon = parseFloat(val);
                  if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    setPin({ lat, lon });
                    setFlyTarget([lat, lon]);
                    setLatError('');
                    setLonError('');
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && applyManual()}
                placeholder="Lon °E"
                step="0.1"
                className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800 font-mono text-xs placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

{/* Grid toggle */}
<button
  onClick={() => setShowGrid(g => !g)}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
    showGrid
      ? 'bg-cyan-50 border-cyan-300 text-cyan-800 shadow-2xs'
      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
  }`}
  title="Toggle 1°×1° Spatial Grid"
>
  <Grid3X3
    size={13}
    className={showGrid ? 'text-cyan-600' : 'text-slate-500'}
  />
  <span>{showGrid ? 'Grid ON' : 'Grid OFF'}</span>
</button>

{/* Date selector */}
<div
  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-700 text-xs font-semibold transition-all hover:bg-white hover:border-cyan-300"
  title="Select map date"
>
  <Calendar size={13} className="text-cyan-600 shrink-0" />

  <input
    type="date"
    value={selectedDate}
    min="2023-01-01"
    max={new Date().toISOString().split('T')[0]}
    onChange={e => setSelectedDate(e.target.value)}
    className="bg-transparent border-none outline-none text-slate-700 text-xs font-semibold cursor-pointer"
  />
</div>

            {/* Clear pin */}
            {pin && (
              <button
                onClick={() => { setPin(null); setLatInput(''); setLonInput(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all cursor-pointer"
                title="Clear selected pin"
              >
                <RotateCcw size={11} />
                <span>Clear Pin</span>
              </button>
            )}

            {/* NIO Domain Info Pill */}
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono text-slate-500 pl-2 border-l border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>NIO Domain (5°N–30°N, 45°E–105°E)</span>
            </div>
          </div>

          {(latError || lonError) && (
            <div className="mt-1 px-3 py-1 rounded-xl bg-red-500/90 text-white text-[11px] font-medium shadow-md">
              {latError || lonError}
            </div>
          )}
        </div>


        {/* =========================================================================
            4. SELECTED LOCATION / BATHYMETRIC INSPECTION CARD (BOTTOM-LEFT / CENTER)
           ========================================================================= */}
        {pin && bathyStatus ? (
          <div
            className={`absolute bottom-6 z-[1000] pointer-events-auto transition-all duration-300 max-w-[440px] w-[calc(100vw-32px)] ${
              presetsOpen ? 'left-4 sm:left-[340px]' : 'left-4'
            }`}
          >
            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-2xl rounded-3xl p-4 sm:p-5 text-slate-800 space-y-3.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Selected Grid:</span>
                      <span className="font-mono text-[#005088]">{pin.lat.toFixed(2)}°N, {pin.lon.toFixed(2)}°E</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {bathyStatus.locationName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setPin(null); setLatInput(''); setLonInput(''); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close Details"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10.5px] font-mono px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  bathyStatus.isValidGrid
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {bathyStatus.isValidGrid ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      <span>VALID DEEP OCEAN (~{bathyStatus.depthMeters}m)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={13} className="text-amber-500" />
                      <span>{bathyStatus.isLand ? 'LANDMASS' : `SHALLOW WATER (~${bathyStatus.depthMeters}m)`}</span>
                    </>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {inDomain ? 'In NIO Domain' : 'Outside Domain'}
                </span>
              </div>

              {/* Invalid Warning */}
              {!bathyStatus.isValidGrid && (
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px]">{bathyStatus.statusMessage}</p>
                </div>
              )}

              {/* Telemetry baseline */}
              {nearest && (
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span className="flex items-center gap-1">
                      <Info size={11} className="text-[#005088]" />
                      Station: {nearest.record.location}
                    </span>
                    <span className="font-mono text-slate-400">{nearest.dist}° offset</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="text-center p-1.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[9px] text-slate-400 block">SST</span>
                      <span className="font-mono text-xs font-bold text-red-500">{nearest.record.inputs.sst.toFixed(1)}°C</span>
                    </div>
                    <div className="text-center p-1.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[9px] text-slate-400 block">SSS</span>
                      <span className="font-mono text-xs font-bold text-blue-500">{nearest.record.inputs.sss.toFixed(1)}</span>
                    </div>
                    <div className="text-center p-1.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[9px] text-slate-400 block">SSH</span>
                      <span className="font-mono text-xs font-bold text-cyan-600">{nearest.record.inputs.ssh.toFixed(1)}</span>
                    </div>
                    <div className="text-center p-1.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="text-[9px] text-slate-400 block">MLD</span>
                      <span className="font-mono text-xs font-bold text-purple-600">{nearest.record.mld.toFixed(0)}m</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {bathyStatus.isValidGrid ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate(`/profile-3d?lat=${pin.lat}&lon=${pin.lon}&date=${selectedDate}`)}
                    className="w-full py-2.5 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm bg-gradient-to-r from-[#005088] via-[#0284c7] to-[#0ea5e9] hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Layers size={15} className="text-white" />
                    <span>View 3D Subsurface Profile</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <button
                  disabled
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle size={14} className="text-amber-500" />
                  <span>Cannot Proceed: Depth &lt; 1000m or Land</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Subtle hint pill at bottom-center when nothing is selected */
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] pointer-events-none hidden md:flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-950/90 backdrop-blur-xl border border-white/30 shadow-2xl"
            style={{ color: '#ffffff' }}
          >
            <Grid3X3 size={15} className="text-cyan-400 shrink-0" />
            <span
              className="text-xs font-bold tracking-wide"
              style={{ color: '#ffffff' }}
            >
              Click any open-ocean cell or select a preset location to inspect subsurface profiles
            </span>
          </div>
        )}

      </div>
    </PageLayout>
  );
}
