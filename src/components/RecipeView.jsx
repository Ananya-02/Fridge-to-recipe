import { useRef, useState } from 'react';
import { useHotkeys } from '../hooks/ui.js';
import { beep, useTimers } from '../hooks/useTimers.js';
import { recipeToText } from '../lib/scale.js';
import Blocks from './Blocks.jsx';
import Confetti from './Confetti.jsx';
import CookMode from './CookMode.jsx';
import Icon from './Icon.jsx';
import IngredientList from './IngredientList.jsx';
import RefineBar from './RefineBar.jsx';
import StepList from './StepList.jsx';
import { TimerDock } from './Timers.jsx';

function Servings({ value, onChange }) {
  return (
    <div className="servings" role="group" aria-label="Servings">
      <button type="button" className="round" aria-label="Fewer servings" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <Icon name="minus" />
      </button>
      <div className="servings-val">
        <output key={value} aria-live="polite">{value}</output>
        <span>{value === 1 ? 'serving' : 'servings'}</span>
      </div>
      <button type="button" className="round" aria-label="More servings" disabled={value >= 24} onClick={() => onChange(value + 1)}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

// Controlled: the session (from useSessions) owns servings, swaps, checked steps and the version,
// so they are saved automatically. Changes go up as small patches.
export default function RecipeView({ session, onPatch, onClose, onRefine, refine, toast }) {
  const recipe = session.versions[session.current].recipe;
  const { servings, swaps, checked } = session;
  const [cooking, setCooking] = useState(false);
  const refineInput = useRef(null);
  const timers = useTimers((t) => {
    beep();
    toast(`⏰ ${t.label}: time's up!`);
  });

  const busy = refine?.status === 'loading';
  const allDone = checked.length === recipe.steps.length;
  const setServings = (n) => onPatch({ servings: Math.min(24, Math.max(1, n)) });
  const onSwap = (id, idx) => {
    const next = { ...swaps };
    if (idx == null) delete next[id];
    else next[id] = idx;
    onPatch({ swaps: next });
  };
  const toggleStep = (id) => onPatch({ checked: checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id] });

  const share = async () => {
    const text = recipeToText(recipe, servings, swaps);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: recipe.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast('📋 Recipe copied, with your servings and swaps');
      }
    } catch (e) {
      if (e.name !== 'AbortError') toast("Couldn't copy the recipe in this browser.");
    }
  };

  useHotkeys({
    c: () => setCooking(true),
    r: () => refineInput.current?.focus(),
    '+': () => setServings(servings + 1),
    '=': () => setServings(servings + 1),
    '-': () => setServings(servings - 1),
  });

  return (
    <article className={`recipe${busy ? ' is-busy' : ''}`} aria-busy={busy}>
      <header className="dish">
        <div className="plate" aria-hidden="true"><span>{recipe.emoji}</span></div>
        <div className="dish-body">
          <div className="dish-tags">
            <span className={`badge diff-${recipe.difficulty}`}>{recipe.difficulty}</span>
            {session.versions.length > 1 && <span className="badge">version {session.current + 1}</span>}
          </div>
          <h2>{recipe.title}</h2>
          {recipe.description && <p className="dish-desc">{recipe.description}</p>}
          <ul className="facts">
            <li><Icon name="clock" size={16} /><b>{recipe.prepMinutes}</b> min prep</li>
            <li><Icon name="flame" size={16} /><b>{recipe.cookMinutes}</b> min cook</li>
            <li><Icon name="timer" size={16} /><b>{recipe.prepMinutes + recipe.cookMinutes}</b> min total</li>
          </ul>
        </div>
        <div className="dish-side">
          <Servings value={servings} onChange={setServings} />
          <div className="dish-actions">
            <button type="button" className="btn btn-primary" onClick={() => setCooking(true)}><Icon name="play" size={16} /> Cook mode</button>
            <button type="button" className="btn btn-soft" onClick={share}><Icon name="share" size={16} /> Share</button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close recipe"><Icon name="x" /></button>
          </div>
        </div>
      </header>

      <RefineBar
        request={refine}
        inputRef={refineInput}
        versions={session.versions}
        current={session.current}
        onSubmit={(instruction) => onRefine(recipe, instruction)}
        onPickVersion={(i) => onPatch({ current: i, checked: [], swaps: {} })}
        stepsWritten={refine?.stepsWritten ?? 0}
      />

      <div className="recipe-grid">
        <IngredientList ingredients={recipe.ingredients} base={recipe.baseServings} servings={servings} swaps={swaps} onSwap={onSwap} />
        <StepList
          steps={recipe.steps} ingredients={recipe.ingredients} swaps={swaps} base={recipe.baseServings}
          servings={servings} checked={checked} onToggle={toggleStep} timers={timers}
        />
      </div>

      {recipe.blocks.length > 0 && <Blocks blocks={recipe.blocks} />}
      <p className="disclaimer">AI-generated. Double-check amounts, allergens and cooking times.</p>

      {cooking && (
        <CookMode recipe={recipe} servings={servings} swaps={swaps} checked={checked} onToggle={toggleStep} timers={timers} onClose={() => setCooking(false)} />
      )}
      <TimerDock timers={timers} />
      <Confetti fire={allDone} />
    </article>
  );
}
