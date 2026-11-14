import { foodEmoji } from '../lib/foodEmoji.js';
import { formatQty } from '../lib/scale.js';

// Read-only preview of a recipe that is still being written. The data is partial and unvalidated,
// so every field is checked before use; nothing here can crash on a half-written value.
const str = (v) => (typeof v === 'string' ? v : '');
const objects = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const Caret = () => <span className="caret" aria-hidden="true" />;

export default function StreamPreview({ preview }) {
  const r = preview?.recipe && typeof preview.recipe === 'object' ? preview.recipe : null;
  if (!r) {
    return (
      <div className="preview is-waiting" aria-hidden="true">
        <p className="preview-tag"><span className="live-dot" /> Waiting for the first words…</p>
        <div className="skel w60" /><div className="skel w90" /><div className="skel w80" /><div className="skel w70" />
      </div>
    );
  }
  const ings = objects(r.ingredients);
  const steps = objects(r.steps);
  const names = Object.fromEntries(ings.map((i) => [str(i.id), str(i.name)]));
  // Placeholders become names; a placeholder cut off mid-stream ("{{i") is hidden.
  const fill = (t) => str(t).replace(/\{\{(\w+)\}\}/g, (_, id) => names[id] || '…').replace(/\{\{[^}]*$/, '');
  const caretAt = steps.length ? 'steps' : ings.length ? 'ings' : 'title';

  return (
    <div className="preview" aria-label="Recipe being written">
      <p className="preview-tag"><span className="live-dot" /> Live draft · streaming from the AI</p>
      <h3>{str(r.emoji)} {str(r.title)}{caretAt === 'title' && <Caret />}</h3>
      {str(r.description) && <p className="muted">{str(r.description)}</p>}
      {ings.length > 0 && (
        <ul className="preview-ings">
          {ings.map((i, k) => (
            <li key={k}>
              <span aria-hidden="true">{foodEmoji(str(i.name))}</span>{' '}
              {typeof i.quantity === 'number' && <b>{formatQty(i.quantity)} {str(i.unit)} </b>}
              {str(i.name)}
              {caretAt === 'ings' && k === ings.length - 1 && <Caret />}
            </li>
          ))}
        </ul>
      )}
      {steps.length > 0 && (
        <ol className="preview-steps">
          {steps.map((s, k) => (
            <li key={k}>{fill(s.text)}{k === steps.length - 1 && <Caret />}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
