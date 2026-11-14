import { useCallback, useEffect, useRef, useState } from 'react';

// Kitchen timers for steps like "simmer 10 minutes". Several can run at once.
// A running timer stores when it ends (not a countdown), so it stays accurate even if the tab sleeps.
// timer: { id, label, total, endsAt (ms or null when paused), left (ms, when paused), done }
export function useTimers(onDone) {
  const [timers, setTimers] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const running = timers.some((t) => t.endsAt);
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    const finished = timers.filter((t) => t.endsAt && t.endsAt <= now);
    if (!finished.length) return;
    const ids = new Set(finished.map((t) => t.id));
    setTimers((ts) => ts.map((t) => (ids.has(t.id) ? { ...t, endsAt: null, left: 0, done: true } : t)));
    finished.forEach((t) => onDoneRef.current?.(t));
  }, [now, timers]);

  const remaining = useCallback((t) => (t.endsAt ? Math.max(0, t.endsAt - now) : t.left), [now]);

  const start = useCallback((id, label, minutes) => {
    const total = Math.round(minutes * 60_000);
    setNow(Date.now());
    setTimers((ts) => [...ts.filter((t) => t.id !== id), { id, label, total, endsAt: Date.now() + total, left: total, done: false }]);
  }, []);

  const toggle = useCallback((id) => {
    setNow(Date.now());
    setTimers((ts) =>
      ts.map((t) => {
        if (t.id !== id || t.done) return t;
        return t.endsAt ? { ...t, endsAt: null, left: Math.max(0, t.endsAt - Date.now()) } : { ...t, endsAt: Date.now() + t.left };
      }),
    );
  }, []);

  const remove = useCallback((id) => setTimers((ts) => ts.filter((t) => t.id !== id)), []);
  const get = useCallback((id) => timers.find((t) => t.id === id), [timers]);

  return { timers, remaining, start, toggle, remove, get };
}

export const formatClock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Three short beeps with the Web Audio API (no sound file needed).
export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* sound is optional */
  }
}
