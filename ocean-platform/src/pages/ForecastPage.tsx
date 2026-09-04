import { useState, useMemo } from 'react';
import {
  Wind, Thermometer, Layers, Calendar,
  TrendingUp, Activity,
  Droplets, Waves, Clock, Zap,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import { addDays, format } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, DEPTH_LEVELS, generateProfile } from '../contexts/DataContext';

// ── Temp → CSS colour ─────────────────────────────────────────────────────────
function tempColor(t: number): string {
  const n = Math.max(0, Math.min(1, (t - 2) / 27));
  if (n < 0.25) return '#1e40af';
  if (n < 0.5 ) return '#06b6d4';
  if (n < 0.75) return '#fbbf24';
  return '#ef4444';
}

// ── Generate 7-day forecast for a given location ──────────────────────────────
function buildForecast(
  baseSst: number,
  baseSsh: number,
  baseSss: number,
  lat: number,
  startDate: Date,
) {
  return Array.from({ length: 7 }, (_, i) => {
    const date   = addDays(startDate, i + 1);
    // Add realistic drift: SST cools ~0.1°C/day, SSH oscillates, wind varies
    const sstDrift  = -0.08 * i + Math.sin(i * 0.9) * 0.4;
    const sshDrift  =  Math.cos(i * 0.7) * 3;
    const sst = +(baseSst  + sstDrift).toFixed(3);
    const ssh = +(baseSsh  + sshDrift).toFixed(3);
    const sss = +(baseSss  + Math.sin(i * 0.5) * 0.2).toFixed(3);
    const mld       = +(30 + Math.abs(ssh) * 0.5 + i * 0.8).toFixed(1);
    const ohc       = +(sst * 3.2 + ssh * 0.5 + 42).toFixed(1);
    const thermocline = +(72 + ssh * 0.9 - (sst - 28) * 2).toFixed(1);
    const profile   = generateProfile(sst, ssh, format(date, 'yyyy-MM-dd'), lat, i * 13);
    const windSpeed = +(3 + Math.sin(i * 1.1) * 2 + i * 0.1).toFixed(2);
    const confidence = Math.max(50, 96 - i * 7);   // degrades with forecast lead
    return {
      day:       i + 1,
      date:      format(date, 'MMM d'),
      fullDate:  format(date, 'EEEE, MMM d'),
      sst, ssh, sss, mld, ohc, thermocline,
      windSpeed, confidence,
      profile,
    };
  });
}

