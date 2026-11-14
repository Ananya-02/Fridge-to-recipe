import { foodEmoji } from '../lib/foodEmoji.js';
import { amountText, effective } from '../lib/scale.js';
import Icon from './Icon.jsx';

export default function IngredientList({ ingredients, base, servings, swaps, onSwap }) {
  const swapped = Object.keys(swaps).length;
  return (
    <section className="panel" aria-labelledby="ing-h">
      <div className="panel-head">
        <h3 id="ing-h">Ingredients</h3>
        <span className="muted small">{ingredients.length} items{swapped ? ` · ${swapped} swapped` : ''}</span>
      </div>
      <ul className="ingredients">
        {ingredients.map((ing, k) => {
          const chosen = swaps[ing.id];
          const e = effective(ing, chosen);
          const amount = amountText(e.quantity, e.unit, base, servings);
          return (
            <li key={ing.id} className={e.swapped ? 'is-swapped' : ''} style={{ '--i': k }}>
              <span className="ing-emoji" aria-hidden="true">{foodEmoji(e.name)}</span>
              <span className="ing-main">
                {/* key remounts the text when it changes, which replays the pop animation */}
                <span className="ing-name" key={e.name}>{e.name}</span>
                <span className="amt" key={amount}>{amount}</span>
              </span>
              {ing.swaps.length > 0 && (
                <label className={`swap${chosen != null ? ' is-on' : ''}`}>
                  <Icon name="swap" size={14} />
                  <span className="sr">Swap {ing.name}</span>
                  <select value={chosen ?? ''} onChange={(ev) => onSwap(ing.id, ev.target.value === '' ? null : Number(ev.target.value))}>
                    <option value="">{chosen == null ? 'Swap' : `Back to ${ing.name}`}</option>
                    {ing.swaps.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                  </select>
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
