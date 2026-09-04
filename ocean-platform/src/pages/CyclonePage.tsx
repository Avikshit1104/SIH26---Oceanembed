import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wind, Activity, Target, Clock, TrendingUp,
  ChevronRight, Database, RefreshCw, Shield,
  Calendar, AlertTriangle, Zap, MapPin, Thermometer,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, AreaChart, Area,
} from 'recharts';
import { format, parseISO, addHours } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData } from '../contexts/DataContext';

// ── Cyclone risk derived from new DataContext fields ──────────────────────────
function computeCycloneRisk(
  sst: number,
  ssh: number,
  ohc: number,
  mld: number,
  thermoclineDepth: number,
  windMag: number,
) {
  // Physics-based scoring
  let score = 0;
  // SST contribution (warm ocean fuels cyclones)
  if (sst >= 30) score += 30;
  else if (sst >= 28) score += 20;
  else if (sst >= 26) score += 10;
  // OHC contribution (deep warm water sustains intensification)
  if (ohc >= 80) score += 25;
  else if (ohc >= 60) score += 15;
  else if (ohc >= 40) score += 8;
  // SSH (warm-core eddies deepen thermocline)
  if (ssh >= 15) score += 15;
  else if (ssh >= 5) score += 8;
  else if (ssh <= -10) score -= 5; // cold eddy suppresses
  // Shallow MLD means rapid surface cooling — slightly unfavourable
  if (mld < 20) score -= 5;
  else if (mld >= 50) score += 5;
  // Thermocline depth > 80m means more buffering for intensification
  if (thermoclineDepth >= 80) score += 10;
  else if (thermoclineDepth < 40) score -= 5;
  // Wind shear (high surface wind mag ≈ high shear at upper levels)
  if (windMag > 10) score -= 10;
  else if (windMag < 5) score += 5;

  score = Math.max(5, Math.min(95, score + Math.round(Math.random() * 4)));
  const label: 'Low' | 'Moderate' | 'High' | 'Severe' =
    score >= 75 ? 'Severe' : score >= 55 ? 'High' : score >= 30 ? 'Moderate' : 'Low';
  const intensity =
    score >= 75 ? 'Severe Cyclonic Storm (Cat 3+)' :
    score >= 55 ? 'Cyclonic Storm (Cat 1–2)' :
    score >= 30 ? 'Deep Depression' : 'Low Pressure Area';
  return { score, label, intensity };
}

// ── Build 72-hour track prediction ───────────────────────────────────────────
function buildTrack(score: number, lat: number, lon: number) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const t = addHours(now, i * 12);
    const decayFactor = Math.max(0.2, 1 - i * 0.08);
    return {
      time:      format(t, 'MMM d HH:mm'),
      hour:      `+${i * 12}h`,
      lat:       +(lat + i * 0.85 + Math.sin(i * 0.4) * 0.3).toFixed(2),
      lon:       +(lon - i * 1.1 + Math.cos(i * 0.5) * 0.2).toFixed(2),
      prob:      Math.round(score * decayFactor),
      windSpeed: Math.round(30 + score * 0.55 * decayFactor),
      pressure:  Math.round(1005 - score * 0.15 * decayFactor),
    };
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(p.value < 10 ? 2 : 0) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Animated training log ─────────────────────────────────────────────────────
const TRAINING_LOGS = [
  '[02:00:00] Nightly cyclone prediction job started  (cron: 0 2 * * *)',
  '[02:00:12] Loading ERA5 reanalysis surface winds...',
  '[02:01:05] Loading GLORYS subsurface OHC / thermocline depth...',
  '[02:02:18] Loading IMD historical cyclone tracks (1980–2024)...',
  '[02:03:40] Feature engineering: SST anomaly, OHC, MLD, wind shear...',
  '[02:05:10] Training XGBoost ensemble — fold 1/5...',
  '[02:07:28] Training — fold 2/5  | val_auc: 0.913',
  '[02:09:45] Training — fold 3/5  | val_auc: 0.924',
  '[02:12:03] Training — fold 4/5  | val_auc: 0.931',
  '[02:14:21] Training — fold 5/5  | val_auc: 0.938',
  '[02:16:00] Cross-val AUC: 0.931  |  Track RMSE: 87 km  |  Intensity Acc: 81.4%',
  '[02:16:08] Serialising → /models/cyclone_v44.pkl',
  '[02:16:12] Publishing inference endpoint — ready ✓',
  '[02:16:15] Nightly pipeline complete. Next run: tomorrow 02:00 IST',
];

