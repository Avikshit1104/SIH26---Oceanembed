import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Waves, MessageSquare, LayoutDashboard, Globe, Wind,
  Thermometer, BarChart2, ArrowRight, Activity, Layers,
  Database, Calendar, GitCompare, Fish, Anchor, Zap,
  TrendingDown, Eye, Navigation,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { DEPTH_LEVELS } from '../contexts/DataContext';

// ── Depth zones with content ──────────────────────────────────────────────────
const DEPTH_ZONES = [
  {
    id:    'surface',
    depth: 0,
    label: 'Surface (0 m)',
    color: '#ef4444',
    bg:    'from-red-900/20 to-transparent',
    border:'border-red-500/20',
    icon:  Waves,
    title: 'Sea Surface — Where Satellites Watch',
    desc:  'The ocean surface is our window into the deep. Satellites measure sea surface temperature (SST), salinity (SSS), height (SSH), and currents every day at 0.25° resolution across the entire North Indian Ocean.',
    facts: [
      { label:'SST Range',     value:'24°C – 32°C', icon: Thermometer },
      { label:'Satellite Obs', value:'8 per day',    icon: Eye },
      { label:'Resolution',    value:'0.25° × 0.25°', icon: Navigation },
      { label:'Sources',       value:'MODIS · VIIRS · AVHRR', icon: Globe },
    ],
    feature: { label:'Surface Obs', to:'/surface', desc:'View live SST, SSS, SSH heatmaps' },
  },
  {
    id:    'mixedlayer',
    depth: 30,
    label: 'Mixed Layer (30 m)',
    color: '#f97316',
    bg:    'from-orange-900/20 to-transparent',
    border:'border-orange-500/20',
    icon:  Layers,
    title: 'Mixed Layer — Wind-Driven Uniformity',
    desc:  'Wind-driven turbulence keeps the upper 20–80m nearly uniform in temperature. The Mixed Layer Depth (MLD) determines how much thermal energy is available to fuel tropical cyclones — a deeper MLD means more heat reservoir.',
    facts: [
      { label:'Typical MLD',    value:'30 – 80 m',    icon: TrendingDown },
      { label:'Effect',         value:'Cyclone fuel',  icon: Wind },
      { label:'Driver',         value:'Wind stress',   icon: Wind },
      { label:'Season',         value:'Deeper in winter', icon: Calendar },
    ],
    feature: { label:'7-Day Forecast', to:'/forecast', desc:'Predict MLD evolution over next week' },
  },
  {
    id:    'thermocline',
    depth: 100,
    label: 'Thermocline (75–200 m)',
    color: '#fbbf24',
    bg:    'from-yellow-900/20 to-transparent',
    border:'border-yellow-500/20',
    icon:  TrendingDown,
    title: 'Thermocline — The Great Divider',
    desc:  'Below the mixed layer, temperature drops sharply — 10–15°C within just 100m. This layer, the thermocline, acts as a barrier between warm surface waters and cold deep ocean. SSH anomalies from eddies displace it up or down.',
    facts: [
      { label:'Temp Drop',    value:'~15°C per 100m', icon: Thermometer },
      { label:'Depth',        value:'75 – 200 m',     icon: Layers },
      { label:'SSH Link',     value:'Eddy coupling',  icon: Waves },
      { label:'OHC Driver',   value:'Critical zone',  icon: Zap },
    ],
    feature: { label:'3D Profile View', to:'/map', desc:'Visualise thermocline in 3D depth slabs' },
  },
  {
    id:    'mesopelagic',
    depth: 300,
    label: 'Mesopelagic (200–1000 m)',
    color: '#06b6d4',
    bg:    'from-cyan-900/20 to-transparent',
    border:'border-cyan-500/20',
    icon:  Fish,
    title: 'Twilight Zone — Life Without Light',
    desc:  'From 200m to 1000m, sunlight barely penetrates. Temperature stabilises between 5–15°C. This zone hosts the largest animal migration on Earth — the diel vertical migration — as creatures rise at night to feed at the surface.',
    facts: [
      { label:'Temp Range', value:'5°C – 15°C',       icon: Thermometer },
      { label:'Light',      value:'< 1% of surface',  icon: Eye },
      { label:'Biomass',    value:'Highest density',   icon: Activity },
      { label:'Key depths', value:'200 · 300 · 500m',  icon: Layers },
    ],
    feature: { label:'Input Data', to:'/input', desc:'Upload .nc files for reconstruction' },
  },
  {
    id:    'deep',
    depth: 700,
    label: 'Deep Ocean (700–1000 m)',
    color: '#3b82f6',
    bg:    'from-blue-900/25 to-transparent',
    border:'border-blue-500/20',
    icon:  Anchor,
    title: 'The Deep — Cold, Dark, Stable',
    desc:  'Below 700m the ocean is near-freezing, pitch black, and under enormous pressure. Temperature changes are measured in fractions of a degree. These waters hold vast climate memory — changes here take decades to reach the surface.',
    facts: [
      { label:'Temp',     value:'2°C – 6°C',        icon: Thermometer },
      { label:'Pressure', value:'>70 atm',           icon: Waves },
      { label:'Timescale',value:'Centuries',         icon: Calendar },
      { label:'ARGO',     value:'Floats to 2000m',   icon: Database },
    ],
    feature: { label:'Model vs GLORYS', to:'/compare', desc:'Compare DL model vs reanalysis data' },
  },
];

