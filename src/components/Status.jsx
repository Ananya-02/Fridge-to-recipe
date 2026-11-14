import { foodEmoji } from '../lib/foodEmoji.js';
import Icon from './Icon.jsx';
import SessionCard from './SessionCard.jsx';
import StreamPreview from './StreamPreview.jsx';

const HOW = [
  ['🧊', 'List what you have', 'Type it the way you would say it: "half an onion, some rice, 3 eggs".'],
  ['✨', 'Get a real recipe', 'Amounts, steps, swaps, timers and nutrition, as data the app can work with.'],
  ['👩‍🍳', 'Cook it your way', 'Scale servings, swap ingredients, tweak it, then follow along in cook mode.'],
];

export function Idle({ sessions, onOpen }) {
  const recent = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  return (
    <div className="idle">
      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Pick up where you left off</h2>
          <div className="recent">
            {recent.map((s) => <SessionCard key={s.id} session={s} onOpen={() => onOpen(s.id)} />)}
          </div>
        </section>
      )}
      <section>
        <h2 className="section-title">How it works</h2>
        <ol className="how">
          {HOW.map(([emoji, title, text], i) => (
            <li key={title} style={{ '--i': i }}>
              <span className="how-emoji" aria-hidden="true">{emoji}</span>
              <b>{title}</b>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const PHASES = [
  ['connecting', 'Opening the fridge'],
  ['thinking', 'Thinking it through'],
  ['writing', 'Writing the recipe'],
];

function Pot({ items }) {
  const emojis = (items.length ? items : ['tomato', 'egg', 'onion', 'rice']).slice(0, 6).map(foodEmoji);
  return (
    <div className="pot" aria-hidden="true" style={{ '--n': emojis.length }}>
      <div className="steam"><i /><i /><i /></div>
      <div className="drops">
        {emojis.map((e, i) => <span key={i} style={{ '--i': i }}>{e}</span>)}
      </div>
      <div className="pot-lid" />
      <div className="pot-body"><div className="bubbles"><i /><i /><i /><i /></div></div>
      <div className="flame"><i /><i /><i /></div>
    </div>
  );
}

export function Loading({ items, phase, preview, attempt, onCancel }) {
  const now = phase === 'retrying' ? 2 : Math.max(0, PHASES.findIndex(([id]) => id === phase));
  return (
    <div className="kitchen">
      <div className="kitchen-stage" role="status" aria-live="polite">
        <Pot items={items} />
        <ol className="phases">
          {PHASES.map(([id, label], i) => (
            <li key={id} className={i < now ? 'is-done' : i === now ? 'is-now' : ''}>
              <span className="phase-dot">{i < now ? <Icon name="check" size={12} /> : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {phase === 'retrying' && (
          <p className="retry-note">The AI fumbled the format, so I asked it to fix its answer (attempt {attempt} of 2).</p>
        )}
        <button type="button" className="btn btn-soft btn-sm" onClick={onCancel}>Cancel <kbd>Esc</kbd></button>
      </div>
      <StreamPreview preview={preview} />
    </div>
  );
}

const ERRORS = {
  TIMEOUT: ['⏳', 'That took too long', 'The AI is slow right now. Trying again usually works.'],
  STALL: ['📡', 'The connection went quiet', 'No data arrived for 20 seconds.'],
  RATE_LIMITED: ['🚦', 'Too many requests', 'Give it a minute, then try again.'],
  INVALID_OUTPUT: ['🧩', 'The AI garbled the recipe', 'It sent something the app could not read, even after asking it to fix it.'],
  EMPTY: ['🫙', 'The AI came back empty', 'It returned no recipe at all.'],
  NETWORK: ['🔌', "Can't reach the server", 'Check your connection and that the API server is running.'],
  DROPPED: ['✂️', 'The stream was cut off', 'The connection closed before the recipe was finished.'],
  NO_KEY: ['🔑', 'No API key on the server', 'Add GROQ_API_KEY to .env, or start with AI_MOCK=ok.'],
  AUTH: ['🔑', 'API key rejected', 'Check GROQ_API_KEY in .env.'],
  BAD_INPUT: ['✍️', 'Check your list', ''],
  UPSTREAM: ['🌩️', 'The AI service is unavailable', 'This is usually temporary.'],
};

export function ErrorCard({ code, message, onRetry, onDismiss }) {
  const [emoji, title, hint] = ERRORS[code] ?? ERRORS.UPSTREAM;
  return (
    <div className="alert" role="alert">
      <span className="alert-emoji" aria-hidden="true">{emoji}</span>
      <div className="alert-body">
        <h2>{title}</h2>
        <p>{message}</p>
        {hint && <p className="muted small">{hint}</p>}
        <div className="alert-actions">
          {code !== 'BAD_INPUT' && <button type="button" className="btn btn-primary" onClick={onRetry}><Icon name="retry" /> Try again</button>}
          <button type="button" className="btn btn-soft" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

export function Refusal({ reason, onEdit }) {
  return (
    <div className="alert alert--soft" role="status">
      <span className="alert-emoji" aria-hidden="true">🤔</span>
      <div className="alert-body">
        <h2>That doesn't look like ingredients</h2>
        <p>{reason}</p>
        <div className="alert-actions">
          <button type="button" className="btn btn-soft" onClick={onEdit}>Edit my list</button>
        </div>
      </div>
    </div>
  );
}
