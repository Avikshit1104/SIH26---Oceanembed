import { useState, useCallback } from 'react';
import {
  BarChart2, Calendar, MapPin, Thermometer, Droplets,
  Wind, Waves, ArrowUpDown, CheckCircle2, Loader2,
  History, ChevronRight, ChevronDown, Layers, Activity,
  Navigation, TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, generateProfile, DEPTH_LEVELS, type DayRecord, type SurfaceInputs } from '../contexts/DataContext';

// North Indian Ocean locations at 0.25° resolution
const LOCATIONS = [
  { name: 'Bay of Bengal (NE)',  lat: 15.5, lon: 88.0 },
  { name: 'Bay of Bengal (SW)', lat: 10.0, lon: 82.0 },
  { name: 'Arabian Sea (NW)',    lat: 20.0, lon: 63.0 },
  { name: 'Arabian Sea (SE)',    lat: 12.0, lon: 70.0 },
  { name: 'Lakshadweep Sea',     lat: 11.0, lon: 73.0 },
  { name: 'Gulf of Mannar',      lat: 8.8,  lon: 79.0 },
  { name: 'BoB Central',         lat: 14.0, lon: 87.0 },
  { name: 'AS Central',          lat: 17.0, lon: 65.0 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl border border-white/15 p-3 text-xs space-y-1 shadow-xl">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

// Depth profile chart (horizontal: temp, vertical: depth)
function DepthProfileChart({ profile }: { profile: DayRecord['profile'] }) {
  const data = profile.depths.map((d, i) => ({
    depth: d,
    Reconstructed: +profile.temperatures[i].toFixed(2),
    ARGO: profile.argoTemps?.[i] != null ? +profile.argoTemps[i].toFixed(2) : undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          type="number" domain={['auto', 'auto']}
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false}
          label={{ value: 'Temperature (°C)', fill: 'rgba(255,255,255,0.3)', fontSize: 10, position: 'insideBottom', offset: -2 }}
        />
        <YAxis
          type="number" dataKey="depth" reversed
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false}
          label={{ value: 'Depth (m)', fill: 'rgba(255,255,255,0.3)', fontSize: 10, angle: -90, position: 'insideLeft' }}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="Reconstructed" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 3 }} name="Reconstructed (°C)" />
        <Line type="monotone" dataKey="ARGO" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: '#10b981', r: 2 }} name="ARGO Obs (°C)" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function InputPage() {
  const { records, addRecord } = useData();
  const today = new Date().toISOString().split('T')[0];

  // Form state — satellite surface variables
  const [date, setDate] = useState(today);
  const [locationName, setLocationName] = useState('Bay of Bengal (NE)');
  const [sst, setSst]         = useState('28.5');
  const [sss, setSss]         = useState('34.2');
  const [ssh, setSsh]         = useState('5.0');
  const [sla, setSla]         = useState('3.2');
  const [ucurrent, setUcurrent] = useState('0.15');
  const [vcurrent, setVcurrent] = useState('-0.08');
  const [uwind, setUwind]     = useState('4.5');
  const [vwind, setVwind]     = useState('-2.1');

  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<DayRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const selectedLoc = LOCATIONS.find(l => l.name === locationName) ?? LOCATIONS[0];

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 2200));

    const inputs: SurfaceInputs = {
      sst: parseFloat(sst),
      sss: parseFloat(sss),
      ssh: parseFloat(ssh),
      sla: parseFloat(sla),
      ucurrent: parseFloat(ucurrent),
      vcurrent: parseFloat(vcurrent),
      uwind: parseFloat(uwind),
      vwind: parseFloat(vwind),
    };

    const profile = generateProfile(inputs.sst, inputs.ssh, date, selectedLoc.lat);
    const mld = 30 + Math.abs(inputs.ssh) * 0.5;
    const ohc = inputs.sst * 3 + inputs.ssh * 0.5 + 45;
    const thermoclineDepth = 75 + inputs.ssh * 0.8;

    const record = addRecord({
      date, location: locationName,
      lat: selectedLoc.lat, lon: selectedLoc.lon,
      inputs, profile, mld, ohc, thermoclineDepth,
      embeddingVector: Array.from({ length: 8 }, () => Math.random() * 2 - 1),
    });
    setResult(record);
    setLoading(false);
  }, [date, locationName, selectedLoc, sst, sss, ssh, sla, ucurrent, vcurrent, uwind, vwind, addRecord]);

  // Surface variable input fields
  const surfaceFields = [
    { label: 'SST',     fullLabel: 'Sea Surface Temperature', unit: '°C',   value: sst,      set: setSst,      icon: Thermometer,  min: '15', max: '35', step: '0.01', color: 'text-red-400',    desc: 'MODIS/VIIRS/AVHRR' },
    { label: 'SSS',     fullLabel: 'Sea Surface Salinity',    unit: 'PSU',  value: sss,      set: setSss,      icon: Droplets,     min: '28', max: '40', step: '0.01', color: 'text-blue-400',   desc: 'SMOS/Aquarius' },
    { label: 'SSH',     fullLabel: 'Sea Surface Height',      unit: 'cm',   value: ssh,      set: setSsh,      icon: Waves,        min: '-50',max: '50', step: '0.1',  color: 'text-cyan-400',   desc: 'Jason-3/Sentinel-6' },
    { label: 'SLA',     fullLabel: 'Sea Level Anomaly',       unit: 'cm',   value: sla,      set: setSla,      icon: TrendingUp,   min: '-50',max: '50', step: '0.1',  color: 'text-teal-400',   desc: 'CMEMS Altimetry' },
    { label: 'U-Curr',  fullLabel: 'Surface Current U',       unit: 'm/s',  value: ucurrent, set: setUcurrent, icon: ArrowUpDown,  min: '-3', max: '3',  step: '0.01', color: 'text-purple-400', desc: 'OSCAR/GlobCurrent' },
    { label: 'V-Curr',  fullLabel: 'Surface Current V',       unit: 'm/s',  value: vcurrent, set: setVcurrent, icon: ArrowUpDown,  min: '-3', max: '3',  step: '0.01', color: 'text-purple-400', desc: 'OSCAR/GlobCurrent' },
    { label: 'U-Wind',  fullLabel: 'Surface Wind U',          unit: 'm/s',  value: uwind,    set: setUwind,    icon: Wind,         min: '-20',max: '20', step: '0.1',  color: 'text-green-400',  desc: 'ERA5/ASCAT/CCMP' },
    { label: 'V-Wind',  fullLabel: 'Surface Wind V',          unit: 'm/s',  value: vwind,    set: setVwind,    icon: Wind,         min: '-20',max: '20', step: '0.1',  color: 'text-green-400',  desc: 'ERA5/ASCAT/CCMP' },
  ];

  const depthChartData = records.slice(-7).map(r => ({
    date: format(parseISO(r.date), 'MMM d'),
    SST: +r.inputs.sst.toFixed(1),
    OHC: +r.ohc.toFixed(1),
    MLD: r.mld,
  }));

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Satellite Data Input"
          subtitle="Submit daily satellite surface observations (0.25° grid, North Indian Ocean) — triggers subsurface temperature reconstruction via deep learning embedding"
          icon={<Layers size={16} className="text-cyan-400" />}
        />

        {/* Domain badge */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { label: 'Domain', value: '5°N–30°N, 45°E–105°E' },
            { label: 'Resolution', value: '0.25° × 0.25°' },
            { label: 'Temporal', value: 'Daily' },
            { label: 'Depth Levels', value: '15 standard levels (0–1000m)' },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl px-3 py-2 border border-cyan-500/20 text-xs">
              <span className="text-white/40">{label}: </span>
              <span className="text-cyan-400 font-medium">{value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Input form */}
          <div className="xl:col-span-2 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date + Location */}
              <div className="glass rounded-2xl p-6 border border-white/10">
                <h2 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <Calendar size={14} className="text-cyan-400" />
                  Observation Metadata
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Date</label>
                    <input
                      type="date" value={date} max={today}
                      onChange={e => setDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-1">
                      <MapPin size={11} /> Grid Point (0.25°)
                    </label>
                    <select
                      value={locationName} onChange={e => setLocationName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 [color-scheme:dark] appearance-none cursor-pointer"
                    >
                      {LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-white/30 mt-3">
                  Grid: {selectedLoc.lat}°N, {selectedLoc.lon}°E — North Indian Ocean 0.25° resolution
                </p>
              </div>

              {/* Surface satellite inputs */}
              <div className="glass rounded-2xl p-6 border border-white/10">
                <h2 className="text-sm font-semibold text-white/80 mb-1 flex items-center gap-2">
                  <Navigation size={14} className="text-cyan-400" />
                  Satellite Surface Observations
                </h2>
                <p className="text-xs text-white/30 mb-5">Input variables for the embedding model — harmonized to 0.25° × 0.25° daily</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {surfaceFields.map(({ label, fullLabel, unit, value, set, icon: Icon, min, max, step, color, desc }) => (
                    <div key={label} className="space-y-2">
                      <label className="text-xs text-white/50 flex items-center justify-between">
                        <span className="flex items-center gap-1"><Icon size={11} className={color} />{fullLabel} ({unit})</span>
                        <span className="text-white/25">{desc}</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number" value={value} min={min} max={max} step={step}
                          onChange={e => set(e.target.value)} required
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <input
                          type="range" min={min} max={max} step={step} value={value}
                          onChange={e => set(e.target.value)}
                          className="w-16 accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm glow-cyan hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" />Running DL reconstruction model...</>
                ) : (
                  <><Activity size={16} />Reconstruct Subsurface Temperature Profile</>
                )}
              </button>
            </form>

            {/* Trend chart */}
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h2 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                <BarChart2 size={14} className="text-cyan-400" />
                Recent Observations Trend
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={depthChartData}>
                  <defs>
                    <linearGradient id="gSST" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOHC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="SST" stroke="#ef4444" fill="url(#gSST)" strokeWidth={2} name="SST (°C)" dot={false} />
                  <Area type="monotone" dataKey="OHC" stroke="#f97316" fill="url(#gOHC)" strokeWidth={2} name="OHC (kJ/cm²)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Output panel */}
          <div className="space-y-5">
            {loading && (
              <div className="glass rounded-2xl p-6 border border-cyan-500/20 text-center space-y-4">
                <Loader2 size={32} className="text-cyan-400 animate-spin mx-auto" />
                <div>
                  <p className="text-white font-medium">DL Model Running</p>
                  <p className="text-white/40 text-xs mt-1">Generating satellite embeddings → subsurface reconstruction</p>
                </div>
                <div className="space-y-1.5">
                  {['Preprocessing surface obs', 'Generating CNN embeddings', 'Running ViT attention layers', 'Reconstructing depth profile', 'Computing ARGO validation'].map((s, i) => (
                    <div key={s} className="flex items-center gap-2 text-xs text-white/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: `${i * 0.25}s` }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="glass rounded-2xl p-5 border border-green-500/20 glow-cyan fade-in-up space-y-5">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-semibold">Reconstruction Complete</span>
                  <span className="text-xs text-white/30 ml-auto">{format(parseISO(result.date), 'MMM d')}</span>
                </div>

                {/* Key derived fields */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'MLD', value: `${result.mld.toFixed(0)} m`, color: 'text-cyan-400' },
                    { label: 'OHC', value: `${result.ohc.toFixed(0)} kJ/cm²`, color: 'text-orange-400' },
                    { label: 'Thermocline', value: `${result.thermoclineDepth.toFixed(0)} m`, color: 'text-purple-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center p-2 rounded-xl bg-white/5 border border-white/8">
                      <p className={`text-sm font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-white/40">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Depth profile chart */}
                <div>
                  <p className="text-xs text-white/50 mb-3 flex items-center gap-1.5">
                    <Layers size={11} />
                    Reconstructed Temperature Profile vs ARGO
                  </p>
                  <DepthProfileChart profile={result.profile} />
                  <div className="flex gap-4 mt-2 text-xs text-white/40">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Reconstructed</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block border-dashed border" /> ARGO Obs</span>
                  </div>
                </div>

                {/* Embedding vector preview */}
                {result.embeddingVector && (
                  <div>
                    <p className="text-xs text-white/40 mb-2">Latent Embedding (8-dim)</p>
                    <div className="flex gap-1">
                      {result.embeddingVector.map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full rounded-sm"
                            style={{
                              height: `${Math.abs(v) * 20 + 4}px`,
                              background: v > 0 ? 'rgba(6,182,212,0.7)' : 'rgba(239,68,68,0.7)',
                            }}
                          />
                          <span className="text-[9px] text-white/25">z{i}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top 5 depth levels */}
                <div>
                  <p className="text-xs text-white/40 mb-2">Key Depth Levels</p>
                  <div className="space-y-1">
                    {[0, 2, 5, 8, 11].map(idx => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-white/50">{DEPTH_LEVELS[idx]} m</span>
                        <div className="flex-1 mx-3 bg-white/10 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                            style={{ width: `${((result.profile.temperatures[idx] - 2) / 28) * 100}%` }}
                          />
                        </div>
                        <span className="text-cyan-400 font-mono">{result.profile.temperatures[idx].toFixed(1)}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Latest record summary */}
            {!result && !loading && records.length > 0 && (
              <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <Activity size={12} />Latest reconstruction
                </p>
                {records.slice(-1).map(r => (
                  <div key={r.id}>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-white/60">{format(parseISO(r.date), 'MMM d, yyyy')}</span>
                      <span className="text-cyan-400 text-xs">{r.location}</span>
                    </div>
                    <DepthProfileChart profile={r.profile} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="mt-6 glass rounded-2xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-all"
          >
            <span className="text-sm font-medium text-white/80 flex items-center gap-2">
              <History size={14} className="text-cyan-400" />
              Reconstruction History ({records.length} records)
            </span>
            {historyOpen ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
          </button>
          {historyOpen && (
            <div className="border-t border-white/10 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Date', 'Location', 'SST', 'SSS', 'SSH', 'MLD', 'OHC', 'Thermocline'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...records].reverse().map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-all">
                      <td className="px-4 py-3 text-white/60">{format(parseISO(r.date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-white/60 max-w-[120px] truncate">{r.location}</td>
                      <td className="px-4 py-3 text-red-400">{r.inputs.sst.toFixed(1)}°C</td>
                      <td className="px-4 py-3 text-blue-400">{r.inputs.sss.toFixed(1)} PSU</td>
                      <td className="px-4 py-3 text-cyan-400">{r.inputs.ssh.toFixed(1)} cm</td>
                      <td className="px-4 py-3 text-white/70">{r.mld.toFixed(0)} m</td>
                      <td className="px-4 py-3 text-orange-400">{r.ohc.toFixed(0)} kJ/cm²</td>
                      <td className="px-4 py-3 text-purple-400">{r.thermoclineDepth.toFixed(0)} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