// ── Depth meter sidebar ────────────────────────────────────────────────────────
function DepthMeter({ depth, maxDepth }: { depth: number; maxDepth: number }) {
  const pct = Math.min((depth / maxDepth) * 100, 100);
  const markers = [0, 100, 200, 300, 500, 700, 1000];

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-1"
      style={{ height: '320px' }}>
      {/* Label */}
      <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1 rotate-0">Depth</div>

      {/* Track */}
      <div className="relative flex-1 w-1 bg-white/10 rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className="absolute top-0 left-0 right-0 rounded-full transition-all duration-700"
          style={{
            height: `${pct}%`,
            background: `linear-gradient(to bottom, #ef4444, #f97316, #fbbf24, #06b6d4, #3b82f6, #7c3aed)`,
          }}
        />
        {/* Marker ticks */}
        {markers.map(m => (
          <div key={m}
            className="absolute left-1/2 w-3 h-px -translate-x-1/2 bg-white/20"
            style={{ top: `${(m / maxDepth) * 100}%` }}
          />
        ))}
      </div>

      {/* Current depth label */}
      <div className="mt-1 glass rounded-lg px-2 py-1 border border-white/15 text-center min-w-[52px]">
        <span className="text-xs font-bold font-mono" style={{
          color: depth < 50 ? '#ef4444' : depth < 200 ? '#fbbf24' : depth < 500 ? '#06b6d4' : '#3b82f6'
        }}>
          {Math.round(depth)}m
        </span>
      </div>
    </div>
  );
}

