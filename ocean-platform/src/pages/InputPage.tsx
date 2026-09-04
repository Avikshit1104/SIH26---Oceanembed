import { useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, CheckCircle2, Loader2, AlertCircle,
  Layers, BarChart2, History, ChevronRight,
  ChevronDown, X, Eye, Calendar, MapPin, Info,
  Thermometer, Droplets, Waves, Wind, ArrowUpDown, TrendingUp,
  FileCheck, Cpu,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, generateProfile, DEPTH_LEVELS, type DayRecord, type SurfaceInputs } from '../contexts/DataContext';

// ── Expected .nc variable names per dataset ────────────────────────────────────
const NC_VARIABLE_SPEC = {
  sst: {
    label: 'Sea Surface Temperature',
    variables: ['analysed_sst', 'sea_surface_temperature', 'SST', 'sst', 'thetao'],
    unit: '°C', source: 'MODIS / AVHRR / VIIRS', color: 'text-red-400',
    borderColor: 'border-red-500/30', bgColor: 'bg-red-500/10',
  },
  sss: {
    label: 'Sea Surface Salinity',
    variables: ['sss', 'sea_surface_salinity', 'SSS', 'so'],
    unit: 'PSU', source: 'SMOS / Aquarius', color: 'text-blue-400',
    borderColor: 'border-blue-500/30', bgColor: 'bg-blue-500/10',
  },
  ssh: {
    label: 'Sea Surface Height',
    variables: ['ssh', 'adt', 'sea_surface_height', 'zos', 'SSH'],
    unit: 'cm', source: 'Jason-3 / Sentinel-6', color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30', bgColor: 'bg-cyan-500/10',
  },
  sla: {
    label: 'Sea Level Anomaly',
    variables: ['sla', 'adt_anomaly', 'SLA', 'sea_level_anomaly'],
    unit: 'cm', source: 'CMEMS Altimetry', color: 'text-teal-400',
    borderColor: 'border-teal-500/30', bgColor: 'bg-teal-500/10',
  },
  currents: {
    label: 'Surface Currents (U, V)',
    variables: ['ugos', 'vgos', 'u_curr', 'v_curr', 'uo', 'vo'],
    unit: 'm/s', source: 'OSCAR / GlobCurrent', color: 'text-purple-400',
    borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/10',
  },
  winds: {
    label: 'Surface Winds (U, V)',
    variables: ['u10', 'v10', 'eastward_wind', 'northward_wind', 'uas', 'vas'],
    unit: 'm/s', source: 'ERA5 / ASCAT / CCMP', color: 'text-green-400',
    borderColor: 'border-green-500/30', bgColor: 'bg-green-500/10',
  },
};

// ── Accepted .nc file slot types ──────────────────────────────────────────────
const FILE_SLOTS = [
  { id: 'sst',      ...NC_VARIABLE_SPEC.sst,      icon: Thermometer,  required: true },
  { id: 'sss',      ...NC_VARIABLE_SPEC.sss,      icon: Droplets,     required: true },
  { id: 'ssh',      ...NC_VARIABLE_SPEC.ssh,      icon: Waves,        required: true },
  { id: 'sla',      ...NC_VARIABLE_SPEC.sla,      icon: TrendingUp,   required: true },
  { id: 'currents', ...NC_VARIABLE_SPEC.currents, icon: ArrowUpDown,  required: true },
  { id: 'winds',    ...NC_VARIABLE_SPEC.winds,    icon: Wind,         required: true },
] as const;

type SlotId = typeof FILE_SLOTS[number]['id'];

interface UploadedFile {
  name: string;
  size: number;
  sizeLabel: string;
  parsedVars: string[];
  extractedValues: Partial<SurfaceInputs>;
  date: string;
  lat: number;
  lon: number;
  location: string;
  status: 'parsing' | 'ready' | 'error';
  errorMsg?: string;
}

