import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Crosshair, Eye, RotateCcw,
  ArrowRight, Info, Globe,
  Navigation,
} from 'lucide-react';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, DOMAIN } from '../contexts/DataContext';
import { format, parseISO } from 'date-fns';

// ── World map SVG proportions ─────────────────────────────────────────────────
// Simple equirectangular projection: lon -180→180 = 0→100%, lat 90→-90 = 0→100%
const projLonToX = (lon: number) => ((lon + 180) / 360) * 100;
const projLatToY = (lat: number) => ((90 - lat) / 180) * 100;

// Inverse — SVG % coords → lat/lon
const xToLon = (xPct: number) => xPct * 360 - 180;
const yToLat = (yPct: number) => 90 - yPct * 180;

// ── North Indian Ocean domain box ─────────────────────────────────────────────
const DOMAIN_BOX = {
  x:  projLonToX(DOMAIN.lonMin),
  y:  projLatToY(DOMAIN.latMax),   // top-left (higher lat = lower y)
  w:  projLonToX(DOMAIN.lonMax) - projLonToX(DOMAIN.lonMin),
  h:  projLatToY(DOMAIN.latMin) - projLatToY(DOMAIN.latMax),
};

// ── Preset famous ocean locations ─────────────────────────────────────────────
const PRESETS = [
  { name: 'Bay of Bengal (Centre)',    lat: 15.0, lon: 88.0 },
  { name: 'Arabian Sea (Centre)',      lat: 17.0, lon: 65.0 },
  { name: 'Lakshadweep Sea',           lat: 11.0, lon: 73.0 },
  { name: 'Gulf of Mannar',            lat:  8.8, lon: 79.0 },
  { name: 'Andaman Sea',               lat: 12.5, lon: 95.0 },
  { name: 'BoB — Near Bangladesh Coast', lat: 20.5, lon: 90.0 },
  { name: 'Arabian Sea — Off Mumbai',  lat: 18.0, lon: 69.5 },
  { name: 'Indian Ocean South',        lat:  6.0, lon: 75.0 },
];

