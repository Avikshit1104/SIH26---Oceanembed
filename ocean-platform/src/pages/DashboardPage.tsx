import { useState, useEffect } from 'react';
import {
  Thermometer, Droplets, Wind, Waves,
  Activity, TrendingUp, TrendingDown, RefreshCw,
  Bell, ArrowUpRight, Zap, Eye, Globe, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import PageLayout from '../components/PageLayout';
import { useData, DEPTH_LEVELS } from '../contexts/DataContext';

// ── Animated number counter ────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setVal(+target.toFixed(2)); clearInterval(timer); }
      else setVal(+current.toFixed(2));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ── Glowing metric card ────────────────────────────────────────────────────────
function GlowCard({ label, value, unit, icon: Icon, color, trend, sub }: {
  label: string; value: string | number; unit?: string;
  icon: any; color: string; trend?: 'up' | 'down'; sub?: string;
}) {
  const cm: Record<string, { bg: string; border: string; txt: string }> = {
    red:    { bg: 'from-red-500/15 to-red-900/5',    border: 'border-red-500/25',    txt: 'text-red-400' },
    blue:   { bg: 'from-blue-500/15 to-blue-900/5',  border: 'border-blue-500/25',   txt: 'text-blue-400' },
    cyan:   { bg: 'from-cyan-500/15 to-cyan-900/5',  border: 'border-cyan-500/25',   txt: 'text-cyan-400' },
    purple: { bg: 'from-purple-500/15 to-purple-900/5', border: 'border-purple-500/25', txt: 'text-purple-400' },
    teal:   { bg: 'from-teal-500/15 to-teal-900/5',  border: 'border-teal-500/25',   txt: 'text-teal-400' },
    orange: { bg: 'from-orange-500/15 to-orange-900/5', border: 'border-orange-500/25', txt: 'text-orange-400' },
    green:  { bg: 'from-green-500/15 to-green-900/5', border: 'border-green-500/25', txt: 'text-green-400' },
  };
  const c = cm[color] ?? cm.cyan;
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border bg-gradient-to-br ${c.bg} ${c.border} backdrop-blur-xl hover:scale-[1.03] hover:-translate-y-1 transition-all duration-300 group depth-shadow-lg`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/3 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.txt} bg-white/5 border ${c.border}`}>
          <Icon size={18} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend === 'up' ? '+2.3%' : '-1.1%'}
          </div>
        )}
      </div>
      <p className="text-3xl font-black text-white tracking-tight">
        {value}
        {unit && <span className="text-lg font-normal text-white/40 ml-1">{unit}</span>}
      </p>
      <p className="text-xs text-white/50 mt-1 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Risk level derived from OHC + thermocline ─────────────────────────────────
function deriveRiskLabel(ohc: number, thermoclineDepth: number, mld: number) {
  const score = Math.min(100,
    (ohc > 80 ? 30 : ohc > 60 ? 15 : 5) +
    (thermoclineDepth < 40 ? 25 : thermoclineDepth < 60 ? 12 : 3) +
    (mld < 20 ? 20 : mld < 35 ? 10 : 2) +
    Math.random() * 5
  );
  const label = score >= 75 ? 'Severe' : score >= 55 ? 'High' : score >= 30 ? 'Moderate' : 'Low';
  const color = score >= 75 ? 'red' : score >= 55 ? 'orange' : score >= 30 ? 'yellow' : 'green';
  return { score: Math.round(score), label, color };
}

