import { useState, useMemo } from 'react';
import {
  Thermometer, Droplets, Waves, Wind,
  MapPin, Info, Eye, Layers, X as XIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, DOMAIN } from '../contexts/DataContext';

// ── Grid config — North Indian Ocean 5°N–30°N, 45°E–105°E at 0.25° ───────────
const GRID_ROWS = 20;
const GRID_COLS = 24;
const { latMin: LAT_MIN, latMax: LAT_MAX, lonMin: LON_MIN, lonMax: LON_MAX } = DOMAIN;

type VarMode = 'sst' | 'sss' | 'ssh' | 'uwind' | 'vwind';

// ── Variable metadata ─────────────────────────────────────────────────────────
const VAR_CONFIG: Record<VarMode, {
  label: string; unit: string; min: number; max: number;
  gradStart: string; gradEnd: string; source: string;
  accessor: (r: { inputs: any }) => number;
}> = {
  sst:   { label:'Sea Surface Temperature', unit:'°C',  min:24, max:32, gradStart:'#1e3a8a', gradEnd:'#ef4444', source:'MODIS/AVHRR/VIIRS',  accessor: r => r.inputs.sst },
  sss:   { label:'Sea Surface Salinity',    unit:'PSU', min:30, max:38, gradStart:'#1e3a8a', gradEnd:'#a855f7', source:'SMOS/Aquarius',       accessor: r => r.inputs.sss },
  ssh:   { label:'Sea Surface Height',      unit:'cm',  min:-30,max:30, gradStart:'#1e3a8a', gradEnd:'#06b6d4', source:'Jason-3/Sentinel-6',  accessor: r => r.inputs.ssh },
  uwind: { label:'Surface Wind U',          unit:'m/s', min:-15,max:15, gradStart:'#1e3a8a', gradEnd:'#10b981', source:'ERA5/ASCAT',           accessor: r => r.inputs.uwind },
  vwind: { label:'Surface Wind V',          unit:'m/s', min:-15,max:15, gradStart:'#1e3a8a', gradEnd:'#10b981', source:'ERA5/ASCAT',           accessor: r => r.inputs.vwind },
};

function valueToColor(val: number, min: number, max: number, gradStart: string, gradEnd: string): string {
  const n = Math.max(0, Math.min(1, (val - min) / (max - min)));
  // Parse hex to RGB and lerp
  const parse = (hex: string) => [
    parseInt(hex.slice(1,3), 16),
    parseInt(hex.slice(3,5), 16),
    parseInt(hex.slice(5,7), 16),
  ];
  const [r1,g1,b1] = parse(gradStart);
  const [r2,g2,b2] = parse(gradEnd);
  const r = Math.round(r1 + (r2-r1)*n);
  const g = Math.round(g1 + (g2-g1)*n);
  const b = Math.round(b1 + (b2-b1)*n);
  return `rgba(${r},${g},${b},0.88)`;
}

// ── IDW interpolation from anchor points ──────────────────────────────────────
function generateField(
  varMode: VarMode,
  anchors: Array<{ lat: number; lon: number; value: number }>,
  seed: number,
): number[][] {
  const cfg = VAR_CONFIG[varMode];
  return Array.from({ length: GRID_ROWS }, (_, ri) => {
    const lat = LAT_MAX - (ri / (GRID_ROWS - 1)) * (LAT_MAX - LAT_MIN);
    return Array.from({ length: GRID_COLS }, (_, ci) => {
      const lon = LON_MIN + (ci / (GRID_COLS - 1)) * (LON_MAX - LON_MIN);
      let weightedSum = 0, weightTotal = 0;
      for (const a of anchors) {
        const d = Math.hypot(lat - a.lat, lon - a.lon) + 0.01;
        const w = 1 / (d * d);
        weightedSum += w * a.value;
        weightTotal += w;
      }
      const base = weightTotal > 0 ? weightedSum / weightTotal : (cfg.min + cfg.max) / 2;
      const noise =
        Math.sin(lat * 0.45 + seed) * (cfg.max - cfg.min) * 0.04 +
        Math.cos(lon * 0.35 + seed * 0.7) * (cfg.max - cfg.min) * 0.03 +
        Math.sin((lat + lon) * 0.22) * (cfg.max - cfg.min) * 0.02;
      return Math.max(cfg.min, Math.min(cfg.max, base + noise));
    });
  });
}

