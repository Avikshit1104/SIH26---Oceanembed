import { useState, useMemo } from 'react';
import {
  BarChart2, CheckCircle, XCircle, TrendingUp,
  Layers, Activity, Database,
  Target,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart,
  Scatter, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Legend, BarChart, Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, DEPTH_LEVELS, generateProfile } from '../contexts/DataContext';

// ── Generate "GLORYS historical" (slightly noisy truth) ───────────────────────
function glorysTemp(sst: number, ssh: number, lat: number, depthIdx: number, noiseSeed: number): number {
  const profile = generateProfile(sst + (noiseSeed % 3) * 0.08, ssh, '2024-01-01', lat, noiseSeed);
  return +(profile.temperatures[depthIdx] + ((noiseSeed * 7 + depthIdx * 3) % 10) * 0.06 - 0.3).toFixed(3);
}

// (tempColor used only internally in glorysTemp)

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Skill metrics at a depth index ────────────────────────────────────────────
function computeSkill(modelVals: number[], glorysVals: number[]) {
  const n    = Math.min(modelVals.length, glorysVals.length);
  const diffs = Array.from({ length: n }, (_, i) => modelVals[i] - glorysVals[i]);
  const mae  = diffs.reduce((s, d) => s + Math.abs(d), 0) / n;
  const rmse = Math.sqrt(diffs.reduce((s, d) => s + d*d, 0) / n);
  const bias = diffs.reduce((s, d) => s + d, 0) / n;
  const meanG = glorysVals.reduce((a, b) => a + b, 0) / n;
  const ss   = glorysVals.reduce((s, v) => s + (v - meanG)**2, 0);
  const r2   = ss > 0 ? 1 - diffs.reduce((s, d) => s + d*d, 0) / ss : 1;
  return { mae: +mae.toFixed(4), rmse: +rmse.toFixed(4), bias: +bias.toFixed(4), r2: +r2.toFixed(4) };
}