// ── Animated number ───────────────────────────────────────────────────────────
function AnimNum({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / 60;
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [target]);
  return <>{val.toLocaleString()}{suffix}</>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate    = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollDepth, setScrollDepth] = useState(0);
  const maxDepth = 1000;

  // Track scroll → map to 0–1000m
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollTop  = window.scrollY;
      const docHeight  = document.body.scrollHeight - window.innerHeight;
      const pct        = docHeight > 0 ? scrollTop / docHeight : 0;
      setScrollDepth(Math.round(pct * maxDepth));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#020917]" ref={containerRef}>
      <Navbar />

      {/* Depth meter */}
      <DepthMeter depth={scrollDepth} maxDepth={maxDepth} />

      {/* ── HERO — 0m ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#020917] via-[#041530] to-[#020c22]" />
          <div className="absolute inset-0"
            style={{ backgroundImage:'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6,182,212,0.15), transparent)' }} />
          {/* Animated wave lines */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute left-0 right-0 h-px opacity-10"
              style={{
                top: `${30 + i * 12}%`,
                background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
                animation: `shimmer ${3 + i * 0.5}s linear ${i * 0.3}s infinite`,
              }} />
          ))}
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          {/* Depth badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-cyan-500/30 text-cyan-400 text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            0 m · Sea Surface · Real-time monitoring active
          </div>

          <h1 className="text-5xl sm:text-7xl font-black mb-6 leading-tight tracking-tight">
            <span style={{ background:'linear-gradient(135deg,#06b6d4,#3b82f6,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Ocean &amp; Climate
            </span>
            <br />
            <span className="text-white">Intelligence Platform</span>
          </h1>

          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Reconstructing the <span className="text-cyan-400">subsurface ocean</span> from satellite observations using deep learning embeddings — 15 depth levels, 0 to 1000m, across the North Indian Ocean.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-16">
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold glow-cyan hover:opacity-90 transition-opacity"
              style={{ background:'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>
              Open Dashboard <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/forecast')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/15 text-white font-semibold hover:bg-white/10 transition-all">
              <Calendar size={16} className="text-cyan-400" />
              7-Day Forecast
            </button>
            <button onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/15 text-white font-semibold hover:bg-white/10 transition-all">
              <MessageSquare size={16} className="text-purple-400" />
              Ask X AI
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { label:'Depth Levels', value:15, suffix:'' },
              { label:'Max Depth',    value:1000, suffix:'m' },
              { label:'Grid Points',  value:40000, suffix:'+' },
              { label:'Accuracy',     value:94, suffix:'%' },
            ].map(({ label, value, suffix }) => (
              <div key={label} className="glass rounded-2xl p-4 border border-white/10 text-center">
                <p className="text-2xl font-black"
                  style={{ background:'linear-gradient(90deg,#06b6d4,#3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                  <AnimNum target={value} suffix={suffix} />
                </p>
                <p className="text-white/40 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Scroll hint */}
          <div className="mt-16 flex flex-col items-center gap-2 text-white/25 text-xs">
            <span>Scroll to dive deeper</span>
            <div className="w-px h-8 bg-gradient-to-b from-white/25 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── DEPTH ZONES ── */}
      {DEPTH_ZONES.map((zone, zi) => {
        const Icon = zone.icon;
        return (
          <section key={zone.id}
            className={`relative min-h-screen flex items-center py-24 overflow-hidden`}>
            {/* Depth-coloured BG gradient */}
            <div className="absolute inset-0 pointer-events-none">
              <div className={`absolute inset-0 bg-gradient-to-br ${zone.bg}`} />
              {/* Depth pressure lines */}
              {[...Array(4)].map((_, i) => (
                <div key={i}
                  className="absolute left-0 right-0 h-px"
                  style={{
                    top:`${20 + i * 20}%`,
                    background: `linear-gradient(90deg, transparent 10%, ${zone.color}18, transparent 90%)`,
                  }} />
              ))}
              {/* Depth badge (left-centre) */}
              <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden xl:block">
                <div className="glass rounded-2xl px-4 py-6 border text-center w-20"
                  style={{ borderColor: zone.color + '40' }}>
                  <span className="text-xs text-white/30 block mb-1">depth</span>
                  <span className="text-2xl font-black block" style={{ color: zone.color }}>
                    {zone.depth}
                  </span>
                  <span className="text-xs text-white/40">m</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 w-full">
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${zi % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>

                {/* Text side */}
                <div className={zi % 2 === 1 ? 'lg:order-2' : ''}>
                  {/* Depth pill */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border text-sm mb-5"
                    style={{ borderColor: zone.color + '50', color: zone.color }}>
                    <Icon size={13} />
                    {zone.label}
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
                    {zone.title}
                  </h2>
                  <p className="text-white/55 text-base leading-relaxed mb-8">
                    {zone.desc}
                  </p>

                  {/* Facts grid */}
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {zone.facts.map(({ label, value, icon: FIcon }) => (
                      <div key={label} className="glass rounded-xl p-4 border border-white/10 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: zone.color + '20', border: `1px solid ${zone.color}40` }}>
                          <FIcon size={13} style={{ color: zone.color }} />
                        </div>
                        <div>
                          <p className="text-xs text-white/40">{label}</p>
                          <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button onClick={() => navigate(zone.feature.to)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-all"
                    style={{ background: `linear-gradient(135deg, ${zone.color}cc, ${zone.color}88)` }}>
                    <ArrowRight size={14} />
                    {zone.feature.label}
                  </button>
                  <p className="text-white/30 text-xs mt-2">{zone.feature.desc}</p>
                </div>

                {/* Visual side — depth profile column */}
                <div className={`${zi % 2 === 1 ? 'lg:order-1' : ''} flex items-center justify-center`}>
                  <div className="relative">
                    {/* Giant depth column */}
                    <div className="flex gap-1 items-end" style={{ height: '360px' }}>
                      {/* DEPTH_LEVELS column */}
                      <div className="flex flex-col-reverse w-12 rounded-2xl overflow-hidden border border-white/10"
                        style={{ height: '360px' }}>
                        {DEPTH_LEVELS.map((d) => {
                          const isActive = d >= zone.depth && d < (DEPTH_ZONES[zi + 1]?.depth ?? 1001);
                          // temp decreases with depth
                          const temp = 28 - (d / 1000) * 26;
                          const n = Math.max(0, Math.min(1, (temp - 2) / 27));
                          let bg: string;
                          if (n < 0.25) bg = '#1e40af';
                          else if (n < 0.5) bg = '#06b6d4';
                          else if (n < 0.75) bg = '#fbbf24';
                          else bg = '#ef4444';
                          return (
                            <div key={d}
                              title={`${d}m · ${temp.toFixed(1)}°C`}
                              className={`flex-1 transition-all duration-300 ${isActive ? 'opacity-100 brightness-125' : 'opacity-40'}`}
                              style={{ background: bg }}
                            />
                          );
                        })}
                      </div>

                      {/* Depth labels */}
                      <div className="flex flex-col-reverse justify-between pl-3 text-[10px] text-white/30"
                        style={{ height: '360px' }}>
                        {DEPTH_LEVELS.filter((_, i) => i % 2 === 0).map(d => (
                          <span key={d} className={d >= zone.depth && d < (DEPTH_ZONES[zi+1]?.depth ?? 1001) ? 'text-white/70' : ''}>
                            {d}m
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Active zone label */}
                    <div className="absolute -right-4 top-1/2 -translate-y-1/2 glass rounded-xl px-3 py-2 border text-xs"
                      style={{ borderColor: zone.color + '50', color: zone.color }}>
                      ← Active zone
                    </div>

                    {/* Temp legend */}
                    <div className="mt-3 w-48 mx-auto">
                      <div className="h-2 rounded-full" style={{ background:'linear-gradient(to right,#1e40af,#06b6d4,#fbbf24,#ef4444)' }} />
                      <div className="flex justify-between text-[9px] text-white/25 mt-1">
                        <span>2°C</span><span>10°C</span><span>20°C</span><span>29°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── ABYSSAL — 1000m — features grid ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#020c22] to-[#020917]" />
        <div className="absolute inset-0"
          style={{ backgroundImage:'radial-gradient(ellipse 60% 40% at 50% 80%, rgba(124,58,237,0.12), transparent)' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-purple-500/30 text-purple-400 text-sm mb-6">
              <Anchor size={13} />
              1000 m · Abyssal Zone · Deepest level monitored
            </div>
            <h2 className="text-4xl font-black text-white mb-4">Platform Modules</h2>
            <p className="text-white/40 max-w-xl mx-auto">
              From surface satellites to 1000m deep — every tool you need for North Indian Ocean intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: LayoutDashboard, label:'Dashboard',       desc:'Live metrics, OHC, MLD, subsurface profile snapshot',    to:'/dashboard', color:'cyan' },
              { icon: Calendar,        label:'7-Day Forecast',  desc:'Sliding window temperature prediction at 15 depth levels', to:'/forecast',  color:'blue' },
              { icon: GitCompare,      label:'Model vs GLORYS', desc:'DL model accuracy vs GLORYS12 reanalysis data',           to:'/compare',   color:'purple' },
              { icon: BarChart2,       label:'Input Data',      desc:'Upload .nc satellite files for reconstruction',           to:'/input',     color:'orange' },
              { icon: Layers,          label:'3D Profile',      desc:'Interactive 3D depth-level slab visualisation',           to:'/map',       color:'teal' },
              { icon: Wind,            label:'Cyclone Pred.',   desc:'Physics-based cyclone risk from OHC and SST',             to:'/cyclone',   color:'red' },
              { icon: Eye,             label:'Surface Obs',     desc:'SST · SSS · SSH · Wind heatmaps',                        to:'/surface',   color:'green' },
              { icon: Database,        label:'Validation',      desc:'ARGO-based per-depth RMSE · Bias · R²',                  to:'/validation',color:'yellow' },
              { icon: MessageSquare,   label:'X AI',            desc:'Natural language Q&A over live ocean data',              to:'/chat',      color:'violet' },
            ].map(({ icon: Icon, label, desc, to, color }) => (
              <button key={to} onClick={() => navigate(to)}
                className={`text-left glass rounded-2xl p-5 border border-${color}-500/20 bg-gradient-to-br from-${color}-500/8 to-transparent hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 group depth-shadow`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-${color}-400 bg-white/5 border border-${color}-500/20 mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={18} />
                </div>
                <h3 className={`font-semibold text-${color}-400 mb-1`}>{label}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
                <div className={`flex items-center gap-1 mt-3 text-xs text-${color}-400 opacity-0 group-hover:opacity-100 transition-opacity`}>
                  Open <ArrowRight size={11} />
                </div>
              </button>
            ))}
          </div>

          {/* Footer depth readout */}
          <div className="text-center mt-20 space-y-3">
            <div className="inline-flex items-center gap-2 text-white/20 text-xs">
              <Waves size={12} />
              You've reached 1000m · North Indian Ocean · 5°N–30°N, 45°E–105°E
            </div>
            <div className="w-px h-12 bg-gradient-to-b from-purple-500/30 to-transparent mx-auto" />
          </div>
        </div>
      </section>
    </div>
  );
}
