import { useState, useEffect, useRef } from 'react';
import {
  Wind, Activity, Target, Clock, TrendingUp,
  ChevronRight, Database,
  RefreshCw, Shield, Calendar,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  Radar,
} from 'recharts';
import { format, addHours } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData } from '../contexts/DataContext';
import RiskBadge from '../components/RiskBadge';

// ── Mock nightly model inference ───────────────────────────────────────────────
function runInference(sstMean: number, pressureMin: number, windMax: number, riskMean: number) {
  const base = (sstMean - 24) * 8 + (1010 - pressureMin) * 1.5 + windMax * 0.3 + riskMean * 0.4;
  const prob = Math.min(Math.max(base, 5), 95);
  return {
    formationProbability: Math.round(prob),
    predictedIntensity: prob > 70 ? 'Severe Cyclonic Storm' : prob > 50 ? 'Cyclonic Storm' : prob > 30 ? 'Deep Depression' : 'Low Pressure',
    confidence: Math.round(70 + Math.random() * 20),
    trackOrigin: { lat: 13.5, lon: 87.2 },
    landfall: prob > 50 ? 'Andhra Pradesh / Odisha coast' : 'No landfall expected',
    landfallDate: format(addHours(new Date(), 60 + Math.random() * 24), 'MMM d HH:mm') + ' IST',
    features: {
      sst:      Math.round((sstMean - 26) * 10) / 10,
      pressure: Math.round((1008 - pressureMin) * 10) / 10,
      windShear: Math.round(windMax * 0.4 * 10) / 10,
      oceanHeat: Math.round(prob * 0.8 * 10) / 10,
      enso:     -0.3,
    },
  };
}