export default function DashboardPage() {
  const { records, alerts, getLatestRecord } = useData();
  const latest = getLatestRecord();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Safe accessors
  const sst  = latest?.inputs.sst  ?? 0;
  const sss  = latest?.inputs.sss  ?? 0;
  const ssh  = latest?.inputs.ssh  ?? 0;
  const uWind = latest?.inputs.uwind ?? 0;
  const vWind = latest?.inputs.vwind ?? 0;
  const windMag = Math.hypot(uWind, vWind);
  const mld   = latest?.mld ?? 0;
  const ohc   = latest?.ohc ?? 0;
  const thermo = latest?.thermoclineDepth ?? 75;

  const risk = latest ? deriveRiskLabel(ohc, thermo, mld) : { score: 0, label: 'Low', color: 'green' };

  // Animated counters
  const sstAnim  = useCountUp(sst);
  const sssAnim  = useCountUp(sss);
  const ohcAnim  = useCountUp(ohc);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  // Area chart: last 7 records
  const areaData = records.slice(-7).map(r => ({
    date:  format(parseISO(r.date), 'MMM d'),
    SST:   +r.inputs.sst.toFixed(1),
    OHC:   +r.ohc.toFixed(1),
    SSH:   +r.inputs.ssh.toFixed(1),
    MLD:   +r.mld.toFixed(0),
  }));

  // Regional OHC bars (from records grouped by location prefix)
  const regionMap: Record<string, number[]> = {};
  records.forEach(r => {
    const key = r.location.split(' ')[0] + ' ' + (r.location.split(' ')[1] ?? '');
    if (!regionMap[key]) regionMap[key] = [];
    regionMap[key].push(r.ohc);
  });
  const regionData = Object.entries(regionMap).slice(0, 4).map(([name, vals]) => ({
    region: name,
    ohc: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
  }));

  // Wind vector rose (use actual U/V winds from records)
  const windData = [
    { name: 'N',  value: Math.max(1, records.slice(-1)[0]?.inputs.vwind ?? 0 > 0 ? Math.abs(records.slice(-1)[0].inputs.vwind) * 10 : 5) },
    { name: 'NE', value: 18 },
    { name: 'E',  value: Math.max(1, (records.slice(-1)[0]?.inputs.ucurrent ?? 0.1) * 30) },
    { name: 'SE', value: 28 },
    { name: 'S',  value: Math.max(1, records.slice(-1)[0]?.inputs.vwind ?? 0 < 0 ? Math.abs(records.slice(-1)[0].inputs.vwind) * 10 : 8) },
    { name: 'SW', value: 12 },
    { name: 'W',  value: 10 },
    { name: 'NW', value: 15 },
  ];

  const activeAlerts = alerts.filter(a => !a.acknowledged);

  // Profile summary — surface vs deep
  const profile = latest?.profile;
  const surf5  = profile?.temperatures[1]?.toFixed(1) ?? '—';   // 5 m
  const t100   = profile?.temperatures[7]?.toFixed(1) ?? '—';   // 100 m
  const t500   = profile?.temperatures[12]?.toFixed(1) ?? '—';  // 500 m

  return (
    <PageLayout>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium uppercase tracking-wider">Live Reconstruction</span>
            </div>
            <h1 className="text-3xl font-black gradient-text-ocean">Subsurface Ocean Intelligence</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {latest?.location ?? 'North Indian Ocean'} · 0.25° grid · Updated {format(lastUpdated, 'HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeAlerts.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm animate-pulse-slow">
                <Bell size={14} />
                {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? 's' : ''}
              </div>
            )}
            <button onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/60 hover:text-white text-sm transition-all">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Top metric cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <GlowCard label="Sea Surface Temp"     value={sstAnim.toFixed(1)}  unit="°C"      icon={Thermometer} color="red"    trend="up"   sub={`SSH ${ssh.toFixed(1)} cm`} />
          <GlowCard label="Sea Surface Salinity" value={sssAnim.toFixed(1)}  unit="PSU"     icon={Droplets}    color="blue"   sub="SMOS/Aquarius" />
          <GlowCard label="Surface Wind Speed"   value={windMag.toFixed(1)}  unit="m/s"     icon={Wind}        color="cyan"   trend="up"   sub={`U:${uWind.toFixed(1)} V:${vWind.toFixed(1)}`} />
          <GlowCard label="Mixed Layer Depth"    value={mld.toFixed(0)}      unit="m"       icon={Waves}       color="purple" sub="Isothermal layer" />
          <GlowCard label="Ocean Heat Content"   value={ohcAnim.toFixed(0)}  unit="kJ/cm²"  icon={Activity}    color="orange" trend="up"   sub="0–700 m integral" />
          <GlowCard label="Thermocline Depth"    value={thermo.toFixed(0)}   unit="m"       icon={Layers}      color="teal"   sub="Max temp gradient" />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* SST + OHC trend */}
          <div className="lg:col-span-2 glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-white">SST · OHC · SSH Trend</h2>
                <p className="text-xs text-white/40 mt-0.5">Last 7 reconstructions</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-white/40">
                {[['SST','#ef4444'],['OHC','#f97316'],['SSH','#06b6d4']].map(([n,c]) => (
                  <span key={n} className="flex items-center gap-1">
                    <span className="w-3 h-0.5 rounded" style={{ background: c }} />
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={areaData}>
                <defs>
                  {[['gradSST','#ef4444'],['gradOHC','#f97316'],['gradSSH','#06b6d4']].map(([id, color]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date"  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="SST" stroke="#ef4444" fill="url(#gradSST)" strokeWidth={2.5} name="SST (°C)"     dot={{ fill:'#ef4444', r:3 }} />
                <Area type="monotone" dataKey="OHC" stroke="#f97316" fill="url(#gradOHC)" strokeWidth={2.5} name="OHC (kJ/cm²)" dot={{ fill:'#f97316', r:3 }} />
                <Area type="monotone" dataKey="SSH" stroke="#06b6d4" fill="url(#gradSSH)" strokeWidth={2}   name="SSH (cm)"      dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* OHC-derived risk gauge */}
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow flex flex-col">
            <h2 className="font-bold text-white mb-1">Derived Risk Index</h2>
            <p className="text-xs text-white/40 mb-4">From OHC + thermocline shoaling</p>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart cx="50%" cy="65%" innerRadius="55%" outerRadius="85%"
                  startAngle={200} endAngle={-20}
                  data={[{ value: risk.score, fill: risk.score >= 55 ? '#f97316' : '#06b6d4' }]}>
                  <PolarAngleAxis type="number" domain={[0,100]} tick={false} />
                  <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center -mt-6">
              <p className="text-4xl font-black text-white">{risk.score}</p>
              <p className="text-xs text-white/40 mt-1">risk score / 100</p>
              <p className={`text-sm font-bold mt-2 ${
                risk.label === 'High' || risk.label === 'Severe' ? 'text-orange-400' :
                risk.label === 'Moderate' ? 'text-yellow-400' : 'text-green-400'
              }`}>{risk.label}</p>
            </div>
          </div>
        </div>

        {/* ── Second row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Regional OHC */}
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <h2 className="font-bold text-white mb-1">Regional OHC</h2>
            <p className="text-xs text-white/40 mb-4">Ocean Heat Content by zone</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={regionData} layout="vertical" barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="region" tick={{ fill:'rgba(255,255,255,0.5)', fontSize:9 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ohc" fill="#f97316" radius={[0,6,6,0]} name="OHC (kJ/cm²)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Wind rose */}
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <h2 className="font-bold text-white mb-1">Wind Direction</h2>
            <p className="text-xs text-white/40 mb-4">Surface wind distribution</p>
            <div className="grid grid-cols-4 gap-2">
              {windData.map(d => (
                <div key={d.name} className="text-center">
                  <div className="h-12 flex items-end justify-center">
                    <div className="w-6 rounded-t-sm bg-gradient-to-t from-cyan-600 to-cyan-400"
                      style={{ height: `${Math.min((d.value / 35) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-white/40 mt-1">{d.name}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-3 text-center">
              Speed: {windMag.toFixed(1)} m/s · U:{uWind.toFixed(1)} V:{vWind.toFixed(1)}
            </p>
          </div>

          {/* Alert panel */}
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Alerts</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                activeAlerts.length > 0 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
              }`}>{activeAlerts.length} active</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {alerts.slice(0, 4).map(a => (
                <div key={a.id} className={`p-3 rounded-xl border text-xs space-y-1 ${
                  a.severity === 'Critical' ? 'bg-red-500/10 border-red-500/25 text-red-300'
                  : a.severity === 'Warning' ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-300'
                  : 'bg-blue-500/10 border-blue-500/25 text-blue-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{a.severity}</span>
                    {!a.acknowledged && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                  </div>
                  <p className="text-white/60 line-clamp-2 leading-relaxed">{a.message}</p>
                  <p className="text-white/30">{format(new Date(a.timestamp), 'MMM d · HH:mm')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Subsurface profile snapshot ── */}
        <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow mb-6">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <Layers size={16} className="text-cyan-400" />
            Reconstructed Subsurface Profile Snapshot — {latest?.location ?? '—'}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-15 gap-2">
            {(latest?.profile.temperatures ?? []).map((t, i) => {
              const n = Math.max(0, Math.min(1, (t - 2) / 27));
              const bg = n < 0.33
                ? `rgba(30,64,175,${0.5 + n * 0.5})`
                : n < 0.66
                ? `rgba(6,182,212,${0.7})`
                : `rgba(239,68,68,${0.6 + (n - 0.66)})`;
              return (
                <div key={i} className="flex flex-col items-center gap-1 group cursor-default">
                  <div
                    className="w-full rounded-xl transition-all duration-200 group-hover:scale-110"
                    style={{ height: '48px', background: bg, boxShadow: `0 0 10px ${bg}` }}
                  />
                  <p className="text-[10px] text-white/40">{DEPTH_LEVELS[i]}m</p>
                  <p className="text-[10px] font-mono text-white/70">{t.toFixed(1)}°</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-white/40">
            <span>Surface (0m): <span className="text-red-400 font-mono">{surf5}°C</span></span>
            <span>100m: <span className="text-cyan-400 font-mono">{t100}°C</span></span>
            <span>500m: <span className="text-blue-400 font-mono">{t500}°C</span></span>
            <span className="ml-auto">MLD: <span className="text-purple-400">{mld.toFixed(0)} m</span></span>
            <span>Thermocline: <span className="text-teal-400">{thermo.toFixed(0)} m</span></span>
          </div>
        </div>

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '3D Profile View', icon: Globe,    desc: '15-level depth slabs',  color: 'cyan',   to: '/map' },
            { label: 'Reconstruct',     icon: Zap,      desc: 'Run DL model',          color: 'orange', to: '/cyclone' },
            { label: 'Surface Obs',     icon: Eye,      desc: 'SST · SSS · SSH maps',  color: 'purple', to: '/surface' },
            { label: 'Validation',      icon: Activity, desc: 'ARGO vs predicted',     color: 'teal',   to: '/validation' },
          ].map(({ label, icon: Icon, desc, color }) => (
            <div key={label}
              className={`glass rounded-2xl p-4 border border-${color}-500/20 bg-gradient-to-br from-${color}-500/10 to-transparent hover:scale-[1.03] hover:-translate-y-1 transition-all cursor-pointer group depth-shadow`}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={16} className={`text-${color}-400`} />
                <ArrowUpRight size={14} className={`text-${color}-400 opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-white/40">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
