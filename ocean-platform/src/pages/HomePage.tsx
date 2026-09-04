import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Waves, MessageSquare, LayoutDashboard, Globe, Wind,
  Thermometer, BarChart2, ArrowRight, Activity, Layers,
  Database, Calendar, GitCompare, Fish, Anchor, Zap,
  TrendingDown, Eye, Navigation,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { DEPTH_LEVELS } from '../contexts/DataContext';

// ── Depth zones ────────────────────────────────────────────────────────────────
const DEPTH_ZONES = [
  {
    id: 'surface', depth: 0,
    label: 'Surface (0 m)', color: '#ef4444',
    bg: 'from-red-950/40 via-[#020917] to-[#020917]',
    icon: Waves,
    title: 'Sea Surface — Where Satellites Watch',
    desc: 'The ocean surface is our window into the deep. Satellites measure SST, SSS, SSH and currents every day at 0.25° resolution across the entire North Indian Ocean.',
    facts: [
      { label: 'SST Range',     value: '24°C – 32°C',        icon: Thermometer },
      { label: 'Satellite Obs', value: '8 per day',           icon: Eye },
      { label: 'Resolution',    value: '0.25° × 0.25°',       icon: Navigation },
      { label: 'Sources',       value: 'MODIS · VIIRS · AVHRR', icon: Globe },
    ],
    feature: { label: 'Surface Obs', to: '/surface', desc: 'View live SST, SSS, SSH heatmaps' },
  },
  {
    id: 'mixed', depth: 30,
    label: 'Mixed Layer (30 m)', color: '#f97316',
    bg: 'from-orange-950/40 via-[#020917] to-[#020917]',
    icon: Layers,
    title: 'Mixed Layer — Wind-Driven Uniformity',
    desc: 'Wind-driven turbulence keeps the upper 20–80 m nearly uniform in temperature. MLD determines how much thermal energy is available to fuel tropical cyclones.',
    facts: [
      { label: 'Typical MLD', value: '30 – 80 m',      icon: TrendingDown },
      { label: 'Effect',      value: 'Cyclone fuel',    icon: Wind },
      { label: 'Driver',      value: 'Wind stress',     icon: Wind },
      { label: 'Season',      value: 'Deeper in winter', icon: Calendar },
    ],
    feature: { label: '7-Day Forecast', to: '/forecast', desc: 'Predict MLD evolution over next week' },
  },
  {
    id: 'thermocline', depth: 100,
    label: 'Thermocline (75–200 m)', color: '#fbbf24',
    bg: 'from-yellow-950/30 via-[#020917] to-[#020917]',
    icon: TrendingDown,
    title: 'Thermocline — The Great Divider',
    desc: 'Temperature drops sharply — 10–15°C within just 100 m. SSH anomalies from mesoscale eddies displace this layer up or down, directly controlling Ocean Heat Content.',
    facts: [
      { label: 'Temp Drop',  value: '~15°C per 100 m', icon: Thermometer },
      { label: 'Depth',      value: '75 – 200 m',      icon: Layers },
      { label: 'SSH Link',   value: 'Eddy coupling',   icon: Waves },
      { label: 'OHC Driver', value: 'Critical zone',   icon: Zap },
    ],
    feature: { label: '3D Profile View', to: '/map', desc: 'Visualise thermocline in 3D depth slabs' },
  },
  {
    id: 'meso', depth: 300,
    label: 'Mesopelagic (200–1000 m)', color: '#06b6d4',
    bg: 'from-cyan-950/30 via-[#020917] to-[#020917]',
    icon: Fish,
    title: 'Twilight Zone — Life Without Light',
    desc: 'From 200 m to 1000 m, sunlight barely penetrates. Temperature stabilises at 5–15°C. The largest animal migration on Earth happens here nightly.',
    facts: [
      { label: 'Temp Range', value: '5°C – 15°C',      icon: Thermometer },
      { label: 'Light',      value: '< 1% of surface', icon: Eye },
      { label: 'Biomass',    value: 'Highest density', icon: Activity },
      { label: 'Key depths', value: '200 · 300 · 500m', icon: Layers },
    ],
    feature: { label: 'Input Data', to: '/input', desc: 'Upload .nc files for reconstruction' },
  },
  {
    id: 'deep', depth: 700,
    label: 'Deep Ocean (700–1000 m)', color: '#3b82f6',
    bg: 'from-blue-950/40 via-[#020917] to-[#020917]',
    icon: Anchor,
    title: 'The Deep — Cold, Dark, Stable',
    desc: 'Near-freezing, pitch black, enormous pressure. Temperature changes are fractions of a degree. These waters hold centuries of climate memory.',
    facts: [
      { label: 'Temp',      value: '2°C – 6°C',      icon: Thermometer },
      { label: 'Pressure',  value: '> 70 atm',        icon: Waves },
      { label: 'Timescale', value: 'Centuries',        icon: Calendar },
      { label: 'ARGO',      value: 'Floats to 2000 m', icon: Database },
    ],
    feature: { label: 'Model vs GLORYS', to: '/compare', desc: 'Compare DL model vs reanalysis' },
  },
];

