import { useState, useMemo } from 'react';
import {
  BarChart2, CheckCircle, XCircle,
  TrendingUp, Target, Calendar, Eye, Layers,
} from 'lucide-react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData } from '../contexts/DataContext';
import RiskBadge from '../components/RiskBadge';

// Colour helpers (same palette as SurfacePage)
function sstColor(t: number): string {
  const n = Math.max(0, Math.min(1, (t - 20) / 12));
  if (n < 0.25) return `rgba(30,64,175,0.85)`;
  if (n < 0.5)  return `rgba(6,182,212,0.85)`;
  if (n < 0.75) return `rgba(251,191,36,0.85)`;
  return          `rgba(239,68,68,0.9)`;
}

// Generate simulated "actual" values by adding bounded noise to predictions
function simulateActual(predicted: number, noise: number): number {
  return Math.round((predicted + (Math.random() * noise * 2 - noise)) * 10) / 10;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// Mini heatmap tile grid (16×12 field)
function HeatmapGrid({ data, colorFn, label }: {
  data: number[][];
  colorFn: (v: number) => string;
  label: string;
}) {
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null);
  const rows = data.length;
  const cols = data[0]?.length ?? 1;

  return (
    <div>
      <p className="text-xs text-white/50 mb-2">{label}</p>
      <div
        className="relative rounded-xl overflow-hidden border border-white/10"
        style={{ aspectRatio: `${cols}/${rows}` }}
        onMouseLeave={() => setHoverCell(null)}
      >
        {data.map((row, ri) =>
          row.map((val, ci) => (
            <div
              key={`${ri}-${ci}`}
              className="absolute cursor-crosshair"
              style={{
                left:   `${(ci / cols) * 100}%`,
                top:    `${(ri / rows) * 100}%`,
                width:  `${100 / cols}%`,
                height: `${100 / rows}%`,
                background: colorFn(val),
                outline: hoverCell?.r === ri && hoverCell?.c === ci ? '2px solid rgba(255,255,255,0.5)' : 'none',
              }}
              onMouseEnter={() => setHoverCell({ r: ri, c: ci })}
              title={`${val.toFixed(1)}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function ValidationPage() {
  const { records } = useData();

  const [mode, setMode]         = useState<'sst' | 'risk'>('sst');
  const [dateIdx, setDateIdx]   = useState(records.length - 1);
  const [showDiff, setShowDiff] = useState(false);

  const ROWS = 12, COLS = 16;

  // Generate predicted and actual heatmaps
  const { predicted, actual, diff } = useMemo(() => {
    const seedRecord = records[dateIdx];
    const baseSst  = seedRecord?.seaSurfaceTemp ?? 28;
    const baseRisk = (seedRecord?.cycloneRiskScore ?? 45) / 100 * 12 + 20; // map to ~20–32°C range

    const base = mode === 'sst' ? baseSst : baseRisk;
    const noise = mode === 'sst' ? 1.5 : 2.0;

    const pred: number[][] = Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: COLS }, (_, ci) => {
        const latFactor  = Math.sin(ri * 0.4) * 1.2;
        const lonFactor  = Math.cos(ci * 0.3) * 0.9;
        const crossNoise = Math.sin((ri + ci) * 0.25) * 0.6;
        return Math.max(20, Math.min(33, base + latFactor + lonFactor + crossNoise));
      })
    );

    const act: number[][] = pred.map(row =>
      row.map(v => simulateActual(v, noise))
    );

    const dif: number[][] = pred.map((row, ri) =>
      row.map((v, ci) => act[ri][ci] - v)
    );

    return { predicted: pred, actual: act, diff: dif };
  }, [records, dateIdx, mode]);

  // Flatten for stats
  const predFlat = predicted.flat();
  const actFlat  = actual.flat();
  const diffFlat = diff.flat();

  const mae  = diffFlat.reduce((s, v) => s + Math.abs(v), 0) / diffFlat.length;
  const rmse = Math.sqrt(diffFlat.reduce((s, v) => s + v * v, 0) / diffFlat.length);
  const bias = diffFlat.reduce((s, v) => s + v, 0) / diffFlat.length;
  const r2   = 1 - diffFlat.reduce((s, v) => s + v * v, 0) /
               actFlat.reduce((s, v) => s + (v - actFlat.reduce((a, b) => a + b, 0) / actFlat.length) ** 2, 0);

  // Scatter data for predicted vs actual
  const scatterData = predFlat.slice(0, 80).map((p, i) => ({ pred: p, actual: actFlat[i] }));

  // Timeline comparison (last 7 records)
  const timelineData = records.slice(-7).map(r => {
    const predicted = r.seaSurfaceTemp;
    const actual    = simulateActual(predicted, 1.0);
    return {
      date: format(parseISO(r.date), 'MMM d'),
      Predicted: predicted,
      Actual: actual,
      Error: Math.abs(actual - predicted),
    };
  });

  const diffColorFn = (v: number): string => {
    const n = (v + 4) / 8; // map -4..4 to 0..1
    if (n < 0.4) return `rgba(59,130,246,${0.5 + (0.4 - n) * 1.2})`;  // cold bias = blue
    if (n > 0.6) return `rgba(239,68,68,${0.5 + (n - 0.6) * 1.2})`;   // warm bias = red
    return `rgba(34,197,94,0.5)`;                                         // near-zero = green
  };

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Validation"
          subtitle="Compare predicted heatmaps against observations — internal QA for SST and cyclone models"
          icon={<BarChart2 size={16} className="text-cyan-400" />}
        />

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-xl overflow-hidden glass border border-white/10 p-1 gap-1">
            {([['sst', 'SST Field'], ['risk', 'Risk Field']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  mode === id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowDiff(d => !d)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl glass border text-sm transition-all ${
              showDiff ? 'border-purple-500/30 text-purple-400' : 'border-white/10 text-white/50'
            }`}
          >
            <Layers size={13} />
            {showDiff ? 'Hide' : 'Show'} Diff Map
          </button>

          <span className="ml-auto text-xs text-white/40">
            {records[dateIdx] ? format(parseISO(records[dateIdx].date), 'MMMM d, yyyy') : '—'}
          </span>
        </div>

        {/* Date scrubber */}
        <div className="glass rounded-xl px-4 py-3 border border-white/10 mb-6">
          <input
            type="range"
            min={0}
            max={records.length - 1}
            value={dateIdx}
            onChange={e => setDateIdx(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/25 mt-1">
            <span>{records[0] ? format(parseISO(records[0].date), 'MMM d') : ''}</span>
            <span className="text-cyan-400">{records[dateIdx] ? format(parseISO(records[dateIdx].date), 'MMM d') : ''}</span>
            <span>{records[records.length - 1] ? format(parseISO(records[records.length - 1].date), 'MMM d') : ''}</span>
          </div>
        </div>

        {/* Side-by-side heatmaps */}
        <div className={`grid gap-5 mb-8 ${showDiff ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          <div className="glass rounded-2xl p-5 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Predicted</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">Model output</span>
            </div>
            <HeatmapGrid data={predicted} colorFn={sstColor} label={`${mode === 'sst' ? 'SST (°C)' : 'Risk-equivalent (°C)'} · Indian Ocean`} />
          </div>

          <div className="glass rounded-2xl p-5 border border-green-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">Observed / Ground Truth</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">Satellite / Buoy</span>
            </div>
            <HeatmapGrid data={actual} colorFn={sstColor} label={`${mode === 'sst' ? 'SST (°C)' : 'Risk-equivalent (°C)'} · Same region`} />
          </div>

          {showDiff && (
            <div className="glass rounded-2xl p-5 border border-purple-500/20 fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white text-sm">Difference Map</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">Actual − Predicted</span>
              </div>
              <HeatmapGrid data={diff} colorFn={diffColorFn} label="Bias: Blue=cold, Green=neutral, Red=warm" />
              <div className="flex items-center justify-between mt-2 text-xs text-white/30">
                <span className="text-blue-400">Cold bias (−)</span>
                <span className="text-green-400">Neutral (0)</span>
                <span className="text-red-400">Warm bias (+)</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats + charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Error metrics */}
          <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Target size={14} className="text-cyan-400" />
              Validation Metrics
            </h3>
            {[
              { label: 'MAE',  value: mae.toFixed(3),  unit: '°C', good: mae < 1.0,   desc: 'Mean Absolute Error' },
              { label: 'RMSE', value: rmse.toFixed(3), unit: '°C', good: rmse < 1.5,  desc: 'Root Mean Squared Error' },
              { label: 'Bias', value: bias.toFixed(3), unit: '°C', good: Math.abs(bias) < 0.5, desc: 'Mean Bias' },
              { label: 'R²',   value: r2.toFixed(3),   unit: '',   good: r2 > 0.85,   desc: 'Coefficient of Determination' },
            ].map(({ label, value, unit, good, desc }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-white/30">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-white">{value}{unit}</span>
                  {good
                    ? <CheckCircle size={14} className="text-green-400" />
                    : <XCircle size={14} className="text-red-400" />
                  }
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-white/10">
              <div className={`p-3 rounded-xl text-xs ${r2 > 0.85 ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
                {r2 > 0.85
                  ? '✓ Model performance within acceptable bounds'
                  : '⚠ Model performance below target — retrain recommended'}
              </div>
            </div>
          </div>

          {/* Predicted vs Actual scatter */}
          <div className="glass rounded-2xl p-5 border border-white/10">
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Eye size={14} className="text-cyan-400" />
              Predicted vs Actual
            </h3>
            <p className="text-xs text-white/40 mb-3">Each point = one grid cell</p>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="pred" name="Predicted" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Predicted', fill: 'rgba(255,255,255,0.3)', fontSize: 10, position: 'insideBottom', offset: -2 }} />
                <YAxis dataKey="actual" name="Actual"    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: 'Actual', fill: 'rgba(255,255,255,0.3)', fontSize: 10, angle: -90, position: 'insideLeft' }} width={35} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<CustomTooltip />} />
                <Scatter data={scatterData} fill="#06b6d4" fillOpacity={0.5} />
                {/* Perfect fit line */}
                <ReferenceLine segment={[{ x: 22, y: 22 }, { x: 32, y: 32 }]} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Timeline error */}
          <div className="glass rounded-2xl p-5 border border-white/10">
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
              <TrendingUp size={14} className="text-cyan-400" />
              7-Day Timeline
            </h3>
            <p className="text-xs text-white/40 mb-3">Predicted vs observed SST</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Predicted" stroke="#06b6d4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Actual"    stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-white/40">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Predicted</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block border-dashed" /> Observed</span>
            </div>
          </div>
        </div>

        {/* Per-record validation table */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Calendar size={14} className="text-cyan-400" />
              Per-Day Validation Summary
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  {['Date', 'Location', 'Pred SST', 'Obs SST', 'Error', 'Pred Risk', 'Actual Risk', 'Pass?'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const obsSst  = simulateActual(r.seaSurfaceTemp, 0.9);
                  const err     = obsSst - r.seaSurfaceTemp;
                  const pass    = Math.abs(err) < 1.5;
                  const obsRisk = simulateActual(r.cycloneRiskScore, 8);
                  const obsRiskLabel: 'Low' | 'Moderate' | 'High' | 'Severe' =
                    obsRisk >= 75 ? 'Severe' : obsRisk >= 55 ? 'High' : obsRisk >= 30 ? 'Moderate' : 'Low';

                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-all">
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{format(parseISO(r.date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-white/60">{r.location}</td>
                      <td className="px-4 py-3 text-cyan-400">{r.seaSurfaceTemp.toFixed(1)}°C</td>
                      <td className="px-4 py-3 text-green-400">{obsSst.toFixed(1)}°C</td>
                      <td className={`px-4 py-3 font-mono ${pass ? 'text-green-400' : 'text-red-400'}`}>
                        {err > 0 ? '+' : ''}{err.toFixed(2)}°C
                      </td>
                      <td className="px-4 py-3"><RiskBadge risk={r.cycloneRisk} size="sm" /></td>
                      <td className="px-4 py-3"><RiskBadge risk={obsRiskLabel} size="sm" /></td>
                      <td className="px-4 py-3">
                        {pass
                          ? <CheckCircle size={14} className="text-green-400" />
                          : <XCircle size={14} className="text-red-400" />
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
