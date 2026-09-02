import { useState, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Waves, Thermometer, Wind,
  AlertTriangle, RefreshCw, Trash2, ChevronDown, Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import PageLayout from '../components/PageLayout';
import { useData } from '../contexts/DataContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── AI response generator — all field refs use new DataContext shape ───────────
function generateResponse(input: string, ctx: ReturnType<typeof useData>): string {
  const q      = input.toLowerCase();
  const latest = ctx.getLatestRecord();
  const sst    = latest?.inputs.sst;
  const sss    = latest?.inputs.sss;
  const ssh    = latest?.inputs.ssh;
  const uWind  = latest?.inputs.uwind ?? 0;
  const vWind  = latest?.inputs.vwind ?? 0;
  const windMag = Math.hypot(uWind, vWind);
  const mld    = latest?.mld;
  const ohc    = latest?.ohc;
  const thermo = latest?.thermoclineDepth;
  const profile = latest?.profile;
  const date   = latest ? format(new Date(latest.date), 'MMMM d, yyyy') : 'N/A';
  const loc    = latest?.location ?? 'North Indian Ocean';
  const activeAlerts = ctx.alerts.filter(a => !a.acknowledged);

  // ── SST / temperature ──────────────────────────────────────────────────────
  if (q.includes('temperature') || q.includes('sst') || q.includes('sea surface')) {
    const anomaly = sst != null ? (sst - 28).toFixed(1) : '—';
    return `**Sea Surface Temperature (SST):** ${sst?.toFixed(2) ?? '—'}°C at ${loc} on ${date}.\n\nThe seasonal climatological mean is ~28°C for the North Indian Ocean (5°N–30°N). Current anomaly: **${anomaly}°C**.\n\nSST is the primary driver in the satellite embedding pipeline — it feeds directly into the CNN/ViT encoder as one of 8 surface input variables. Above 26°C, the ocean provides sufficient thermal energy for cyclone intensification and thermocline deepening.\n\nSubsurface: Surface layer (5m) = **${profile?.temperatures[1]?.toFixed(1) ?? '—'}°C**, at 100m = **${profile?.temperatures[7]?.toFixed(1) ?? '—'}°C**, at 500m = **${profile?.temperatures[12]?.toFixed(1) ?? '—'}°C**.`;
  }

  // ── Salinity / SSS ─────────────────────────────────────────────────────────
  if (q.includes('salinity') || q.includes('sss') || q.includes('salt')) {
    return `**Sea Surface Salinity (SSS):** ${sss?.toFixed(2) ?? '—'} PSU at ${loc} on ${date}.\n\nThe Bay of Bengal is typically fresher (~32–33 PSU) due to heavy riverine freshwater discharge from the Ganga–Brahmaputra system and monsoonal rainfall. The Arabian Sea is saltier (~35–36 PSU) owing to higher evaporation. SSS is an important input variable because salinity gradients influence density stratification, mixed-layer depth, and barrier-layer formation — all of which affect how subsurface temperatures evolve.\n\nIn the embedding model, SSS is provided from **SMOS** and **Aquarius** satellite products, harmonized to 0.25° × 0.25° daily resolution.`;
  }

  // ── SSH / SLA ──────────────────────────────────────────────────────────────
  if (q.includes('ssh') || q.includes('sea level') || q.includes('sla') || q.includes('height')) {
    return `**Sea Surface Height (SSH) / SLA:** ${ssh?.toFixed(2) ?? '—'} cm at ${loc} on ${date}.\n\nSSH anomalies indicate thermocline displacement caused by mesoscale eddies:\n• **Positive SSH (warm-core eddy):** thermocline deepens → elevated Ocean Heat Content → favourable for cyclone intensification.\n• **Negative SSH (cold-core eddy):** thermocline shoals → upwelling of cold water → potential marine heatwave suppression.\n\nCurrent thermocline depth: **${thermo?.toFixed(0) ?? '—'} m**. SSH is sourced from **Jason-3 / Sentinel-6** altimetry via CMEMS, regridded to 0.25°.`;
  }

  // ── Ocean Heat Content ─────────────────────────────────────────────────────
  if (q.includes('ohc') || q.includes('heat content') || q.includes('ocean heat')) {
    return `**Ocean Heat Content (OHC):** ${ohc?.toFixed(1) ?? '—'} kJ/cm² at ${loc}.\n\nOHC integrates the thermal energy in the water column from the surface to ~700 m. It is a more reliable cyclone intensification predictor than SST alone because it accounts for the depth of warm water available to fuel a storm.\n\nOHC is derived here from the reconstructed subsurface temperature profile — the deep learning model reconstructs temperatures at all 15 standard depth levels (0–1000 m), from which OHC is computed as:\n\nOHC = ρ·Cp·∫(T − 26°C) dz\n\nValues above ~80 kJ/cm² are associated with rapid cyclone intensification.`;
  }

  // ── MLD / mixed layer ──────────────────────────────────────────────────────
  if (q.includes('mld') || q.includes('mixed layer') || q.includes('thermocline')) {
    return `**Mixed Layer Depth (MLD):** ${mld?.toFixed(0) ?? '—'} m · **Thermocline Depth:** ${thermo?.toFixed(0) ?? '—'} m at ${loc}.\n\nThe mixed layer is the near-surface zone where wind-driven turbulence keeps temperature nearly uniform. Below it, the thermocline marks a sharp temperature gradient — the depth where the rate of temperature decrease with depth is maximum.\n\nA **shallow thermocline** (<50 m) means wind-induced upwelling can bring cold water to the surface quickly, limiting cyclone intensification. A **deep thermocline** (>100 m) buffers the surface from cold water entrainment.\n\nCurrent profile: T at MLD boundary ≈ **${profile?.temperatures[Math.floor((mld ?? 30) / 100)]?.toFixed(1) ?? '—'}°C**.`;
  }

  // ── Wind ──────────────────────────────────────────────────────────────────
  if (q.includes('wind') || q.includes('current') || q.includes('u wind') || q.includes('v wind')) {
    return `**Surface Winds at ${loc}:** U = ${uWind.toFixed(2)} m/s, V = ${vWind.toFixed(2)} m/s · Speed = **${windMag.toFixed(2)} m/s** on ${date}.\n\nWind data is sourced from **ERA5 reanalysis**, **ASCAT scatterometer**, and **CCMP** products — all harmonized to 0.25° daily. Surface wind is a critical input because:\n1. **Ekman pumping** — wind curl drives vertical ocean motion (upwelling/downwelling).\n2. **Wind shear** — vertical shear inhibits cyclone organisation.\n3. **Mixed layer deepening** — strong winds deepen the mixed layer, burying the thermocline.\n\nSurface currents (U = ${latest?.inputs.ucurrent?.toFixed(2) ?? '—'}, V = ${latest?.inputs.vcurrent?.toFixed(2) ?? '—'} m/s) are from **OSCAR / GlobCurrent**.`;
  }

  // ── Depth profile ─────────────────────────────────────────────────────────
  if (q.includes('depth') || q.includes('profile') || q.includes('subsurface') || q.includes('reconstruct')) {
    const temps = profile?.temperatures ?? [];
    const summary = [0, 5, 7, 9, 11, 14].map(i =>
      `${[0,5,10,50,100,200,300,500,700,1000][i] ?? '—'}m: ${temps[i]?.toFixed(1) ?? '—'}°C`
    ).join(' · ');
    return `**Subsurface Temperature Profile at ${loc}** (${date}):\n\n${summary}\n\nThis profile was **reconstructed by the deep learning model** from 8 satellite surface variables (SST, SSS, SSH, SLA, U/V currents, U/V winds). The model generates a compact latent embedding via a CNN/ViT encoder, then maps it to temperatures at 15 standard depth levels: 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m.\n\nVisit **3D Profile** in the nav to see the full layered visualisation.`;
  }

  // ── Model / ML / AI ───────────────────────────────────────────────────────
  if (q.includes('model') || q.includes('machine learning') || q.includes('embedding') || q.includes('neural') || q.includes('cnn') || q.includes('vit') || q.includes('autoencoder')) {
    return `**The OceanIntel Subsurface Reconstruction Framework:**\n\n**Inputs (8 daily satellite variables at 0.25°):**\n• SST (MODIS/AVHRR) · SSS (SMOS) · SSH/SLA (Jason-3) · Surface currents (OSCAR) · Surface winds (ERA5/ASCAT)\n\n**Embedding architectures:**\n• CNN — spatial feature extraction from 2D surface fields\n• Vision Transformer (ViT) — global attention across the North Indian Ocean domain\n• Autoencoder — compact latent representation (8-dim shown in Input page)\n• GNN — relationship between neighbouring grid points\n\n**Output:** Temperature at 15 standard depth levels (0–1000 m) at 0.25° × 0.25° daily.\n\n**Validation:** RMSE, Bias, Correlation vs independent ARGO float observations. Current RMSE ≈ 0.8–1.2°C at surface levels, ~0.4°C below 300 m.`;
  }

  // ── ARGO ─────────────────────────────────────────────────────────────────
  if (q.includes('argo') || q.includes('float') || q.includes('validation') || q.includes('ground truth')) {
    return `**ARGO Floats** are the primary ground-truth dataset for subsurface temperature validation.\n\nARGO is a global network of ~4,000 autonomous profiling floats that drift at ~1000 m depth, then ascend every 10 days measuring temperature (and salinity) from 2000 m to the surface. The North Indian Ocean hosts ~450 active floats.\n\n**In this platform**, gridded ARGO data from **INCOIS Live Access Server (LAS)** is used for validation:\n• We compare reconstructed temperature profiles vs ARGO observations at collocated positions\n• Metrics computed: RMSE, Bias, Correlation at every depth level\n• Visit the **Validation** page for side-by-side heatmap comparison and per-depth skill scores.`;
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  if (q.includes('alert') || q.includes('warning') || q.includes('notification')) {
    return `**Active Alerts: ${activeAlerts.length}**\n\n${activeAlerts.length > 0
      ? activeAlerts.slice(0, 2).map(a => `• **[${a.severity}]** ${a.message}`).join('\n\n')
      : 'No unacknowledged alerts at this time.'
    }\n\nAlerts are auto-dispatched to NDMA, INCOIS, IMD, and relevant SDMAs when the derived OHC exceeds 80 kJ/cm² or the thermocline shoals below 40 m. See the **Gov Portal** for the full alert feed and audit log.`;
  }

  // ── Domain / study area ───────────────────────────────────────────────────
  if (q.includes('domain') || q.includes('north indian') || q.includes('bay of bengal') || q.includes('arabian sea') || q.includes('indian ocean')) {
    return `**Study Domain:** North Indian Ocean — **5°N to 30°N, 45°E to 105°E**.\n\n**Sub-regions:**\n• **Bay of Bengal** — highest cyclone frequency (~5–6 storms/year), freshwater stratification from river runoff\n• **Arabian Sea** — intensifying storms due to rising SSTs, high salinity\n• **Lakshadweep Sea** — coral ecosystem monitoring, low cyclone activity\n• **Gulf of Mannar / Andaman Sea** — fisheries management zones\n\n**Grid:** 0.25° × 0.25° spatial resolution (100 × 240 grid points), **daily** temporal resolution. All satellite input datasets are harmonized to this common grid via bilinear/nearest-neighbour interpolation.`;
  }

  // ── Hello / greet ─────────────────────────────────────────────────────────
  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.match(/^(good\s+)?(morning|evening|afternoon)/)) {
    return `Hello! I'm **X AI**, the OceanIntel subsurface intelligence assistant.\n\n**Latest reconstruction** (${date}, ${loc}):\n• SST: **${sst?.toFixed(1) ?? '—'}°C** · SSS: **${sss?.toFixed(1) ?? '—'} PSU** · SSH: **${ssh?.toFixed(1) ?? '—'} cm**\n• MLD: **${mld?.toFixed(0) ?? '—'} m** · OHC: **${ohc?.toFixed(0) ?? '—'} kJ/cm²** · Thermocline: **${thermo?.toFixed(0) ?? '—'} m**\n\nAsk me about SST, subsurface profiles, the ML model, ARGO validation, or anything about North Indian Ocean dynamics.`;
  }

  // ── Status / overview ─────────────────────────────────────────────────────
  if (q.includes('status') || q.includes('overview') || q.includes('summary') || q.includes('current')) {
    return `**Ocean Intelligence Summary** — ${date}\n\n📍 **Grid point:** ${loc} (${latest?.lat?.toFixed(2) ?? '—'}°N, ${latest?.lon?.toFixed(2) ?? '—'}°E)\n🌡️ **SST:** ${sst?.toFixed(2) ?? '—'}°C\n🧂 **SSS:** ${sss?.toFixed(2) ?? '—'} PSU\n🌊 **SSH:** ${ssh?.toFixed(2) ?? '—'} cm\n💨 **Wind:** ${windMag.toFixed(2)} m/s (U:${uWind.toFixed(2)}, V:${vWind.toFixed(2)})\n🔵 **MLD:** ${mld?.toFixed(0) ?? '—'} m\n🔶 **OHC:** ${ohc?.toFixed(1) ?? '—'} kJ/cm²\n📉 **Thermocline:** ${thermo?.toFixed(0) ?? '—'} m\n🚨 **Active alerts:** ${activeAlerts.length}`;
  }

  // ── Help ──────────────────────────────────────────────────────────────────
  if (q.includes('help') || q.includes('what can you') || q.includes('capabilit')) {
    return `I'm **X AI**, your North Indian Ocean subsurface intelligence assistant. I can help with:\n\n🌡️ **Surface obs** — SST, SSS, SSH/SLA, surface currents, winds\n🌊 **Subsurface** — Reconstructed depth profiles, MLD, OHC, thermocline\n🤖 **ML model** — Embedding architecture (CNN/ViT/Autoencoder), training pipeline\n✅ **Validation** — ARGO comparison, RMSE/Bias/Correlation at each depth\n🚨 **Alerts** — Marine heatwaves, OHC thresholds, government dispatches\n🗺️ **Domain** — North Indian Ocean (5°N–30°N, 45°E–105°E), 0.25° grid\n\nTry: *"Show me the subsurface profile"*, *"What is the MLD?"*, or *"Explain the embedding model"*.`;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return `I'm focused on North Indian Ocean subsurface temperature reconstruction. You can ask about:\n\n• **SST, SSS, SSH** — satellite surface observations\n• **Subsurface profile** — reconstructed temperatures at 15 depth levels (0–1000 m)\n• **MLD, OHC, thermocline** — derived oceanographic diagnostics\n• **Satellite embeddings** — CNN/ViT/Autoencoder architecture\n• **ARGO validation** — ground-truth comparison\n• **Alerts** — marine heatwave and OHC threshold notifications\n\nExample: *"What is the current OHC?"* or *"Explain the thermocline depth"*.`;
}

const SUGGESTIONS = [
  'Show me the current subsurface profile',
  'What is the Ocean Heat Content?',
  'Explain the Mixed Layer Depth',
  'How does the satellite embedding model work?',
  'What are the active alerts?',
  'Compare SST and SSH anomalies',
];

export default function ChatPage() {
  const data    = useData();
  const latest  = data.getLatestRecord();
  const sst     = latest?.inputs.sst;
  const windMag = Math.hypot(latest?.inputs.uwind ?? 0, latest?.inputs.vwind ?? 0);
  const activeAlerts = data.alerts.filter(a => !a.acknowledged).length;

  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: `Hello! I'm **X AI**, your North Indian Ocean subsurface temperature intelligence assistant.\n\nI have access to reconstructed subsurface profiles from the satellite embedding deep-learning model — covering SST, SSS, SSH, surface currents/winds, and temperature at 15 standard depth levels (0–1000 m).\n\nAsk me anything about current ocean conditions, the ML reconstruction pipeline, or ARGO validation.`,
    timestamp: new Date(),
  }]);
  const [input, setInput]           = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    setShowSuggestions(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600 + Math.random() * 1000));
    const response = generateResponse(text, data);
    setIsTyping(false);
    setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: response, timestamp: new Date() }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => {
    setMessages([{ id: '0', role: 'assistant', content: `Chat cleared. Ask me about North Indian Ocean subsurface temperature reconstruction.`, timestamp: new Date() }]);
    setShowSuggestions(true);
  };

  // Simple **bold** markdown renderer
  const renderContent = (text: string) =>
    text.split('\n').map((line, i, arr) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1
            ? <strong key={j} className="text-white font-semibold">{part}</strong>
            : part
          )}
          {i < arr.length - 1 && <br />}
        </span>
      );
    });

  return (
    <PageLayout fullHeight>
      <div className="flex flex-col max-w-4xl mx-auto px-4 pb-4" style={{ height: 'calc(100vh - 64px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center glow-cyan">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">X AI — Ocean Intelligence</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-white/40">Connected to reconstruction pipeline</span>
              </div>
            </div>
          </div>
          <button onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/10 text-white/50 hover:text-white hover:bg-white/10 text-sm transition-all">
            <Trash2 size={13} /> Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
                msg.role === 'assistant' ? 'bg-gradient-to-br from-cyan-400 to-blue-600' : 'bg-gradient-to-br from-purple-500 to-pink-600'
              }`}>
                {msg.role === 'assistant' ? <Waves size={14} className="text-white" /> : <User size={14} className="text-white" />}
              </div>
              <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'glass border border-white/10 text-white/90 rounded-tl-sm'
                    : 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-500/20 text-white rounded-tr-sm'
                }`}>
                  {renderContent(msg.content)}
                </div>
                <span className="text-xs text-white/25 px-1">{format(msg.timestamp, 'HH:mm')}</span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3 fade-in-up">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 mt-1">
                <Waves size={14} className="text-white" />
              </div>
              <div className="glass border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                      style={{ animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && messages.length === 1 && (
            <div className="space-y-3 py-4">
              <p className="text-xs text-white/30 flex items-center gap-1.5"><ChevronDown size={12} />Suggested questions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-xl glass border border-white/10 text-white/60 text-sm hover:text-white hover:border-cyan-500/30 hover:bg-white/5 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="pt-4">
          <div className="glass rounded-2xl border border-white/10 focus-within:border-cyan-500/40 transition-all p-3">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about subsurface temperature, SST, OHC, ARGO validation, ML embeddings..."
                rows={1}
                className="flex-1 bg-transparent text-white text-sm placeholder-white/30 resize-none outline-none min-h-[36px] max-h-32 py-1.5"
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = t.scrollHeight + 'px';
                }}
              />
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white/25 hidden sm:block">↵ send</span>
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
                  className="w-9 h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0">
                  {isTyping ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick stat bar — all using correct new field paths */}
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-white/25">
            <span className="flex items-center gap-1">
              <Thermometer size={11} />
              {sst != null ? `${sst.toFixed(1)}°C SST` : 'No data'}
            </span>
            <span className="flex items-center gap-1">
              <Wind size={11} />
              {`${windMag.toFixed(1)} m/s wind`}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle size={11} />
              {activeAlerts} active alert{activeAlerts !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Layers size={11} />
              {latest?.profile.temperatures.length ?? 0} depth levels
            </span>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
