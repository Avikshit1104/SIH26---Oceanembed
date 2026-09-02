import { useState } from 'react';
import {
  BookOpen, Cpu, TrendingUp, Activity, Server, Database,
  ArrowRight, CheckCircle, Clock, Zap,
  Globe, Shield, Layers, GitBranch, Wifi,
} from 'lucide-react';
import PageLayout, { SectionHeader } from '../components/PageLayout';

const TABS = [
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'performance',  label: 'Performance',  icon: TrendingUp },
  { id: 'status',       label: 'System Status', icon: Activity },
] as const;

type Tab = typeof TABS[number]['id'];

// ── Architecture tab ──────────────────────────────────────────────────────────
function ArchitectureTab() {
  const layers = [
    {
      title: 'Data Ingestion Layer',
      icon: Database,
      color: 'cyan',
      items: [
        'IMD satellite feeds (INSAT-3D/3DR) — 6-hourly',
        'Argo float buoy network — ~3,800 active floats',
        'ERA5 reanalysis data (ECMWF) — daily batch',
        'INCOIS ocean model outputs (MOM6)',
        'Manual sensor overrides via Input Page',
      ],
    },
    {
      title: 'Processing & Storage',
      icon: Cpu,
      color: 'blue',
      items: [
        'Feature engineering: SST anomalies, OHC, pressure gradients',
        'Time-series store: per-location daily records (PostgreSQL + TimescaleDB)',
        'Object store: model artifacts, heatmap PNGs (S3-compatible)',
        'In-memory cache: latest metrics per region (Redis)',
        'Data validation & QC pipeline (range checks, spike detection)',
      ],
    },
    {
      title: 'ML Training Pipeline',
      icon: GitBranch,
      color: 'purple',
      items: [
        'Scheduled nightly job — cron: 0 2 * * * IST',
        'XGBoost gradient-boosted ensemble (40yr training data)',
        '5-fold cross-validation, early stopping',
        'Feature store: 14-day rolling window per station',
        'Model versioning → /models/cyclone_v{n}.pkl',
        'Decoupled from UI — no live training in browser',
      ],
    },
    {
      title: 'Inference & API Layer',
      icon: Zap,
      color: 'teal',
      items: [
        'Read-only inference endpoint (FastAPI)',
        'Pre-computed predictions served from latest model artifact',
        'REST + WebSocket for real-time metric streaming',
        'Rate limiting: 100 req/min (general), 1000 (government)',
        'JWT authentication with role-based access control',
      ],
    },
    {
      title: 'Frontend (This App)',
      icon: Globe,
      color: 'green',
      items: [
        'React 18 + Vite + TypeScript',
        'Three.js / @react-three/fiber — 3D globe',
        'Recharts — analytics charts',
        'Tailwind CSS v4 — glassmorphism design system',
        'React Router v6 — client-side routing',
        'Two auth tiers: General Analyst + Government Officer',
      ],
    },
    {
      title: 'Government Alert System',
      icon: Shield,
      color: 'orange',
      items: [
        'Threshold-triggered alerts (risk score > 55)',
        'Recipients: NDMA HQ, IMD, coastal state SDMAs, Navy',
        'Delivery: Email (SMTP) + SMS (NIC gateway) + API webhook',
        'Audit log: timestamp, recipient, trigger, acknowledgement',
        'Alert fatigue prevention: 4h cooldown per region',
      ],
    },
  ];

  const colorMap: Record<string, string> = {
    cyan:   'from-cyan-500/15 to-cyan-900/5 border-cyan-500/25 text-cyan-400',
    blue:   'from-blue-500/15 to-blue-900/5 border-blue-500/25 text-blue-400',
    purple: 'from-purple-500/15 to-purple-900/5 border-purple-500/25 text-purple-400',
    teal:   'from-teal-500/15 to-teal-900/5 border-teal-500/25 text-teal-400',
    green:  'from-green-500/15 to-green-900/5 border-green-500/25 text-green-400',
    orange: 'from-orange-500/15 to-orange-900/5 border-orange-500/25 text-orange-400',
  };

  return (
    <div className="space-y-8 fade-in-up">
      {/* Data flow diagram */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-6 flex items-center gap-2">
          <Layers size={16} className="text-cyan-400" />
          End-to-End Data Flow
        </h2>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center gap-2 min-w-max">
            {[
              { label: 'Satellites\n& Buoys', color: 'cyan' },
              { label: 'Ingestion\n& QC', color: 'blue' },
              { label: 'Feature\nStore', color: 'purple' },
              { label: 'Nightly\nML Job', color: 'purple' },
              { label: 'Model\nArtifacts', color: 'teal' },
              { label: 'Inference\nAPI', color: 'teal' },
              { label: 'Dashboard\n& Alerts', color: 'orange' },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className={`rounded-xl px-3 py-2.5 border bg-gradient-to-br text-center ${colorMap[step.color]} min-w-[80px]`}>
                  {step.label.split('\n').map((l, j) => (
                    <p key={j} className={`text-xs font-medium ${j === 0 ? `text-${step.color}-400` : 'text-white/50 mt-0.5'}`}>{l}</p>
                  ))}
                </div>
                {i < 6 && <ArrowRight size={14} className="text-white/20 mx-1 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/30 mt-4">
          Input Page submissions enter the Feature Store directly and influence the next nightly training run.
        </p>
      </div>

      {/* Layer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {layers.map(({ title, icon: Icon, color, items }) => (
          <div key={title} className={`glass rounded-2xl p-5 border bg-gradient-to-br ${colorMap[color]}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border ${colorMap[color].split(' ')[2]}`}>
                <Icon size={16} className={colorMap[color].split(' ')[3]} />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
            </div>
            <ul className="space-y-1.5">
              {items.map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-white/60">
                  <span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${colorMap[color].split(' ')[3].replace('text-', 'bg-')}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Tech stack table */}
      <div className="glass rounded-2xl p-6 border border-white/10 overflow-x-auto">
        <h2 className="font-bold text-white mb-4">Tech Stack</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Component', 'Technology', 'Version', 'Purpose'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-white/40 font-medium text-xs uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Frontend', 'React + Vite', '18 / 6.x', 'UI framework'],
              ['3D Rendering', 'Three.js + R3F', '0.170 / 9.x', 'Globe & heatmap'],
              ['Charts', 'Recharts', '2.x', 'Analytics'],
              ['Styles', 'Tailwind CSS', 'v4', 'Glassmorphism'],
              ['Routing', 'React Router', 'v6', 'Client routing'],
              ['ML Model', 'XGBoost', '2.x', 'Cyclone prediction'],
              ['API', 'FastAPI', '0.115', 'Inference endpoint'],
              ['DB', 'PostgreSQL + Timescale', '16 / 2.x', 'Time-series data'],
              ['Cache', 'Redis', '7.x', 'Real-time metrics'],
              ['Storage', 'MinIO / S3', 'latest', 'Model artifacts'],
            ].map(row => (
              <tr key={row[0]} className="border-b border-white/5 hover:bg-white/3 transition-all">
                {row.map((cell, i) => (
                  <td key={i} className={`px-3 py-2.5 text-xs ${i === 0 ? 'text-white font-medium' : 'text-white/60'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Performance tab ────────────────────────────────────────────────────────────
function PerformanceTab() {
  const metrics = [
    { label: 'Model Track Error (24h)', value: '85 km', target: '< 120 km', status: 'good' },
    { label: 'Model Track Error (72h)', value: '152 km', target: '< 200 km', status: 'good' },
    { label: 'Intensity Accuracy (±1 cat)', value: '81.3%', target: '> 75%', status: 'good' },
    { label: 'False Positive Rate', value: '4.2%', target: '< 10%', status: 'good' },
    { label: 'API P99 Latency', value: '142 ms', target: '< 500 ms', status: 'good' },
    { label: 'Dashboard Load Time', value: '1.8 s', target: '< 3 s', status: 'good' },
    { label: 'Data Ingestion Lag', value: '6.1 min', target: '< 10 min', status: 'good' },
    { label: 'Model Training Time', value: '17 min', target: '< 30 min', status: 'good' },
    { label: 'Uptime (30d)', value: '99.87%', target: '> 99.5%', status: 'good' },
    { label: 'Alert Delivery Success', value: '99.2%', target: '> 98%', status: 'good' },
  ];

  const benchmarks = [
    { name: 'IMD NWP Model (Baseline)', track24: 120, track72: 230, intensity: 68, color: '#64748b' },
    { name: 'OceanIntel v42 (Current)', track24: 85, track72: 152, intensity: 81, color: '#06b6d4' },
    { name: 'OceanIntel v35 (Last)',    track24: 98, track72: 188, intensity: 74, color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-8 fade-in-up">
      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(({ label, value, target }) => (
          <div key={label} className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-white/50">{label}</p>
              <CheckCircle size={14} className="text-green-400 shrink-0" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/30 mt-1">Target: {target}</p>
          </div>
        ))}
      </div>

      {/* Model comparison */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-6">Model Benchmark Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Model', 'Track Error 24h', 'Track Error 72h', 'Intensity Acc.', 'Improvement'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-white/40 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b, i) => (
                <tr key={b.name} className={`border-b border-white/5 ${i === 1 ? 'bg-cyan-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                      <span className="text-white text-xs">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.color }}>{b.track24} km</td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.color }}>{b.track72} km</td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.color }}>{b.intensity}%</td>
                  <td className="px-4 py-3 text-xs text-green-400">
                    {i === 1 ? '↑ 29% vs baseline' : i === 2 ? '↑ 18% vs baseline' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual bars */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-6">Performance vs Targets</h2>
        <div className="space-y-4">
          {[
            { label: 'Model Intensity Accuracy', value: 81.3, target: 75, max: 100, unit: '%', color: 'bg-cyan-400' },
            { label: 'API Uptime', value: 99.87, target: 99.5, max: 100, unit: '%', color: 'bg-green-400' },
            { label: 'Alert Delivery', value: 99.2, target: 98, max: 100, unit: '%', color: 'bg-purple-400' },
            { label: 'Data Coverage (Indian Ocean)', value: 87.4, target: 80, max: 100, unit: '%', color: 'bg-blue-400' },
          ].map(({ label, value, target, max, unit, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/60">{label}</span>
                <span className="text-white font-medium">{value}{unit}</span>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${(value / max) * 100}%` }} />
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                  style={{ left: `${(target / max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-white/25 mt-1">Target: {target}{unit}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── System Status tab ─────────────────────────────────────────────────────────
function StatusTab() {
  const services = [
    { name: 'Data Ingestion Pipeline', status: 'operational', latency: '< 6min lag', uptime: '99.9%' },
    { name: 'ML Training Job (Nightly)', status: 'operational', latency: 'Last: 02:17 IST', uptime: '100%' },
    { name: 'Inference API', status: 'operational', latency: '142ms p99', uptime: '99.87%' },
    { name: 'Government Alert System', status: 'operational', latency: '< 30s delivery', uptime: '99.2%' },
    { name: 'Dashboard Frontend', status: 'operational', latency: '1.8s load', uptime: '99.95%' },
    { name: 'Database (TimescaleDB)', status: 'operational', latency: '8ms p99', uptime: '99.99%' },
    { name: 'Redis Cache', status: 'degraded', latency: '45ms p99', uptime: '98.3%' },
    { name: 'Object Storage (MinIO)', status: 'operational', latency: '22ms p99', uptime: '99.99%' },
    { name: 'IMD Satellite Feed', status: 'operational', latency: '6h cadence', uptime: '99.5%' },
    { name: 'INCOIS Data Feed', status: 'maintenance', latency: 'Scheduled 03:00–05:00', uptime: '—' },
  ];

  const statusConfig = {
    operational: { color: 'text-green-400', bg: 'bg-green-400', label: 'Operational' },
    degraded:    { color: 'text-yellow-400', bg: 'bg-yellow-400', label: 'Degraded' },
    maintenance: { color: 'text-blue-400',   bg: 'bg-blue-400',   label: 'Maintenance' },
    outage:      { color: 'text-red-400',     bg: 'bg-red-400',    label: 'Outage' },
  };

  const operational = services.filter(s => s.status === 'operational').length;
  const degraded    = services.filter(s => s.status === 'degraded').length;
  const maintenance = services.filter(s => s.status === 'maintenance').length;

  return (
    <div className="space-y-8 fade-in-up">
      {/* Overall status */}
      <div className="glass rounded-2xl p-6 border border-green-500/25 bg-gradient-to-br from-green-500/10 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" />
          <h2 className="text-xl font-bold text-white">All Core Systems Operational</h2>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-3xl font-black text-green-400">{operational}</p>
            <p className="text-xs text-white/50">Operational</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-yellow-400">{degraded}</p>
            <p className="text-xs text-white/50">Degraded</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-blue-400">{maintenance}</p>
            <p className="text-xs text-white/50">Maintenance</p>
          </div>
          <div className="text-center ml-auto">
            <p className="text-2xl font-bold text-white">99.87%</p>
            <p className="text-xs text-white/50">30-day uptime</p>
          </div>
        </div>
      </div>

      {/* Service table */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Server size={16} className="text-cyan-400" />
            Service Health
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Wifi size={12} className="text-green-400" />
            Live monitoring
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {services.map(svc => {
            const cfg = statusConfig[svc.status as keyof typeof statusConfig];
            return (
              <div key={svc.name} className="flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-all">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${cfg.bg} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                  <div>
                    <p className="text-sm text-white">{svc.name}</p>
                    <p className="text-xs text-white/30">{svc.latency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white/40 hidden sm:block">{svc.uptime}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg.replace('bg-', 'bg-').replace('400', '500/15')} border-current/30`}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident history */}
      <div className="glass rounded-2xl p-6 border border-white/10">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={16} className="text-cyan-400" />
          Recent Incidents
        </h2>
        <div className="space-y-4">
          {[
            { date: 'Sep 1, 2026', title: 'Redis Cache Degradation', status: 'ongoing', desc: 'Memory pressure causing elevated latency. Mitigation in progress — capacity upgrade scheduled.' },
            { date: 'Aug 28, 2026', title: 'INCOIS Feed Latency', status: 'resolved', desc: 'Ingestion lag of 45min due to upstream API timeout. Resolved after 2h by switching to backup endpoint.' },
            { date: 'Aug 21, 2026', title: 'Alert Delivery Delay', status: 'resolved', desc: 'SMTP relay issue caused 8-minute delay in government alerts. Failover to backup SMTP resolved the issue.' },
          ].map(inc => (
            <div key={inc.title} className={`p-4 rounded-xl border ${
              inc.status === 'ongoing' ? 'border-yellow-500/25 bg-yellow-500/8' : 'border-white/8 bg-white/3'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm font-medium text-white">{inc.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  inc.status === 'ongoing'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-green-500/15 text-green-400 border border-green-500/25'
                }`}>
                  {inc.status === 'ongoing' ? 'Ongoing' : 'Resolved'}
                </span>
              </div>
              <p className="text-xs text-white/30 mb-2">{inc.date}</p>
              <p className="text-xs text-white/60">{inc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('architecture');

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Documentation"
          subtitle="Platform architecture, performance benchmarks, and live system health — restricted to authenticated users"
          icon={<BookOpen size={16} className="text-cyan-400" />}
        />

        {/* Auth notice */}
        <div className="flex items-center gap-2 mb-8 p-3 rounded-xl glass border border-green-500/20 text-green-400 text-sm w-fit">
          <Shield size={14} />
          Authenticated access — General Analyst
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-8 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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

        {activeTab === 'architecture' && <ArchitectureTab />}
        {activeTab === 'performance'  && <PerformanceTab />}
        {activeTab === 'status'       && <StatusTab />}
      </div>
    </PageLayout>
  );
}