// Predicted track points
function buildTrack(prob: number) {
  const now = new Date();
  return Array.from({ length: 8 }, (_, i) => ({
    time: format(addHours(now, i * 12), 'MMM d HH:mm'),
    lat:  13.5 + i * 0.9 + Math.sin(i * 0.5) * 0.4,
    lon:  87.2 - i * 1.2 + Math.cos(i * 0.4) * 0.3,
    intensity: Math.max(5, prob - i * (prob > 60 ? 5 : 3) + Math.random() * 8),
    windSpeed: Math.round(30 + prob * 0.8 - i * 4),
    pressure:  Math.round(1000 - prob * 0.2 + i * 1.5),
  }));
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Training log simulator ─────────────────────────────────────────────────────
const TRAINING_LOGS = [
  '[02:00:00] Nightly training job started (cron: 0 2 * * *)',
  '[02:00:12] Loading ERA5 reanalysis data — 40yr dataset',
  '[02:01:45] Loading IMD historical cyclone tracks (1980–2025)',
  '[02:03:22] Feature engineering: SST anomalies, OHC, wind shear',
  '[02:05:01] Training gradient-boosted ensemble — fold 1/5',
  '[02:07:18] Training gradient-boosted ensemble — fold 2/5',
  '[02:09:44] Training gradient-boosted ensemble — fold 3/5',
  '[02:12:06] Training gradient-boosted ensemble — fold 4/5',
  '[02:14:33] Training gradient-boosted ensemble — fold 5/5',
  '[02:17:01] Cross-validation RMSE: 0.187 (track), 0.94 cat/accuracy',
  '[02:17:05] Serialising model weights → /models/cyclone_v42.pkl',
  '[02:17:09] Publishing inference endpoint — ready',
  '[02:17:11] Nightly job complete. Next run: tomorrow 02:00 IST',
];

export default function CyclonePage() {
  const { records } = useData();

  // Derive inputs for inference
  const sstMean    = records.reduce((s, r) => s + r.seaSurfaceTemp, 0) / records.length;
  const pressureMin = Math.min(...records.map(r => r.pressure));
  const windMax     = Math.max(...records.map(r => r.windSpeed));
  const riskMean    = records.reduce((s, r) => s + r.cycloneRiskScore, 0) / records.length;

  const inference = runInference(sstMean, pressureMin, windMax, riskMean);
  const track     = buildTrack(inference.formationProbability);

  const [activeTab, setActiveTab] = useState<'prediction' | 'track' | 'features' | 'training'>('prediction');
  const [logIdx, setLogIdx]       = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Animate training logs
  useEffect(() => {
    if (activeTab !== 'training') return;
    if (logIdx >= TRAINING_LOGS.length) return;
    const t = setTimeout(() => setLogIdx(i => i + 1), 400);
    return () => clearTimeout(t);
  }, [activeTab, logIdx]);

  useEffect(() => {
    if (activeTab === 'training') setLogIdx(0);
  }, [activeTab]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' });
  }, [logIdx]);

  // Radar data for feature importance
  const radarData = [
    { feature: 'SST', value: 85 },
    { feature: 'OHC',  value: 72 },
    { feature: 'Pressure', value: 90 },
    { feature: 'Wind Shear', value: 68 },
    { feature: 'ENSO', value: 45 },
    { feature: 'Humidity', value: 58 },
  ];

  const prob = inference.formationProbability;
  const riskLevel: 'Low' | 'Moderate' | 'High' | 'Severe' =
    prob >= 75 ? 'Severe' : prob >= 55 ? 'High' : prob >= 30 ? 'Moderate' : 'Low';

  const TABS = [
    { id: 'prediction', label: 'Prediction', icon: Target },
    { id: 'track',      label: 'Track',      icon: Wind },
    { id: 'features',   label: 'Features',   icon: Activity },
    { id: 'training',   label: 'Training Log', icon: Database },
  ] as const;

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Cyclone Prediction"
          subtitle="ML model inference · nightly training pipeline · Indian Ocean basin"
          icon={<Wind size={16} className="text-cyan-400" />}
        />

        {/* Hero card */}
        <div className={`relative overflow-hidden glass rounded-2xl p-6 mb-8 border ${
          prob >= 70 ? 'border-red-500/40 glow-red' : prob >= 50 ? 'border-orange-500/30' : 'border-white/10'
        }`}>
          {/* Animated background glow */}
          {prob >= 55 && (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 to-red-600/5 animate-pulse-slow" />
          )}

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Probability donut */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke={prob >= 70 ? '#ef4444' : prob >= 50 ? '#f97316' : '#06b6d4'}
                    strokeWidth="10"
                    strokeDasharray={`${prob * 3.14} 314`}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${prob >= 70 ? '#ef4444' : '#f97316'})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white">{prob}%</span>
                  <span className="text-xs text-white/40">formation</span>
                </div>
              </div>
              <RiskBadge risk={riskLevel} size="lg" />
            </div>

            {/* Prediction details */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Predicted System</p>
                <p className="text-xl font-bold text-white">{inference.predictedIntensity}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Likely Landfall</p>
                <p className="text-sm text-orange-300 font-medium">{inference.landfall}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Est. Landfall Time</p>
                <p className="text-sm text-white/80">{inference.landfallDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40 uppercase tracking-wider">Model Confidence</p>
                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${inference.confidence}%` }}
                  />
                </div>
                <span className="text-xs text-cyan-400">{inference.confidence}%</span>
              </div>
            </div>

            {/* Key features driving prediction */}
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Top Drivers</p>
              {[
                { label: 'SST Anomaly',     value: `+${inference.features.sst}°C`,     color: 'text-red-400' },
                { label: 'Pressure Drop',   value: `-${inference.features.pressure} hPa`, color: 'text-orange-400' },
                { label: 'Wind Shear',      value: `${inference.features.windShear} m/s`, color: 'text-yellow-400' },
                { label: 'Ocean Heat Cont.', value: `${inference.features.oceanHeat} kJ/cm²`, color: 'text-cyan-400' },
                { label: 'ENSO Index',      value: inference.features.enso.toFixed(2), color: 'text-blue-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-white/50">{label}</span>
                  <span className={`font-medium ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Last trained badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full glass border border-white/10 text-xs text-white/40">
            <Clock size={10} />
            Model trained: 02:17 IST today
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white border border-cyan-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'prediction' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-up">
            {/* Probability over next 96h */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="font-semibold text-white mb-1">72-Hour Probability Forecast</h3>
              <p className="text-xs text-white/40 mb-4">Formation probability at 12h intervals</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={track.slice(0, 6).map(t => ({
                  time: t.time.split(' ')[1],
                  prob: t.intensity,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="prob" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} name="Prob %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Intensity timeline */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="font-semibold text-white mb-1">Intensity Timeline</h3>
              <p className="text-xs text-white/40 mb-4">Wind speed & pressure forecast</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={track}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tickFormatter={v => v.split(' ')[1]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="left" type="monotone" dataKey="windSpeed" stroke="#06b6d4" strokeWidth={2} dot={false} name="Wind (km/h)" />
                  <Line yAxisId="right" type="monotone" dataKey="pressure" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Pressure (hPa)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'track' && (
          <div className="glass rounded-2xl p-6 border border-white/10 fade-in-up">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Wind size={16} className="text-cyan-400" />
              Predicted Track — 96h
            </h3>
            {/* 2D lat/lon plot */}
            <div className="relative h-64 bg-gradient-to-br from-blue-900/30 to-blue-950/20 rounded-xl border border-white/5 overflow-hidden mb-6">
              {/* Simple ocean grid background */}
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.2) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
              />
              {/* Plot track as SVG */}
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="trackGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                {/* Map lon 80→95 → x, lat 10→22 → y (inverted) */}
                {track.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = track[i - 1];
                  const x1 = ((prev.lon - 80) / 15) * 100;
                  const y1 = (1 - (prev.lat - 10) / 12) * 100;
                  const x2 = ((pt.lon - 80) / 15) * 100;
                  const y2 = (1 - (pt.lat - 10) / 12) * 100;
                  return (
                    <line
                      key={i}
                      x1={`${x1}%`} y1={`${y1}%`}
                      x2={`${x2}%`} y2={`${y2}%`}
                      stroke="url(#trackGrad)"
                      strokeWidth="2"
                      strokeDasharray={i > 4 ? '6 4' : 'none'}
                    />
                  );
                })}
                {track.map((pt, i) => {
                  const x = ((pt.lon - 80) / 15) * 100;
                  const y = (1 - (pt.lat - 10) / 12) * 100;
                  const r = i === 0 ? 6 : i === track.length - 1 ? 5 : 4;
                  return (
                    <circle
                      key={pt.time}
                      cx={`${x}%`} cy={`${y}%`} r={r}
                      fill={i === 0 ? '#06b6d4' : i >= 5 ? 'rgba(239,68,68,0.6)' : '#f97316'}
                      stroke="white" strokeWidth="1"
                    />
                  );
                })}
              </svg>
              {/* Axis labels */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-between px-2 text-xs text-white/30">
                <span>80°E</span><span>85°E</span><span>90°E</span><span>95°E</span>
              </div>
              <div className="absolute top-2 left-2 flex flex-col justify-between h-full text-xs text-white/30">
                <span>22°N</span><span>16°N</span><span>10°N</span>
              </div>
              {/* Legend */}
              <div className="absolute top-2 right-2 glass rounded-lg px-2 py-1 text-xs text-white/50 space-y-0.5">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Start</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />End (72h)</div>
                <div className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-white/40 inline-block" />Uncertain</div>
              </div>
            </div>

            {/* Track table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Time', 'Lat', 'Lon', 'Wind (km/h)', 'Pressure (hPa)', 'Prob (%)'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-white/40 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {track.map((pt, i) => (
                    <tr key={pt.time} className={`border-b border-white/5 ${i === 0 ? 'bg-cyan-500/5' : ''}`}>
                      <td className="px-3 py-2 text-white/70">{pt.time}</td>
                      <td className="px-3 py-2 text-white/60">{pt.lat.toFixed(1)}°N</td>
                      <td className="px-3 py-2 text-white/60">{pt.lon.toFixed(1)}°E</td>
                      <td className="px-3 py-2 text-cyan-400">{pt.windSpeed}</td>
                      <td className="px-3 py-2 text-purple-400">{pt.pressure}</td>
                      <td className="px-3 py-2 text-orange-400">{pt.intensity.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-up">
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h3 className="font-semibold text-white mb-1">Feature Importance</h3>
              <p className="text-xs text-white/40 mb-4">Contribution to cyclone probability score</p>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="feature" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                  <Radar name="Importance" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="font-semibold text-white mb-1">Input Feature Values</h3>
              <p className="text-xs text-white/40 mb-4">Derived from latest 14-day observations</p>
              {[
                { label: 'Mean SST', value: `${sstMean.toFixed(1)}°C`, threshold: '> 26°C triggers risk', icon: '🌡️' },
                { label: 'Min Pressure', value: `${pressureMin.toFixed(0)} hPa`, threshold: '< 1000 hPa critical', icon: '🌀' },
                { label: 'Max Wind', value: `${windMax.toFixed(0)} km/h`, threshold: '> 63 km/h = depression', icon: '💨' },
                { label: 'Avg Risk Score', value: `${riskMean.toFixed(0)}/100`, threshold: '> 55 = High risk', icon: '📊' },
                { label: 'ENSO Index', value: '-0.3 (neutral)', threshold: 'La Niña increases risk', icon: '🌊' },
              ].map(({ label, value, threshold, icon }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-sm font-bold text-cyan-400">{value}</p>
                    </div>
                    <p className="text-xs text-white/30 mt-0.5">{threshold}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div className="glass rounded-2xl p-6 border border-white/10 fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Database size={16} className="text-cyan-400" />
                  Nightly Training Pipeline
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Scheduled batch job — runs independently of UI · cron: <code className="text-cyan-400">0 2 * * *</code>
                </p>
              </div>
              <button
                onClick={() => setLogIdx(0)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-xs transition-all"
              >
                <RefreshCw size={12} />
                Replay
              </button>
            </div>

            {/* Architecture diagram */}
            <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
              {[
                { label: 'Data Sources', sub: 'ERA5, IMD, Buoys', color: 'cyan' },
                { label: 'Feature Eng.', sub: 'SST, OHC, Shear', color: 'blue' },
                { label: 'Gradient Boost', sub: 'XGBoost / 5-fold CV', color: 'purple' },
                { label: 'Model Store', sub: '/models/cyclone_v*.pkl', color: 'teal' },
                { label: 'Inference API', sub: 'Read-only endpoint', color: 'green' },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center">
                  <div className={`text-center px-3 py-2 rounded-xl bg-${step.color}-500/10 border border-${step.color}-500/20 min-w-[90px]`}>
                    <p className={`text-xs font-semibold text-${step.color}-400`}>{step.label}</p>
                    <p className="text-xs text-white/30 mt-0.5 leading-tight">{step.sub}</p>
                  </div>
                  {i < 4 && <ChevronRight size={14} className="text-white/20 mx-1 shrink-0" />}
                </div>
              ))}
            </div>

            {/* Terminal log */}
            <div
              ref={logRef}
              className="bg-black/50 rounded-xl border border-white/10 p-4 h-64 overflow-y-auto font-mono text-xs space-y-1"
            >
              <div className="text-green-400 mb-2">$ ocean-cyclone-trainer --config config/prod.yaml</div>
              {TRAINING_LOGS.slice(0, logIdx).map((log, i) => (
                <div key={i} className={`${
                  log.includes('ERROR') ? 'text-red-400' :
                  log.includes('complete') ? 'text-green-400' :
                  log.includes('fold') ? 'text-yellow-400' :
                  'text-white/60'
                }`}>
                  {log}
                </div>
              ))}
              {logIdx < TRAINING_LOGS.length && (
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />
              )}
            </div>

            {/* Pipeline info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {[
                { icon: Calendar, label: 'Schedule', value: 'Daily 02:00 IST', sub: 'cron / systemd timer' },
                { icon: Shield, label: 'Decoupled from UI', value: 'Yes — read-only API', sub: 'No live training in app' },
                { icon: TrendingUp, label: 'Latest Version', value: 'cyclone_v42.pkl', sub: 'Published 02:17 today' },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Icon size={14} />
                    <span className="text-xs text-white/50">{label}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{value}</p>
                  <p className="text-xs text-white/30">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
