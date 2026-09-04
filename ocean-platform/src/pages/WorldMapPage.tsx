import { useState, useCallback, useEffect } from 'react';
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
  ArrowRight, Info, Navigation, Globe,
} from 'lucide-react';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, DOMAIN } from '../contexts/DataContext';
import { format, parseISO } from 'date-fns';

// ── Fix default Leaflet marker icon broken by bundlers ─────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Red pin icon for selected coordinate
const redIcon = new L.Icon({
  iconUrl:       'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

// Station markers use CircleMarker (no custom icon needed)

// ── NIO domain bounding box ───────────────────────────────────────────────────
const NIO_BOUNDS: L.LatLngBoundsLiteral = [
  [DOMAIN.latMin, DOMAIN.lonMin],
  [DOMAIN.latMax, DOMAIN.lonMax],
];

// ── Preset locations ──────────────────────────────────────────────────────────
const PRESETS = [
  { name: 'Bay of Bengal (Centre)',       lat: 15.0, lon: 88.0 },
  { name: 'Arabian Sea (Centre)',         lat: 17.0, lon: 65.0 },
  { name: 'Lakshadweep Sea',              lat: 11.0, lon: 73.0 },
  { name: 'Gulf of Mannar',               lat:  8.8, lon: 79.0 },
  { name: 'Andaman Sea',                  lat: 12.5, lon: 95.0 },
  { name: 'BoB — Near Bangladesh Coast',  lat: 20.5, lon: 90.0 },
  { name: 'Arabian Sea — Off Mumbai',     lat: 18.0, lon: 69.5 },
  { name: 'Indian Ocean South',           lat:  6.0, lon: 75.0 },
];

// ── Click handler component (must be inside MapContainer) ────────────────────
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
  lat: number,
  lon: number,
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

  const [pin,      setPin]      = useState<{ lat: number; lon: number } | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [latError, setLatError] = useState('');
  const [lonError, setLonError] = useState('');

  const inDomain = pin
    ? pin.lat >= DOMAIN.latMin && pin.lat <= DOMAIN.latMax
      && pin.lon >= DOMAIN.lonMin && pin.lon <= DOMAIN.lonMax
    : false;

  const nearest = pin ? findNearest(records, pin.lat, pin.lon) : null;

  // Unique station locations
  const stations = (() => {
    const seen = new Set<string>();
    return records.filter(r => {
      const k = `${r.lat.toFixed(1)},${r.lon.toFixed(1)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  })();

  const handleMapClick = useCallback((lat: number, lon: number) => {
    setPin({ lat, lon });
    setLatInput(lat.toString());
    setLonInput(lon.toString());
    setLatError(''); setLonError('');
  }, []);

  const applyManual = useCallback(() => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    let ok = true;
    if (isNaN(lat) || lat < -90  || lat > 90)  { setLatError('Must be −90 to 90');   ok = false; } else setLatError('');
    if (isNaN(lon) || lon < -180 || lon > 180) { setLonError('Must be −180 to 180'); ok = false; } else setLonError('');
    if (ok) { setPin({ lat, lon }); }
  }, [latInput, lonInput]);

  const handleGetSurface = useCallback(() => {
    if (!pin) return;
    navigate(`/surface?lat=${pin.lat}&lon=${pin.lon}`);
  }, [pin, navigate]);

  // Inject Leaflet CSS override for dark theme map UI
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'leaflet-dark-override';
    style.textContent = `
      .leaflet-container { background: #020917 !important; cursor: crosshair !important; }
      .leaflet-control-zoom a { background: rgba(2,9,23,0.85) !important; color: #06b6d4 !important; border-color: rgba(6,182,212,0.3) !important; }
      .leaflet-control-zoom a:hover { background: rgba(6,182,212,0.15) !important; }
      .leaflet-control-attribution { background: rgba(2,9,23,0.7) !important; color: rgba(255,255,255,0.3) !important; font-size: 10px; }
      .leaflet-control-attribution a { color: rgba(6,182,212,0.6) !important; }
      .leaflet-popup-content-wrapper { background: rgba(2,9,23,0.92) !important; border: 1px solid rgba(255,255,255,0.15) !important; border-radius: 12px !important; backdrop-filter: blur(16px); color: white !important; box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important; }
      .leaflet-popup-tip { background: rgba(2,9,23,0.92) !important; }
      .leaflet-popup-close-button { color: rgba(255,255,255,0.5) !important; }
      .leaflet-popup-close-button:hover { color: white !important; }
      .leaflet-tooltip { background: rgba(2,9,23,0.88) !important; border: 1px solid rgba(6,182,212,0.3) !important; color: white !important; border-radius: 8px !important; font-size: 11px; }
      .leaflet-tooltip::before { border-top-color: rgba(6,182,212,0.3) !important; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('leaflet-dark-override')?.remove(); };
  }, []);

  return (
    <PageLayout>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="World Map — Coordinate Selector"
          subtitle="Click anywhere on the real map to select ocean coordinates, then view surface observations for that location"
          icon={<Globe size={16} className="text-cyan-400" />}
        />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* ── Map ── */}
          <div className="xl:col-span-3">
            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Globe size={12} className="text-cyan-400" />
                  OpenStreetMap · Zoom / pan freely · Click to place pin
                </div>
                {pin && (
                  <button
                    onClick={() => { setPin(null); setLatInput(''); setLonInput(''); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg glass border border-white/10 text-white/50 hover:text-white text-xs transition-all"
                  >
                    <RotateCcw size={11} /> Clear pin
                  </button>
                )}
              </div>

              {/* Leaflet map */}
              <div style={{ height: '520px' }}>
                <MapContainer
                  center={[15, 75]}
                  zoom={4}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                  doubleClickZoom={false}
                >
                  {/* Dark oceanic tile layer */}
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>'
                    maxZoom={18}
                  />

                  {/* NIO study domain rectangle */}
                  <Rectangle
                    bounds={NIO_BOUNDS}
                    pathOptions={{
                      color: '#06b6d4',
                      weight: 2,
                      dashArray: '6 4',
                      fillColor: '#06b6d4',
                      fillOpacity: 0.05,
                    }}
                  >
                    <LeafletTooltip sticky={false} direction="top">
                      NIO Study Domain · 5°N–30°N, 45°E–105°E
                    </LeafletTooltip>
                  </Rectangle>

                  {/* Data station markers */}
                  {stations.map(r => (
                    <CircleMarker
                      key={r.id}
                      center={[r.lat, r.lon]}
                      radius={6}
                      pathOptions={{
                        color: '#06b6d4',
                        fillColor: '#06b6d4',
                        fillOpacity: 0.7,
                        weight: 1.5,
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

                  {/* Preset location markers */}
                  {PRESETS.map(p => (
                    <CircleMarker
                      key={p.name}
                      center={[p.lat, p.lon]}
                      radius={5}
                      pathOptions={{
                        color: '#fbbf24',
                        fillColor: '#fbbf24',
                        fillOpacity: 0.5,
                        weight: 1,
                      }}
                      eventHandlers={{
                        click: () => handleMapClick(p.lat, p.lon),
                      }}
                    >
                      <LeafletTooltip>
                        <span className="text-xs font-medium">{p.name}</span>
                      </LeafletTooltip>
                    </CircleMarker>
                  ))}

                  {/* Selected pin marker */}
                  {pin && (
                    <Marker position={[pin.lat, pin.lon]} icon={redIcon}>
                      <Popup>
                        <div className="text-sm space-y-2 min-w-[180px]">
                          <p className="font-bold text-white text-base">📍 Selected Point</p>
                          <div className="space-y-1 text-xs">
                            <p className="text-white/70">
                              Lat: <span className="text-cyan-400 font-mono">{pin.lat}°N</span>
                            </p>
                            <p className="text-white/70">
                              Lon: <span className="text-cyan-400 font-mono">{pin.lon}°E</span>
                            </p>
                            <p className="text-white/70">
                              Snapped: <span className="text-cyan-400 font-mono">
                                {(Math.round(pin.lat / 0.25) * 0.25).toFixed(2)}°N,{' '}
                                {(Math.round(pin.lon / 0.25) * 0.25).toFixed(2)}°E
                              </span>
                            </p>
                            <p className={inDomain ? 'text-green-400' : 'text-yellow-400'}>
                              {inDomain ? '✓ Inside NIO domain' : '⚠ Outside NIO domain'}
                            </p>
                          </div>
                          <button
                            onClick={handleGetSurface}
                            className="w-full mt-2 py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
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
                  <span className="w-3 h-0.5 border-dashed border border-cyan-400/60 inline-block" />
                  NIO Study Domain
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/70 inline-block" />
                  Data station (hover for obs)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60 inline-block" />
                  Preset location (click to select)
                </span>
                {pin && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                    Selected pin · {pin.lat}°N, {pin.lon}°E
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

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
                    type="number"
                    value={latInput}
                    onChange={e => setLatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyManual()}
                    placeholder="e.g. 15.5"
                    step="0.25" min="-90" max="90"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {latError && <p className="text-red-400 text-[10px] mt-1">{latError}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Longitude °E</label>
                  <input
                    type="number"
                    value={lonInput}
                    onChange={e => setLonInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyManual()}
                    placeholder="e.g. 88.0"
                    step="0.25" min="-180" max="180"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {lonError && <p className="text-red-400 text-[10px] mt-1">{lonError}</p>}
                </div>
                <button
                  onClick={applyManual}
                  className="w-full py-2.5 rounded-xl glass border border-cyan-500/30 text-cyan-400 text-sm hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-2"
                >
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
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
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

            {/* Pin details + CTA */}
            {pin ? (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-4 fade-in-up">
                <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <MapPin size={14} className={inDomain ? 'text-red-400' : 'text-orange-400'} />
                  Selected Location
                </h3>

                <div className="space-y-2 text-sm">
                  {[
                    { l: 'Latitude',    v: `${pin.lat}°N`,  c: 'text-white font-mono' },
                    { l: 'Longitude',   v: `${pin.lon}°E`,  c: 'text-white font-mono' },
                    { l: '0.25° grid',  v: `${(Math.round(pin.lat/0.25)*0.25).toFixed(2)}°N, ${(Math.round(pin.lon/0.25)*0.25).toFixed(2)}°E`, c: 'text-cyan-400 font-mono' },
                    { l: 'NIO Domain',  v: inDomain ? '✓ Inside' : '⚠ Outside', c: inDomain ? 'text-green-400' : 'text-yellow-400' },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="flex justify-between items-center">
                      <span className="text-white/50">{l}</span>
                      <span className={c}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Nearest station preview */}
                {nearest && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs text-white/40 flex items-center gap-1.5">
                      <Info size={11} />
                      Nearest station ({nearest.dist}° away)
                    </p>
                    <p className="text-xs font-medium text-white">{nearest.record.location}</p>
                    <p className="text-[10px] text-white/30">{format(parseISO(nearest.record.date), 'MMM d, yyyy')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { l:'SST',  v:`${nearest.record.inputs.sst.toFixed(1)}°C`,    c:'text-red-400' },
                        { l:'SSS',  v:`${nearest.record.inputs.sss.toFixed(1)} PSU`,  c:'text-blue-400' },
                        { l:'SSH',  v:`${nearest.record.inputs.ssh.toFixed(1)} cm`,   c:'text-cyan-400' },
                        { l:'MLD',  v:`${nearest.record.mld.toFixed(0)} m`,           c:'text-purple-400' },
                        { l:'OHC',  v:`${nearest.record.ohc.toFixed(0)} kJ/cm²`,     c:'text-orange-400' },
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

                {/* CTA */}
                <button
                  onClick={handleGetSurface}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Eye size={15} />
                  Get Surface Observations
                  <ArrowRight size={14} />
                </button>
                <p className="text-[10px] text-white/25 text-center">
                  Opens Surface Obs filtered to {pin.lat}°N, {pin.lon}°E
                </p>
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <Crosshair size={18} className="text-white/30" />
                </div>
                <p className="text-sm text-white/40">Click the map to select coordinates</p>
                <p className="text-xs text-white/25">Or choose a preset location above</p>
              </div>
            )}

            {/* NIO domain info */}
            <div className="glass rounded-2xl p-4 border border-cyan-500/15 bg-cyan-500/5">
              <p className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5 mb-2">
                <Info size={12} />
                NIO Study Domain
              </p>
              <div className="text-[11px] text-white/50 space-y-0.5">
                <p>Lat: {DOMAIN.latMin}°N – {DOMAIN.latMax}°N</p>
                <p>Lon: {DOMAIN.lonMin}°E – {DOMAIN.lonMax}°E</p>
                <p>Resolution: 0.25° × 0.25° · Daily</p>
                <p className="text-cyan-400/60 mt-1">Best results inside the highlighted box</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