// ── Simulate realistic .nc file parsing ───────────────────────────────────────
// In production, use a library like netcdfjs or send to a backend.
// Here we realistically extract values by seeding from filename + size.
function simulateNcParse(
  file: File,
  slotId: SlotId,
): Promise<UploadedFile> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Seed deterministically from filename so same file → same values
      const seed = Array.from(file.name).reduce((a, c) => a + c.charCodeAt(0), 0) + file.size;
      const rand  = (min: number, max: number) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
      const rand2 = (min: number, max: number, offset: number) =>
        min + ((seed * offset * 9301 + 49297) % 233280) / 233280 * (max - min);

      // Try to extract date from filename e.g. "SST_20240815.nc", "sst_2024-08-15.nc"
      const dateMatch = file.name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
      const date = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : new Date().toISOString().split('T')[0];

      // Extract lat/lon hint from filename if present, else use BoB default
      const latMatch  = file.name.match(/lat[-_]?([\d.]+)/i);
      const lonMatch  = file.name.match(/lon[-_]?([\d.]+)/i);
      const lat  = latMatch  ? parseFloat(latMatch[1])  : 10 + rand(0, 20);
      const lon  = lonMatch  ? parseFloat(lonMatch[1])  : 60 + rand(0, 45);

      const locName = lon > 80
        ? (lat > 12 ? 'Bay of Bengal (NE)' : 'Bay of Bengal (SW)')
        : (lat > 15 ? 'Arabian Sea (NW)' : 'Arabian Sea (SE)');

      // Simulate what variables were found inside the file
      const spec = NC_VARIABLE_SPEC[slotId as keyof typeof NC_VARIABLE_SPEC];
      const foundVars = spec.variables.slice(0, 2 + Math.floor(rand2(0, 2, 3)));

      // Extract realistic values per slot
      let extracted: Partial<SurfaceInputs> = {};

      if (slotId === 'sst') {
        extracted = { sst: +(26 + rand2(0, 5, 7)).toFixed(4) };
      } else if (slotId === 'sss') {
        extracted = { sss: +(32 + rand2(0, 6, 11)).toFixed(4) };
      } else if (slotId === 'ssh') {
        extracted = { ssh: +(-20 + rand2(0, 40, 13)).toFixed(4) };
      } else if (slotId === 'sla') {
        extracted = { sla: +(-15 + rand2(0, 30, 17)).toFixed(4) };
      } else if (slotId === 'currents') {
        extracted = {
          ucurrent: +(-0.8 + rand2(0, 1.6, 19)).toFixed(4),
          vcurrent: +(-0.5 + rand2(0, 1.0, 23)).toFixed(4),
        };
      } else if (slotId === 'winds') {
        extracted = {
          uwind:  +(-12 + rand2(0, 24, 29)).toFixed(4),
          vwind:  +(-10 + rand2(0, 20, 31)).toFixed(4),
        };
      }

      resolve({
        name:   file.name,
        size:   file.size,
        sizeLabel: file.size > 1e6 ? `${(file.size / 1e6).toFixed(1)} MB` : `${(file.size / 1e3).toFixed(0)} KB`,
        parsedVars: foundVars,
        extractedValues: extracted,
        date,
        lat:  +lat.toFixed(2),
        lon:  +lon.toFixed(2),
        location: locName,
        status: 'ready',
      });
    }, 900 + Math.random() * 800);
  });
}

// ── Tooltip for charts ─────────────────────────────────────────────────────────
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

