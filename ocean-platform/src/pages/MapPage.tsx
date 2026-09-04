import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Thermometer, Layers, Info, MapPin } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { useData, DEPTH_LEVELS } from '../contexts/DataContext';
import { format, parseISO } from 'date-fns';

// ── Config ─────────────────────────────────────────────────────────────────────
const SLAB_W  = 4.2;
const SLAB_D  = 3.0;
const TOTAL_H = 3.6; // world units spanning all 15 depth levels
const DEPTH_MAX = 1000;

// Map depth index → Y position (top = 0m, bottom = 1000m)
function depthToY(d: number): number {
  return 1.8 - (d / DEPTH_MAX) * TOTAL_H;
}

function slabThickness(i: number): number {
  if (i >= DEPTH_LEVELS.length - 1) return 0.18;
  const dz = DEPTH_LEVELS[i + 1] - DEPTH_LEVELS[i];
  return Math.min((dz / DEPTH_MAX) * TOTAL_H * 1.05, 0.5);
}

// ── Colour: cold (deep) → hot (surface) ───────────────────────────────────────
function tempToHex(t: number): string {
  const n = THREE.MathUtils.clamp((t - 2) / 27, 0, 1);
  const cold  = [0.10, 0.20, 0.70];
  const cool  = [0.04, 0.71, 0.83];
  const warm  = [0.98, 0.74, 0.13];
  const hot   = [0.93, 0.27, 0.27];
  const lerp  = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  let rgb: number[];
  if (n < 0.33)      rgb = lerp(cold, cool, n / 0.33);
  else if (n < 0.66) rgb = lerp(cool, warm, (n - 0.33) / 0.33);
  else               rgb = lerp(warm, hot,  (n - 0.66) / 0.34);
  return `#${rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

// ── Canvas texture with cell-wise temperature grid ────────────────────────────
function buildSlabTexture(temp: number, cols = 20, rows = 15): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width  = cols * 10;
  canvas.height = rows * 10;
  const ctx = canvas.getContext('2d')!;
  // Fully opaque vivid fill — no globalAlpha dimming
  ctx.globalAlpha = 1.0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const noise = Math.sin(r * 0.8 + c * 0.6) * 1.8 + Math.cos(r * 0.5 - c * 0.9) * 1.2;
      const t = THREE.MathUtils.clamp(temp + noise, 2, 30);
      const hex = tempToHex(t);
      ctx.fillStyle = hex;
      ctx.fillRect(c * 10, r * 10, 10, 10);
    }
  }
  // Subtle grid overlay
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * 10, 0); ctx.lineTo(c * 10, canvas.height); ctx.stroke(); }
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * 10); ctx.lineTo(canvas.width, r * 10); ctx.stroke(); }
  ctx.globalAlpha = 1.0;
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ── A single depth-level slab ─────────────────────────────────────────────────
function DepthSlab({
  depthIdx, temp, isHovered, onClick,
}: {
  depthIdx: number;
  temp: number;
  isHovered: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const depth   = DEPTH_LEVELS[depthIdx];
  const yCenter = depthToY(depth);
  const thick   = slabThickness(depthIdx);
  const hexColor = tempToHex(temp);

  const topTex  = useMemo(() => buildSlabTexture(temp), [temp]);

  const topMat  = useMemo(() => new THREE.MeshStandardMaterial({
    map: topTex,
    roughness: 0.1,
    metalness: 0.0,
    transparent: false,
    opacity: 1.0,
    // Boost brightness so colour shows through scene lighting
    emissiveMap: topTex,
    emissive: new THREE.Color(0.3, 0.3, 0.3),
  }), [topTex]);

  const sideMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexColor),
    emissive: new THREE.Color(hexColor),
    emissiveIntensity: isHovered ? 0.7 : 0.2,
    roughness: 0.4, metalness: 0.15,
    transparent: true, opacity: isHovered ? 0.95 : 0.80,
  }), [hexColor, isHovered]);

  useFrame(({ clock }) => {
    if (meshRef.current && isHovered) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial[];
      if (mat[0]) mat[0].emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.25;
    }
  });

  const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[0, yCenter, 0]}
        material={mats}
        onClick={onClick}
        onPointerEnter={() => {}}
        castShadow receiveShadow
      >
        <boxGeometry args={[SLAB_W, thick, SLAB_D]} />
      </mesh>

      {/* Glow halo on hover */}
      {isHovered && (
        <mesh position={[0, yCenter, 0]}>
          <boxGeometry args={[SLAB_W + 0.08, thick + 0.08, SLAB_D + 0.08]} />
          <meshBasicMaterial color={hexColor} transparent opacity={0.15} side={THREE.BackSide} />
        </mesh>
      )}

      {/* Right-side label — only render for every 3rd level to avoid overlap */}
      {depthIdx % 3 === 0 && (
        <Html
          position={[SLAB_W / 2 + 0.30, yCenter, 0]}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div className={`transition-all duration-200 ${isHovered ? 'opacity-100 scale-105' : 'opacity-75'}`}
            style={{ background: 'rgba(2,9,23,0.7)', borderRadius: '6px', padding: '2px 6px', border: `1px solid ${hexColor}55` }}>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: hexColor, boxShadow: `0 0 4px ${hexColor}` }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>{depth}m</span>
            </div>
            <span style={{ color: hexColor, fontSize: '10px', fontFamily: 'monospace', marginLeft: '10px' }}>{temp.toFixed(1)}°C</span>
          </div>
        </Html>
      )}
      {/* For hovered slab: always show label regardless of index */}
      {isHovered && depthIdx % 3 !== 0 && (
        <Html
          position={[SLAB_W / 2 + 0.30, yCenter, 0]}
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div style={{ background: 'rgba(2,9,23,0.85)', borderRadius: '6px', padding: '3px 8px', border: `1px solid ${hexColor}80` }}>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: hexColor, boxShadow: `0 0 6px ${hexColor}` }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>{depth}m</span>
            </div>
            <span style={{ color: hexColor, fontSize: '10px', fontFamily: 'monospace', marginLeft: '10px' }}>{temp.toFixed(1)}°C</span>
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Vertical connector pillars at slab corners ────────────────────────────────
function CornerPillars() {
  const yTop = depthToY(DEPTH_LEVELS[0]) + slabThickness(0) / 2;
  const yBot = depthToY(DEPTH_LEVELS[DEPTH_LEVELS.length - 1]) - slabThickness(DEPTH_LEVELS.length - 1) / 2;
  const corners: [number, number][] = [
    [-SLAB_W / 2, -SLAB_D / 2], [SLAB_W / 2, -SLAB_D / 2],
    [ SLAB_W / 2,  SLAB_D / 2], [-SLAB_W / 2,  SLAB_D / 2],
  ];
  return (
    <group>
      {corners.map(([x, z], i) => (
        <Line
          key={i}
          points={[new THREE.Vector3(x, yTop, z), new THREE.Vector3(x, yBot, z)]}
          color="#ffffff"
          transparent
          opacity={0.12}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

// ── Temperature probe: vertical cylinder with glowing tip ─────────────────────
function TempProbe({ temperatures }: { temperatures: number[] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.25;
  });

  const yTop = depthToY(0) + 0.1;
  const yBot = depthToY(1000) - 0.1;
  const height = yTop - yBot;
  const surfTemp = temperatures[0];

  return (
    <group ref={ref} position={[0.9, (yTop + yBot) / 2, 0.7]}>
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, height, 8]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.0} transparent opacity={0.8} />
      </mesh>
      {/* Glowing tip at surface */}
      <mesh position={[0, height / 2, 0]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color={tempToHex(surfTemp)} emissive={tempToHex(surfTemp)} emissiveIntensity={2.5} />
      </mesh>
      {/* Reading */}
      <Html position={[0.12, height / 2, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div className="glass rounded-lg px-2 py-1 border border-cyan-500/30 text-xs shadow-lg">
          <p className="text-white/50 text-[10px]">SST</p>
          <p className="text-cyan-400 font-mono font-bold">{surfTemp.toFixed(1)}°C</p>
        </div>
      </Html>
    </group>
  );
}

// ── Floating particles (upwelling) ────────────────────────────────────────────
function Particles() {
  const count = 180;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * SLAB_W * 0.9;
      arr[i * 3 + 1] = Math.random() * TOTAL_H - TOTAL_H / 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * SLAB_D * 0.9;
    }
    return arr;
  }, []);

  const speeds = useMemo(() => new Float32Array(count).map(() => 0.0004 + Math.random() * 0.0006), []);

  const ref = useRef<THREE.Points>(null);
  useFrame(() => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i];
      if (pos[i * 3 + 1] > TOTAL_H / 2) pos[i * 3 + 1] = -TOTAL_H / 2;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
      </bufferGeometry>
      <pointsMaterial color="#06b6d4" size={0.014} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

// ── Axis ruler on the left ────────────────────────────────────────────────────
function DepthRuler() {
  const x    = -SLAB_W / 2 - 0.55;  // pushed further left
  const yTop = depthToY(0);
  const yBot = depthToY(1000);

  return (
    <group>
      <Line
        points={[new THREE.Vector3(x, yTop + 0.1, 0), new THREE.Vector3(x, yBot - 0.1, 0)]}
        color="#ffffff" transparent opacity={0.20} lineWidth={1}
      />
      {[0, 100, 200, 300, 500, 700, 1000].map(d => {
        const y = depthToY(d);
        return (
          <group key={d}>
            <Line
              points={[new THREE.Vector3(x - 0.08, y, 0), new THREE.Vector3(x + 0.06, y, 0)]}
              color="#ffffff" transparent opacity={0.25} lineWidth={1}
            />
            <Html
              position={[x - 0.12, y, 0]}
              style={{ pointerEvents: 'none', whiteSpace: 'nowrap', transform: 'translate(-100%, -50%)' }}
            >
              <span style={{
                fontSize: '10px', color: 'rgba(255,255,255,0.5)',
                fontFamily: 'monospace', fontWeight: 600,
                background: 'rgba(2,9,23,0.6)', padding: '1px 4px', borderRadius: '3px',
              }}>{d}m</span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function ProfileScene({ temperatures }: { temperatures: number[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <>
      <Stars radius={80} depth={40} count={1500} factor={3} saturation={0} fade />
      <ambientLight intensity={1.2} />
      <directionalLight position={[6, 8, 5]} intensity={2.5} castShadow />
      <directionalLight position={[0, 5, 8]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-4, -3, -3]} intensity={0.6} color="#1e40af" />
      <pointLight position={[0, 2.5, 0]} intensity={1.5} color="#06b6d4" distance={8} />
      <pointLight position={[0, -2.5, 0]} intensity={0.8} color="#3730a3" distance={6} />

      {DEPTH_LEVELS.map((_, i) => (
        <DepthSlab
          key={i}
          depthIdx={i}
          temp={temperatures[i]}
          isHovered={hoveredIdx === i}
          onClick={() => setHoveredIdx(prev => prev === i ? null : i)}
        />
      ))}

      <CornerPillars />
      <TempProbe temperatures={temperatures} />
      <Particles />
      <DepthRuler />

      <OrbitControls
        enablePan enableZoom enableRotate
        minDistance={3} maxDistance={14}
        target={[0, 0, 0]}
      />
    </>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function TempLegend() {
  const stops = [
    { t: '2°C',  hex: '#1a34b3' },
    { t: '10°C', hex: '#0ab8d9' },
    { t: '20°C', hex: '#fabd21' },
    { t: '29°C', hex: '#ee4444' },
  ];
  return (
    <div className="glass rounded-xl p-3 border border-white/10 w-44">
      <p className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
        <Thermometer size={11} className="text-cyan-400" />
        Temperature Scale
      </p>
      <div className="h-3 rounded-full mb-1" style={{ background: 'linear-gradient(to right, #1a34b3, #0ab8d9, #fabd21, #ee4444)' }} />
      <div className="flex justify-between text-[10px] text-white/40">
        {stops.map(s => <span key={s.t}>{s.t}</span>)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { records, getLatestRecord } = useData();
  const latest = getLatestRecord();
  const [dateIdx, setDateIdx] = useState(records.length - 1);
  const currentRecord = records[dateIdx] ?? latest;
  const temperatures = currentRecord?.profile.temperatures ?? DEPTH_LEVELS.map((d) => 28 - d * 0.025);

  return (
    <PageLayout fullHeight>
      <div className="relative" style={{ height: 'calc(100vh - 64px)' }}>
        <Canvas camera={{ position: [6, 1.5, 7], fov: 40 }} shadows gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
          <Suspense fallback={null}>
            <ProfileScene temperatures={temperatures} />
          </Suspense>
        </Canvas>

        {/* Title */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="glass rounded-xl px-4 py-3 border border-white/10">
            <h1 className="text-lg font-bold gradient-text-ocean">3D Subsurface Temperature Profile</h1>
            <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1.5">
              <MapPin size={10} />
              {currentRecord?.location ?? 'North Indian Ocean'} ·{' '}
              {currentRecord ? format(parseISO(currentRecord.date), 'MMM d, yyyy') : '—'}
            </p>
            <p className="text-xs text-white/30 mt-0.5">15 standard depth levels: 0 → 1000 m</p>
          </div>
        </div>

        {/* Layer list */}
        <div className="absolute top-4 right-4 w-48">
          <div className="glass rounded-xl p-3 border border-white/10">
            <p className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
              <Layers size={11} className="text-cyan-400" />
              Depth Levels ({DEPTH_LEVELS.length})
            </p>
            <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1">
              {DEPTH_LEVELS.map((d, i) => (
                <div key={d} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: tempToHex(temperatures[i]) }} />
                    <span className="text-xs text-white/60">{d} m</span>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: tempToHex(temperatures[i]) }}>
                    {temperatures[i].toFixed(1)}°C
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Date scrubber */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
          <div className="glass rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">Date scrubber</span>
              <span className="text-xs text-cyan-400 font-medium">
                {currentRecord ? format(parseISO(currentRecord.date), 'MMMM d, yyyy') : '—'}
              </span>
            </div>
            <input
              type="range" min={0} max={records.length - 1} value={dateIdx}
              onChange={e => setDateIdx(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white/25 mt-1">
              <span>{records[0] ? format(parseISO(records[0].date), 'MMM d') : ''}</span>
              <span>{records[records.length - 1] ? format(parseISO(records[records.length - 1].date), 'MMM d') : ''}</span>
            </div>
          </div>
        </div>

        {/* Bottom-left: live readings */}
        <div className="absolute bottom-4 left-4 space-y-2">
          <TempLegend />
          {currentRecord && (
            <div className="glass rounded-xl p-3 border border-white/10 text-xs w-44 space-y-1.5">
              <p className="text-white/50 flex items-center gap-1"><Info size={11} />Surface Obs</p>
              {[
                { l: 'SST',  v: `${currentRecord.inputs.sst.toFixed(1)}°C`,    c: 'text-red-400' },
                { l: 'SSS',  v: `${currentRecord.inputs.sss.toFixed(1)} PSU`,  c: 'text-blue-400' },
                { l: 'SSH',  v: `${currentRecord.inputs.ssh.toFixed(1)} cm`,   c: 'text-cyan-400' },
                { l: 'MLD',  v: `${currentRecord.mld.toFixed(0)} m`,           c: 'text-purple-400' },
                { l: 'OHC',  v: `${currentRecord.ohc.toFixed(0)} kJ/cm²`,     c: 'text-orange-400' },
              ].map(({ l, v, c }) => (
                <div key={l} className="flex justify-between">
                  <span className="text-white/40">{l}</span>
                  <span className={`font-medium ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="absolute bottom-24 right-4 pointer-events-none">
          <div className="glass rounded-xl px-3 py-2 border border-white/8 text-xs text-white/30 space-y-0.5">
            <p>🖱 Drag to rotate</p>
            <p>🖱 Scroll to zoom</p>
            <p>🖱 Click slab for details</p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