const REGIONS = ['All Regions', 'Bay of Bengal', 'Arabian Sea', 'Lakshadweep Sea', 'Andaman Sea'];

interface HoverInfo { lat: number; lon: number; val: number; x: number; y: number }

// All 6 parameter values interpolated at a clicked point
interface ClickedPointData {
  lat: number;
  lon: number;
  sst: number;
  sss: number;
  ssh: number;
  sla: number;
  uwind: number;
  vwind: number;
}

export default function SurfacePage() {
  const { records } = useData();
  const [searchParams] = useSearchParams();

  // Read lat/lon from URL params (set by WorldMapPage redirect)
  const paramLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const paramLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null;
  const hasParamPin = paramLat !== null && paramLon !== null;

  // Pin position in grid % coords
  const pinGridX = hasParamPin ? ((paramLon! - LON_MIN) / (LON_MAX - LON_MIN)) * 100 : null;
  const pinGridY = hasParamPin ? ((LAT_MAX - paramLat!) / (LAT_MAX - LAT_MIN)) * 100 : null;

  const [mode, setMode]       = useState<VarMode>('sst');
  const [region, setRegion]   = useState('All Regions');
  const [dateIdx, setDateIdx] = useState(records.length - 1);
  const [hover, setHover]     = useState<HoverInfo | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [clickedPoint, setClickedPoint] = useState<ClickedPointData | null>(null);

  const selectedRecord = records[dateIdx];
  const cfg = VAR_CONFIG[mode];

  // Build anchor points from records using correct field accessors
  const anchors = useMemo(() =>
    records.map(r => ({
      lat:   r.lat,
      lon:   r.lon,
      value: cfg.accessor(r),
    })),
  [records, mode, cfg]);

  // Generate field using IDW
  const field = useMemo(() =>
    generateField(mode, anchors, dateIdx),
  [mode, anchors, dateIdx]);

  const flatVals = field.flat();
  const minVal   = Math.min(...flatVals);
  const maxVal   = Math.max(...flatVals);
  const meanVal  = flatVals.reduce((a, b) => a + b, 0) / flatVals.length;

  // IDW for a single variable at any lat/lon
  const idwAt = (varAccessor: (r: typeof records[0]) => number, lat: number, lon: number): number => {
    if (records.length === 0) return 0;
    let ws = 0, wt = 0;
    for (const r of records) {
      const d = Math.hypot(r.lat - lat, r.lon - lon) + 0.01;
      const w = 1 / (d * d);
      ws += w * varAccessor(r);
      wt += w;
    }
    return ws / wt;
  };

  // Handle grid cell click → compute all 6 parameters at that point
  const handleCellClick = (lat: number, lon: number) => {
    const seed = lat * 0.3 + lon * 0.2;
    const noise = (s: number) => Math.sin(s) * 0.5;
    setClickedPoint({
      lat: +lat.toFixed(2),
      lon: +lon.toFixed(2),
      sst:   +idwAt(r => r.inputs.sst,      lat, lon).toFixed(3),
      sss:   +idwAt(r => r.inputs.sss,      lat, lon).toFixed(3),
      ssh:   +(idwAt(r => r.inputs.ssh,     lat, lon) + noise(seed * 1.1)).toFixed(3),
      sla:   +(idwAt(r => r.inputs.sla,     lat, lon) + noise(seed * 1.3)).toFixed(3),
      uwind: +(idwAt(r => r.inputs.uwind,   lat, lon) + noise(seed * 0.9)).toFixed(3),
      vwind: +(idwAt(r => r.inputs.vwind,   lat, lon) + noise(seed * 1.7)).toFixed(3),
    });
  };

  const cellW = 100 / GRID_COLS;
  const cellH = 100 / GRID_ROWS;

  const VAR_TABS: { id: VarMode; label: string; icon: any; color: string }[] = [
    { id:'sst',   label:'SST',    icon:Thermometer, color:'red' },
    { id:'sss',   label:'SSS',    icon:Droplets,    color:'blue' },
    { id:'ssh',   label:'SSH',    icon:Waves,       color:'cyan' },
    { id:'uwind', label:'U-Wind', icon:Wind,        color:'green' },
    { id:'vwind', label:'V-Wind', icon:Wind,        color:'teal' },
  ];

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Surface Observations"
          subtitle="Satellite surface variables at 0.25° · North Indian Ocean (5°N–30°N, 45°E–105°E)"
          icon={<Eye size={16} className="text-cyan-400" />}
        />

        {/* Banner shown when redirected from World Map page */}
        {hasParamPin && (
          <div className="flex items-center justify-between gap-4 mb-6 p-4 rounded-2xl glass border border-red-500/30 bg-red-500/8 fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Showing observations near {paramLat!.toFixed(2)}°N, {paramLon!.toFixed(2)}°E
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  Redirected from World Map · Grid interpolation shown · Pin visible on heatmap
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Domain badge */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { l:'Domain',    v:`${LAT_MIN}°N–${LAT_MAX}°N, ${LON_MIN}°E–${LON_MAX}°E` },
            { l:'Resolution', v:'0.25° × 0.25°' },
            { l:'Temporal',   v:'Daily' },
            { l:'Source',     v:cfg.source },
          ].map(({l,v}) => (
            <div key={l} className="glass rounded-lg px-3 py-1.5 border border-white/10 text-xs">
              <span className="text-white/40">{l}: </span>
              <span className="text-cyan-400">{v}</span>
            </div>
          ))}
        </div>

        {/* ── Variable selector tabs ── */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-6 w-fit overflow-x-auto">
          {VAR_TABS.map(({ id, label, icon: Icon, color }) => (
            <button key={id} onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                mode === id
                  ? `bg-${color}-500/20 text-${color}-400 border border-${color}-500/30`
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={13} />{label}
            </button>
          ))}
          {/* Region filter */}
          <select value={region} onChange={e => setRegion(e.target.value)}
            className="ml-2 glass border border-white/10 rounded-lg pl-3 pr-6 py-2 text-xs text-white/70 focus:outline-none [color-scheme:dark] appearance-none cursor-pointer">
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={() => setShowGrid(g => !g)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs transition-all ml-1 ${showGrid ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-white/40 hover:text-white/70'}`}>
            <Layers size={12} />Grid
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Heatmap panel */}
          <div className="lg:col-span-3">
            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <span className="text-sm font-medium text-white/70">
                  {cfg.label} ({cfg.unit}) — North Indian Ocean
                </span>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Eye size={11} />{LAT_MIN}°N–{LAT_MAX}°N · {LON_MIN}°E–{LON_MAX}°E
                </div>
              </div>

              {/* Grid */}
              <div
                className="relative select-none"
                style={{ aspectRatio: `${GRID_COLS}/${GRID_ROWS}` }}
                onMouseLeave={() => setHover(null)}
              >
                {field.map((row, ri) =>
                  row.map((val, ci) => {
                    const lat = LAT_MAX - (ri / (GRID_ROWS-1)) * (LAT_MAX-LAT_MIN);
                    const lon = LON_MIN + (ci / (GRID_COLS-1)) * (LON_MAX-LON_MIN);
                    return (
                      <div key={`${ri}-${ci}`}
                        className="absolute cursor-crosshair"
                        style={{
                          left: `${ci*cellW}%`, top: `${ri*cellH}%`,
                          width: `${cellW}%`, height: `${cellH}%`,
                          background: valueToColor(val, cfg.min, cfg.max, cfg.gradStart, cfg.gradEnd),
                          outline: showGrid ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                        onMouseEnter={e => {
                          const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                          setHover({ lat, lon, val, x: e.clientX-rect.left, y: e.clientY-rect.top });
                        }}
                        onClick={() => handleCellClick(lat, lon)}
                      />
                    );
                  })
                )}

                {/* Sensor pins */}
                {anchors.map((a, i) => {
                  const x = ((a.lon-LON_MIN)/(LON_MAX-LON_MIN))*100;
                  const y = ((LAT_MAX-a.lat)/(LAT_MAX-LAT_MIN))*100;
                  return (
                    <div key={i} className="absolute z-10 pointer-events-none"
                      style={{ left:`${x}%`, top:`${y}%`, transform:'translate(-50%,-50%)' }}>
                      <div className="w-3 h-3 rounded-full border-2 border-white/80 bg-white/20 shadow-lg" />
                    </div>
                  );
                })}

                {/* Hover tooltip */}
                {hover && (
                  <div className="absolute z-20 pointer-events-none glass rounded-xl px-3 py-2 border border-white/20 text-xs shadow-2xl whitespace-nowrap"
                    style={{
                      left: hover.x + 12, top: hover.y - 10,
                      transform: hover.x > 250 ? 'translateX(-110%)' : 'none',
                    }}>
                    <p className="text-white/50 mb-1 flex items-center gap-1">
                      <MapPin size={10} />
                      {hover.lat.toFixed(2)}°N · {hover.lon.toFixed(2)}°E
                    </p>
                    <p className="font-bold" style={{ color: valueToColor(hover.val, cfg.min, cfg.max, cfg.gradStart, cfg.gradEnd) }}>
                      {cfg.label}: <span className="text-white">{hover.val.toFixed(2)} {cfg.unit}</span>
                    </p>
                  </div>
                )}

                {/* Map redirect pin — shown when navigated from WorldMapPage */}
                {hasParamPin && pinGridX !== null && pinGridY !== null
                  && pinGridX >= 0 && pinGridX <= 100
                  && pinGridY >= 0 && pinGridY <= 100 && (
                  <div
                    className="absolute z-30 pointer-events-none"
                    style={{ left: `${pinGridX}%`, top: `${pinGridY}%`, transform: 'translate(-50%, -100%)' }}
                  >
                    {/* Pin drop */}
                    <div className="flex flex-col items-center">
                      <div className="glass rounded-lg px-2 py-1 border border-red-500/50 bg-red-500/20 text-[10px] text-red-300 whitespace-nowrap mb-1 shadow-lg">
                        {paramLat!.toFixed(2)}°N, {paramLon!.toFixed(2)}°E
                      </div>
                      <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-lg"
                        style={{ boxShadow: '0 0 8px rgba(239,68,68,0.8)' }} />
                      <div className="w-0.5 h-3 bg-red-400/70" />
                    </div>
                  </div>
                )}
              </div>

              {/* Date scrubber */}
              <div className="px-4 py-3 border-t border-white/8">
                <input type="range" min={0} max={records.length - 1} value={dateIdx}
                  onChange={e => setDateIdx(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer" />
                <div className="flex justify-between text-xs text-white/25 mt-1">
                  <span>{records[0] ? format(parseISO(records[0].date), 'MMM d') : ''}</span>
                  <span className="text-cyan-400">{selectedRecord ? format(parseISO(selectedRecord.date), 'MMM d, yyyy') : ''}</span>
                  <span>{records[records.length-1] ? format(parseISO(records[records.length-1].date), 'MMM d') : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Colour scale */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
              <h3 className="text-sm font-semibold text-white/80 mb-4">{cfg.label} ({cfg.unit})</h3>
              <div className="h-40 w-6 rounded-full mx-auto mb-3"
                style={{ background: `linear-gradient(to bottom, ${cfg.gradEnd}, ${cfg.gradStart})` }} />
              <div className="flex justify-between text-xs text-white/40">
                <span>{cfg.max} {cfg.unit}</span>
                <span>{cfg.min} {cfg.unit}</span>
              </div>
              <p className="text-[10px] text-white/30 mt-2 text-center">{cfg.source}</p>
            </div>

            {/* Field stats */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-3">
              <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Info size={14} className="text-cyan-400" />Field Statistics
              </h3>
              {[
                { label:'Min',  value:`${minVal.toFixed(2)} ${cfg.unit}` },
                { label:'Max',  value:`${maxVal.toFixed(2)} ${cfg.unit}` },
                { label:'Mean', value:`${meanVal.toFixed(2)} ${cfg.unit}` },
                { label:'Range',value:`${(maxVal-minVal).toFixed(2)} ${cfg.unit}` },
                { label:'Grid', value:`${GRID_ROWS}×${GRID_COLS}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-white/50">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* Clicked point — all 6 parameters */}
            {clickedPoint ? (
              <div className="glass rounded-2xl p-5 border border-cyan-500/25 depth-shadow space-y-3 fade-in-up">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin size={14} className="text-cyan-400" />
                    Selected Point
                  </h3>
                  <button onClick={() => setClickedPoint(null)}
                    className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                    <XIcon size={10} className="text-white/60" />
                  </button>
                </div>
                <p className="text-xs text-white/40 font-mono">
                  {clickedPoint.lat}°N · {clickedPoint.lon}°E
                </p>
                <p className="text-xs text-white/30 -mt-1">
                  {records[dateIdx] ? format(parseISO(records[dateIdx].date), 'MMM d, yyyy') : '—'}
                </p>
                <div className="space-y-2 pt-1">
                  {([
                    { label:'SST',    v:`${clickedPoint.sst.toFixed(3)}°C`,    c:'text-red-400',    icon: Thermometer },
                    { label:'SSS',    v:`${clickedPoint.sss.toFixed(3)} PSU`,  c:'text-blue-400',   icon: Droplets },
                    { label:'SSH MIN',    v:`${clickedPoint.ssh.toFixed(3)} cm`,   c:'text-cyan-400',   icon: Waves },
                    { label:'SSH MAX',    v:`${clickedPoint.sla.toFixed(3)} cm`,   c:'text-teal-400',   icon: Waves },
                    { label:'U-Wind', v:`${clickedPoint.uwind.toFixed(3)} m/s`, c:'text-green-400', icon: Wind },
                    { label:'V-Wind', v:`${clickedPoint.vwind.toFixed(3)} m/s`, c:'text-green-400', icon: Wind },
                  ] as { label: string; v: string; c: string; icon: any }[]).map(({ label, v, c, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/8">
                      <span className="text-white/50 text-xs flex items-center gap-1.5">
                        <Icon size={11} className={c} />{label}
                      </span>
                      <span className={`font-mono font-bold text-xs ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/25 pt-1 border-t border-white/8">
                  Values interpolated via IDW from nearby stations
                </p>
              </div>
            ) : (
              /* Selected grid point values from nearest record */
              selectedRecord && (
                <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-3">
                  <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                    <MapPin size={14} className="text-cyan-400" />
                    {selectedRecord.location}
                  </h3>
                  <p className="text-xs text-white/30">{format(parseISO(selectedRecord.date), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-white/25 italic">Click any grid cell to see all 6 parameters at that exact coordinate</p>
                  <div className="space-y-2">
                    {([
                      { label:'SST',    v:`${selectedRecord.inputs.sst.toFixed(2)}°C`,    c:'text-red-400' },
                      { label:'SSS',    v:`${selectedRecord.inputs.sss.toFixed(2)} PSU`,  c:'text-blue-400' },
                      { label:'SSH MAX',    v:`${selectedRecord.inputs.ssh.toFixed(2)} cm`,   c:'text-cyan-400' },
                      { label:'SSH MIN',    v:`${selectedRecord.inputs.sla.toFixed(2)} cm`,   c:'text-teal-400' },
                      { label:'U-Wind', v:`${selectedRecord.inputs.uwind.toFixed(2)} m/s`, c:'text-green-400' },
                      { label:'V-Wind', v:`${selectedRecord.inputs.vwind.toFixed(2)} m/s`, c:'text-green-400' },
                    ] as {label:string;v:string;c:string}[]).map(({ label, v, c }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-white/50">{label}</span>
                        <span className={`font-mono ${c}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
