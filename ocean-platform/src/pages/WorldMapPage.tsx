import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  Rectangle,
  CircleMarker,
  Tooltip as LeafletTooltip,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Crosshair, Eye, RotateCcw,
  ArrowRight, Info, Navigation, Globe, Grid3X3,
} from 'lucide-react';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, DOMAIN } from '../contexts/DataContext';
import { format, parseISO } from 'date-fns';

// ── Fix Leaflet default marker icon ──────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl:      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
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
      const west  = DOMAIN.lonMin + col * GRID_LON_RES;
      const east  = west + GRID_LON_RES;
      const centerLat = +(south + GRID_LAT_RES / 2).toFixed(4);
      const centerLon = +(west  + GRID_LON_RES / 2).toFixed(4);
      cells.push({
        lat:    centerLat,
        lon:    centerLon,
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
  hoveredCell,
  setHoveredCell,
  showGrid,
}: {
  records: ReturnType<typeof useData>['records'];
  onCellClick: (lat: number, lon: number) => void;
  hoveredCell: string | null;
  setHoveredCell: (k: string | null) => void;
  showGrid: boolean;
}) {
  if (!showGrid) return null;

  return (
    <>
      {GRID_CELLS.map(cell => {
        const key  = `${cell.lat},${cell.lon}`;
        const sst  = idwSST(records, cell.lat, cell.lon);
        const isHovered = hoveredCell === key;

        return (
          <Rectangle
            key={key}
            bounds={cell.bounds}
            pathOptions={{
              color:       isHovered ? '#ffffff' : 'rgba(255,255,255,0.25)',
              weight:      isHovered ? 1.5 : 0.5,
              fillColor:   sstToRgba(sst, 0),   // transparent fill normally
              fillOpacity: isHovered ? 0.45 : 0.08,
              // fill with SST colour on hover
              ...(isHovered && { fillColor: sstToRgba(sst, 1) }),
            }}
            eventHandlers={{
              click:      () => onCellClick(cell.lat, cell.lon),
              mouseover:  () => setHoveredCell(key),
              mouseout:   () => setHoveredCell(null),
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
                <p className="text-white/50 text-[10px]">Click → Surface Obs</p>
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
  { name: 'Bay of Bengal (Centre)',      lat: 15.0, lon: 88.0 },
  { name: 'Arabian Sea (Centre)',        lat: 17.0, lon: 65.0 },
  { name: 'Lakshadweep Sea',             lat: 11.0, lon: 73.0 },
  { name: 'Gulf of Mannar',              lat:  8.8, lon: 79.0 },
  { name: 'Andaman Sea',                 lat: 12.5, lon: 95.0 },
  { name: 'BoB — Near Bangladesh Coast', lat: 20.5, lon: 90.0 },
  { name: 'Arabian Sea — Off Mumbai',    lat: 18.0, lon: 69.5 },
  { name: 'Indian Ocean South',          lat:  6.0, lon: 75.0 },
];

// ── Click handler (inside MapContainer) ──────────────────────────────────────
function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4));
    },
  });
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorldMapPage() {
  const { records } = useData();
  const navigate    = useNavigate();

  const [pin,         setPin]         = useState<{ lat: number; lon: number } | null>(null);
  const [latInput,    setLatInput]    = useState('');
  const [lonInput,    setLonInput]    = useState('');
  const [latError,    setLatError]    = useState('');
  const [lonError,    setLonError]    = useState('');
  const [showGrid,    setShowGrid]    = useState(true);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const inDomain = pin
    ? pin.lat >= DOMAIN.latMin && pin.lat <= DOMAIN.latMax
      && pin.lon >= DOMAIN.lonMin && pin.lon <= DOMAIN.lonMax
    : false;

  const nearest = pin ? findNearest(records, pin.lat, pin.lon) : null;

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
    setLatInput(lat.toString());
    setLonInput(lon.toString());
    setLatError(''); setLonError('');
  }, []);

  // Clicking a grid cell sets pin AND immediately navigates to surface obs
  const handleCellClick = useCallback((lat: number, lon: number) => {
    setPin({ lat, lon });
    setLatInput(lat.toString());
    setLonInput(lon.toString());
    setLatError(''); setLonError('');
    navigate(`/surface?lat=${lat}&lon=${lon}`);
  }, [navigate]);

  const applyManual = useCallback(() => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    let ok = true;
    if (isNaN(lat) || lat < -90  || lat > 90 ) { setLatError('Must be −90 to 90');   ok = false; } else setLatError('');
    if (isNaN(lon) || lon < -180 || lon > 180) { setLonError('Must be −180 to 180'); ok = false; } else setLonError('');
    if (ok) setPin({ lat, lon });
  }, [latInput, lonInput]);

  const handleGetSurface = useCallback(() => {
    if (!pin) return;
    navigate(`/surface?lat=${pin.lat}&lon=${pin.lon}`);
  }, [pin, navigate]);

  // Leaflet dark-mode CSS overrides
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'leaflet-dark-override';
    style.textContent = `
      .leaflet-container { background: #0a3d62 !important; cursor: crosshair !important; }
      .leaflet-control-zoom a { background: rgba(255,255,255,0.92) !important; color: #0a3d62 !important; border-color: rgba(255,255,255,0.4) !important; font-weight: bold; }
      .leaflet-control-zoom a:hover { background: #fff !important; color: #06b6d4 !important; }
      .leaflet-control-attribution { background: rgba(0,0,0,0.55) !important; color: rgba(255,255,255,0.6) !important; font-size: 10px; }
      .leaflet-control-attribution a { color: rgba(100,220,255,0.8) !important; }
      .leaflet-popup-content-wrapper { background: rgba(2,9,23,0.94) !important; border: 1px solid rgba(255,255,255,0.2) !important; border-radius: 14px !important; backdrop-filter: blur(20px); color: white !important; box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important; }
      .leaflet-popup-tip { background: rgba(2,9,23,0.94) !important; }
      .leaflet-popup-close-button { color: rgba(255,255,255,0.6) !important; font-size:16px !important; top:8px !important; right:10px !important; }
      .leaflet-popup-close-button:hover { color: white !important; }
      .leaflet-tooltip { background: rgba(2,9,23,0.92) !important; border: 1px solid rgba(6,182,212,0.4) !important; color: white !important; border-radius: 8px !important; font-size: 11px; backdrop-filter: blur(10px); box-shadow: 0 4px 16px rgba(0,0,0,0.5); padding: 6px 10px !important; }
      .leaflet-tooltip::before { border-top-color: rgba(6,182,212,0.4) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('leaflet-dark-override')?.remove(); };
  }, []);

  return (
    <PageLayout>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="World Map — NIO Grid Selector"
          subtitle={`25 × 60 grid over North Indian Ocean (5°N–30°N, 45°E–105°E) · Click any cell for surface observations`}
          icon={<Globe size={16} className="text-cyan-400" />}
        />

        {/* Domain / grid info badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { l:'Domain',   v:'5°N–30°N · 45°E–105°E' },
            { l:'Grid',     v:`${GRID_LAT_STEPS} rows × ${GRID_LON_STEPS} cols = ${GRID_LAT_STEPS * GRID_LON_STEPS} cells` },
            { l:'Cell size', v:'1° × 1°' },
            { l:'Click',    v:'→ Surface Obs for that cell' },
          ].map(({ l, v }) => (
            <div key={l} className="glass rounded-lg px-3 py-1.5 border border-cyan-500/20 text-xs">
              <span className="text-white/40">{l}: </span>
              <span className="text-cyan-400 font-medium">{v}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* ── Map panel ── */}
          <div className="xl:col-span-3">
            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-white/50">
                    <Globe size={12} className="text-cyan-400" />
                    Satellite map · hover grid cell to preview · click to view surface obs
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Grid toggle */}
                  <button
                    onClick={() => setShowGrid(g => !g)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      showGrid
                        ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400'
                        : 'glass border-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    <Grid3X3 size={12} />
                    {showGrid ? 'Grid ON' : 'Grid OFF'}
                  </button>
                  {pin && (
                    <button
                      onClick={() => { setPin(null); setLatInput(''); setLonInput(''); }}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg glass border border-white/10 text-white/50 hover:text-white text-xs transition-all"
                    >
                      <RotateCcw size={11} /> Clear pin
                    </button>
                  )}
                </div>
              </div>

              {/* Leaflet map */}
              <div style={{ height: '540px' }}>
                <MapContainer
                  center={[17, 75]}
                  zoom={5}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                  doubleClickZoom={false}
                >
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
                      color:       '#facc15',
                      weight:      2.5,
                      dashArray:   '8 5',
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
                        color:       '#ffffff',
                        fillColor:   '#06b6d4',
                        fillOpacity: 0.95,
                        weight:      2,
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
                        color:       '#ffffff',
                        fillColor:   '#f97316',
                        fillOpacity: 0.9,
                        weight:      2,
                      }}
                      eventHandlers={{ click: () => handleMapClick(p.lat, p.lon) }}
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
                        <div className="text-sm space-y-2 min-w-[190px]">
                          <p className="font-bold text-white">📍 Selected Point</p>
                          <div className="space-y-1 text-xs">
                            <p className="text-white/70">Lat: <span className="text-cyan-400 font-mono">{pin.lat}°N</span></p>
                            <p className="text-white/70">Lon: <span className="text-cyan-400 font-mono">{pin.lon}°E</span></p>
                            <p className="text-white/70">Grid cell: <span className="text-cyan-400 font-mono">
                              {(Math.floor((pin.lat - DOMAIN.latMin) / GRID_LAT_RES) + 1)}/{GRID_LAT_STEPS} row ·{' '}
                              {(Math.floor((pin.lon - DOMAIN.lonMin) / GRID_LON_RES) + 1)}/{GRID_LON_STEPS} col
                            </span></p>
                            <p className={inDomain ? 'text-green-400' : 'text-yellow-400'}>
                              {inDomain ? '✓ Inside NIO domain' : '⚠ Outside NIO domain'}
                            </p>
                          </div>
                          <button
                            onClick={handleGetSurface}
                            className="w-full mt-2 py-1.5 px-3 rounded-lg text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                            style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}
                          >
                            <Eye size={11} /> View Surface Obs
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  <ClickHandler onMapClick={handleMapClick} />
                </MapContainer>
              </div>

              {/* Map legend */}
              <div className="flex flex-wrap items-center gap-5 px-4 py-3 border-t border-white/8 text-xs text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-dashed border-2 border-yellow-400 inline-block" />
                  NIO Domain border
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-white/30 bg-cyan-400/20 inline-block" />
                  1°×1° grid cell (hover = SST colour · click = surface obs)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-white inline-block" />
                  Data station
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 border-2 border-white inline-block" />
                  Preset
                </span>
                {pin && (
                  <span className="flex items-center gap-1.5 ml-auto text-cyan-400">
                    📍 {pin.lat}°N, {pin.lon}°E selected
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* Grid info card */}
            <div className="glass rounded-2xl p-5 border border-cyan-500/20 bg-cyan-500/5 depth-shadow space-y-3">
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                <Grid3X3 size={14} />
                NIO Grid — 25 × 60
              </h3>
              <div className="space-y-1.5 text-xs text-white/60">
                <div className="flex justify-between">
                  <span className="text-white/40">Total cells</span>
                  <span className="font-mono text-white">{GRID_LAT_STEPS * GRID_LON_STEPS}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Rows (lat)</span>
                  <span className="font-mono text-white">{GRID_LAT_STEPS} × 1°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Cols (lon)</span>
                  <span className="font-mono text-white">{GRID_LON_STEPS} × 1°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Lat range</span>
                  <span className="font-mono text-white">{DOMAIN.latMin}°N – {DOMAIN.latMax}°N</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Lon range</span>
                  <span className="font-mono text-white">{DOMAIN.lonMin}°E – {DOMAIN.lonMax}°E</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/10 text-[10px] text-white/30 leading-relaxed">
                Each cell colour on hover = IDW-interpolated SST from station data.
                Click any cell to jump directly to Surface Obs for that coordinate.
              </div>
            </div>

            {/* Manual coordinate entry */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-4">
              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Crosshair size={14} className="text-cyan-400" />
                Enter Coordinates
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Latitude °N</label>
                  <input
                    type="number" value={latInput}
                    onChange={e => setLatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyManual()}
                    placeholder="e.g. 15.5" step="1" min="-90" max="90"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {latError && <p className="text-red-400 text-[10px] mt-1">{latError}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Longitude °E</label>
                  <input
                    type="number" value={lonInput}
                    onChange={e => setLonInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyManual()}
                    placeholder="e.g. 88.0" step="1" min="-180" max="180"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {lonError && <p className="text-red-400 text-[10px] mt-1">{lonError}</p>}
                </div>
                <button onClick={applyManual}
                  className="w-full py-2.5 rounded-xl glass border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-2">
                  <Navigation size={13} /> Place Pin
                </button>
              </div>
            </div>

            {/* Preset locations */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
              <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                <MapPin size={14} className="text-yellow-400" />
                Preset Locations
              </h3>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setPin({ lat: p.lat, lon: p.lon });
                      setLatInput(p.lat.toString());
                      setLonInput(p.lon.toString());
                      setLatError(''); setLonError('');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all ${
                      pin?.lat === p.lat && pin?.lon === p.lon
                        ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
                        : 'glass border border-white/8 text-white/60 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span className="font-medium block">{p.name}</span>
                    <span className="text-white/30 font-mono">{p.lat}°N, {p.lon}°E</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected pin CTA */}
            {pin ? (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-4 fade-in-up">
                <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <MapPin size={14} className={inDomain ? 'text-red-400' : 'text-orange-400'} />
                  Selected
                </h3>
                <div className="space-y-2 text-sm">
                  {[
                    { l:'Latitude',   v:`${pin.lat}°N`,  c:'text-white font-mono' },
                    { l:'Longitude',  v:`${pin.lon}°E`,  c:'text-white font-mono' },
                    { l:'NIO Domain', v: inDomain ? '✓ Inside' : '⚠ Outside', c: inDomain ? 'text-green-400' : 'text-yellow-400' },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="flex justify-between items-center">
                      <span className="text-white/50">{l}</span>
                      <span className={c}>{v}</span>
                    </div>
                  ))}
                </div>

                {nearest && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs text-white/40 flex items-center gap-1.5">
                      <Info size={11} />Nearest station ({nearest.dist}° away)
                    </p>
                    <p className="text-xs font-medium text-white">{nearest.record.location}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { l:'SST',  v:`${nearest.record.inputs.sst.toFixed(1)}°C`,   c:'text-red-400' },
                        { l:'SSS',  v:`${nearest.record.inputs.sss.toFixed(1)} PSU`, c:'text-blue-400' },
                        { l:'SSH',  v:`${nearest.record.inputs.ssh.toFixed(1)} cm`,  c:'text-cyan-400' },
                        { l:'MLD',  v:`${nearest.record.mld.toFixed(0)} m`,          c:'text-purple-400' },
                        { l:'OHC',  v:`${nearest.record.ohc.toFixed(0)} kJ/cm²`,    c:'text-orange-400' },
                        { l:'Wind', v:`${Math.hypot(nearest.record.inputs.uwind, nearest.record.inputs.vwind).toFixed(1)} m/s`, c:'text-green-400' },
                      ].map(({ l, v, c }) => (
                        <div key={l} className="flex justify-between px-2 py-1 rounded-lg bg-white/5 text-[11px]">
                          <span className="text-white/40">{l}</span>
                          <span className={`font-mono ${c}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleGetSurface}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  style={{ background:'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
                  <Eye size={15} />
                  Get Surface Observations
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <Grid3X3 size={18} className="text-white/30" />
                </div>
                <p className="text-sm text-white/40">Click any grid cell or the map</p>
                <p className="text-xs text-white/25">Clicking a grid cell opens Surface Obs instantly</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
