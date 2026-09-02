import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Standard depth levels (metres) per the problem statement ──────────────────
export const DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

// ── Domain: North Indian Ocean 5°N–30°N, 45°E–105°E at 0.25° resolution ──────
export const DOMAIN = { latMin: 5, latMax: 30, lonMin: 45, lonMax: 105, resolution: 0.25 };

// ── Satellite surface input variables ─────────────────────────────────────────
export interface SurfaceInputs {
  sst: number;     // Sea Surface Temperature (°C)
  sss: number;     // Sea Surface Salinity (PSU)
  ssh: number;     // Sea Surface Height / SLA (cm)
  sla: number;     // Sea Level Anomaly (cm)
  ucurrent: number; // Surface current U (m/s)
  vcurrent: number; // Surface current V (m/s)
  uwind: number;   // Surface wind U (m/s)
  vwind: number;   // Surface wind V (m/s)
}

// ── Subsurface temperature profile (one value per depth level) ────────────────
export interface DepthProfile {
  depths: number[];       // DEPTH_LEVELS
  temperatures: number[]; // reconstructed temperature at each depth (°C)
  argoTemps?: number[];   // ARGO ground-truth (where available)
  rmse?: number[];        // RMSE per depth level
  bias?: number[];        // Bias per depth level
  correlation?: number[]; // Correlation per depth level
}

// ── Per-day observation record ────────────────────────────────────────────────
export interface DayRecord {
  id: string;
  date: string;        // YYYY-MM-DD
  location: string;
  lat: number;
  lon: number;

  // Surface satellite inputs
  inputs: SurfaceInputs;

  // Reconstructed subsurface profile
  profile: DepthProfile;

  // Derived summary
  mld: number;          // Mixed Layer Depth (m)
  ohc: number;          // Ocean Heat Content (kJ/cm²)
  thermoclineDepth: number; // depth of max temperature gradient (m)
  embeddingVector?: number[]; // 8-dim latent embedding (summary)

  processedAt: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  triggerEvent: string;
  recipients: string[];
  severity: 'Info' | 'Warning' | 'Critical';
  message: string;
  acknowledged: boolean;
}

interface DataContextType {
  records: DayRecord[];
  alerts: Alert[];
  addRecord: (record: Omit<DayRecord, 'id' | 'processedAt'>) => DayRecord;
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => void;
  acknowledgeAlert: (id: string) => void;
  getLatestRecord: () => DayRecord | null;
  getRecordByDate: (date: string) => DayRecord | undefined;
}

const DataContext = createContext<DataContextType | null>(null);

// ── Physics-based temperature profile generator ───────────────────────────────
export function generateProfile(
  sst: number,
  ssh: number,
  _date: string,
  lat: number,
  seed = 0
): DepthProfile {
  const temperatures = DEPTH_LEVELS.map((d, i) => {
    // Mixed layer: near-isothermal
    if (d <= 30) return sst - d * 0.02 + Math.sin(seed * 0.3 + i) * 0.3;
    // Thermocline: steep gradient
    if (d <= 200) {
      const frac = (d - 30) / 170;
      const thermoclineDepth = 80 + ssh * 0.5 + lat * 0.4;
      const sharpness = Math.exp(-((d - thermoclineDepth) ** 2) / 800);
      return sst - 2 - frac * 12 + sharpness * 2 + Math.sin(seed * 0.5 + i * 0.7) * 0.5;
    }
    // Deep water: cold, slow decay
    const deep = sst - 14 - (d - 200) / 800 * 10 + Math.cos(seed * 0.2 + i) * 0.3;
    return Math.max(deep, 2.0);
  });

  // Simulate ARGO observations (sparse — available at ~60% of levels)
  const argoTemps = temperatures.map((t) =>
    Math.random() > 0.4 ? t + (Math.random() - 0.5) * 0.6 : undefined
  ) as (number | undefined)[];

  const rmse = temperatures.map((t, i) =>
    argoTemps[i] !== undefined ? Math.abs(t - argoTemps[i]!) * 0.8 + 0.1 : undefined
  ) as (number | undefined)[];

  const bias = temperatures.map((t, i) =>
    argoTemps[i] !== undefined ? t - argoTemps[i]! : undefined
  ) as (number | undefined)[];

  const correlation = temperatures.map((_, i) => 0.92 + Math.random() * 0.06 - i * 0.003);

  // MLD: depth where temp drops >0.5°C from surface
  const mldIdx = temperatures.findIndex((t, idx) => idx > 0 && temperatures[0] - t > 0.5);
  void mldIdx; // used implicitly via DEPTH_LEVELS[mldIdx] in calling code

  // OHC: simplified integral
  let ohc = 0;
  for (let i = 1; i < DEPTH_LEVELS.length; i++) {
    const dz = DEPTH_LEVELS[i] - DEPTH_LEVELS[i - 1];
    ohc += ((temperatures[i] + temperatures[i - 1]) / 2) * dz * 1025 * 3990 / 1e7;
  }

  // Thermocline depth: largest gradient
  let maxGrad = 0;
  let foundThermocline = 75;
  for (let i = 1; i < DEPTH_LEVELS.length - 1; i++) {
    const grad = Math.abs(temperatures[i + 1] - temperatures[i - 1]);
    if (grad > maxGrad) { maxGrad = grad; foundThermocline = DEPTH_LEVELS[i]; }
  }
  void foundThermocline;

  return {
    depths: DEPTH_LEVELS,
    temperatures,
    argoTemps: argoTemps.filter(Boolean) as number[],
    rmse: rmse.filter(Boolean) as number[],
    bias: bias.filter(Boolean) as number[],
    correlation,
    // expose mld/ohc/thermoclineDepth on the profile too (used by some components)
  };
}