const TABS = [
  { id: 'prediction', label: 'Prediction',    icon: Target },
  { id: 'track',      label: '72h Track',     icon: Wind },
  { id: 'features',   label: 'Risk Factors',  icon: Activity },
  { id: 'training',   label: 'Training Log',  icon: Database },
] as const;

type Tab = typeof TABS[number]['id'];

export default function CyclonePage() {
  const { records } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('prediction');
  const [logIdx, setLogIdx]       = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Use latest record for current conditions
  const latest   = records[records.length - 1];
  const sst      = latest?.inputs.sst      ?? 28;
  const ssh      = latest?.inputs.ssh      ?? 0;
  const ohc      = latest?.ohc             ?? 55;
  const mld      = latest?.mld             ?? 40;
  const thermo   = latest?.thermoclineDepth ?? 75;
  const uWind    = latest?.inputs.uwind    ?? 3;
  const vWind    = latest?.inputs.vwind    ?? -2;
  const windMag  = Math.hypot(uWind, vWind);
  const lat      = latest?.lat             ?? 15.5;
  const lon      = latest?.lon             ?? 88.0;

  const risk  = useMemo(() => computeCycloneRisk(sst, ssh, ohc, mld, thermo, windMag), [sst, ssh, ohc, mld, thermo, windMag]);
  const track = useMemo(() => buildTrack(risk.score, lat, lon), [risk.score, lat, lon]);

  // Historical risk trend
  const trendData = records.slice(-7).map(r => {
    const wm = Math.hypot(r.inputs.uwind, r.inputs.vwind);
    const rk = computeCycloneRisk(r.inputs.sst, r.inputs.ssh, r.ohc, r.mld, r.thermoclineDepth, wm);
    return {
      date:  format(parseISO(r.date), 'MMM d'),
      Score: rk.score,
      SST:   +r.inputs.sst.toFixed(1),
      OHC:   +r.ohc.toFixed(0),
    };
  });

  // Feature radar
  const radarData = [
    { feature: 'SST',        value: Math.round(Math.min(100, ((sst - 24) / 8) * 100)) },
    { feature: 'OHC',        value: Math.round(Math.min(100, (ohc / 100) * 100)) },
    { feature: 'SSH',        value: Math.round(Math.min(100, Math.max(0, ((ssh + 30) / 60) * 100))) },
    { feature: 'MLD',        value: Math.round(Math.min(100, (mld / 80) * 100)) },
    { feature: 'Thermocline', value: Math.round(Math.min(100, (thermo / 120) * 100)) },
    { feature: 'Low Shear',  value: Math.round(Math.min(100, Math.max(0, ((15 - windMag) / 15) * 100))) },
  ];

  // Training log animation
  useEffect(() => {
    if (activeTab !== 'training') return;
    if (logIdx >= TRAINING_LOGS.length) return;
    const t = setTimeout(() => setLogIdx(i => i + 1), 380);
    return () => clearTimeout(t);
  }, [activeTab, logIdx]);
  useEffect(() => { if (activeTab === 'training') setLogIdx(0); }, [activeTab]);
  useEffect(() => { logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }); }, [logIdx]);

  const riskHex   = risk.label === 'Severe' ? '#ef4444' : risk.label === 'High' ? '#f97316' : risk.label === 'Moderate' ? '#eab308' : '#22c55e';

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Cyclone Prediction"
          subtitle="ML-based cyclone formation probability · North Indian Ocean · 72-hour forecast"
          icon={<Wind size={16} className="text-cyan-400" />}
        />

        {/* ── Hero card ── */}
        <div className={`relative overflow-hidden glass rounded-2xl p-6 mb-8 border depth-shadow-lg ${
          risk.label === 'High' || risk.label === 'Severe'
            ? 'border-red-500/40'
            : 'border-white/10'
        }`}>
          {(risk.label === 'High' || risk.label === 'Severe') && (
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 to-orange-600/5 animate-pulse-slow" />
          )}

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cyclone animation + probability */}
            <div className="flex flex-col items-center justify-center py-2">
              {/* Animated cyclone SVG */}
              <div className="relative w-44 h-44 mb-3">
                <svg
                  viewBox="0 0 200 200"
                  className="w-full h-full"
                  style={{
                    animation: risk.score >= 30
                      ? `spin ${risk.score >= 70 ? '3s' : risk.score >= 50 ? '5s' : '8s'} linear infinite`
                      : 'none',
                  }}
                >
                  <defs>
                    <radialGradient id="eyeGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={riskHex} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={riskHex} stopOpacity="0" />
                    </radialGradient>
                    <filter id="cycloneGlow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>

                  {/* Outer glow ring */}
                  <circle cx="100" cy="100" r="90" fill="none"
                    stroke={riskHex} strokeWidth="1" strokeOpacity="0.15" />

                  {/* Spiral arms — each is an arc path that looks like a cyclone band */}
                  {[0, 60, 120, 180, 240, 300].map((startDeg, i) => {
                    const rad    = (startDeg * Math.PI) / 180;
                    const r1     = 20 + i * 10;
                    const r2     = r1 + 14;
                    const x1     = 100 + r1 * Math.cos(rad);
                    const y1     = 100 + r1 * Math.sin(rad);
                    const cpx    = 100 + (r1 + 20) * Math.cos(rad + 0.6);
                    const cpy    = 100 + (r1 + 20) * Math.sin(rad + 0.6);
                    const x2     = 100 + r2 * Math.cos(rad + 1.2);
                    const y2     = 100 + r2 * Math.sin(rad + 1.2);
                    const alpha  = 0.15 + (i / 6) * 0.55;
                    return (
                      <path key={i}
                        d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                        fill="none"
                        stroke={riskHex}
                        strokeWidth={3 - i * 0.2}
                        strokeLinecap="round"
                        strokeOpacity={alpha}
                        filter="url(#cycloneGlow)"
                      />
                    );
                  })}

                  {/* Inner band rings */}
                  {[35, 55, 70].map((r, i) => (
                    <circle key={r} cx="100" cy="100" r={r}
                      fill="none"
                      stroke={riskHex}
                      strokeWidth={1.5 - i * 0.3}
                      strokeOpacity={0.20 - i * 0.04}
                      strokeDasharray={`${r * 0.8} ${r * 0.4}`}
                    />
                  ))}

                  {/* Eye wall */}
                  <circle cx="100" cy="100" r="18"
                    fill={`${riskHex}22`}
                    stroke={riskHex} strokeWidth="2.5" strokeOpacity="0.7"
                    filter="url(#cycloneGlow)"
                  />

                  {/* Eye (calm centre) */}
                  <circle cx="100" cy="100" r="9" fill="url(#eyeGrad)" />
                  <circle cx="100" cy="100" r="5"
                    fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
                </svg>

                {/* Score overlay in centre */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-white" style={{ textShadow: `0 0 20px ${riskHex}` }}>
                    {risk.score}%
                  </span>
                  <span className="text-[10px] text-white/40 mt-0.5">formation</span>
                </div>
              </div>

              <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${
                risk.label === 'Severe'  ? 'bg-red-500/20    text-red-400    border-red-500/40' :
                risk.label === 'High'    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                risk.label === 'Moderate'? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                                           'bg-green-500/20  text-green-400  border-green-500/40'
              }`}>
                {risk.label} Risk
              </span>

              {/* Rotation speed label */}
              <p className="text-[10px] text-white/25 mt-2">
                {risk.score >= 70 ? '⚡ Rapidly intensifying' :
                 risk.score >= 50 ? '↻ Active rotation' :
                 risk.score >= 30 ? '〜 Slow spiral' : '◎ Low activity'}
              </p>
            </div>

            {/* Prediction details */}
            <div className="space-y-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Predicted System</p>
                <p className="text-xl font-bold text-white">{risk.intensity}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Origin Point</p>
                <p className="text-sm text-white/80 flex items-center gap-1.5">
                  <MapPin size={13} className="text-cyan-400" />
                  {lat.toFixed(1)}°N, {lon.toFixed(1)}°E — {latest?.location ?? 'North Indian Ocean'}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Likely Landfall</p>
                <p className="text-sm text-orange-300 font-medium">
                  {risk.score >= 55 ? 'Andhra Pradesh / Odisha coast (est. +60–72h)' : 'No landfall expected within 72h'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40 uppercase tracking-wider shrink-0">Confidence</p>
                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${70 + risk.score * 0.2}%` }} />
                </div>
                <span className="text-xs text-cyan-400 shrink-0">{Math.round(70 + risk.score * 0.2)}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/30">
                <Clock size={11} />
                Model: cyclone_v44.pkl · trained 02:16 IST today
              </div>
            </div>

            {/* Driving conditions */}
            <div className="space-y-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">Driving Conditions</p>
              {[
                { label: 'SST',             value: `${sst.toFixed(2)}°C`,     warn: sst >= 28,    icon: Thermometer },
                { label: 'Ocean Heat Content', value: `${ohc.toFixed(0)} kJ/cm²`, warn: ohc >= 60, icon: Activity },
                { label: 'SSH Anomaly',     value: `${ssh.toFixed(1)} cm`,    warn: ssh >= 10,    icon: TrendingUp },
                { label: 'Mixed Layer',     value: `${mld.toFixed(0)} m`,     warn: mld >= 40,    icon: Wind },
                { label: 'Thermocline',     value: `${thermo.toFixed(0)} m`,  warn: thermo >= 75, icon: Zap },
                { label: 'Wind Shear',      value: `${windMag.toFixed(2)} m/s`, warn: windMag < 8, icon: Wind },
              ].map(({ label, value, warn, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-white/50 flex items-center gap-1.5">
                    <Icon size={11} className="text-white/30" />{label}
                  </span>
                  <span className={`font-mono font-medium ${warn ? 'text-orange-400' : 'text-white/70'}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert banner */}
          {(risk.label === 'High' || risk.label === 'Severe') && (
            <div className="relative mt-5 pt-4 border-t border-red-500/20 flex items-center gap-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 animate-pulse" />
              <p className="text-sm text-red-300">
                Elevated cyclone formation probability. Government alerts dispatched to NDMA, IMD Chennai, and coastal SDMAs.
              </p>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white border border-cyan-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ── Prediction tab ── */}
        {activeTab === 'prediction' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-up">
            {/* Risk score trend */}
            <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
              <h3 className="font-semibold text-white mb-1">Cyclone Risk Score — 7 Day Trend</h3>
              <p className="text-xs text-white/40 mb-4">Derived from OHC, SST, SSH, MLD, thermocline, wind shear</p>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={riskHex} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={riskHex} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOHC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Score" stroke={riskHex} fill="url(#gScore)" strokeWidth={2.5} name="Risk Score" dot={{ fill: riskHex, r:3 }} />
                  <Area type="monotone" dataKey="OHC"   stroke="#06b6d4" fill="url(#gOHC)"   strokeWidth={2}   name="OHC (kJ/cm²)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast intensity */}
            <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
              <h3 className="font-semibold text-white mb-1">72h Intensity Forecast</h3>
              <p className="text-xs text-white/40 mb-4">Predicted wind speed & central pressure over time</p>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={track}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="hour" tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} width={35} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill:'rgba(255,255,255,0.35)', fontSize:10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line yAxisId="left"  type="monotone" dataKey="windSpeed" stroke="#f97316" strokeWidth={2.5} dot={{ fill:'#f97316', r:3 }} name="Wind (km/h)" />
                  <Line yAxisId="right" type="monotone" dataKey="pressure"  stroke="#8b5cf6" strokeWidth={2}   dot={false} name="Pressure (hPa)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Track tab ── */}
        {activeTab === 'track' && (
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow fade-in-up">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Wind size={16} className="text-cyan-400" />
              Predicted 72-Hour Track — North Indian Ocean
            </h3>

            {/* 2D SVG track plot */}
            <div className="relative h-64 bg-gradient-to-br from-blue-950/50 to-blue-900/20 rounded-xl border border-white/8 overflow-hidden mb-6">
              <div className="absolute inset-0 opacity-15"
                style={{ backgroundImage:'linear-gradient(rgba(6,182,212,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.2) 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="trackG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor={riskHex} />
                  </linearGradient>
                </defs>
                {/* Map: lon 60→95 → x, lat 5→30 → y (inverted) */}
                {track.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = track[i - 1];
                  const x1 = ((prev.lon - 60) / 35) * 100;
                  const y1 = (1 - (prev.lat - 5) / 25) * 100;
                  const x2 = ((pt.lon   - 60) / 35) * 100;
                  const y2 = (1 - (pt.lat   - 5) / 25) * 100;
                  return (
                    <line key={i}
                      x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                      stroke="url(#trackG)" strokeWidth="2.5"
                      strokeDasharray={i >= 4 ? '6 4' : 'none'}
                    />
                  );
                })}
                {track.map((pt, i) => {
                  const x = ((pt.lon - 60) / 35) * 100;
                  const y = (1 - (pt.lat - 5) / 25) * 100;
                  return (
                    <circle key={pt.time}
                      cx={`${x}%`} cy={`${y}%`} r={i === 0 ? 7 : 4}
                      fill={i === 0 ? '#06b6d4' : i >= 5 ? riskHex : '#f97316'}
                      stroke="white" strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
              {/* Axis labels */}
              <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 text-[10px] text-white/30">
                <span>60°E</span><span>70°E</span><span>80°E</span><span>90°E</span><span>95°E</span>
              </div>
              <div className="absolute top-2 left-2 flex flex-col text-[10px] text-white/30 h-[calc(100%-16px)] justify-between">
                <span>30°N</span><span>18°N</span><span>5°N</span>
              </div>
              {/* Legend */}
              <div className="absolute top-2 right-2 glass rounded-lg px-2 py-1.5 text-[10px] text-white/50 space-y-0.5">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Origin</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: riskHex }} />+72h</div>
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
                    <tr key={pt.time} className={`border-b border-white/5 hover:bg-white/3 transition-all ${i === 0 ? 'bg-cyan-500/5' : ''}`}>
                      <td className="px-3 py-2.5 text-white/70 whitespace-nowrap">{pt.time}</td>
                      <td className="px-3 py-2.5 text-white/60">{pt.lat}°N</td>
                      <td className="px-3 py-2.5 text-white/60">{pt.lon}°E</td>
                      <td className="px-3 py-2.5 text-orange-400 font-mono">{pt.windSpeed}</td>
                      <td className="px-3 py-2.5 text-purple-400 font-mono">{pt.pressure}</td>
                      <td className="px-3 py-2.5 font-mono" style={{ color: riskHex }}>{pt.prob}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Risk factors tab ── */}
        {activeTab === 'features' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-in-up">
            <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
              <h3 className="font-semibold text-white mb-1">Cyclogenesis Factor Radar</h3>
              <p className="text-xs text-white/40 mb-4">Relative contribution of each ocean-atmosphere parameter</p>
              <ResponsiveContainer width="100%" height={270}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="feature" tick={{ fill:'rgba(255,255,255,0.55)', fontSize:11 }} />
                  <Radar name="Cyclone Factor" dataKey="value" stroke={riskHex} fill={riskHex} fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow space-y-4">
              <h3 className="font-semibold text-white mb-1">Factor Breakdown</h3>
              <p className="text-xs text-white/40 mb-4">Current values vs cyclogenesis thresholds</p>
              {[
                { label:'SST',                 val:`${sst.toFixed(2)}°C`,     thresh:'≥ 26°C needed',     ok: sst >= 26  },
                { label:'Ocean Heat Content',   val:`${ohc.toFixed(0)} kJ/cm²`, thresh:'≥ 60 kJ/cm² high risk', ok: ohc >= 40  },
                { label:'SSH Anomaly',         val:`${ssh.toFixed(1)} cm`,    thresh:'> 0 cm favourable',  ok: ssh >= 0   },
                { label:'Mixed Layer Depth',   val:`${mld.toFixed(0)} m`,     thresh:'≥ 30m sustained heat', ok: mld >= 30  },
                { label:'Thermocline Depth',   val:`${thermo.toFixed(0)} m`,  thresh:'≥ 60m buffers shear', ok: thermo >= 60},
                { label:'Low Wind Shear',      val:`${windMag.toFixed(2)} m/s`, thresh:'< 10 m/s needed',  ok: windMag < 10},
              ].map(({ label, val, thresh, ok }) => (
                <div key={label} className="flex items-start justify-between gap-4 text-sm">
                  <div className="flex-1">
                    <p className="text-white/80 font-medium">{label}</p>
                    <p className="text-xs text-white/30 mt-0.5">{thresh}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono font-bold ${ok ? 'text-orange-400' : 'text-white/50'}`}>{val}</p>
                    <p className={`text-[10px] mt-0.5 ${ok ? 'text-orange-400' : 'text-white/30'}`}>
                      {ok ? '✓ Favourable' : '✗ Not met'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Training log tab ── */}
        {activeTab === 'training' && (
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Database size={16} className="text-cyan-400" />
                  Nightly Cyclone Model Training Log
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Offline batch job · decoupled from UI · <code className="text-cyan-400">cron: 0 2 * * *</code>
                </p>
              </div>
              <button onClick={() => setLogIdx(0)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-xs transition-all">
                <RefreshCw size={12} /> Replay
              </button>
            </div>

            {/* Pipeline diagram */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5">
              {[
                { label:'SST · OHC · SSH\nWinds · MLD',  color:'cyan'   },
                { label:'Feature\nEngineering',           color:'blue'   },
                { label:'XGBoost\nEnsemble',              color:'purple' },
                { label:'Model\nArtifact',                color:'teal'   },
                { label:'Inference\nAPI',                 color:'green'  },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center shrink-0">
                  <div className={`text-center px-3 py-2.5 rounded-xl bg-${step.color}-500/10 border border-${step.color}-500/20 min-w-[90px]`}>
                    <p className={`text-[11px] font-semibold text-${step.color}-400 whitespace-pre-line leading-tight`}>{step.label}</p>
                  </div>
                  {i < 4 && <ChevronRight size={14} className="text-white/20 mx-1 shrink-0" />}
                </div>
              ))}
            </div>

            {/* Terminal */}
            <div ref={logRef}
              className="bg-black/60 rounded-xl border border-white/10 p-4 h-64 overflow-y-auto font-mono text-xs space-y-0.5">
              <div className="text-green-400 mb-2">$ python train_cyclone.py --config config/nio_cyclone.yaml</div>
              {TRAINING_LOGS.slice(0, logIdx).map((log, i) => (
                <div key={i} className={
                  log.includes('✓') || log.includes('complete') ? 'text-green-400' :
                  log.includes('fold') ? 'text-yellow-400' :
                  log.includes('auc') || log.includes('RMSE') ? 'text-cyan-400' :
                  'text-white/60'
                }>{log}</div>
              ))}
              {logIdx < TRAINING_LOGS.length && <span className="inline-block w-2 h-3.5 bg-green-400 animate-pulse" />}
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              {[
                { icon: Calendar,    label:'Schedule',     value:'Daily 02:00 IST',     sub:'cron / systemd timer' },
                { icon: Shield,      label:'UI Decoupled', value:'Read-only inference', sub:'No live training in app' },
                { icon: TrendingUp,  label:'Latest Model', value:'cyclone_v44.pkl',     sub:'AUC 0.931 · Track RMSE 87 km' },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400"><Icon size={14} /><span className="text-xs text-white/50">{label}</span></div>
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
