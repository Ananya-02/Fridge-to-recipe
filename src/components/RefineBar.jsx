import { useState } from 'react';
import Icon from './Icon.jsx';

const IDEAS = [
  ['🌱', 'Make it vegetarian'], ['🌶️', 'Make it spicier'], ['⚡', 'Make it quicker'],
  ['🥗', 'Make it lighter'], ['🥛', 'Make it dairy-free'], ['🍳', 'Use fewer pans'],
];
const PHASE_TEXT = {
  connecting: 'Sending your change…', thinking: 'The AI is thinking…', writing: 'Rewriting the recipe…', retrying: 'Fixing a formatting slip…',
};

// Follow-up prompts edit the current recipe instead of starting over. Each result is a new version.
export default function RefineBar({ request, inputRef, versions, current, onSubmit, onPickVersion, stepsWritten }) {
  const [text, setText] = useState('');
  const busy = request?.status === 'loading';
  const send = (instruction) => {
    const v = instruction.trim();
    if (!v || busy) return;
    onSubmit(v);
    setText('');
  };

  return (
    <section className="refine" aria-labelledby="refine-h">
      <div className="refine-head">
        <h3 id="refine-h"><Icon name="wand" /> Not quite right? Tweak it</h3>
        {versions.length > 1 && (
          <div className="versions" role="group" aria-label="Versions">
            {versions.map((v, i) => (
              <button type="button" key={i} aria-pressed={i === current} onClick={() => onPickVersion(i)} title={v.instruction ?? 'Original recipe'}>
                <span className="v-num">v{i + 1}</span> {i === 0 ? 'Original' : v.instruction}
              </button>
            ))}
          </div>
        )}
      </div>
      <form className="refine-form" onSubmit={(e) => (e.preventDefault(), send(text))}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          disabled={busy}
          aria-label="What should change?"
          placeholder='"no dairy", "use the oven", "add more veg"…'
        />
        <button type="submit" className="btn btn-dark" disabled={!text.trim() || busy}>
          {busy ? <><span className="spinner" /> Working</> : <>Apply <Icon name="arrow" size={16} /></>}
        </button>
      </form>
      <div className="ideas">
        {IDEAS.map(([emoji, idea]) => (
          <button type="button" key={idea} className="chip" disabled={busy} onClick={() => send(idea)}>
            <span aria-hidden="true">{emoji}</span> {idea}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {busy && (
          <p className="refine-status">
            <span className="live-dot" /> {PHASE_TEXT[request.phase] ?? 'Working…'}
            {stepsWritten > 0 && ` ${stepsWritten} step${stepsWritten > 1 ? 's' : ''} written.`}
            <button type="button" className="link" onClick={request.onCancel}>Cancel</button>
          </p>
        )}
        {request?.status === 'error' && (
          <div className="inline-alert" role="alert">
            <span>⚠️ {request.message} Your current recipe is unchanged.</span>
            <span>
              <button type="button" className="link" onClick={request.onRetry}>Retry</button>
              <button type="button" className="link" onClick={request.onDismiss}>Dismiss</button>
            </span>
          </div>
        )}
        {request?.status === 'empty' && (
          <div className="inline-alert is-soft">
            <span>🤔 {request.message}</span>
            <button type="button" className="link" onClick={request.onDismiss}>OK</button>
          </div>
        )}
      </div>
    </section>
  );
}