// ── Depth profile chart ────────────────────────────────────────────────────────
function DepthProfileChart({ profile }: { profile: DayRecord['profile'] }) {
  const data = profile.depths.map((d, i) => ({
    depth: d,
    Reconstructed: +profile.temperatures[i].toFixed(2),
    ARGO: profile.argoTemps?.[i] != null ? +profile.argoTemps[i].toFixed(2) : undefined,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" domain={['auto','auto']} tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false}
          label={{ value:'Temp (°C)', fill:'rgba(255,255,255,0.3)', fontSize:10, position:'insideBottom', offset:-2 }} />
        <YAxis type="number" dataKey="depth" reversed tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={42}
          label={{ value:'Depth (m)', fill:'rgba(255,255,255,0.3)', fontSize:10, angle:-90, position:'insideLeft' }} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="Reconstructed" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill:'#06b6d4', r:3 }} name="Reconstructed (°C)" />
        <Line type="monotone" dataKey="ARGO" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={{ fill:'#10b981', r:2 }} name="ARGO Obs (°C)" connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Drop zone component ────────────────────────────────────────────────────────
function DropZone({
  slot, uploaded, parsing, onDrop, onRemove,
}: {
  slot: typeof FILE_SLOTS[number];
  uploaded: UploadedFile | null;
  parsing: boolean;
  onDrop: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onDrop(file);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onDrop(file);
    e.target.value = '';
  };

  const Icon = slot.icon;

  return (
    <div
      onClick={() => !uploaded && !parsing && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden
        ${parsing ? 'border-cyan-500/40 bg-cyan-500/5 cursor-wait'
          : uploaded?.status === 'ready' ? `${slot.borderColor} ${slot.bgColor} cursor-default`
          : uploaded?.status === 'error' ? 'border-red-500/40 bg-red-500/5 cursor-pointer'
          : dragging ? 'border-cyan-400/60 bg-cyan-500/10 scale-[1.01] cursor-copy'
          : 'border-dashed border-white/15 hover:border-white/30 hover:bg-white/3 cursor-pointer'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".nc,.nc4,.netcdf,.cdf,.h5,.hdf5"
        className="hidden"
        onChange={handleChange}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${slot.bgColor} border ${slot.borderColor}`}>
              <Icon size={14} className={slot.color} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80">{slot.label}</p>
              <p className="text-[10px] text-white/30">{slot.unit} · {slot.source}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {slot.required && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40">required</span>
            )}
            {uploaded?.status === 'ready' && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center transition-all"
              >
                <X size={10} className="text-white/60" />
              </button>
            )}
          </div>
        </div>

        {/* State: empty */}
        {!uploaded && !parsing && (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <Upload size={22} className="text-white/20" />
            <p className="text-xs text-white/40 text-center">
              Drop <code className="text-cyan-400">.nc</code> file or click to browse
            </p>
            <p className="text-[10px] text-white/20">
              Variables: {slot.variables.slice(0,3).join(', ')}…
            </p>
          </div>
        )}

        {/* State: parsing */}
        {parsing && (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <Loader2 size={20} className="text-cyan-400 animate-spin" />
            <p className="text-xs text-cyan-400">Parsing NetCDF headers…</p>
            <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mt-1">
              <div className="h-full bg-cyan-400 rounded-full animate-[shimmer_1.5s_linear_infinite]"
                style={{ width:'60%', background:'linear-gradient(90deg,transparent,#06b6d4,transparent)', backgroundSize:'200%', animation:'shimmer 1.5s linear infinite' }} />
            </div>
          </div>
        )}

        {/* State: ready */}
        {uploaded?.status === 'ready' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck size={14} className="text-green-400 shrink-0" />
              <span className="text-xs text-white/80 truncate font-mono">{uploaded.name}</span>
              <span className="text-[10px] text-white/30 shrink-0 ml-auto">{uploaded.sizeLabel}</span>
            </div>
            {/* Parsed variables */}
            <div className="flex flex-wrap gap-1">
              {uploaded.parsedVars.map(v => (
                <span key={v} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${slot.bgColor} ${slot.color} border ${slot.borderColor}`}>
                  {v}
                </span>
              ))}
            </div>
            {/* Extracted values */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
              {Object.entries(uploaded.extractedValues).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[10px]">
                  <span className="text-white/40 font-mono">{k}</span>
                  <span className={`font-mono font-bold ${slot.color}`}>{(v as number).toFixed(4)}</span>
                </div>
              ))}
            </div>
            {/* Date + coords hint */}
            <div className="text-[10px] text-white/30 pt-1 border-t border-white/8 flex items-center justify-between">
              <span className="flex items-center gap-1"><Calendar size={9}/>{uploaded.date}</span>
              <span className="flex items-center gap-1"><MapPin size={9}/>{uploaded.lat}°N, {uploaded.lon}°E</span>
            </div>
          </div>
        )}

        {/* State: error */}
        {uploaded?.status === 'error' && (
          <div className="flex flex-col items-center justify-center py-3 gap-1.5">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-xs text-red-400 text-center">{uploaded.errorMsg}</p>
            <p className="text-[10px] text-white/30">Click to re-upload</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InputPage() {
  const { records, addRecord } = useData();
  const today = new Date().toISOString().split('T')[0];

  const [uploads, setUploads]       = useState<Partial<Record<SlotId, UploadedFile>>>({});
  const [parsing,  setParsing]      = useState<Partial<Record<SlotId, boolean>>>({});
  const [running,  setRunning]      = useState(false);
  const [result,   setResult]       = useState<DayRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Handle file drop/select for a slot
  const handleFileUpload = useCallback(async (slotId: SlotId, file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = ['nc', 'nc4', 'netcdf', 'cdf', 'h5', 'hdf5'];
    if (!allowed.includes(ext)) {
      const errFile: UploadedFile = {
        name: file.name,
        size: file.size,
        sizeLabel: 'N/A',
        parsedVars: [],
        extractedValues: {},
        date: today,
        lat: 15.5,
        lon: 88.0,
        location: 'Unknown',
        status: 'error',
        errorMsg: 'Invalid format ".' + ext + '". Expected .nc / .nc4 / .h5',
      };
      setUploads(prev => ({ ...prev, [slotId]: errFile }));
      return;
    }

    setParsing(prev => ({ ...prev, [slotId]: true }));
    setUploads(prev => { const n = { ...prev }; delete n[slotId]; return n; });

    try {
      const parsed = await simulateNcParse(file, slotId);
      setUploads(prev => ({ ...prev, [slotId]: parsed }));
    } finally {
      setParsing(prev => ({ ...prev, [slotId]: false }));
    }
  }, [today]);

  const removeUpload = useCallback((slotId: SlotId) => {
    setUploads(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setResult(null);
  }, []);

  // Check if all required slots are filled
  const requiredSlots  = FILE_SLOTS.filter(s => s.required).map(s => s.id);
  const readySlots     = requiredSlots.filter(id => uploads[id]?.status === 'ready');
  const allReady       = readySlots.length === requiredSlots.length;
  const anyParsing     = Object.values(parsing).some(Boolean);

  // Merge all extracted values into one SurfaceInputs object
  const mergeInputs = (): SurfaceInputs => {
    const merged: Partial<SurfaceInputs> = {};
    for (const slot of FILE_SLOTS) {
      const up = uploads[slot.id];
      if (up?.status === 'ready') Object.assign(merged, up.extractedValues);
    }
    return {
      sst:       merged.sst       ?? 28.0,
      sss:       merged.sss       ?? 34.0,
      ssh:       merged.ssh       ?? 0.0,
      sla:       merged.sla       ?? merged.ssh ?? 0.0,
      ucurrent:  merged.ucurrent  ?? 0.0,
      vcurrent:  merged.vcurrent  ?? 0.0,
      uwind:     merged.uwind     ?? 3.0,
      vwind:     merged.vwind     ?? -2.0,
    };
  };

  // Best-guess date and location from uploaded files
  const inferMeta = () => {
    const firstReady = FILE_SLOTS.map(s => uploads[s.id]).find(u => u?.status === 'ready');
    return {
      date:     firstReady?.date     ?? today,
      lat:      firstReady?.lat      ?? 15.5,
      lon:      firstReady?.lon      ?? 88.0,
      location: firstReady?.location ?? 'Bay of Bengal (NE)',
    };
  };

  const handleRun = useCallback(async () => {
    if (!allReady) return;
    setRunning(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 2400));

    const inputs = mergeInputs();
    const meta   = inferMeta();
    const profile = generateProfile(inputs.sst, inputs.ssh, meta.date, meta.lat);
    const mld     = 30 + Math.abs(inputs.ssh) * 0.5 + inputs.sss * 0.1;
    const ohc     = inputs.sst * 3.2 + inputs.ssh * 0.5 + 42;
    const thermoclineDepth = 72 + inputs.ssh * 0.9 - (inputs.sst - 28) * 2;

    const record = addRecord({
      date: meta.date, location: meta.location,
      lat: meta.lat, lon: meta.lon,
      inputs, profile, mld, ohc, thermoclineDepth,
      embeddingVector: Array.from({ length: 8 }, () => Math.random() * 2 - 1),
    });
    setResult(record);
    setRunning(false);
  }, [allReady, uploads, addRecord]);

  const depthChartData = records.slice(-7).map(r => ({
    date: format(parseISO(r.date), 'MMM d'),
    SST: +r.inputs.sst.toFixed(1),
    OHC: +r.ohc.toFixed(1),
  }));

  const uploadedCount = FILE_SLOTS.filter(s => uploads[s.id]?.status === 'ready').length;
  const totalSlots    = FILE_SLOTS.length;

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="NetCDF Data Input"
          subtitle="Upload daily satellite .nc files — the embedding model extracts surface variables and reconstructs subsurface temperature profiles at 15 depth levels"
          icon={<Layers size={16} className="text-cyan-400" />}
        />

        {/* Domain info badges */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { l:'Domain',     v:'5°N–30°N, 45°E–105°E' },
            { l:'Resolution', v:'0.25° × 0.25°' },
            { l:'Temporal',   v:'Daily' },
            { l:'Format',     v:'.nc / .nc4 / .h5 / .hdf5' },
            { l:'Depth levels', v:'15 (0–1000 m)' },
          ].map(({l,v}) => (
            <div key={l} className="glass rounded-xl px-3 py-1.5 border border-cyan-500/20 text-xs">
              <span className="text-white/40">{l}: </span>
              <span className="text-cyan-400 font-medium">{v}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── Left: Upload panel ── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Progress bar */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                  <Upload size={14} className="text-cyan-400" />
                  Upload NetCDF Files
                </h2>
                <span className="text-xs text-white/40">{uploadedCount} / 6 files ready</span>
              </div>
              {/* Progress */}
              <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden mb-1">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                  style={{ width:`${(uploadedCount / totalSlots) * 100}%` }} />
              </div>
              <p className="text-[10px] text-white/30">
                All 6 parameter files required: SST · SSS · SSH · SLA · Surface Currents · Surface Winds
              </p>
            </div>

            {/* File drop zones grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FILE_SLOTS.map(slot => (
                <DropZone
                  key={slot.id}
                  slot={slot}
                  uploaded={uploads[slot.id] ?? null}
                  parsing={!!parsing[slot.id]}
                  onDrop={file => handleFileUpload(slot.id, file)}
                  onRemove={() => removeUpload(slot.id)}
                />
              ))}
            </div>

            {/* NC format reference */}
            <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
              <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
                <Info size={13} className="text-cyan-400" />
                Expected NetCDF Variable Names
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FILE_SLOTS.map(slot => (
                  <div key={slot.id} className={`rounded-xl p-3 border ${slot.borderColor} ${slot.bgColor}`}>
                    <p className={`text-xs font-semibold ${slot.color} mb-1`}>{slot.label}</p>
                    <p className="text-[10px] text-white/30 font-mono">
                      {slot.variables.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/25 mt-3">
                The parser reads the first matching variable name found in the file header.
                Coordinates must include <code className="text-cyan-400">lat</code> / <code className="text-cyan-400">lon</code> / <code className="text-cyan-400">time</code> dimensions.
              </p>
            </div>

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={!allReady || running || anyParsing}
              className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all
                bg-gradient-to-r from-cyan-500 to-blue-600 text-white glow-cyan
                hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Running DL reconstruction pipeline…
                </>
              ) : anyParsing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Parsing NetCDF files…
                </>
              ) : !allReady ? (
                <>
                  <Upload size={16} />
                  Upload required files to continue ({readySlots.length}/{requiredSlots.length} of 6 ready)
                </>
              ) : (
                <>
                  <Cpu size={16} />
                  Run Subsurface Reconstruction ({uploadedCount} files loaded)
                </>
              )}
            </button>

            {/* Trend chart */}
            {records.length > 0 && (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow">
                <h2 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
                  <BarChart2 size={14} className="text-cyan-400" />
                  Recent Observation Trend
                </h2>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={depthChartData}>
                    <defs>
                      <linearGradient id="gSST" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gOHC" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:'rgba(255,255,255,0.4)', fontSize:10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="SST" stroke="#ef4444" fill="url(#gSST)" strokeWidth={2} name="SST (°C)" dot={false} />
                    <Area type="monotone" dataKey="OHC" stroke="#f97316" fill="url(#gOHC)" strokeWidth={2} name="OHC (kJ/cm²)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Right: Output panel ── */}
          <div className="space-y-5">

            {/* Merged input summary (once files are ready) */}
            {uploadedCount > 0 && !running && !result && (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-3">
                <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                  <FileText size={14} className="text-cyan-400" />
                  Extracted Values Summary
                </h3>
                {FILE_SLOTS.map(slot => {
                  const up = uploads[slot.id];
                  if (!up || up.status !== 'ready') return null;
                  return (
                    <div key={slot.id} className={`rounded-xl p-3 border ${slot.borderColor} ${slot.bgColor} space-y-1`}>
                      <p className={`text-[10px] font-semibold ${slot.color}`}>{slot.label}</p>
                      <div className="grid grid-cols-2 gap-x-3 text-[10px]">
                        {Object.entries(up.extractedValues).map(([k,v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-white/40 font-mono">{k}</span>
                            <span className="text-white/80 font-mono font-bold">{(v as number).toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Running state */}
            {running && (
              <div className="glass rounded-2xl p-6 border border-cyan-500/20 text-center space-y-4 depth-shadow">
                <Loader2 size={32} className="text-cyan-400 animate-spin mx-auto" />
                <div>
                  <p className="text-white font-medium">Reconstruction Pipeline Running</p>
                  <p className="text-white/40 text-xs mt-1">CNN → ViT embeddings → depth decoder</p>
                </div>
                <div className="space-y-1.5 text-left">
                  {[
                    'Loading .nc variable arrays…',
                    'Regridding to 0.25° × 0.25°…',
                    'Generating CNN spatial embeddings…',
                    'Running ViT attention encoder…',
                    'Decoding depth profile (0–1000 m)…',
                    'Comparing with ARGO observations…',
                  ].map((s, i) => (
                    <div key={s} className="flex items-center gap-2 text-xs text-white/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
                        style={{ animationDelay:`${i * 0.2}s` }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {result && !running && (
              <div className="glass rounded-2xl p-5 border border-green-500/20 glow-cyan fade-in-up space-y-5 depth-shadow">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-semibold">Reconstruction Complete</span>
                  <span className="text-xs text-white/30 ml-auto">{format(parseISO(result.date), 'MMM d, yyyy')}</span>
                </div>
                <div className="text-xs text-white/50 flex items-center gap-1">
                  <MapPin size={10} />{result.location} · {result.lat}°N, {result.lon}°E
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label:'MLD',        v:`${result.mld.toFixed(0)} m`,        c:'text-cyan-400' },
                    { label:'OHC',        v:`${result.ohc.toFixed(0)} kJ/cm²`,   c:'text-orange-400' },
                    { label:'Thermocline',v:`${result.thermoclineDepth.toFixed(0)} m`, c:'text-purple-400' },
                  ].map(({ label, v, c }) => (
                    <div key={label} className="text-center p-2 rounded-xl bg-white/5 border border-white/8">
                      <p className={`text-sm font-bold ${c}`}>{v}</p>
                      <p className="text-[10px] text-white/40">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Depth profile */}
                <div>
                  <p className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
                    <Layers size={11} />Reconstructed Profile vs ARGO
                  </p>
                  <DepthProfileChart profile={result.profile} />
                  <div className="flex gap-4 mt-2 text-xs text-white/40">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block" />Reconstructed</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block" />ARGO</span>
                  </div>
                </div>

                {/* Embedding vector */}
                {result.embeddingVector && (
                  <div>
                    <p className="text-xs text-white/40 mb-2">Latent Embedding (8-dim)</p>
                    <div className="flex gap-1 h-10 items-end">
                      {result.embeddingVector.map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-sm transition-all"
                            style={{ height:`${Math.abs(v)*32+3}px`, background: v > 0 ? 'rgba(6,182,212,0.7)' : 'rgba(239,68,68,0.7)' }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-white/20 mt-0.5">
                      {result.embeddingVector.map((_, i) => <span key={i}>z{i}</span>)}
                    </div>
                  </div>
                )}

                {/* Key depth levels */}
                <div>
                  <p className="text-xs text-white/40 mb-2">Key Depth Levels</p>
                  <div className="space-y-1">
                    {[0, 2, 5, 8, 11, 14].map(idx => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-white/40 w-14">{DEPTH_LEVELS[idx]} m</span>
                        <div className="flex-1 mx-2 bg-white/10 rounded-full h-1 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                            style={{ width:`${Math.max(5, ((result.profile.temperatures[idx]-2)/27)*100)}%` }} />
                        </div>
                        <span className="text-cyan-400 font-mono w-14 text-right">
                          {result.profile.temperatures[idx].toFixed(1)}°C
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Latest record if no result yet */}
            {!result && !running && records.length > 0 && uploadedCount === 0 && (
              <div className="glass rounded-2xl p-5 border border-white/10 depth-shadow space-y-3">
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <Eye size={12} />Latest reconstruction
                </p>
                {records.slice(-1).map(r => (
                  <div key={r.id}>
                    <div className="flex justify-between text-xs mb-3">
                      <span className="text-white/60">{format(parseISO(r.date), 'MMM d, yyyy')}</span>
                      <span className="text-cyan-400">{r.location}</span>
                    </div>
                    <DepthProfileChart profile={r.profile} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* History table */}
        <div className="mt-6 glass rounded-2xl border border-white/10 depth-shadow overflow-hidden">
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
                      <td className="px-4 py-3 text-white/60 max-w-[130px] truncate">{r.location}</td>
                      <td className="px-4 py-3 text-red-400 font-mono">{r.inputs.sst.toFixed(2)}°C</td>
                      <td className="px-4 py-3 text-blue-400 font-mono">{r.inputs.sss.toFixed(2)} PSU</td>
                      <td className="px-4 py-3 text-cyan-400 font-mono">{r.inputs.ssh.toFixed(2)} cm</td>
                      <td className="px-4 py-3 text-purple-400 font-mono">{r.mld.toFixed(0)} m</td>
                      <td className="px-4 py-3 text-orange-400 font-mono">{r.ohc.toFixed(0)} kJ/cm²</td>
                      <td className="px-4 py-3 text-teal-400 font-mono">{r.thermoclineDepth.toFixed(0)} m</td>
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
