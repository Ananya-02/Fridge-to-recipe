const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(ms) {
  const s = Math.round((ms - Date.now()) / 1000);
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]])
    if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
  return 'just now';
}

export default function SessionCard({ session, onOpen, active }) {
  const r = session.versions[session.current].recipe;
  const pct = Math.round((session.checked.length / r.steps.length) * 100);
  const versions = session.versions.length;
  return (
    <button type="button" className={`session-card${active ? ' is-active' : ''}`} onClick={onOpen}>
      <span className="session-emoji" aria-hidden="true">{r.emoji}</span>
      <span className="session-body">
        <b>{r.title}</b>
        <span className="muted small">
          {timeAgo(session.updatedAt)}{versions > 1 ? ` · ${versions} versions` : ''} · {pct}% cooked
        </span>
      </span>
      <span className="session-ring" style={{ '--p': pct }} aria-hidden="true" />
    </button>
  );
}
