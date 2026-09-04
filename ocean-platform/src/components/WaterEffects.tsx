import { useEffect, useRef } from 'react';

// ── Button/click bubble effect ─────────────────────────────────────────────────
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
      const isBtn  = !!target.closest('button, a, [role="button"]');
      const count  = isBtn ? 18 : 8;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const speed = 2 + Math.random() * 5;
        bubbles.current.push({
          id:      nextId.current++,
          x:       e.clientX,
          y:       e.clientY,
          size:    3 + Math.random() * (isBtn ? 12 : 7),
          vx:      Math.cos(angle) * speed,
          vy:      Math.sin(angle) * speed - 2,
          opacity: 0.8 + Math.random() * 0.2,
          born:    performance.now(),
          hue:     180 + Math.random() * 60,
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

        b.x  += b.vx * 0.3;
        b.y  += b.vy * 0.3;
        b.vy += 0.04;
        b.vx *= 0.98;
        b.vy *= 0.98;

        const r    = b.size * (0.7 + age * 0.6);
        const grad = ctx.createRadialGradient(
          b.x - r * 0.35, b.y - r * 0.35, r * 0.05,
          b.x, b.y, r,
        );
        grad.addColorStop(0,    `hsla(${b.hue}, 90%, 90%, ${alpha * 0.9})`);
        grad.addColorStop(0.4,  `hsla(${b.hue}, 80%, 65%, ${alpha * 0.5})`);
        grad.addColorStop(0.85, `hsla(${b.hue}, 70%, 50%, ${alpha * 0.2})`);
        grad.addColorStop(1,    `hsla(${b.hue}, 70%, 50%, 0)`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
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

// Stub export so existing App.tsx import doesn't break
export function WaterCursorTrail() { return null; }
