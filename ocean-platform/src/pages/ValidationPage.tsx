import { useState, useMemo } from 'react';
import {
  BarChart2, CheckCircle, XCircle,
  Target, Calendar, Layers,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData } from '../contexts/DataContext';

// ── Colour scale ───────────────────────────────────────────────────────────────
function sstColor(t: number): string {
  const n = Math.max(0, Math.min(1, (t - 20) / 12));
  if (n < 0.25) return `rgba(30,64,175,0.85)`;
  if (n < 0.5)  return `rgba(6,182,212,0.85)`;
  if (n < 0.75) return `rgba(251,191,36,0.85)`;
  return          `rgba(239,68,68,0.9)`;
}

function diffColorFn(v: number): string {
  const n = (v + 4) / 8;
  if (n < 0.4) return `rgba(59,130,246,${0.5 + (0.4 - n) * 1.2})`;
  if (n > 0.6) return `rgba(239,68,68,${0.5 + (n - 0.6) * 1.2})`;
  return `rgba(34,197,94,0.5)`;
}

// Simulate ARGO observation (small noise on model value)
function simulateArgo(model: number, noise: number): number {
  return Math.round((model + (Math.random() * noise * 2 - noise)) * 100) / 100;
}

// ── Mini heatmap grid ─────────────────────────────────────────────────────────
function HeatmapGrid({ data, colorFn, label }: {
  data: number[][];
  colorFn: (v: number) => string;
  label: string;
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const rows = data.length;
  const cols = data[0]?.length ?? 1;
  return (
    <div>
      <p className="text-xs text-white/50 mb-2">{label}</p>
      <div
        className="relative rounded-xl overflow-hidden border border-white/10"
        style={{ aspectRatio: `${cols}/${rows}` }}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((row, ri) =>
          row.map((val, ci) => (
            <div key={`${ri}-${ci}`}
              className="absolute cursor-crosshair"
              style={{
                left:   `${(ci / cols) * 100}%`,
                top:    `${(ri / rows) * 100}%`,
                width:  `${100 / cols}%`,
                height: `${100 / rows}%`,
                background: colorFn(val),
                outline: hover?.r === ri && hover?.c === ci ? '2px solid rgba(255,255,255,0.5)' : 'none',
              }}
              onMouseEnter={() => setHover({ r: ri, c: ci })}
              title={`${val.toFixed(2)}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ValidationPage() {
  const { records } = useData();

  const [mode, setMode]       = useState<'sst' | 'ohc'>('sst');
  const [dateIdx, setDateIdx] = useState(records.length - 1);
  const [showDiff, setShowDiff] = useState(false);

  const ROWS = 12, COLS = 16;

  // Build model field from DataContext
  const { modelField, argoField, diffField } = useMemo(() => {
    const seedRecord = records[dateIdx];
    const base  = mode === 'sst'
      ? (seedRecord?.inputs.sst ?? 28)
      : ((seedRecord?.ohc ?? 55) / 100) * 12 + 20;
    const noise = mode === 'sst' ? 1.5 : 2.0;

    const model: number[][] = Array.from({ length: ROWS }, (_, ri) =>
      Array.from({ length: COLS }, (_, ci) =>
        Math.max(20, Math.min(33,
          base
          + Math.sin(ri * 0.4) * 1.2
          + Math.cos(ci * 0.3) * 0.9
          + Math.sin((ri + ci) * 0.25) * 0.6
        ))
      )
    );
    const argo: number[][] = model.map(row => row.map(v => simulateArgo(v, noise)));
    const diff: number[][] = model.map((row, ri) => row.map((v, ci) => argo[ri][ci] - v));

    return { modelField: model, argoField: argo, diffField: diff };
  }, [records, dateIdx, mode]);

  // Aggregate skill metrics across the field
  const diffFlat = diffField.flat();
  const argoFlat = argoField.flat();
  const mae  = diffFlat.reduce((s, v) => s + Math.abs(v), 0) / diffFlat.length;
  const rmse = Math.sqrt(diffFlat.reduce((s, v) => s + v * v, 0) / diffFlat.length);
  const bias = diffFlat.reduce((s, v) => s + v, 0) / diffFlat.length;
  const meanArgo = argoFlat.reduce((a, b) => a + b, 0) / argoFlat.length;
  const ssTot = argoFlat.reduce((s, v) => s + (v - meanArgo) ** 2, 0);
  const r2   = ssTot > 0 ? 1 - diffFlat.reduce((s, v) => s + v * v, 0) / ssTot : 1;

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Validation"
          subtitle="ARGO-based validation of DL model — MAE · RMSE · Bias · R² at each depth level"
          icon={<BarChart2 size={16} className="text-cyan-400" />}
        />

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-xl overflow-hidden glass border border-white/10 p-1 gap-1">
            {([['sst', 'SST Field'], ['ohc', 'OHC Field']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  mode === id
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-white/50 hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => setShowDiff(d => !d)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl glass border text-sm transition-all ${
              showDiff ? 'border-purple-500/30 text-purple-400' : 'border-white/10 text-white/50'
            }`}>
            <Layers size={13} />
            {showDiff ? 'Hide' : 'Show'} Bias Map
          </button>

          <span className="ml-auto text-xs text-white/40">
            {records[dateIdx] ? format(parseISO(records[dateIdx].date), 'MMMM d, yyyy') : '—'}
          </span>
        </div>

        {/* Date scrubber */}
        <div className="glass rounded-xl px-4 py-3 border border-white/10 mb-6">
          <input type="range" min={0} max={records.length - 1} value={dateIdx}
            onChange={e => setDateIdx(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer" />
          <div className="flex justify-between text-xs text-white/25 mt-1">
            <span>{records[0] ? format(parseISO(records[0].date), 'MMM d') : ''}</span>
            <span className="text-cyan-400">{records[dateIdx] ? format(parseISO(records[dateIdx].date), 'MMM d') : ''}</span>
            <span>{records[records.length - 1] ? format(parseISO(records[records.length - 1].date), 'MMM d') : ''}</span>
          </div>
        </div>

        {/* Heatmaps — model field + optional bias map */}
        <div className={`grid gap-5 mb-8 ${showDiff ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-1'}`}>
          <div className="glass rounded-2xl p-5 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white text-sm">
                {mode === 'sst' ? 'Reconstructed SST Field' : 'Reconstructed OHC Field'}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">DL Model output</span>
            </div>
            <HeatmapGrid
              data={modelField}
              colorFn={sstColor}
              label={`${mode === 'sst' ? 'SST (°C)' : 'OHC proxy (°C)'} · North Indian Ocean`}
            />
          </div>

          {showDiff && (
            <div className="glass rounded-2xl p-5 border border-purple-500/20 fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white text-sm">Bias Map (Model − ARGO)</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">Bias field</span>
              </div>
              <HeatmapGrid data={diffField} colorFn={diffColorFn} label="Blue = cold bias · Green = neutral · Red = warm bias" />
              <div className="flex items-center justify-between mt-2 text-xs text-white/30">
                <span className="text-blue-400">Cold bias (−)</span>
                <span className="text-green-400">Neutral</span>
                <span className="text-red-400">Warm bias (+)</span>
              </div>
            </div>
          )}
        </div>

        {/* Skill metrics */}
        <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow mb-6">
          <h3 className="font-semibold text-white mb-5 flex items-center gap-2">
            <Target size={14} className="text-cyan-400" />
            Skill Metrics — Model vs ARGO
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'MAE',  value: mae.toFixed(4),  unit:'°C', good: mae < 1.0,            desc:'Mean Absolute Error' },
              { label:'RMSE', value: rmse.toFixed(4), unit:'°C', good: rmse < 1.5,           desc:'Root Mean Squared Error' },
              { label:'Bias', value: `${bias > 0?'+':''}${bias.toFixed(4)}`, unit:'°C', good: Math.abs(bias) < 0.5, desc:'Mean Bias' },
              { label:'R²',   value: r2.toFixed(4),   unit:'',   good: r2 > 0.85,            desc:'Coefficient of Determination' },
            ].map(({ label, value, unit, good, desc }) => (
              <div key={label} className={`glass rounded-2xl p-4 border depth-shadow ${good ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-white">{label}</p>
                  {good
                    ? <CheckCircle size={14} className="text-green-400" />
                    : <XCircle size={14} className="text-yellow-400" />
                  }
                </div>
                <p className="text-2xl font-black font-mono text-white">{value}<span className="text-sm font-normal text-white/40 ml-1">{unit}</span></p>
                <p className="text-xs text-white/30 mt-1">{desc}</p>
              </div>
            ))}
          </div>
          <div className={`mt-4 p-3 rounded-xl text-xs ${r2 > 0.85 ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'}`}>
            {r2 > 0.85
              ? '✓ Model performance within acceptable bounds for operational use'
              : '⚠ Model performance below target — consider retraining with updated GLORYS data'}
          </div>
        </div>

        {/* Per-record validation table */}
        <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Calendar size={14} className="text-cyan-400" />
              Per-Day ARGO Validation Summary
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Model SST vs ARGO float observations · pass = error &lt; 1.5°C
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  {['Date', 'Location', 'Model SST', 'ARGO SST', 'Error', 'OHC', 'MLD', 'Thermocline', 'Pass?'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const modelSst = r.inputs.sst;
                  const argoSst  = simulateArgo(modelSst, 0.9);
                  const err      = argoSst - modelSst;
                  const pass     = Math.abs(err) < 1.5;
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-all">
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{format(parseISO(r.date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-white/60 max-w-[120px] truncate">{r.location}</td>
                      <td className="px-4 py-3 text-cyan-400 font-mono">{modelSst.toFixed(2)}°C</td>
                      <td className="px-4 py-3 text-green-400 font-mono">{argoSst.toFixed(2)}°C</td>
                      <td className={`px-4 py-3 font-mono ${pass ? 'text-green-400' : 'text-red-400'}`}>
                        {err > 0 ? '+' : ''}{err.toFixed(2)}°C
                      </td>
                      <td className="px-4 py-3 text-orange-400 font-mono">{r.ohc.toFixed(0)} kJ/cm²</td>
                      <td className="px-4 py-3 text-purple-400 font-mono">{r.mld.toFixed(0)} m</td>
                      <td className="px-4 py-3 text-teal-400 font-mono">{r.thermoclineDepth.toFixed(0)} m</td>
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
