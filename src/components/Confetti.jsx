import { useEffect, useRef, useState } from 'react';

const COLORS = ['#ff5a36', '#ffb02e', '#2fa36b', '#3f8cff', '#d63c6b', '#ffd84d'];

// A small canvas confetti burst when `fire` turns true (not when it is already true on load).
export default function Confetti({ fire }) {
  const canvas = useRef(null);
  const prev = useRef(fire);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (fire && !prev.current) setBurst((b) => b + 1);
    prev.current = fire;
  }, [fire]);

  useEffect(() => {
    if (!burst || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = canvas.current;
    const ctx = el.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    el.width = W * dpr;
    el.height = H * dpr;
    ctx.scale(dpr, dpr);

    const pieces = Array.from({ length: 170 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.4,
      y: H * 0.4,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 6,
      size: Math.random() * 7 + 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      round: Math.random() < 0.3,
    }));

    let raf;
    const start = performance.now();
    const tick = (t) => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t - start < 3500) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, W, H);
    };
  }, [burst]);

  return <canvas ref={canvas} className="confetti" aria-hidden="true" />;
}