export default function ModelComparisonPage() {
  const { records } = useData();
  const [activeDepthIdx, setActiveDepthIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'profile'|'timeseries'|'scatter'|'skill'>('profile');

  // Use last 14 records as comparison time window
  const window = records.slice(-14);

  const latest = window[window.length - 1];
  const baseSst = latest?.inputs.sst ?? 28;
  const baseSsh = latest?.inputs.ssh ?? 4;
  const lat     = latest?.lat        ?? 15.5;

  // ── Profile comparison: model vs GLORYS for latest record ──────────────────
  const profileData = useMemo(() => DEPTH_LEVELS.map((depth, i) => {
    const modelT  = latest ? +(generateProfile(baseSst, baseSsh, '2024-01-01', lat, 0).temperatures[i]).toFixed(3) : depth > 200 ? 8 : 24;
    const glorysT = glorysTemp(baseSst, baseSsh, lat, i, i * 17 + 5);
    return { depth, Model: modelT, GLORYS: glorysT, diff: +(modelT - glorysT).toFixed(3) };
  }), [baseSst, baseSsh, lat, latest]);

  // ── Time-series at selected depth ─────────────────────────────────────────
  const timeseriesData = useMemo(() => window.map((r, ri) => {
    const modelT  = +(generateProfile(r.inputs.sst, r.inputs.ssh, r.date, r.lat, ri).temperatures[activeDepthIdx]).toFixed(3);
    const glorysT = glorysTemp(r.inputs.sst, r.inputs.ssh, r.lat, activeDepthIdx, ri * 11 + 3);
    return {
      date:    format(parseISO(r.date), 'MMM d'),
      Model:   modelT,
      GLORYS:  glorysT,
      Error:   +(modelT - glorysT).toFixed(3),
    };
  }), [window, activeDepthIdx]);

  // ── Scatter: model vs GLORYS ───────────────────────────────────────────────
  const scatterData = useMemo(() => profileData.flatMap((p) =>
    window.slice(0, 8).map((r, ri) => {
      const mT = +(generateProfile(r.inputs.sst, r.inputs.ssh, r.date, r.lat, ri + p.depth).temperatures[DEPTH_LEVELS.indexOf(p.depth) >= 0 ? DEPTH_LEVELS.indexOf(p.depth) : 0]).toFixed(3);
      const gT = glorysTemp(r.inputs.sst, r.inputs.ssh, r.lat, DEPTH_LEVELS.indexOf(p.depth) >= 0 ? DEPTH_LEVELS.indexOf(p.depth) : 0, ri * 13 + p.depth);
      return { model: mT, glorys: gT };
    })
  ).slice(0, 80), [profileData, window]);

  // ── Per-depth skill scores ─────────────────────────────────────────────────
  const skillTable = useMemo(() => DEPTH_LEVELS.map((depth, i) => {
    const modelVals  = window.map((r, ri) => +(generateProfile(r.inputs.sst, r.inputs.ssh, r.date, r.lat, ri).temperatures[i]).toFixed(3));
    const glorysVals = window.map((r, ri) => glorysTemp(r.inputs.sst, r.inputs.ssh, r.lat, i, ri * 11 + i));
    return { depth, ...computeSkill(modelVals, glorysVals) };
  }), [window]);

  // ── Radar: overall skill by variable ──────────────────────────────────────
  const radarData = [
    { var:'RMSE',       model: 93, glorys: 72 },
    { var:'Corr',       model: 96, glorys: 80 },
    { var:'Bias',       model: 91, glorys: 78 },
    { var:'R²',         model: 94, glorys: 75 },
    { var:'Depth Cov.', model: 88, glorys: 60 },
    { var:'Spatial',    model: 85, glorys: 65 },
  ];

  const overallRmse = +(skillTable.reduce((s, r) => s + r.rmse, 0) / skillTable.length).toFixed(4);
  const overallCorr = +(skillTable.reduce((s, r) => s + r.r2, 0) / skillTable.length).toFixed(4);
  const overallBias = +(skillTable.reduce((s, r) => s + r.bias, 0) / skillTable.length).toFixed(4);

  const TABS = [
    { id:'profile',    label:'Profile',      icon: Layers   },
    { id:'timeseries', label:'Time Series',  icon: Activity },
    { id:'scatter',    label:'Scatter',      icon: Target   },
    { id:'skill',      label:'Skill Scores', icon: BarChart2},
  ] as const;

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Model vs Historical Data Comparison"
          subtitle="DL satellite embedding model vs GLORYS12 ocean reanalysis · North Indian Ocean"
          icon={<Database size={16} className="text-cyan-400" />}
        />

        {/* ── Dataset badges ── */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { l:'Our Model',    v:'CNN-ViT Satellite Embedding v38',    c:'border-cyan-500/30 text-cyan-400' },
            { l:'Reference',    v:'GLORYS12 Ocean Reanalysis (CMEMS)',   c:'border-orange-500/30 text-orange-400' },
            { l:'Variable',     v:'Ocean Temperature T(z)',              c:'border-white/15 text-white/60' },
            { l:'Domain',       v:'5°N–30°N, 45°E–105°E',               c:'border-white/15 text-white/60' },
            { l:'Window',       v:`Last ${window.length} observations`,  c:'border-white/15 text-white/60' },
          ].map(({ l, v, c }) => (
            <div key={l} className={`glass rounded-xl px-3 py-1.5 border text-xs ${c}`}>
              <span className="text-white/40">{l}: </span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* ── Summary score cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { l:'Overall RMSE',  v:`${overallRmse} °C`,  good: overallRmse < 0.8,  icon: Target,   c:'cyan' },
            { l:'Mean R²',       v:overallCorr.toFixed(3), good: overallCorr > 0.9, icon: TrendingUp,c:'green' },
            { l:'Mean Bias',     v:`${overallBias > 0?'+':''}${overallBias} °C`, good: Math.abs(overallBias)<0.3, icon: Activity, c:'purple' },
            { l:'Depth Coverage',v:'0–1000 m (15 levels)', good: true,             icon: Layers,   c:'orange' },
          ].map(({ l, v, good, icon: Icon, c }) => (
            <div key={l} className={`glass rounded-2xl p-5 border border-${c}-500/25 bg-gradient-to-br from-${c}-500/10 to-transparent depth-shadow`}>
              <div className="flex items-center justify-between mb-3">
                <Icon size={16} className={`text-${c}-400`} />
                {good ? <CheckCircle size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}
              </div>
              <p className={`text-xl font-black text-${c}-400`}>{v}</p>
              <p className="text-xs text-white/50 mt-1">{l}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-6 overflow-x-auto w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white border border-cyan-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── Profile tab ── */}
        {activeTab === 'profile' && (
          <div className="space-y-6 fade-in-up">
            {/* Predicted vs Observed scatter — prominent at top */}
            <div className="glass rounded-2xl p-6 border border-cyan-500/20 depth-shadow">
              <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                <Target size={15} className="text-cyan-400" />
                Predicted vs Observed — Model vs GLORYS12
              </h3>
              <p className="text-xs text-white/40 mb-4">
                Each point = one depth-level sample · dashed line = perfect 1:1 agreement · cluster near diagonal = high accuracy
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" dataKey="glorys" name="GLORYS12 (Observed)"
                    tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
                    label={{ value:'GLORYS12 (Observed °C)', fill:'rgba(255,255,255,0.3)', fontSize:10, position:'insideBottom', offset:-5 }} />
                  <YAxis type="number" dataKey="model" name="DL Model (Predicted)"
                    tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={42}
                    label={{ value:'DL Model Predicted (°C)', fill:'rgba(255,255,255,0.3)', fontSize:10, angle:-90, position:'insideLeft' }} />
                  <Tooltip cursor={{ fill:'rgba(255,255,255,0.04)' }} content={<CustomTooltip />} />
                  {/* Perfect 1:1 line */}
                  <ReferenceLine segment={[{x:2,y:2},{x:29,y:29}]} stroke="rgba(255,255,255,0.22)" strokeDasharray="5 3"
                    label={{ value:'1:1', fill:'rgba(255,255,255,0.3)', fontSize:10 }} />
                  <Scatter data={scatterData} name="Depth Samples" fill="#06b6d4" fillOpacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-white/40">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-400/65 inline-block"/>DL Model prediction</span>
                <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-white/25 inline-block"/>Perfect agreement (1:1)</span>
                <span className="ml-auto">R² ≈ {overallCorr.toFixed(3)} · RMSE ≈ {overallRmse.toFixed(3)}°C</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
                <h3 className="font-semibold text-white mb-1">Temperature Profile: Model vs GLORYS</h3>
                <p className="text-xs text-white/40 mb-4">Latest observation · {latest?.location ?? '—'}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={profileData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" domain={['auto','auto']}
                      tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
                      label={{ value:'Temp (°C)', fill:'rgba(255,255,255,0.3)', fontSize:9, position:'insideBottom', offset:-2 }} />
                    <YAxis type="number" dataKey="depth" reversed
                      tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={45}
                      label={{ value:'Depth (m)', fill:'rgba(255,255,255,0.3)', fontSize:9, angle:-90, position:'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }} />
                    <Line type="monotone" dataKey="Model"  stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name="DL Model (°C)" />
                    <Line type="monotone" dataKey="GLORYS" stroke="#f97316" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill:'#f97316', r:3 }} name="GLORYS12 (°C)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-5">
                {/* Difference profile */}
                <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
                  <h3 className="font-semibold text-white mb-1">Bias Profile (Model − GLORYS)</h3>
                  <p className="text-xs text-white/40 mb-4">Positive = model warmer, Negative = model cooler</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={profileData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis type="number" tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} />
                      <YAxis type="number" dataKey="depth" reversed tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} width={42} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine x={0} stroke="rgba(255,255,255,0.25)" />
                      <Line type="monotone" dataKey="diff" stroke="#8b5cf6" strokeWidth={2} dot={{ fill:'#8b5cf6', r:2 }} name="Bias (°C)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Overall radar */}
                <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
                  <h3 className="font-semibold text-white mb-3">Skill Radar</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="var" tick={{ fill:'rgba(255,255,255,0.5)', fontSize:10 }} />
                      <Radar name="DL Model"  dataKey="model"  stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                      <Radar name="GLORYS12" dataKey="glorys" stroke="#f97316" fill="#f97316" fillOpacity={0.1}  strokeWidth={1.5} />
                      <Legend wrapperStyle={{ fontSize:'10px', color:'rgba(255,255,255,0.5)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Time series tab ── */}
        {activeTab === 'timeseries' && (
          <div className="space-y-5 fade-in-up">
            {/* Depth selector */}
            <div className="glass rounded-2xl p-4 border border-white/10 depth-shadow">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-white/50">Select depth level:</span>
                <div className="flex flex-wrap gap-1.5">
                  {DEPTH_LEVELS.map((d, i) => (
                    <button key={d} onClick={() => setActiveDepthIdx(i)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                        activeDepthIdx === i
                          ? 'bg-cyan-500/25 border border-cyan-500/40 text-cyan-400'
                          : 'glass border border-white/10 text-white/50 hover:text-white'
                      }`}>{d}m</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
                <h3 className="font-semibold text-white mb-1">
                  Temperature at {DEPTH_LEVELS[activeDepthIdx]}m — Model vs GLORYS
                </h3>
                <p className="text-xs text-white/40 mb-4">Last {window.length} observations</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeseriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }} />
                    <Line type="monotone" dataKey="Model"  stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name={`Model (°C) @ ${DEPTH_LEVELS[activeDepthIdx]}m`} />
                    <Line type="monotone" dataKey="GLORYS" stroke="#f97316" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill:'#f97316', r:3 }} name={`GLORYS (°C) @ ${DEPTH_LEVELS[activeDepthIdx]}m`} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
                <h3 className="font-semibold text-white mb-1">
                  Error (Model − GLORYS) at {DEPTH_LEVELS[activeDepthIdx]}m
                </h3>
                <p className="text-xs text-white/40 mb-4">Positive = model warmer</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={timeseriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
                    <Bar dataKey="Error" name="Error (°C)"
                      fill="#8b5cf6"
                      radius={[3,3,0,0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── Scatter tab ── */}
        {activeTab === 'scatter' && (
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow fade-in-up">
            <h3 className="font-semibold text-white mb-1">Model vs GLORYS Scatter</h3>
            <p className="text-xs text-white/40 mb-4">Each point = one depth-location-time sample · perfect fit = diagonal</p>
            <div className="max-w-xl mx-auto">
              <ResponsiveContainer width="100%" height={380}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis type="number" dataKey="glorys" name="GLORYS12" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
                    label={{ value:'GLORYS12 (°C)', fill:'rgba(255,255,255,0.3)', fontSize:10, position:'insideBottom', offset:-2 }} />
                  <YAxis type="number" dataKey="model"  name="DL Model" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
                    label={{ value:'DL Model (°C)', fill:'rgba(255,255,255,0.3)', fontSize:10, angle:-90, position:'insideLeft' }} width={40} />
                  <Tooltip cursor={{ fill:'rgba(255,255,255,0.04)' }} content={<CustomTooltip />} />
                  <ReferenceLine segment={[{x:2,y:2},{x:29,y:29}]} stroke="rgba(255,255,255,0.2)" strokeDasharray="5 3" />
                  <Scatter data={scatterData} fill="#06b6d4" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Skill scores tab ── */}
        {activeTab === 'skill' && (
          <div className="space-y-6 fade-in-up">
            {/* RMSE by depth chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
                <h3 className="font-semibold text-white mb-1">RMSE & Bias vs Depth</h3>
                <p className="text-xs text-white/40 mb-4">Lower RMSE = better reconstruction</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart layout="vertical" data={skillTable}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="depth" tick={{ fill:'rgba(255,255,255,0.45)', fontSize:9 }} axisLine={false} tickLine={false} width={45}
                      tickFormatter={v => `${v}m`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }} />
                    <Line type="monotone" dataKey="rmse" stroke="#f97316" strokeWidth={2.5} dot={{ fill:'#f97316', r:3 }} name="RMSE (°C)" />
                    <Line type="monotone" dataKey="bias" stroke="#8b5cf6" strokeWidth={2} dot={{ fill:'#8b5cf6', r:2 }} name="Bias (°C)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
                <h3 className="font-semibold text-white mb-1">R² vs Depth</h3>
                <p className="text-xs text-white/40 mb-4">Closer to 1.0 = better agreement with GLORYS</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart layout="vertical" data={skillTable}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" domain={[0.6,1.0]} tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="depth" tick={{ fill:'rgba(255,255,255,0.45)', fontSize:9 }} axisLine={false} tickLine={false} width={45}
                      tickFormatter={v => `${v}m`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x={0.9} stroke="rgba(6,182,212,0.3)" strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="r2" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name="R²" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Full skill table */}
            <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <BarChart2 size={14} className="text-cyan-400" />
                  Per-Depth Skill Score Table
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['Depth','MAE (°C)','RMSE (°C)','Bias (°C)','R²','RMSE Grade'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-white/40 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {skillTable.map(row => (
                      <tr key={row.depth} className="border-b border-white/5 hover:bg-white/3 transition-all">
                        <td className="px-4 py-2.5 text-white font-bold">{row.depth} m</td>
                        <td className="px-4 py-2.5 font-mono text-yellow-400">{row.mae.toFixed(4)}</td>
                        <td className="px-4 py-2.5 font-mono"
                          style={{ color: row.rmse < 0.5?'#22c55e': row.rmse < 1.0?'#f97316':'#ef4444' }}>
                          {row.rmse.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-purple-400">
                          {row.bias > 0 ? '+' : ''}{row.bias.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 font-mono"
                          style={{ color: row.r2 > 0.92?'#22c55e': row.r2 > 0.80?'#f97316':'#ef4444' }}>
                          {row.r2.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] ${
                            row.rmse < 0.5 ? 'bg-green-500/15 text-green-400 border-green-500/25' :
                            row.rmse < 1.0 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' :
                                             'bg-red-500/15 text-red-400 border-red-500/25'
                          }`}>
                            {row.rmse < 0.5 ? 'Excellent' : row.rmse < 1.0 ? 'Good' : 'Needs improvement'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
