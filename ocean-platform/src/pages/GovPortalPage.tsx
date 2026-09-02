import { useState, useCallback } from 'react';
import {
  Shield, Bell, Send, CheckCheck, Clock, AlertTriangle,
  Users, FileText, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import PageLayout, { SectionHeader } from '../components/PageLayout';
import { useData, type Alert } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
const RECIPIENTS = [
  { id: 'ndma',   label: 'NDMA Headquarters',      email: 'ops@ndma.gov.in',         tier: 'national' },
  { id: 'imd',    label: 'IMD New Delhi',           email: 'director@imd.gov.in',     tier: 'national' },
  { id: 'imdche', label: 'IMD Chennai',             email: 'cyclone@imdchennai.gov',  tier: 'regional' },
  { id: 'navy',   label: 'Naval Command (Eastern)', email: 'ops@indiannavy.nic.in',   tier: 'national' },
  { id: 'coast',  label: 'Indian Coast Guard',      email: 'ops@indiancoastguard.gov', tier: 'national' },
  { id: 'tn',     label: 'Tamil Nadu SDMA',         email: 'sdma@tn.gov.in',          tier: 'state' },
  { id: 'ap',     label: 'Andhra Pradesh SDMA',     email: 'sdma@ap.gov.in',          tier: 'state' },
  { id: 'odisha', label: 'Odisha SDMA',             email: 'sdma@odisha.gov.in',      tier: 'state' },
  { id: 'wb',     label: 'West Bengal SDMA',        email: 'sdma@wb.gov.in',          tier: 'state' },
];

const TIER_COLOR: Record<string, string> = {
  national: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  regional: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  state:    'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

const SEV_COLOR: Record<Alert['severity'], string> = {
  Info:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Warning:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  Critical: 'bg-red-500/15 text-red-400 border-red-500/25',
};

export default function GovPortalPage() {
  const { user } = useAuth();
  const { alerts, addAlert, acknowledgeAlert, getLatestRecord } = useData();
  const latest = getLatestRecord();

  // Manual alert form
  const [severity, setSeverity]     = useState<Alert['severity']>('Warning');
  const [message, setMessage]       = useState('');
  const [trigger, setTrigger]       = useState('Manual Government Issue');
  const [selRecipients, setSelRec]  = useState<string[]>(['ndma', 'imd', 'coast']);
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);

  // Filter state
  const [filter, setFilter]         = useState<'all' | 'active' | 'acknowledged'>('all');
  const [activeTab, setActiveTab]   = useState<'alerts' | 'compose' | 'audit'>('alerts');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'active') return !a.acknowledged;
    if (filter === 'acknowledged') return a.acknowledged;
    return true;
  });

  const toggleRecipient = (id: string) => {
    setSelRec(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleSendAlert = useCallback(async () => {
    if (!message.trim() || selRecipients.length === 0) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1500));
    addAlert({
      triggerEvent: trigger,
      recipients: selRecipients.map(id => RECIPIENTS.find(r => r.id === id)!.label),
      severity,
      message: message.trim(),
      acknowledged: false,
    });
    setSending(false);
    setSent(true);
    setMessage('');
    setTimeout(() => { setSent(false); setActiveTab('alerts'); }, 2000);
  }, [message, selRecipients, severity, trigger, addAlert]);

  // Auto-alert: check if latest record warrants one
  const autoAlertNeeded = latest && latest.cycloneRiskScore >= 55 && latest.alerts.length > 0;

  const activeCount      = alerts.filter(a => !a.acknowledged).length;
  const criticalCount    = alerts.filter(a => a.severity === 'Critical' && !a.acknowledged).length;
  const last24hCount     = alerts.filter(a => Date.now() - new Date(a.timestamp).getTime() < 86400000).length;

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <SectionHeader
          title="Government Portal"
          subtitle="Secure alert management and dispatch for NDMA, IMD, and coastal authorities"
          icon={<Shield size={16} className="text-yellow-400" />}
        />

        {/* Gov badge */}
        <div className="flex items-center gap-2 mb-8 p-3 rounded-xl glass border border-yellow-500/25 text-yellow-400 text-sm w-fit">
          <Shield size={14} />
          Government Officer Access — {user?.name}
        </div>

        {/* Auto-alert banner */}
        {autoAlertNeeded && (
          <div className="mb-6 p-4 rounded-2xl border border-red-500/40 bg-red-500/10 glow-red fade-in-up">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <p className="font-semibold text-red-300">Automatic Alert Triggered</p>
                <p className="text-sm text-red-300/70 mt-1">
                  Cyclone risk score {latest.cycloneRiskScore}/100 ({latest.cycloneRisk}) detected over {latest.location}.
                  Automatic notifications dispatched to NDMA, IMD, and coastal authorities.
                </p>
              </div>
              <button
                className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/30 transition-all"
                onClick={() => setActiveTab('alerts')}
              >
                View Alert
              </button>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Alerts', value: activeCount, color: 'red', icon: Bell },
            { label: 'Critical', value: criticalCount, color: 'orange', icon: AlertTriangle },
            { label: 'Last 24h', value: last24hCount, color: 'yellow', icon: Clock },
            { label: 'Total Logged', value: alerts.length, color: 'blue', icon: FileText },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={`glass rounded-2xl p-5 border border-${color}-500/25 bg-gradient-to-br from-${color}-500/10 to-transparent`}>
              <div className="flex items-center justify-between mb-3">
                <Icon size={18} className={`text-${color}-400`} />
                {value > 0 && <span className={`w-2 h-2 rounded-full bg-${color}-400 animate-pulse`} />}
              </div>
              <p className="text-3xl font-black text-white">{value}</p>
              <p className="text-xs text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/10 mb-6 w-fit overflow-x-auto">
          {([
            { id: 'alerts',  label: 'Alert Feed', icon: Bell },
            { id: 'compose', label: 'Send Alert', icon: Send },
            { id: 'audit',   label: 'Audit Log',  icon: FileText },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-white border border-yellow-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'alerts' && activeCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{activeCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Alert Feed */}
        {activeTab === 'alerts' && (
          <div className="space-y-4 fade-in-up">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'acknowledged'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    filter === f
                      ? 'glass border border-cyan-500/30 text-cyan-400'
                      : 'glass border border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {f} ({f === 'all' ? alerts.length : f === 'active' ? activeCount : alerts.length - activeCount})
                </button>
              ))}
            </div>

            {filteredAlerts.length === 0 && (
              <div className="glass rounded-2xl p-12 border border-white/10 text-center">
                <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
                <p className="text-white/60">No alerts in this category</p>
              </div>
            )}

            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`glass rounded-2xl p-5 border transition-all ${
                  !alert.acknowledged ? `${SEV_COLOR[alert.severity]} glow-${alert.severity === 'Critical' ? 'red' : 'none'}` : 'border-white/8 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SEV_COLOR[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      {!alert.acknowledged && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                          Unacknowledged
                        </span>
                      )}
                      <span className="text-xs text-white/30 ml-auto">{format(new Date(alert.timestamp), 'MMM d, yyyy · HH:mm IST')}</span>
                    </div>
                    <p className="text-sm text-white mb-2 leading-relaxed">{alert.message}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-white/40">Trigger: <span className="text-white/70">{alert.triggerEvent}</span></span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {alert.recipients.map(r => (
                        <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-green-500/30 text-green-400 text-xs hover:bg-green-500/15 transition-all"
                    >
                      <CheckCheck size={12} />
                      ACK
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compose alert */}
        {activeTab === 'compose' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in-up">
            <div className="lg:col-span-2 space-y-5">
              <div className="glass rounded-2xl p-6 border border-white/10 space-y-5">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Send size={16} className="text-yellow-400" />
                  Compose Government Alert
                </h2>

                {/* Severity */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Severity Level</label>
                  <div className="flex gap-2">
                    {(['Info', 'Warning', 'Critical'] as Alert['severity'][]).map(s => (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                          severity === s
                            ? SEV_COLOR[s]
                            : 'glass border-white/10 text-white/40 hover:text-white/70'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trigger */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Trigger / Event</label>
                  <input
                    type="text"
                    value={trigger}
                    onChange={e => setTrigger(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500/40 transition-all"
                    placeholder="e.g. Cyclone Risk: High"
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-xs text-white/50 uppercase tracking-wider">Alert Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Describe the event, affected region, and recommended actions..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/40 resize-none transition-all"
                  />
                  <p className="text-xs text-white/25">{message.length}/500 characters</p>
                </div>

                <button
                  onClick={handleSendAlert}
                  disabled={!message.trim() || selRecipients.length === 0 || sending}
                  className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    sent
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:opacity-90 disabled:opacity-40'
                  }`}
                >
                  {sending ? (
                    <><RefreshCw size={16} className="animate-spin" /> Dispatching to {selRecipients.length} recipient(s)...</>
                  ) : sent ? (
                    <><CheckCircle2 size={16} /> Alert Dispatched Successfully</>
                  ) : (
                    <><Send size={16} /> Dispatch Alert to {selRecipients.length} Recipient(s)</>
                  )}
                </button>
              </div>
            </div>

            {/* Recipients */}
            <div className="glass rounded-2xl p-5 border border-white/10 h-fit">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Users size={14} className="text-yellow-400" />
                Recipients ({selRecipients.length}/{RECIPIENTS.length})
              </h3>
              <div className="space-y-2">
                {RECIPIENTS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggleRecipient(r.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      selRecipients.includes(r.id)
                        ? 'border-yellow-500/30 bg-yellow-500/10'
                        : 'border-white/8 bg-white/3 hover:bg-white/5'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      selRecipients.includes(r.id) ? 'border-yellow-400 bg-yellow-400' : 'border-white/30'
                    }`}>
                      {selRecipients.includes(r.id) && <span className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{r.label}</p>
                      <p className="text-xs text-white/30 truncate">{r.email}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TIER_COLOR[r.tier]} shrink-0`}>
                      {r.tier}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audit log */}
        {activeTab === 'audit' && (
          <div className="fade-in-up">
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <FileText size={16} className="text-cyan-400" />
                  Alert Audit Log
                </h2>
                <p className="text-xs text-white/40 mt-0.5">All dispatched alerts with full traceability — {alerts.length} records</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['Timestamp', 'Severity', 'Trigger', 'Recipients', 'Message', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...alerts].reverse().map(a => (
                      <tr key={a.id} className="border-b border-white/5 hover:bg-white/3 transition-all">
                        <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                          {format(new Date(a.timestamp), 'MMM d · HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${SEV_COLOR[a.severity]}`}>
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 max-w-[120px] truncate">{a.triggerEvent}</td>
                        <td className="px-4 py-3 text-white/50">{a.recipients.length} agencies</td>
                        <td className="px-4 py-3 text-white/60 max-w-[200px] truncate">{a.message}</td>
                        <td className="px-4 py-3">
                          {a.acknowledged
                            ? <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={12} /> ACK'd</span>
                            : <span className="flex items-center gap-1 text-yellow-400"><Clock size={12} /> Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
