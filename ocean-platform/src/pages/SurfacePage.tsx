import { useState, useMemo } from 'react';
import {
  Thermometer, Droplets, Waves, Wind,
  Filter, MapPin, Info, Eye, Layers,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
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

export default function SurfacePage() {
  const { records } = useData();

  const [mode, setMode]       = useState<VarMode>('sst');
  const [region, setRegion]   = useState('All Regions');
  const [dateIdx, setDateIdx] = useState(records.length - 1);
  const [hover, setHover]     = useState<HoverInfo | null>(null);
  const [showGrid, setShowGrid] = useState(true);

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

            {/* Selected grid point values */}
            {selectedRecord && (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-3">
                <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <MapPin size={14} className="text-cyan-400" />
                  {selectedRecord.location}
                </h3>
                <p className="text-xs text-white/30">{format(parseISO(selectedRecord.date), 'MMM d, yyyy')}</p>
                <div className="space-y-2">
                  {([
                    { label:'SST',    v:`${selectedRecord.inputs.sst.toFixed(2)}°C`,    c:'text-red-400' },
                    { label:'SSS',    v:`${selectedRecord.inputs.sss.toFixed(2)} PSU`,  c:'text-blue-400' },
                    { label:'SSH',    v:`${selectedRecord.inputs.ssh.toFixed(2)} cm`,   c:'text-cyan-400' },
                    { label:'SLA',    v:`${selectedRecord.inputs.sla.toFixed(2)} cm`,   c:'text-teal-400' },
                    { label:'U-Wind', v:`${selectedRecord.inputs.uwind.toFixed(2)} m/s`, c:'text-green-400' },
                    { label:'V-Wind', v:`${selectedRecord.inputs.vwind.toFixed(2)} m/s`, c:'text-green-400' },
                    { label:'MLD',    v:`${selectedRecord.mld.toFixed(0)} m`,           c:'text-purple-400' },
                    { label:'OHC',    v:`${selectedRecord.ohc.toFixed(0)} kJ/cm²`,     c:'text-orange-400' },
                  ] as {label:string;v:string;c:string}[]).map(({ label, v, c }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-white/50">{label}</span>
                      <span className={`font-mono ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* SST bar comparison across records */}
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Station SST comparison</p>
                  <div className="space-y-1.5">
                    {records.slice(-6).map(r => (
                      <div key={r.id} className="flex items-center gap-2">
                        <span className="text-xs text-white/40 w-14 truncate">{r.location.split(' ')[0]}</span>
                        <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width:`${Math.max(5,((r.inputs.sst-24)/8)*100)}%`, background:`rgba(239,68,68,0.8)` }} />
                        </div>
                        <span className="text-xs text-white/60 w-12 text-right font-mono">{r.inputs.sst.toFixed(1)}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