// ── Derive surface obs from records for a given lat/lon ───────────────────────
function findNearestRecord(
  records: ReturnType<typeof useData>['records'],
  lat: number,
  lon: number,
) {
  if (records.length === 0) return null;
  let best = records[0];
  let bestDist = Infinity;
  for (const r of records) {
    const d = Math.hypot(r.lat - lat, r.lon - lon);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return { record: best, distance: +bestDist.toFixed(2) };
}

// ── Thin SVG world landmasses (simplified paths for key continents) ───────────
// Coordinates are in % (equirectangular projection)
function WorldLandmasses() {
  // Very simplified continent outlines as SVG polygons (lon/lat pairs → x%/y%)
  const continents: { name: string; points: [number, number][] }[] = [
    // North America
    { name: 'NA', points: [[-168,72],[-140,60],[-125,48],[-120,30],[-86,15],[-77,8],[-60,5],[-52,4],[-45,62],[-65,47],[-55,47],[-80,45],[-95,49],[-130,55],[-168,72]] },
    // South America
    { name: 'SA', points: [[-77,10],[-60,5],[-50,-5],[-35,-5],[-35,-55],[-68,-54],[-75,-40],[-80,-5],[-77,10]] },
    // Europe
    { name: 'EU', points: [[-10,36],[35,35],[30,46],[22,55],[28,70],[18,68],[5,60],[-8,48],[-10,36]] },
    // Africa
    { name: 'AF', points: [[-18,15],[50,15],[42,-10],[35,-35],[18,-35],[12,0],[8,5],[0,5],[-18,15]] },
    // Asia (simplified)
    { name: 'AS', points: [[28,68],[140,72],[145,40],[130,32],[120,24],[110,15],[100,2],[90,10],[80,8],[70,22],[60,22],[45,38],[35,36],[28,68]] },
    // Australia
    { name: 'AU', points: [[115,-22],[125,-15],[136,-12],[148,-18],[152,-25],[148,-38],[135,-38],[118,-33],[115,-22]] },
    // Greenland
    { name: 'GL', points: [[-45,84],[-20,84],[-18,78],[-25,68],[-40,65],[-52,68],[-55,75],[-45,84]] },
    // Japan/Korean
    { name: 'JP', points: [[130,33],[132,35],[136,36],[141,42],[140,38],[132,33],[130,33]] },
    // Sri Lanka
    { name: 'LK', points: [[80,10],[82,10],[82,6],[80,6],[80,10]] },
    // India
    { name: 'IN', points: [[68,22],[72,22],[77,28],[80,28],[88,22],[80,10],[77,8],[72,10],[68,22]] },
  ];

  return (
    <g>
      {continents.map(cont => (
        <polygon
          key={cont.name}
          points={cont.points.map(([lon, lat]) => `${projLonToX(lon)},${projLatToY(lat)}`).join(' ')}
          fill="rgba(30,58,100,0.5)"
          stroke="rgba(6,182,212,0.25)"
          strokeWidth="0.15"
        />
      ))}
    </g>
  );
}

// ── Graticule lines (every 30°) ───────────────────────────────────────────────
function Graticule() {
  const lats = [-60, -30, 0, 30, 60];
  const lons = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  return (
    <g stroke="rgba(6,182,212,0.08)" strokeWidth="0.12">
      {lats.map(lat => (
        <line key={`lat${lat}`} x1={0} y1={projLatToY(lat)} x2={100} y2={projLatToY(lat)} />
      ))}
      {lons.map(lon => (
        <line key={`lon${lon}`} x1={projLonToX(lon)} y1={0} x2={projLonToX(lon)} y2={100} />
      ))}
      {/* Equator — slightly brighter */}
      <line x1={0} y1={projLatToY(0)} x2={100} y2={projLatToY(0)} stroke="rgba(6,182,212,0.18)" strokeDasharray="0.5,0.5" />
      {/* Prime meridian */}
      <line x1={projLonToX(0)} y1={0} x2={projLonToX(0)} y2={100} stroke="rgba(6,182,212,0.12)" strokeDasharray="0.5,0.5" />
    </g>
  );
}

// ── Data station dots from records ────────────────────────────────────────────
function StationDots({ records }: { records: ReturnType<typeof useData>['records'] }) {
  const seen = new Set<string>();
  return (
    <g>
      {records.map(r => {
        const key = `${r.lat.toFixed(1)},${r.lon.toFixed(1)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const x = projLonToX(r.lon);
        const y = projLatToY(r.lat);
        return (
          <g key={key}>
            <circle cx={x} cy={y} r={0.5} fill="#06b6d4" opacity={0.7} />
            <circle cx={x} cy={y} r={1.0} fill="none" stroke="#06b6d4" strokeWidth="0.2" opacity={0.3} />
          </g>
        );
      })}
    </g>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorldMapPage() {
  const { records } = useData();
  const navigate    = useNavigate();
  const svgRef      = useRef<SVGSVGElement>(null);

  const [pin,         setPin]         = useState<{ lat: number; lon: number } | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [latInput,    setLatInput]    = useState('');
  const [lonInput,    setLonInput]    = useState('');
  const [latError,    setLatError]    = useState('');
  const [lonError,    setLonError]    = useState('');

  // SVG click → place pin
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg  = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
    const lon  = +xToLon(xPct / 100).toFixed(2);
    const lat  = +yToLat(yPct / 100).toFixed(2);
    setPin({ lat, lon });
    setLatInput(lat.toString());
    setLonInput(lon.toString());
    setLatError('');
    setLonError('');
  }, []);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg  = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
    setHoverCoords({
      lon: +xToLon(xPct / 100).toFixed(1),
      lat: +yToLat(yPct / 100).toFixed(1),
    });
  }, []);

  // Manual coordinate entry
  const applyManual = useCallback(() => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    let ok = true;
    if (isNaN(lat) || lat < -90 || lat > 90)  { setLatError('Lat must be −90 to 90');   ok = false; }
    else setLatError('');
    if (isNaN(lon) || lon < -180 || lon > 180) { setLonError('Lon must be −180 to 180'); ok = false; }
    else setLonError('');
    if (ok) setPin({ lat, lon });
  }, [latInput, lonInput]);

  // Go to surface obs
  const handleGetSurface = useCallback(() => {
    if (!pin) return;
    navigate(`/surface?lat=${pin.lat}&lon=${pin.lon}`);
  }, [pin, navigate]);

  // Nearest existing record
  const nearest = pin ? findNearestRecord(records, pin.lat, pin.lon) : null;

  // Is pin inside NIO domain?
  const inDomain = pin
    ? pin.lat >= DOMAIN.latMin && pin.lat <= DOMAIN.latMax
      && pin.lon >= DOMAIN.lonMin && pin.lon <= DOMAIN.lonMax
    : false;

  const pinX = pin ? projLonToX(pin.lon) : null;
  const pinY = pin ? projLatToY(pin.lat) : null;

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="World Map — Coordinate Selector"
          subtitle="Click anywhere on the map to select ocean coordinates, then view surface observations for that location"
          icon={<Globe size={16} className="text-cyan-400" />}
        />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* ── Map area ── */}
          <div className="xl:col-span-3">
            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">

              {/* Map toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Globe size={12} className="text-cyan-400" />
                  Equirectangular projection · Click to place coordinate pin
                </div>
                <div className="flex items-center gap-2">
                  {hoverCoords && (
                    <span className="text-xs font-mono text-white/40 hidden sm:block">
                      {hoverCoords.lat > 0 ? '+' : ''}{hoverCoords.lat}°, {hoverCoords.lon > 0 ? '+' : ''}{hoverCoords.lon}°
                    </span>
                  )}
                  {pin && (
                    <button
                      onClick={() => { setPin(null); setLatInput(''); setLonInput(''); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg glass border border-white/10 text-white/50 hover:text-white text-xs transition-all"
                    >
                      <RotateCcw size={11} /> Clear pin
                    </button>
                  )}
                </div>
              </div>

              {/* SVG Map */}
              <div className="relative bg-gradient-to-br from-blue-950/80 to-blue-900/40">
                <svg
                  ref={svgRef}
                  viewBox="0 0 100 50"
                  className="w-full cursor-crosshair select-none"
                  style={{ display: 'block' }}
                  onClick={handleSvgClick}
                  onMouseMove={handleSvgMouseMove}
                  onMouseLeave={() => setHoverCoords(null)}
                >
                  {/* Ocean background */}
                  <rect x={0} y={0} width={100} height={50} fill="rgba(2,9,23,0.9)" />

                  {/* Graticule */}
                  <Graticule />

                  {/* Landmasses */}
                  <WorldLandmasses />

                  {/* NIO domain highlight box */}
                  <rect
                    x={DOMAIN_BOX.x} y={DOMAIN_BOX.y}
                    width={DOMAIN_BOX.w} height={DOMAIN_BOX.h}
                    fill="rgba(6,182,212,0.06)"
                    stroke="rgba(6,182,212,0.45)"
                    strokeWidth="0.2"
                    strokeDasharray="0.8,0.4"
                  />
                  {/* Domain label */}
                  <text
                    x={DOMAIN_BOX.x + DOMAIN_BOX.w / 2}
                    y={DOMAIN_BOX.y - 0.6}
                    textAnchor="middle"
                    fontSize="0.9"
                    fill="rgba(6,182,212,0.7)"
                    fontFamily="monospace"
                  >
                    North Indian Ocean Study Domain
                  </text>

                  {/* Station dots from records */}
                  <StationDots records={records} />

                  {/* Preset location markers */}
                  {PRESETS.map(p => (
                    <g key={p.name}>
                      <circle
                        cx={projLonToX(p.lon)} cy={projLatToY(p.lat)}
                        r={0.4} fill="rgba(251,191,36,0.5)"
                        stroke="rgba(251,191,36,0.4)" strokeWidth="0.15"
                      />
                    </g>
                  ))}

                  {/* Pin marker */}
                  {pin && pinX != null && pinY != null && (
                    <g>
                      {/* Drop shadow */}
                      <ellipse cx={pinX} cy={pinY + 1.8} rx={0.6} ry={0.2} fill="rgba(0,0,0,0.4)" />
                      {/* Pin body */}
                      <circle cx={pinX} cy={pinY} r={1.2}
                        fill={inDomain ? '#ef4444' : '#f97316'}
                        stroke="white" strokeWidth="0.25"
                        style={{ filter: `drop-shadow(0 0 2px ${inDomain ? '#ef4444' : '#f97316'})` }}
                      />
                      {/* Pulsing ring */}
                      <circle cx={pinX} cy={pinY} r={2.0}
                        fill="none" stroke={inDomain ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'}
                        strokeWidth="0.3"
                      >
                        <animate attributeName="r" values="1.5;3;1.5" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                      </circle>
                      {/* Crosshair lines */}
                      <line x1={pinX - 1.8} y1={pinY} x2={pinX - 1.3} y2={pinY} stroke="white" strokeWidth="0.15" opacity={0.6} />
                      <line x1={pinX + 1.3} y1={pinY} x2={pinX + 1.8} y2={pinY} stroke="white" strokeWidth="0.15" opacity={0.6} />
                      <line x1={pinX} y1={pinY - 1.8} x2={pinX} y2={pinY - 1.3} stroke="white" strokeWidth="0.15" opacity={0.6} />
                      <line x1={pinX} y1={pinY + 1.3} x2={pinX} y2={pinY + 1.8} stroke="white" strokeWidth="0.15" opacity={0.6} />
                      {/* Coordinate label */}
                      <rect
                        x={pinX + 1.5} y={pinY - 1.8}
                        width={9} height={2.8}
                        rx={0.4} fill="rgba(2,9,23,0.85)"
                        stroke="rgba(255,255,255,0.2)" strokeWidth="0.1"
                      />
                      <text x={pinX + 2.0} y={pinY - 0.7} fontSize="0.9" fill="white" fontFamily="monospace">
                        {pin.lat > 0 ? '+' : ''}{pin.lat}°N
                      </text>
                      <text x={pinX + 2.0} y={pinY + 0.6} fontSize="0.9" fill="rgba(255,255,255,0.6)" fontFamily="monospace">
                        {pin.lon > 0 ? '+' : ''}{pin.lon}°E
                      </text>
                    </g>
                  )}

                  {/* Axis labels */}
                  {[-60, -30, 0, 30, 60].map(lat => (
                    <text key={`latlbl${lat}`} x={0.5} y={projLatToY(lat) + 0.4}
                      fontSize="0.8" fill="rgba(255,255,255,0.2)" fontFamily="monospace">
                      {lat}°
                    </text>
                  ))}
                  {[-120, -60, 0, 60, 120].map(lon => (
                    <text key={`lonlbl${lon}`} x={projLonToX(lon) - 1} y={49.5}
                      fontSize="0.8" fill="rgba(255,255,255,0.2)" fontFamily="monospace">
                      {lon}°
                    </text>
                  ))}
                </svg>

                {/* Map overlay legend (bottom-left) */}
                <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                    <span className="w-3 h-0.5 border border-dashed border-cyan-400/60 inline-block" />
                    NIO study domain
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                    <span className="w-2 h-2 rounded-full bg-cyan-400/70 inline-block" />
                    Data station
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                    <span className="w-2 h-2 rounded-full bg-yellow-400/60 inline-block" />
                    Preset location
                  </div>
                  {pin && (
                    <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      Selected pin
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-5">

            {/* Manual coordinate entry */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-4">
              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Crosshair size={14} className="text-cyan-400" />
                Enter Coordinates
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Latitude (°N)</label>
                  <input
                    type="number"
                    value={latInput}
                    onChange={e => setLatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyManual()}
                    placeholder="e.g. 15.5"
                    step="0.25"
                    min="-90" max="90"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {latError && <p className="text-red-400 text-[10px] mt-1">{latError}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Longitude (°E)</label>
                  <input
                    type="number"
                    value={lonInput}
                    onChange={e => setLonInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyManual()}
                    placeholder="e.g. 88.0"
                    step="0.25"
                    min="-180" max="180"
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
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
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

            {/* Selected pin info */}
            {pin && (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-4 fade-in-up">
                <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <MapPin size={14} className={inDomain ? 'text-red-400' : 'text-orange-400'} />
                  Selected Location
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Latitude</span>
                    <span className="text-white font-mono">{pin.lat}°N</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Longitude</span>
                    <span className="text-white font-mono">{pin.lon}°E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Grid (0.25°)</span>
                    <span className="text-cyan-400 font-mono">
                      {(Math.round(pin.lat / 0.25) * 0.25).toFixed(2)}°N,{' '}
                      {(Math.round(pin.lon / 0.25) * 0.25).toFixed(2)}°E
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">In NIO Domain</span>
                    <span className={inDomain ? 'text-green-400' : 'text-yellow-400'}>
                      {inDomain ? '✓ Yes' : '⚠ Outside domain'}
                    </span>
                  </div>
                </div>

                {/* Nearest data record */}
                {nearest && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <p className="text-xs text-white/40 flex items-center gap-1.5">
                      <Info size={11} />
                      Nearest data station ({nearest.distance}° away)
                    </p>
                    <p className="text-xs font-medium text-white">{nearest.record.location}</p>
                    <p className="text-[10px] text-white/30">
                      {format(parseISO(nearest.record.date), 'MMM d, yyyy')}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {[
                        { l:'SST',  v:`${nearest.record.inputs.sst.toFixed(1)}°C`,   c:'text-red-400' },
                        { l:'SSS',  v:`${nearest.record.inputs.sss.toFixed(1)} PSU`, c:'text-blue-400' },
                        { l:'SSH',  v:`${nearest.record.inputs.ssh.toFixed(1)} cm`,  c:'text-cyan-400' },
                        { l:'MLD',  v:`${nearest.record.mld.toFixed(0)} m`,          c:'text-purple-400' },
                        { l:'OHC',  v:`${nearest.record.ohc.toFixed(0)} kJ/cm²`,    c:'text-orange-400' },
                        { l:'Wind', v:`${Math.hypot(nearest.record.inputs.uwind, nearest.record.inputs.vwind).toFixed(1)} m/s`, c:'text-green-400' },
                      ].map(({ l, v, c }) => (
                        <div key={l} className="flex justify-between px-2 py-1 rounded-lg bg-white/5">
                          <span className="text-white/40">{l}</span>
                          <span className={`font-mono ${c}`}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA button */}
                <button
                  onClick={handleGetSurface}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Eye size={15} />
                  Get Surface Observations
                  <ArrowRight size={14} />
                </button>
                <p className="text-[10px] text-white/25 text-center">
                  Redirects to Surface Obs page filtered to {pin.lat}°N, {pin.lon}°E
                </p>
              </div>
            )}

            {/* No pin yet */}
            {!pin && (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <Crosshair size={18} className="text-white/30" />
                </div>
                <p className="text-sm text-white/40">Click anywhere on the map to select coordinates</p>
                <p className="text-xs text-white/25">Or enter lat/lon manually above</p>
              </div>
            )}

            {/* Domain info */}
            <div className="glass rounded-2xl p-4 border border-cyan-500/15 bg-cyan-500/5 space-y-2">
              <p className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <Info size={12} />
                NIO Study Domain
              </p>
              <div className="text-[11px] text-white/50 space-y-0.5">
                <p>Lat: {DOMAIN.latMin}°N – {DOMAIN.latMax}°N</p>
                <p>Lon: {DOMAIN.lonMin}°E – {DOMAIN.lonMax}°E</p>
                <p>Resolution: 0.25° × 0.25°</p>
                <p className="text-cyan-400/60 mt-1">
                  Best results for pins within the dashed box
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
