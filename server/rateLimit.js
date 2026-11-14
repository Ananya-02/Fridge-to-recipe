// Fixed-window, in-memory rate limit per IP. Protects the free API key on a public demo.
// In memory means it resets on restart and isn't shared between instances (see README limitations).
export function rateLimit({ max, windowMs = 60_000 }) {
  const hits = new Map(); // ip -> { count, resetAt }
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 5000) for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) hits.set(ip, (h = { count: 0, resetAt: now + windowMs }));

    if (++h.count > max) {
      const wait = Math.ceil((h.resetAt - now) / 1000);
      res.set('Retry-After', String(wait));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: `Too many recipes at once. Try again in ${wait}s.` } });
    }
    next();
  };
}
