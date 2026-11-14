import { useEffect, useRef, useState } from 'react';
import { foodEmoji } from '../lib/foodEmoji.js';
import { stepParts } from '../lib/scale.js';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { StepText } from './StepList.jsx';
import { TimerButton } from './Timers.jsx';

// Keeps the screen awake while cooking, where supported. Purely a nicety: failures are ignored.
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let cancelled = false;
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (cancelled ? l.release() : (lock = l)))
      .catch(() => {});
    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
    };
  }, []);
}

// Full-screen, one step at a time, big text: for when your hands are messy.
export default function CookMode({ recipe, servings, swaps, checked, onToggle, timers, onClose }) {
  const steps = recipe.steps;
  const [i, setI] = useState(() => Math.max(0, steps.findIndex((s) => !checked.includes(s.id))));
  const swipeX = useRef(null);
  useWakeLock();

  const step = steps[i];
  const isDone = checked.includes(step.id);
  const last = i === steps.length - 1;
  const go = (d) => setI((x) => Math.min(steps.length - 1, Math.max(0, x + d)));
  const next = () => {
    if (!isDone) onToggle(step.id);
    if (last) onClose();
    else go(1);
  };
  const parts = stepParts(step.text, recipe.ingredients, swaps, recipe.baseServings, servings);
  const uses = parts.filter((p) => typeof p === 'object');

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else return;
    e.preventDefault();
  };

  return (
    <Modal className="cook" label={`Cook mode: ${recipe.title}`} onClose={onClose} onKeyDown={onKeyDown}>
      <div className="cook-top">
        <div className="cook-progress" aria-hidden="true">
          {steps.map((s, k) => (
            <i key={s.id} className={checked.includes(s.id) ? 'is-done' : k === i ? 'is-now' : ''} />
          ))}
        </div>
        <div className="cook-bar">
          <span className="cook-title">{recipe.emoji} {recipe.title}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close cook mode"><Icon name="x" /></button>
        </div>
      </div>

      <div
        className="cook-body"
        onPointerDown={(e) => (swipeX.current = e.clientX)}
        onPointerUp={(e) => {
          const dx = e.clientX - (swipeX.current ?? e.clientX);
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
          swipeX.current = null;
        }}
      >
        <div key={i} className="cook-step" aria-live="polite">
          <p className="cook-count">Step {i + 1} <span>of {steps.length}</span>{isDone && <span className="badge badge-ok">Done</span>}</p>
          <p className="cook-text"><StepText parts={parts} /></p>
          {uses.length > 0 && (
            <ul className="cook-uses" aria-label="You need">
              {uses.map((u, k) => (
                <li key={k}><span aria-hidden="true">{foodEmoji(u.name)}</span> {u.amount} {u.name}</li>
              ))}
            </ul>
          )}
          {step.timerMinutes && <TimerButton step={step} label={`Step ${i + 1}`} timers={timers} big />}
        </div>
      </div>

      <div className="cook-nav">
        <button type="button" className="btn btn-soft" onClick={() => go(-1)} disabled={i === 0}>
          <Icon name="left" /> Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={next} autoFocus>
          {last ? 'Finish' : isDone ? 'Next step' : 'Done, next'} <Icon name={last ? 'check' : 'right'} />
        </button>
      </div>
      <p className="cook-hint">← → to move · swipe on a phone · the screen stays on</p>
    </Modal>
  );
}