// ── Full-height depth meter ────────────────────────────────────────────────────
function DepthMeter({ depth }: { depth: number }) {
  const pct = Math.min((depth / 1000) * 100, 100);
  const markers = [
    { m: 0,    label: '0', zone: 'Surface' },
    { m: 100,  label: '100', zone: 'Thermo' },
    { m: 300,  label: '300', zone: 'Meso' },
    { m: 700,  label: '700', zone: 'Deep' },
    { m: 1000, label: '1k', zone: 'Abyss' },
  ];

  const depthColor =
    depth < 30  ? '#ef4444' :
    depth < 100 ? '#f97316' :
    depth < 300 ? '#fbbf24' :
    depth < 700 ? '#06b6d4' : '#3b82f6';

  return (
    <div className="fixed left-0 top-0 bottom-0 z-40 hidden lg:block" style={{ width: '44px' }}>
      {/* Frosted glass backdrop */}
      <div className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(2,9,23,0.92) 0%, rgba(4,18,44,0.95) 50%, rgba(2,9,23,0.92) 100%)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }} />

      <div className="relative h-full flex flex-col items-center">
        {/* DEPTH label */}
        <div className="pt-[72px] pb-4">
          <span className="text-[8px] font-bold tracking-[0.3em] uppercase text-white/20"
            style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            DEPTH
          </span>
        </div>

        {/* Track */}
        <div className="relative flex-1 mb-4" style={{ width: '3px' }}>
          {/* Empty track */}
          <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

          {/* Filled gradient */}
          <div className="absolute top-0 left-0 right-0 rounded-full transition-all duration-700"
            style={{
              height: `${pct}%`,
              background: 'linear-gradient(to bottom,#ef4444 0%,#f97316 22%,#fbbf24 42%,#06b6d4 68%,#3b82f6 85%,#7c3aed 100%)',
              boxShadow: `0 0 6px 1px ${depthColor}77`,
            }} />

          {/* Glowing orb tip */}
          <div className="absolute left-1/2 rounded-full transition-all duration-700"
            style={{
              width: '11px', height: '11px',
              top: `calc(${pct}% - 5px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              background: `radial-gradient(circle at 35% 35%, #fff, ${depthColor})`,
              boxShadow: `0 0 14px 5px ${depthColor}88, 0 0 4px 1px #fff4`,
            }} />

          {/* Tick marks + labels */}
          {markers.map(({ m, label }) => {
            const tp   = (m / 1000) * 100;
            const near = Math.abs(m - depth) < 90;
            return (
              <div key={m} className="absolute" style={{ top: `${tp}%`, left: '50%' }}>
                {/* Tick extending right */}
                <div className="absolute h-px transition-all duration-300"
                  style={{
                    left: '6px', width: near ? '10px' : '6px',
                    top: '0px',
                    background: near ? depthColor : 'rgba(255,255,255,0.12)',
                    boxShadow: near ? `0 0 5px ${depthColor}` : 'none',
                  }} />
                {/* Label */}
                <span className="absolute text-[8px] font-mono transition-all duration-300"
                  style={{
                    left: '18px', top: '-5px',
                    color: near ? depthColor : 'rgba(255,255,255,0.14)',
                    fontWeight: near ? 800 : 400,
                    textShadow: near ? `0 0 8px ${depthColor}` : 'none',
                  }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current depth badge */}
        <div className="pb-6 flex flex-col items-center gap-0.5">
          <div className="rounded-lg px-1.5 py-1.5 text-center transition-all duration-500"
            style={{
              background: `${depthColor}15`,
              border: `1px solid ${depthColor}35`,
              minWidth: '36px',
              boxShadow: `0 0 12px ${depthColor}33`,
            }}>
            <span className="text-[11px] font-black font-mono leading-tight block transition-all duration-500"
              style={{ color: depthColor, textShadow: `0 0 8px ${depthColor}` }}>
              {Math.round(depth)}
            </span>
            <span className="text-[7px] text-white/20 font-mono">m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Glass prism panel (macOS Tahoe-inspired) ──────────────────────────────────
function PrismCard({ children, className = '', glowColor = '#06b6d4' }: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: `
          linear-gradient(135deg,
            rgba(255,255,255,0.10) 0%,
            rgba(255,255,255,0.04) 40%,
            rgba(255,255,255,0.08) 100%)
        `,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.06) inset,
          0 1px 0 rgba(255,255,255,0.18) inset,
          0 -1px 0 rgba(0,0,0,0.2) inset,
          0 8px 40px rgba(0,0,0,0.4),
          0 0 60px ${glowColor}22
        `,
      }}
    >
      {/* Rainbow specular streak — the prism effect */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-40%', left: '-20%',
          width: '60%', height: '180%',
          background: `linear-gradient(
            105deg,
            transparent 30%,
            rgba(255,120,120,0.06) 38%,
            rgba(255,200,80,0.07)  42%,
            rgba(120,255,180,0.07) 46%,
            rgba(80,180,255,0.08)  50%,
            rgba(160,80,255,0.06)  54%,
            transparent 62%
          )`,
          transform: 'rotate(-15deg)',
        }}
      />
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }} />
      {children}
    </div>
  );
}

// ── Animated stat counter ─────────────────────────────────────────────────────
function AnimNum({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let v = 0;
    const step = target / 60;
    const t = setInterval(() => {
      v += step;
      if (v >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(v));
    }, 16);
    return () => clearInterval(t);
  }, [target]);
  return <>{val.toLocaleString()}{suffix}</>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const [scrollDepth, setScrollDepth] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const docH = document.body.scrollHeight - window.innerHeight;
      setScrollDepth(docH > 0 ? Math.round((window.scrollY / docH) * 1000) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <Navbar />
      <DepthMeter depth={scrollDepth} />

      {/* All content shifted right to clear the depth meter */}
      <div className="lg:pl-11">

        {/* ── HERO ── */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
          {/* Background layers */}
          <div className="absolute inset-0">
            <div className="absolute inset-0" style={{ background: 'transparent' }} />
            <div className="absolute inset-0"
              style={{ backgroundImage: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(6,182,212,0.12), transparent)' }} />
            {/* Subtle bioluminescence flickers */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute rounded-full"
                style={{
                  width:  `${2 + Math.random() * 3}px`,
                  height: `${2 + Math.random() * 3}px`,
                  left:   `${10 + i * 11}%`,
                  top:    `${20 + (i % 3) * 25}%`,
                  background: '#06b6d4',
                  animation: `pulse ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
                  opacity: 0.4,
                }} />
            ))}
          </div>

          <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-10"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#06b6d4' }}>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              0 m · Sea Surface · Real-time monitoring active
            </div>

            <h1 className="text-5xl sm:text-7xl font-black mb-6 leading-tight tracking-tight">
              <span style={{ background: 'linear-gradient(135deg,#06b6d4 0%,#3b82f6 50%,#8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Ocean &amp; Climate
              </span>
              <br />
              <span className="text-white">Intelligence Platform</span>
            </h1>

            <p className="text-white/50 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
              Reconstructing the{' '}
              <span className="text-cyan-400 font-semibold">subsurface ocean</span>{' '}
              from satellite observations using deep learning embeddings —{' '}
              15 depth levels, 0 to 1000 m, across the North Indian Ocean.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4 justify-center mb-16">
              <button onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', boxShadow: '0 0 30px rgba(6,182,212,0.35)' }}>
                Open Dashboard <ArrowRight size={16} />
              </button>
              <button onClick={() => navigate('/forecast')}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white hover:scale-105 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}>
                <Calendar size={16} className="text-cyan-400" />
                7-Day Forecast
              </button>
              <button onClick={() => navigate('/chat')}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white hover:scale-105 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}>
                <MessageSquare size={16} className="text-purple-400" />
                Ask X AI
              </button>
            </div>

            {/* Stats — prism cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { label: 'Depth Levels', value: 15,    suffix: '',  glow: '#06b6d4' },
                { label: 'Max Depth',    value: 1000,  suffix: 'm', glow: '#3b82f6' },
                { label: 'Grid Points',  value: 40000, suffix: '+', glow: '#8b5cf6' },
                { label: 'Accuracy',     value: 94,    suffix: '%', glow: '#10b981' },
              ].map(({ label, value, suffix, glow }) => (
                <PrismCard key={label} glowColor={glow} className="p-4 text-center">
                  <p className="text-2xl font-black"
                    style={{ background: `linear-gradient(135deg,${glow},#fff)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    <AnimNum target={value} suffix={suffix} />
                  </p>
                  <p className="text-white/40 text-xs mt-1">{label}</p>
                </PrismCard>
              ))}
            </div>

            <div className="mt-16 flex flex-col items-center gap-2 text-white/20 text-xs animate-bounce">
              <span>Scroll to dive deeper</span>
              <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent" />
            </div>
          </div>
        </section>

        {/* ── DEPTH ZONE SECTIONS ── */}
        {DEPTH_ZONES.map((zone, zi) => {
          const Icon = zone.icon;
          return (
            <section key={zone.id} className={`relative min-h-screen flex items-center py-24 overflow-hidden bg-gradient-to-b ${zone.bg}`}>

              {/* Horizontal pressure lines */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="absolute left-0 right-0 h-px pointer-events-none"
                  style={{ top: `${15 + i * 17}%`, background: `linear-gradient(90deg, transparent 5%, ${zone.color}20, transparent 95%)` }} />
              ))}

              <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center`}>

                  {/* Text — alternates sides */}
                  <div className={zi % 2 === 1 ? 'lg:order-2' : ''}>
                    {/* Zone pill */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm mb-6"
                      style={{ background: zone.color + '20', border: `1px solid ${zone.color}50`, color: zone.color }}>
                      <Icon size={13} />
                      {zone.label}
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-5 leading-tight">
                      {zone.title}
                    </h2>
                    <p className="text-white/55 text-base leading-relaxed mb-8">{zone.desc}</p>

                    {/* Fact cards — prism style */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                      {zone.facts.map(({ label, value, icon: FIcon }) => (
                        <PrismCard key={label} glowColor={zone.color} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: zone.color + '25', border: `1px solid ${zone.color}45` }}>
                              <FIcon size={13} style={{ color: zone.color }} />
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
                              <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
                            </div>
                          </div>
                        </PrismCard>
                      ))}
                    </div>

                    {/* CTA */}
                    <button onClick={() => navigate(zone.feature.to)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-90 hover:scale-105 transition-all"
                      style={{ background: `linear-gradient(135deg, ${zone.color}dd, ${zone.color}88)`, boxShadow: `0 0 20px ${zone.color}44` }}>
                      <ArrowRight size={14} />
                      {zone.feature.label}
                    </button>
                    <p className="text-white/25 text-xs mt-2">{zone.feature.desc}</p>
                  </div>

                  {/* Visual — depth column */}
                  <div className={`${zi % 2 === 1 ? 'lg:order-1' : ''} flex items-center justify-center`}>
                    <div className="relative flex gap-4">
                      {/* Depth slab column */}
                      <div className="flex flex-col-reverse rounded-2xl overflow-hidden border border-white/10"
                        style={{ width: '56px', height: '380px', boxShadow: `0 0 40px ${zone.color}30` }}>
                        {DEPTH_LEVELS.map((d) => {
                          const isActive = d >= zone.depth && d < (DEPTH_ZONES[zi + 1]?.depth ?? 1001);
                          const temp = 28 - (d / 1000) * 26;
                          const n = Math.max(0, Math.min(1, (temp - 2) / 27));
                          const bg = n < 0.25 ? '#1e40af' : n < 0.5 ? '#06b6d4' : n < 0.75 ? '#fbbf24' : '#ef4444';
                          return (
                            <div key={d} title={`${d}m · ${temp.toFixed(1)}°C`}
                              className="flex-1 transition-all duration-300"
                              style={{
                                background: bg,
                                opacity: isActive ? 1 : 0.3,
                                filter: isActive ? `brightness(1.3) drop-shadow(0 0 4px ${bg})` : 'none',
                              }} />
                          );
                        })}
                      </div>

                      {/* Depth labels */}
                      <div className="flex flex-col-reverse justify-between py-0.5"
                        style={{ height: '380px' }}>
                        {DEPTH_LEVELS.filter((_, i) => i % 2 === 0).map(d => {
                          const isActive = d >= zone.depth && d < (DEPTH_ZONES[zi + 1]?.depth ?? 1001);
                          return (
                            <span key={d}
                              className="text-[10px] font-mono transition-all duration-300"
                              style={{ color: isActive ? zone.color : 'rgba(255,255,255,0.2)', fontWeight: isActive ? 700 : 400 }}>
                              {d}m
                            </span>
                          );
                        })}
                      </div>

                      {/* Active zone badge */}
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full">
                        <PrismCard glowColor={zone.color} className="px-3 py-1.5">
                          <span className="text-xs whitespace-nowrap" style={{ color: zone.color }}>
                            ← Active
                          </span>
                        </PrismCard>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        {/* ── 1000m — Abyssal — Feature Grid ── */}
        <section className="relative py-28 overflow-hidden">
          <div className="absolute inset-0" style={{ background: 'transparent' }} />
          <div className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% 90%, rgba(124,58,237,0.14), transparent)' }} />

          <div className="relative z-10 max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm mb-6"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa' }}>
                <Anchor size={13} />
                1000 m · Abyssal Zone · Deepest level monitored
              </div>
              <h2 className="text-4xl font-black text-white mb-4">Platform Modules</h2>
              <p className="text-white/40 max-w-xl mx-auto">
                From surface satellites to 1000 m deep — every tool you need for North Indian Ocean intelligence
              </p>
            </div>

            {/* Module cards — prism style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: LayoutDashboard, label: 'Dashboard',       desc: 'Live OHC, MLD, subsurface profile snapshot', to: '/dashboard', glow: '#06b6d4' },
                { icon: Calendar,        label: '7-Day Forecast',  desc: 'Sliding window temp prediction at 15 depths', to: '/forecast',  glow: '#3b82f6' },
                { icon: GitCompare,      label: 'Model vs GLORYS', desc: 'DL model accuracy vs GLORYS12 reanalysis',    to: '/compare',   glow: '#8b5cf6' },
                { icon: BarChart2,       label: 'Input Data',      desc: 'Upload .nc satellite files',                  to: '/input',     glow: '#f97316' },
                { icon: Layers,          label: '3D Profile',      desc: 'Interactive 3D depth-level slab view',        to: '/map',       glow: '#14b8a6' },
                { icon: Wind,            label: 'Cyclone Pred.',   desc: 'Physics-based cyclone risk from OHC + SST',   to: '/cyclone',   glow: '#ef4444' },
                { icon: Eye,             label: 'Surface Obs',     desc: 'SST · SSS · SSH · Wind heatmaps',             to: '/surface',   glow: '#10b981' },
                { icon: Database,        label: 'Validation',      desc: 'ARGO-based per-depth RMSE · Bias · R²',       to: '/validation',glow: '#eab308' },
                { icon: MessageSquare,   label: 'X AI',            desc: 'Natural language Q&A over ocean data',        to: '/chat',      glow: '#a78bfa' },
              ].map(({ icon: Icon, label, desc, to, glow }) => (
                <button key={to} onClick={() => navigate(to)}
                  className="text-left group hover:scale-[1.03] hover:-translate-y-1 transition-all duration-200">
                  <PrismCard glowColor={glow} className="p-5 h-full">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{ background: glow + '20', border: `1px solid ${glow}40` }}>
                      <Icon size={18} style={{ color: glow }} />
                    </div>
                    <h3 className="font-semibold mb-1" style={{ color: glow }}>{label}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: glow }}>
                      Open <ArrowRight size={11} />
                    </div>
                  </PrismCard>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="text-center mt-20 space-y-3">
              <div className="inline-flex items-center gap-2 text-white/20 text-xs">
                <Waves size={12} />
                You've reached 1000 m · North Indian Ocean · 5°N–30°N, 45°E–105°E
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-purple-500/30 to-transparent mx-auto" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