// ── Mini depth-column heatmap for one forecast day ───────────────────────────
function DepthColumn({ temps, active }: { temps: number[]; active: boolean }) {
  return (
    <div className={`flex flex-col rounded-xl overflow-hidden border transition-all duration-200 ${
      active ? 'border-cyan-400/60 scale-105 shadow-lg shadow-cyan-500/20' : 'border-white/10'
    }`}>
      {temps.map((t, i) => (
        <div key={i} title={`${DEPTH_LEVELS[i]}m: ${t.toFixed(1)}°C`}
          style={{ background: tempColor(t), height: '14px' }} />
      ))}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs shadow-xl space-y-1">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const { getLatestRecord } = useData();
  const latest   = getLatestRecord();
  const today    = new Date();

  const baseSst  = latest?.inputs.sst  ?? 28.2;
  const baseSsh  = latest?.inputs.ssh  ?? 4.0;
  const baseSss  = latest?.inputs.sss  ?? 34.1;
  const lat      = latest?.lat         ?? 15.5;
  const location = latest?.location    ?? 'Bay of Bengal (NE)';

  const forecast = useMemo(
    () => buildForecast(baseSst, baseSsh, baseSss, lat, today),
    [baseSst, baseSsh, baseSss, lat],
  );

  const [selectedDay, setSelectedDay] = useState(0);   // 0-based index into forecast[]
  const active = forecast[selectedDay];

  // Surface trend chart data across 7 days
  const trendData = forecast.map(d => ({
    date:      d.date,
    SST:       d.sst,
    OHC:       d.ohc,
    MLD:       d.mld,
    Thermocline: d.thermocline,
    Confidence: d.confidence,
  }));

  // Profile comparison data (line chart: depth vs temp for active day)
  const profileData = DEPTH_LEVELS.map((depth, i) => ({
    depth,
    Forecast:  +active.profile.temperatures[i].toFixed(2),
    Today:     latest ? +generateProfile(baseSst, baseSsh, format(today, 'yyyy-MM-dd'), lat, 99).temperatures[i].toFixed(2) : undefined,
  }));

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="7-Day Subsurface Temperature Forecast"
          subtitle={`Sliding window prediction · ${format(addDays(today,1),'MMM d')} → ${format(addDays(today,7),'MMM d, yyyy')} · ${location}`}
          icon={<Calendar size={16} className="text-cyan-400" />}
        />

        {/* ── Date info bar ── */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { l: 'Base Date',   v: format(today, 'MMMM d, yyyy') },
            { l: 'Window',      v: `${format(addDays(today,1),'MMM d')} – ${format(addDays(today,7),'MMM d')}` },
            { l: 'Source',      v: `${location}` },
            { l: 'Depth Range', v: '0 – 1000 m (15 levels)' },
            { l: 'Method',      v: 'CNN-ViT satellite embedding + physics drift' },
          ].map(({ l, v }) => (
            <div key={l} className="glass rounded-xl px-3 py-1.5 border border-cyan-500/20 text-xs">
              <span className="text-white/40">{l}: </span>
              <span className="text-cyan-400 font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* ── 7-day selector strip ── */}
        <div className="glass rounded-2xl p-4 border border-white/10 depth-shadow mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Calendar size={14} className="text-cyan-400" />
              Select Forecast Day
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Clock size={11} />
              Confidence degrades with lead time
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {forecast.map((d, i) => (
              <button
                key={d.day}
                onClick={() => setSelectedDay(i)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                  selectedDay === i
                    ? 'border-cyan-400/60 bg-cyan-500/15 scale-[1.03]'
                    : 'border-white/10 hover:border-white/25 hover:bg-white/5'
                }`}
              >
                <span className="text-[10px] text-white/40 uppercase tracking-wide">Day {d.day}</span>
                <span className="text-sm font-bold text-white">{d.date}</span>
                <span className="text-[11px] font-mono" style={{ color: tempColor(d.sst) }}>
                  {d.sst.toFixed(1)}°C
                </span>
                {/* Tiny depth column preview */}
                <div className="w-full">
                  <DepthColumn temps={d.profile.temperatures} active={selectedDay === i} />
                </div>
                {/* Confidence badge */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                  d.confidence >= 85 ? 'bg-green-500/15 text-green-400 border-green-500/25'
                  : d.confidence >= 70 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
                  : 'bg-orange-500/15 text-orange-400 border-orange-500/25'
                }`}>{d.confidence}%</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* ── Selected day depth profile ── */}
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" />
              {active.fullDate}
            </h2>
            <p className="text-xs text-white/40 mb-4">Predicted temperature profile vs today</p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={profileData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" domain={['auto','auto']}
                  tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
                  label={{ value:'Temp (°C)', fill:'rgba(255,255,255,0.3)', fontSize:9, position:'insideBottom', offset:-2 }} />
                <YAxis type="number" dataKey="depth" reversed
                  tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
                  width={42}
                  label={{ value:'Depth (m)', fill:'rgba(255,255,255,0.3)', fontSize:9, angle:-90, position:'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }} />
                <Line type="monotone" dataKey="Forecast" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name={`${active.date} Forecast (°C)`} />
                <Line type="monotone" dataKey="Today" stroke="#f97316" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Today Baseline (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Selected day key metrics ── */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Activity size={15} className="text-cyan-400" />
                Day {active.day} Diagnostics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l:'SST',         v:`${active.sst.toFixed(2)}°C`,        c:'text-red-400',    icon: Thermometer },
                  { l:'SSS',         v:`${active.sss.toFixed(2)} PSU`,      c:'text-blue-400',   icon: Droplets },
                  { l:'SSH',         v:`${active.ssh.toFixed(2)} cm`,        c:'text-cyan-400',   icon: Waves },
                  { l:'Wind',        v:`${active.windSpeed.toFixed(1)} m/s`, c:'text-green-400',  icon: Wind },
                  { l:'MLD',         v:`${active.mld.toFixed(0)} m`,         c:'text-purple-400', icon: Layers },
                  { l:'OHC',         v:`${active.ohc.toFixed(0)} kJ/cm²`,   c:'text-orange-400', icon: Zap },
                  { l:'Thermocline', v:`${active.thermocline.toFixed(0)} m`, c:'text-teal-400',   icon: TrendingUp },
                  { l:'Confidence',  v:`${active.confidence}%`,              c: active.confidence>=85?'text-green-400':active.confidence>=70?'text-yellow-400':'text-orange-400', icon: Activity },
                ].map(({ l, v, c, icon: Icon }) => (
                  <div key={l} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/8">
                    <span className="text-white/45 text-xs flex items-center gap-1"><Icon size={10}/>{l}</span>
                    <span className={`font-mono font-bold text-xs ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Temperature at key depths for selected day */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
              <h3 className="text-sm font-semibold text-white/80 mb-3">Key Depth Temperatures</h3>
              <div className="space-y-2">
                {[0, 2, 5, 7, 9, 11, 14].map(idx => {
                  const t = active.profile.temperatures[idx];
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-12 shrink-0">{DEPTH_LEVELS[idx]}m</span>
                      <div className="flex-1 bg-white/8 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width:`${Math.max(5,((t-2)/27)*100)}%`, background: tempColor(t) }} />
                      </div>
                      <span className="text-xs font-mono w-14 text-right" style={{ color: tempColor(t) }}>
                        {t.toFixed(1)}°C
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── All 7 days heatmap grid ── */}
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" />
              7-Day Depth Heatmap
            </h2>
            <p className="text-xs text-white/40 mb-4">Each column = one forecast day · rows = depth levels</p>
            <div className="flex gap-2">
              {/* Y axis labels */}
              <div className="flex flex-col justify-between text-[9px] text-white/30 py-0.5 shrink-0">
                {DEPTH_LEVELS.filter((_, i) => i % 3 === 0).map(d => (
                  <span key={d}>{d}m</span>
                ))}
              </div>
              {/* Columns */}
              <div className="flex-1 grid grid-cols-7 gap-1">
                {forecast.map((d, i) => (
                  <div key={d.day} onClick={() => setSelectedDay(i)}
                    className="cursor-pointer group">
                    <div className={`flex flex-col rounded-lg overflow-hidden border-2 transition-all ${
                      selectedDay === i ? 'border-cyan-400/70' : 'border-transparent group-hover:border-white/20'
                    }`}>
                      {d.profile.temperatures.map((t, di) => (
                        <div key={di}
                          style={{ height:'14px', background: tempColor(t) }}
                          title={`${d.date} · ${DEPTH_LEVELS[di]}m: ${t.toFixed(1)}°C`}
                        />
                      ))}
                    </div>
                    <p className="text-[9px] text-white/40 text-center mt-1">{d.date}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Colour legend */}
            <div className="mt-4">
              <div className="h-2.5 rounded-full" style={{
                background:'linear-gradient(to right, #1e40af, #06b6d4, #fbbf24, #ef4444)'
              }} />
              <div className="flex justify-between text-[9px] text-white/30 mt-1">
                <span>2°C (deep)</span><span>10°C</span><span>20°C</span><span>29°C (surface)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 7-day surface trend charts ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <h3 className="font-semibold text-white mb-1">SST & OHC Forecast Trend</h3>
            <p className="text-xs text-white/40 mb-4">7-day predicted evolution from today's baseline</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="fSST" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fOHC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="SST" stroke="#ef4444" fill="url(#fSST)" strokeWidth={2.5} name="SST (°C)" dot={{ fill:'#ef4444', r:3 }} />
                <Area type="monotone" dataKey="OHC" stroke="#f97316" fill="url(#fOHC)" strokeWidth={2} name="OHC (kJ/cm²)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="glass rounded-2xl p-6 border border-white/10 depth-shadow">
            <h3 className="font-semibold text-white mb-1">MLD & Thermocline Depth Forecast</h3>
            <p className="text-xs text-white/40 mb-4">Predicted mixed layer and thermocline evolution</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }} />
                <Line type="monotone" dataKey="MLD"         stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill:'#8b5cf6', r:3 }} name="MLD (m)" />
                <Line type="monotone" dataKey="Thermocline" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name="Thermocline (m)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Confidence table ── */}
        <div className="glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Calendar size={14} className="text-cyan-400" />
              Full 7-Day Forecast Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  {['Day','Date','SST','SSS','SSH','MLD','OHC','Thermocline','Wind','Confidence'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white/40 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.map((d, i) => (
                  <tr key={d.day}
                    onClick={() => setSelectedDay(i)}
                    className={`border-b border-white/5 cursor-pointer transition-all ${
                      selectedDay === i ? 'bg-cyan-500/10' : 'hover:bg-white/3'
                    }`}>
                    <td className="px-4 py-3 text-white font-bold">+{d.day}d</td>
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">{d.fullDate}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: tempColor(d.sst) }}>{d.sst.toFixed(2)}°C</td>
                    <td className="px-4 py-3 text-blue-400 font-mono">{d.sss.toFixed(2)} PSU</td>
                    <td className="px-4 py-3 text-cyan-400 font-mono">{d.ssh.toFixed(2)} cm</td>
                    <td className="px-4 py-3 text-purple-400 font-mono">{d.mld.toFixed(0)} m</td>
                    <td className="px-4 py-3 text-orange-400 font-mono">{d.ohc.toFixed(0)} kJ/cm²</td>
                    <td className="px-4 py-3 text-teal-400 font-mono">{d.thermocline.toFixed(0)} m</td>
                    <td className="px-4 py-3 text-green-400 font-mono">{d.windSpeed.toFixed(1)} m/s</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width:`${d.confidence}%`,
                            background: d.confidence>=85?'#22c55e':d.confidence>=70?'#eab308':'#f97316'
                          }} />
                        </div>
                        <span className={`font-mono ${d.confidence>=85?'text-green-400':d.confidence>=70?'text-yellow-400':'text-orange-400'}`}>
                          {d.confidence}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