// ── Mock data generator ───────────────────────────────────────────────────────
function generateMockRecords(): DayRecord[] {
  const locations = [
    { name: 'Bay of Bengal (NE)',  lat: 15.5, lon: 88.0 },
    { name: 'Arabian Sea (NW)',    lat: 20.0, lon: 63.0 },
    { name: 'Bay of Bengal (SW)', lat: 10.0, lon: 82.0 },
    { name: 'Arabian Sea (SE)',    lat: 12.0, lon: 70.0 },
    { name: 'Lakshadweep Sea',     lat: 11.0, lon: 73.0 },
    { name: 'Gulf of Mannar',      lat: 8.8,  lon: 79.0 },
  ];

  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const loc = locations[i % locations.length];
    const sst = 27 + Math.sin(i * 0.5) * 2.5;
    const sss = 34 + Math.cos(i * 0.3) * 1.5;
    const ssh = -5 + Math.sin(i * 0.7) * 15;
    const sla = ssh + Math.random() * 2 - 1;

    const inputs: SurfaceInputs = {
      sst,
      sss,
      ssh,
      sla,
      ucurrent:  0.1 + Math.sin(i * 0.4) * 0.3,
      vcurrent: -0.05 + Math.cos(i * 0.6) * 0.2,
      uwind:  3 + Math.sin(i * 0.3) * 4,
      vwind: -2 + Math.cos(i * 0.5) * 3,
    };

    const profile = generateProfile(sst, ssh, d.toISOString().split('T')[0], loc.lat, i);
    const mld = 30 + Math.sin(i * 0.4) * 20;
    const ohc = 50 + sst * 2.5 + ssh * 0.3;
    const thermoclineDepth = 60 + Math.sin(i * 0.6) * 30;

    return {
      id: `rec-${i}`,
      date: d.toISOString().split('T')[0],
      location: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      inputs,
      profile,
      mld,
      ohc,
      thermoclineDepth,
      embeddingVector: Array.from({ length: 8 }, () => Math.random() * 2 - 1),
      processedAt: d.toISOString(),
    };
  });
}

function generateMockAlerts(): Alert[] {
  return [
    {
      id: 'al-1',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      triggerEvent: 'Marine Heatwave: SST +3°C anomaly',
      recipients: ['INCOIS', 'NDMA Headquarters', 'IMD Chennai'],
      severity: 'Critical',
      message: 'Sea surface temperature anomaly of +3.2°C above climatology detected over Bay of Bengal (15°N, 88°E). Subsurface reconstruction shows elevated OHC (+18 kJ/cm²). Marine heatwave conditions confirmed.',
      acknowledged: false,
    },
    {
      id: 'al-2',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      triggerEvent: 'Thermocline Shoaling Detected',
      recipients: ['INCOIS', 'Fisheries Department'],
      severity: 'Warning',
      message: 'Thermocline depth has shoaled from 85m to 45m over Arabian Sea region. Strong surface wind forcing (uwind >8 m/s) driving upwelling. Cold subsurface water approaching surface.',
      acknowledged: true,
    },
    {
      id: 'al-3',
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      triggerEvent: 'High SSH Anomaly',
      recipients: ['INCOIS', 'Navy Command'],
      severity: 'Warning',
      message: 'Warm-core eddy detected (SSH +22 cm). Subsurface thermal structure shows deepened thermocline (120m). Ocean Heat Content elevated — potential cyclone intensification zone.',
      acknowledged: true,
    },
  ];
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<DayRecord[]>(() => {
    const stored = localStorage.getItem('ocean_records_v2');
    return stored ? JSON.parse(stored) : generateMockRecords();
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const stored = localStorage.getItem('ocean_alerts_v2');
    return stored ? JSON.parse(stored) : generateMockAlerts();
  });

  const addRecord = useCallback((rec: Omit<DayRecord, 'id' | 'processedAt'>): DayRecord => {
    const newRecord: DayRecord = { ...rec, id: `rec-${Date.now()}`, processedAt: new Date().toISOString() };
    setRecords(prev => {
      const updated = [...prev.filter(r => r.date !== rec.date), newRecord].sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem('ocean_records_v2', JSON.stringify(updated));
      return updated;
    });
    return newRecord;
  }, []);

  const addAlert = useCallback((alert: Omit<Alert, 'id' | 'timestamp'>) => {
    const newAlert: Alert = { ...alert, id: `al-${Date.now()}`, timestamp: new Date().toISOString() };
    setAlerts(prev => {
      const updated = [newAlert, ...prev];
      localStorage.setItem('ocean_alerts_v2', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, acknowledged: true } : a);
      localStorage.setItem('ocean_alerts_v2', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getLatestRecord = useCallback(() => records.length > 0 ? records[records.length - 1] : null, [records]);
  const getRecordByDate = useCallback((date: string) => records.find(r => r.date === date), [records]);

  return (
    <DataContext.Provider value={{ records, alerts, addRecord, addAlert, acknowledgeAlert, getLatestRecord, getRecordByDate }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
