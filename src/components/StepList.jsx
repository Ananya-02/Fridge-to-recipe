import { stepParts } from '../lib/scale.js';
import Icon from './Icon.jsx';
import { TimerButton } from './Timers.jsx';

// Step text with each ingredient highlighted, using the current servings and swaps.
export function StepText({ parts }) {
  return parts.map((p, i) =>
    typeof p === 'string' ? (
      p
    ) : (
      <mark key={i} className={`mention${p.swapped ? ' is-swapped' : ''}`}>
        {p.amount && <b>{p.amount}</b>} {p.name}
      </mark>
    ),
  );
}

export default function StepList({ steps, ingredients, swaps, base, servings, checked, onToggle, timers }) {
  const done = checked.length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="panel" aria-labelledby="steps-h">
      <div className="panel-head">
        <h3 id="steps-h">Method</h3>
        <span className="muted small">{done} of {steps.length} done</span>
      </div>
      <div className="meter" role="progressbar" aria-label="Cooking progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <ol className="steps">
        {steps.map((s, k) => {
          const isDone = checked.includes(s.id);
          return (
            <li key={s.id} className={isDone ? 'is-done' : ''} style={{ '--i': k }}>
              <label className="step">
                <input type="checkbox" className="sr" checked={isDone} onChange={() => onToggle(s.id)} />
                <span className="step-num" aria-hidden="true">{isDone ? <Icon name="check" size={16} /> : k + 1}</span>
                <span className="step-text">
                  <StepText parts={stepParts(s.text, ingredients, swaps, base, servings)} />
                </span>
              </label>
              {s.timerMinutes && <TimerButton step={s} label={`Step ${k + 1}`} timers={timers} />}
            </li>
          );
        })}
      </ol>
      {done === steps.length && <p className="finished">🎉 All done. Bon appétit!</p>}
    </section>
  );
}
