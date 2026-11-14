import { formatClock } from '../hooks/useTimers.js';
import Icon from './Icon.jsx';

const C = 2 * Math.PI * 15.5;

export function Ring({ progress, size = 36 }) {
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="15.5" className="ring-bg" />
      <circle cx="18" cy="18" r="15.5" className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 18 18)" />
    </svg>
  );
}

// The timer control shown on a step (in the list and in cook mode).
export function TimerButton({ step, label, timers, big = false }) {
  const t = timers.get(step.id);
  const cls = `timer-btn${big ? ' timer-btn--big' : ''}`;
  if (!t)
    return (
      <button type="button" className={cls} onClick={() => timers.start(step.id, label, step.timerMinutes)}>
        <Icon name="timer" size={big ? 22 : 15} /> Start {step.timerMinutes} min timer
      </button>
    );
  if (t.done)
    return (
      <button type="button" className={`${cls} is-done`} onClick={() => timers.remove(step.id)}>
        <Icon name="check" size={big ? 22 : 15} /> Time's up · dismiss
      </button>
    );
  const left = timers.remaining(t);
  return (
    <button type="button" className={`${cls} is-running${t.endsAt ? '' : ' is-paused'}`} onClick={() => timers.toggle(step.id)}
      aria-label={`${formatClock(left)} left. ${t.endsAt ? 'Pause' : 'Resume'} timer`}>
      <Ring progress={1 - left / t.total} size={big ? 30 : 20} />
      <b>{formatClock(left)}</b> {t.endsAt ? 'Pause' : 'Resume'}
    </button>
  );
}

// Floating stack of all timers, so they stay visible while you scroll.
export function TimerDock({ timers }) {
  if (!timers.timers.length) return null;
  return (
    <aside className="dock" aria-label="Kitchen timers">
      {timers.timers.map((t) => {
        const left = timers.remaining(t);
        return (
          <div key={t.id} className={`dock-item${t.done ? ' is-done' : ''}`} role={t.done ? 'alert' : undefined}>
            <Ring progress={t.done ? 1 : 1 - left / t.total} />
            <div className="dock-text">
              <b>{t.done ? "Time's up!" : formatClock(left)}</b>
              <span>{t.label}</span>
            </div>
            {!t.done && (
              <button type="button" className="icon-btn" onClick={() => timers.toggle(t.id)} aria-label={t.endsAt ? 'Pause timer' : 'Resume timer'}>
                <Icon name={t.endsAt ? 'pause' : 'play'} size={16} />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={() => timers.remove(t.id)} aria-label="Dismiss timer">
              <Icon name="x" size={16} />
            </button>
          </div>
        );
      })}
    </aside>
  );
}
