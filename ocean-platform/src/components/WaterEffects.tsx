import { useEffect, useRef } from 'react';

// ── Water cursor trail ─────────────────────────────────────────────────────────
interface TrailDrop {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  born: number;
}

export function WaterCursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drops     = useRef<TrailDrop[]>([]);
  const nextId    = useRef(0);
  const rafRef    = useRef<number>(0);
  const lastPos   = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) return; // throttle
      lastPos.current = { x: e.clientX, y: e.clientY };

      // Spawn 2–4 drops along the movement vector
      const count = 2 + Math.floor(dist / 20);
      for (let i = 0; i < count; i++) {
        drops.current.push({
          id:      nextId.current++,
          x:       e.clientX + (Math.random() - 0.5) * 12,
          y:       e.clientY + (Math.random() - 0.5) * 12,
          size:    3 + Math.random() * 6,
          opacity: 0.7 + Math.random() * 0.3,
          born:    performance.now(),
        });
      }
      // Keep pool manageable
      if (drops.current.length > 120) drops.current.splice(0, 30);
    };

    window.addEventListener('mousemove', onMove);

    const LIFETIME = 1000; // ms

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();

      drops.current = drops.current.filter(d => now - d.born < LIFETIME);

      for (const d of drops.current) {
        const age   = (now - d.born) / LIFETIME;  // 0→1
        const alpha = d.opacity * (1 - age);
        const r     = d.size * (0.5 + age * 0.5); // grows slightly then fades

        // Outer ripple ring
        ctx.beginPath();
        ctx.arc(d.x, d.y, r * (1 + age * 1.5), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(6,182,212,${alpha * 0.4})`;
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        // Inner drop
        const grad = ctx.createRadialGradient(d.x - r * 0.3, d.y - r * 0.3, 0, d.x, d.y, r);
        grad.addColorStop(0, `rgba(200,240,255,${alpha * 0.9})`);
        grad.addColorStop(0.4, `rgba(6,182,212,${alpha * 0.7})`);
        grad.addColorStop(1,  `rgba(6,182,212,0)`);
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

// ── Button bubble click effect ─────────────────────────────────────────────────
interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  opacity: number;
  born: number;
  hue: number;
}

export function BubbleClickEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbles   = useRef<Bubble[]>([]);
  const nextId    = useRef(0);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isBtn  = target.closest('button, a, [role="button"]');
      // Always spawn on click; more bubbles if on a button
      const count = isBtn ? 18 : 8;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 2 + Math.random() * 5;
        bubbles.current.push({
          id:      nextId.current++,
          x:       e.clientX,
          y:       e.clientY,
          size:    3 + Math.random() * (isBtn ? 12 : 7),
          vx:      Math.cos(angle) * speed,
          vy:      Math.sin(angle) * speed - 2, // bias upward
          opacity: 0.8 + Math.random() * 0.2,
          born:    performance.now(),
          hue:     180 + Math.random() * 60, // cyan→blue range
        });
      }
    };

    window.addEventListener('click', onClick);

    const LIFETIME = 900;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();

      bubbles.current = bubbles.current.filter(b => now - b.born < LIFETIME);

      for (const b of bubbles.current) {
        const age   = (now - b.born) / LIFETIME;
        const alpha = b.opacity * (1 - age * age);
        const r     = b.size;

        // Update physics
        b.x  += b.vx * 0.3;
        b.y  += b.vy * 0.3;
        b.vy += 0.04; // gravity
        b.vx *= 0.98;
        b.vy *= 0.98;

        // Bubble highlight
        const grad = ctx.createRadialGradient(
          b.x - r * 0.35, b.y - r * 0.35, r * 0.05,
          b.x, b.y, r,
        );
        grad.addColorStop(0,    `hsla(${b.hue}, 90%, 90%, ${alpha * 0.9})`);
        grad.addColorStop(0.4,  `hsla(${b.hue}, 80%, 65%, ${alpha * 0.5})`);
        grad.addColorStop(0.85, `hsla(${b.hue}, 70%, 50%, ${alpha * 0.2})`);
        grad.addColorStop(1,    `hsla(${b.hue}, 70%, 50%, 0)`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, r * (0.7 + age * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * (0.7 + age * 0.6), 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${b.hue}, 80%, 75%, ${alpha * 0.5})`;
        ctx.lineWidth   = 0.6;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9998]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
