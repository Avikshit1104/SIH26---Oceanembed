import { useEffect, useRef } from 'react';

/**
 * WaveBackground
 *
 * Renders a full-screen, fixed, always-behind canvas with slow organic
 * silk-like fluid wave animation in deep navy/black — matching the reference.
 *
 * Technique:
 *  - Multiple overlapping sinusoidal ribbons drawn as thick bezier paths
 *  - Each ribbon has a radial/linear gradient fill giving the glossy "silk" look
 *  - Very slow phase drift (60–120s full cycle) for a calm, meditative feel
 *  - Occasional specular highlight streaks (white/cyan thin lines)
 *  - mixBlendMode: normal on canvas, content renders above via z-index
 */
export default function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // ── Wave definitions ──────────────────────────────────────────────────────
    // Each wave is a thick ribbon drawn as a filled bezier spline
    type Wave = {
      // vertical anchor % (0..1 of canvas height)
      yBase: number;
      // horizontal speed (very slow)
      speed: number;
      // phase offset
      phase: number;
      // amplitude in px
      amp: number;
      // x-frequency (how many waves across screen)
      freq: number;
      // thickness of ribbon
      thickness: number;
      // colour stops [pos, r, g, b, a]
      colors: [number, number, number, number, number][];
      // secondary highlight
      highlight: boolean;
    };

    const waves: Wave[] = [
      {
        yBase: 0.35, speed: 0.00018, phase: 0, amp: 140, freq: 0.6,
        thickness: 320,
        colors: [[0, 8, 20, 55, 0.85], [0.5, 15, 40, 100, 0.55], [1, 5, 12, 38, 0]],
        highlight: false,
      },
      {
        yBase: 0.55, speed: 0.00012, phase: 1.4, amp: 120, freq: 0.5,
        thickness: 280,
        colors: [[0, 5, 15, 50, 0.9], [0.5, 20, 55, 120, 0.5], [1, 6, 18, 50, 0]],
        highlight: false,
      },
      {
        yBase: 0.72, speed: 0.00022, phase: 2.8, amp: 90, freq: 0.8,
        thickness: 200,
        colors: [[0, 2, 8, 30, 0.9], [0.45, 12, 35, 85, 0.6], [1, 3, 10, 35, 0]],
        highlight: false,
      },
      {
        yBase: 0.20, speed: 0.00015, phase: 4.2, amp: 100, freq: 0.55,
        thickness: 250,
        colors: [[0, 3, 10, 40, 0.85], [0.5, 10, 30, 75, 0.55], [1, 4, 12, 42, 0]],
        highlight: false,
      },
      {
        yBase: 0.88, speed: 0.00010, phase: 5.5, amp: 70, freq: 0.7,
        thickness: 180,
        colors: [[0, 1, 5, 22, 0.9], [0.5, 8, 24, 60, 0.5], [1, 2, 7, 25, 0]],
        highlight: false,
      },
      // Specular highlight ribbons (thin, bright)
      {
        yBase: 0.42, speed: 0.00020, phase: 0.7, amp: 110, freq: 0.62,
        thickness: 18,
        colors: [[0, 30, 70, 140, 0], [0.25, 60, 130, 220, 0.25], [0.5, 80, 160, 255, 0.15], [0.75, 60, 130, 220, 0.25], [1, 30, 70, 140, 0]],
        highlight: true,
      },
      {
        yBase: 0.60, speed: 0.00014, phase: 2.1, amp: 95, freq: 0.52,
        thickness: 10,
        colors: [[0, 20, 50, 100, 0], [0.3, 50, 110, 190, 0.18], [0.5, 70, 145, 230, 0.12], [0.7, 50, 110, 190, 0.18], [1, 20, 50, 100, 0]],
        highlight: true,
      },
      {
        yBase: 0.28, speed: 0.00016, phase: 3.5, amp: 85, freq: 0.68,
        thickness: 7,
        colors: [[0, 15, 40, 80, 0], [0.4, 40, 90, 160, 0.15], [0.6, 40, 90, 160, 0.15], [1, 15, 40, 80, 0]],
        highlight: true,
      },
    ];

    // ── Draw a single wave ribbon ─────────────────────────────────────────────
    function drawWave(wave: Wave, t: number, w: number, h: number) {
      const yCenter = wave.yBase * h;
      const pts = 80; // control points

      // Build spline points
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i <= pts; i++) {
        const x = (i / pts) * w;
        // Multi-harmonic for organic look
        const phase1 = wave.phase + t * wave.speed;
        const phase2 = wave.phase * 1.7 + t * wave.speed * 0.6;
        const phase3 = wave.phase * 2.3 + t * wave.speed * 1.4;
        const y = yCenter
          + Math.sin(i / pts * Math.PI * 2 * wave.freq + phase1) * wave.amp
          + Math.sin(i / pts * Math.PI * 2 * wave.freq * 1.3 + phase2) * wave.amp * 0.35
          + Math.sin(i / pts * Math.PI * 2 * wave.freq * 0.7 + phase3) * wave.amp * 0.2;
        xs.push(x);
        ys.push(y);
      }

      const half = wave.thickness / 2;

      // Gradient: perpendicular to wave, top→bottom across ribbon
      const midY = ys[Math.floor(pts / 2)];
      const grad = ctx.createLinearGradient(0, midY - half, 0, midY + half);
      for (const [pos, r, g, b, a] of wave.colors) {
        grad.addColorStop(pos, `rgba(${r},${g},${b},${a})`);
      }

      // Draw filled ribbon using path: top edge → bottom edge reversed
      ctx.beginPath();
      // Top edge (y - half)
      ctx.moveTo(xs[0], ys[0] - half);
      for (let i = 1; i < xs.length; i++) {
        const cpx = (xs[i - 1] + xs[i]) / 2;
        const cpy = (ys[i - 1] + ys[i]) / 2 - half;
        ctx.quadraticCurveTo(xs[i - 1] - half * 0.02, ys[i - 1] - half, cpx, cpy);
      }
      ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1] - half);
      // Vertical end cap
      ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1] + half);
      // Bottom edge reversed (y + half)
      for (let i = xs.length - 2; i >= 0; i--) {
        const cpx = (xs[i] + xs[i + 1]) / 2;
        const cpy = (ys[i] + ys[i + 1]) / 2 + half;
        ctx.quadraticCurveTo(xs[i + 1] + half * 0.02, ys[i + 1] + half, cpx, cpy);
      }
      ctx.closePath();

      ctx.fillStyle = grad;
      ctx.fill();

      // For highlight waves: also stroke a thin bright line at center
      if (wave.highlight) {
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0]);
        for (let i = 1; i < xs.length; i++) {
          const cpx = (xs[i - 1] + xs[i]) / 2;
          const cpy = (ys[i - 1] + ys[i]) / 2;
          ctx.quadraticCurveTo(xs[i - 1], ys[i - 1], cpx, cpy);
        }
        const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
        lineGrad.addColorStop(0,   'rgba(60,130,220,0)');
        lineGrad.addColorStop(0.3, 'rgba(80,160,255,0.18)');
        lineGrad.addColorStop(0.5, 'rgba(100,180,255,0.10)');
        lineGrad.addColorStop(0.7, 'rgba(80,160,255,0.18)');
        lineGrad.addColorStop(1,   'rgba(60,130,220,0)');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    const startTime = performance.now();

    const render = () => {
      const t  = performance.now() - startTime;
      const w  = canvas.width;
      const h  = canvas.height;

      // Deep black base
      ctx.fillStyle = '#010812';
      ctx.fillRect(0, 0, w, h);

      // Very subtle deep radial glow in centre-left (like the reference)
      const glow = ctx.createRadialGradient(w * 0.35, h * 0.5, 0, w * 0.35, h * 0.5, w * 0.7);
      glow.addColorStop(0,   'rgba(8,25,70,0.55)');
      glow.addColorStop(0.5, 'rgba(5,15,45,0.3)');
      glow.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Draw waves back-to-front (non-highlight first, then highlights)
      for (const wave of waves) {
        if (!wave.highlight) drawWave(wave, t, w, h);
      }
      for (const wave of waves) {
        if (wave.highlight) drawWave(wave, t, w, h);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
