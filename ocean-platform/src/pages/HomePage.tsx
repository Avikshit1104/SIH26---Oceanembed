import { useNavigate } from 'react-router-dom';
import {
  Waves, MessageSquare, LayoutDashboard, Globe, Wind,
  Thermometer, BarChart2, ArrowRight, Activity,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';

const FEATURES = [
  { icon: MessageSquare, label: 'X AI Assistant', desc: 'Natural language Q&A about ocean conditions and live data', to: '/chat', color: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/20', text: 'text-cyan-400' },
  { icon: BarChart2, label: 'Data Input', desc: 'Submit daily sensor readings and get computed forecasts', to: '/input', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/20', text: 'text-blue-400' },
  { icon: LayoutDashboard, label: 'Dashboard', desc: 'Glassmorphism analytics with live ocean metrics', to: '/dashboard', color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  { icon: Globe, label: '3D Ocean Map', desc: 'Interactive 3D India map with ocean temperature overlays', to: '/map', color: 'from-teal-500/20 to-teal-600/10', border: 'border-teal-500/20', text: 'text-teal-400' },
  { icon: Wind, label: 'Cyclone Prediction', desc: 'ML-powered cyclone formation and track forecasting', to: '/cyclone', color: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/20', text: 'text-orange-400' },
  { icon: Thermometer, label: 'Surface View', desc: 'Sea surface temperature and salinity heatmaps', to: '/surface', color: 'from-red-500/20 to-red-600/10', border: 'border-red-500/20', text: 'text-red-400' },
];

const STATS = [
  { label: 'Ocean Sensors', value: '2,400+' },
  { label: 'Data Points / Day', value: '1.2M' },
  { label: 'Coverage Area', value: '3.8M km²' },
  { label: 'Model Accuracy', value: '94.7%' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-20 fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-cyan-500/30 text-cyan-400 text-sm mb-6">
            <Activity size={14} className="animate-pulse" />
            Live monitoring active — Indian Ocean Region
          </div>
          <h1 className="text-5xl sm:text-6xl font-black mb-6 leading-tight">
            <span className="gradient-text-ocean">Ocean & Climate</span>
            <br />
            <span className="text-white">Intelligence Platform</span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-10">
            Real-time ocean monitoring, AI-powered cyclone prediction, and government alerting
            for the Indian Ocean region — built for analysts and decision makers.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold glow-cyan hover:opacity-90 transition-opacity"
            >
              Open Dashboard <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl glass border border-white/15 text-white font-semibold hover:bg-white/10 transition-all"
            >
              <MessageSquare size={16} />
              Talk to X AI
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
          {STATS.map(stat => (
            <div key={stat.label} className="glass rounded-2xl p-5 text-center border border-white/10">
              <p className="text-2xl font-bold gradient-text-cyan">{stat.value}</p>
              <p className="text-white/50 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Platform Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, label, desc, to, color, border, text }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`text-left glass rounded-2xl p-6 border ${border} bg-gradient-to-br ${color} hover:scale-[1.02] hover:border-opacity-60 transition-all duration-200 group`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${text} bg-white/5 border ${border} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={20} />
                </div>
                <h3 className={`font-semibold ${text} mb-1`}>{label}</h3>
                <p className="text-white/50 text-sm">{desc}</p>
                <div className={`flex items-center gap-1 mt-3 text-xs ${text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  Open module <ArrowRight size={12} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-white/30 text-xs">
            <Waves size={12} />
            Indian Ocean Region — Data updated every 6 hours
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
