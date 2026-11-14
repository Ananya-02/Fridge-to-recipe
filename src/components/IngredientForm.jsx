import { useState } from 'react';
import { PREFS } from '../../shared/prefs.js';
import { foodEmoji, splitIngredients } from '../lib/foodEmoji.js';
import Icon from './Icon.jsx';

const EXAMPLES = [
  { label: '🍳 Fried rice night', text: 'eggs, tomatoes, onion, leftover rice, soy sauce' },
  { label: '🥥 Cosy curry', text: 'chickpeas, spinach, coconut milk, garlic, ginger' },
  { label: '🍝 Creamy pasta', text: 'pasta, mushrooms, cream, parmesan' },
];
const STAPLES = ['salt', 'olive oil', 'garlic', 'butter', 'lemon', 'chilli flakes'];

export default function IngredientForm({ onSubmit, loading, inputRef }) {
  const [text, setText] = useState('');
  const [prefs, setPrefs] = useState([]);
  const items = splitIngredients(text); // chips are derived from the text: no second source of truth
  const lower = items.map((s) => s.toLowerCase());
  const staples = STAPLES.filter((s) => !lower.some((h) => h.includes(s))).slice(0, 4);

  const add = (word) => setText((t) => (t.trim() ? `${t.trim().replace(/[,;]$/, '')}, ${word}` : word));
  const togglePref = (id) => setPrefs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const submit = (e) => {
    e?.preventDefault();
    if (items.length && !loading) onSubmit({ ingredients: text.trim(), prefs });
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-head">
        <label htmlFor="ingredients">What's in your fridge?</label>
        <span className={`count${text.length > 900 ? ' is-warn' : ''}`}>{text.length}/1000</span>
      </div>
      <textarea
        ref={inputRef}
        id="ingredients"
        rows={2}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
        }}
        placeholder="eggs, two tomatoes, half an onion, leftover rice…"
        aria-describedby="ing-hint"
      />
      <p id="ing-hint" className="sr">Separate ingredients with commas. Enter generates, Shift+Enter adds a line.</p>

      {items.length > 0 && (
        <ul className="magnets" aria-label="Ingredients detected">
          {items.slice(0, 24).map((x, i) => (
            <li key={`${x}-${i}`}>
              <span aria-hidden="true">{foodEmoji(x)}</span>
              {x}
              <button type="button" aria-label={`Remove ${x}`} onClick={() => setText(items.filter((_, j) => j !== i).join(', '))}>
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="prefs" role="group" aria-label="Preferences (optional)">
        {PREFS.map((p) => (
          <button type="button" key={p.id} className="toggle" aria-pressed={prefs.includes(p.id)} onClick={() => togglePref(p.id)}>
            <span aria-hidden="true">{p.emoji}</span> {p.label}
          </button>
        ))}
      </div>

      <div className="composer-foot">
        <div className="quick">
          {items.length === 0 ? (
            <>
              <span className="hint">Try</span>
              {EXAMPLES.map((ex) => (
                <button type="button" className="chip" key={ex.label} onClick={() => setText(ex.text)}>{ex.label}</button>
              ))}
            </>
          ) : (
            staples.length > 0 && (
              <>
                <span className="hint">Add</span>
                {staples.map((s) => (
                  <button type="button" className="chip" key={s} onClick={() => add(s)}>+ {foodEmoji(s)} {s}</button>
                ))}
              </>
            )
          )}
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={!items.length || loading}>
          {loading ? <><span className="spinner" /> Cooking…</> : <><Icon name="sparkles" /> Cook it up</>}
          <kbd className="kbd-on-btn" aria-hidden="true">↵</kbd>
        </button>
      </div>
    </form>
  );
}
