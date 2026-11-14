import { useDeferredValue, useMemo, useRef, useState } from 'react';
import Hero from './components/Hero.jsx';
import Icon from './components/Icon.jsx';
import IngredientForm from './components/IngredientForm.jsx';
import { HistoryDrawer, ShortcutsDialog } from './components/Panels.jsx';
import RecipeView from './components/RecipeView.jsx';
import { ErrorCard, Idle, Loading, Refusal } from './components/Status.jsx';
import { useHotkeys, useTheme, useToast } from './hooks/ui.js';
import { useRecipeRequest } from './hooks/useRecipeRequest.js';
import { useSessions } from './hooks/useSessions.js';
import { splitIngredients } from './lib/foodEmoji.js';
import { parsePartial } from './lib/partialJson.js';

export default function App() {
  const sessions = useSessions();
  const theme = useTheme();
  const [toast, showToast] = useToast();
  const [panel, setPanel] = useState(null); // 'history' | 'help' | null
  const [potItems, setPotItems] = useState([]);
  const [refineFor, setRefineFor] = useState(null); // session id being refined
  const inputRef = useRef(null);
  const stageRef = useRef(null);

  // A valid recipe arrived: a new session, or a new version of the session that was refined.
  const req = useRecipeRequest((meta, recipe, warnings) => {
    if (meta.sessionId) sessions.addVersion(meta.sessionId, recipe, meta.instruction);
    else sessions.create(meta.input, meta.prefs, recipe);
    if (warnings.length) showToast(`⚠️ ${warnings[0]}`);
  });

  const generate = ({ ingredients, prefs }) => {
    setPotItems(splitIngredients(ingredients));
    req.run({ mode: 'create', ingredients, prefs }, { input: ingredients, prefs });
    requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const refine = (session, recipe, instruction) => {
    setRefineFor(session.id);
    req.run({ mode: 'refine', recipe, instruction }, { sessionId: session.id, instruction });
  };

  // Streaming preview, parsed from the partial JSON text. Deferred so typing and animations stay smooth.
  const text = useDeferredValue(req.text);
  const preview = useMemo(() => (text ? parsePartial(text) : null), [text]);

  const loading = req.status === 'loading';
  const creating = req.kind === 'create';
  const active = sessions.active;

  useHotkeys({
    '/': () => inputRef.current?.focus(),
    h: () => setPanel('history'),
    '?': () => setPanel('help'),
    t: theme.toggle,
    Escape: (e) => {
      if (loading) return req.cancel();
      if (e.target instanceof HTMLElement && e.target !== document.body) return e.target.blur();
      return false;
    },
  });

  let stage;
  if (creating && loading)
    stage = <Loading items={potItems} phase={req.phase} preview={preview} attempt={req.attempt} onCancel={req.cancel} />;
  else if (creating && req.status === 'error')
    stage = <ErrorCard code={req.code} message={req.message} onRetry={req.retry} onDismiss={req.clear} />;
  else if (creating && req.status === 'empty')
    stage = <Refusal reason={req.message} onEdit={() => (req.clear(), inputRef.current?.focus())} />;
  else if (active) {
    const refining = req.kind === 'refine' && refineFor === active.id && req.status !== 'success' && req.status !== 'idle';
    stage = (
      <RecipeView
        key={`${active.id}:${active.current}`}
        session={active}
        onPatch={(patch) => sessions.update(active.id, patch)}
        onClose={() => sessions.setActiveId(null)}
        onRefine={(recipe, instruction) => refine(active, recipe, instruction)}
        refine={refining ? {
          status: req.status, phase: req.phase, message: req.message,
          stepsWritten: Array.isArray(preview?.recipe?.steps) ? preview.recipe.steps.length : 0,
          onRetry: req.retry, onCancel: req.cancel, onDismiss: req.clear,
        } : null}
        toast={showToast}
      />
    );
  } else stage = <Idle sessions={sessions.sessions} onOpen={sessions.setActiveId} />;

  return (
    <>
      <a className="skip" href="#stage">Skip to recipe</a>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => (req.clear(), sessions.setActiveId(null))} aria-label="Fridge to Feast, home">
          <span className="fridge" aria-hidden="true"><i className="door" /><i className="door door--low" /></span>
          <span className="brand-name">Fridge<em>to</em>Feast</span>
        </button>
        <nav className="topnav" aria-label="App">
          <button type="button" className="nav-btn" onClick={() => setPanel('history')} aria-label="Saved recipes (H)">
            <Icon name="history" /> <span className="nav-label">Saved</span>
            {sessions.sessions.length > 0 && <b className="count-badge">{sessions.sessions.length}</b>}
          </button>
          <button type="button" className="nav-btn" onClick={theme.toggle} aria-label={theme.dark ? 'Switch to light theme (T)' : 'Switch to dark theme (T)'}>
            <Icon name={theme.dark ? 'sun' : 'moon'} />
          </button>
          <button type="button" className="nav-btn hide-touch" onClick={() => setPanel('help')} aria-label="Keyboard shortcuts (?)">
            <Icon name="keyboard" />
          </button>
        </nav>
      </header>

      <main>
        <Hero compact={Boolean(active) || req.status !== 'idle'}>
          <IngredientForm onSubmit={generate} loading={loading && creating} inputRef={inputRef} />
        </Hero>
        <div id="stage" ref={stageRef} className="stage">{stage}</div>
      </main>

      <footer className="footer">
        Built with React, Express and Groq · the API key stays on the server · photo by Unsplash
      </footer>

      {panel === 'history' && (
        <HistoryDrawer sessions={sessions.sessions} activeId={active?.id} onOpen={(id) => (req.clear(), sessions.setActiveId(id))}
          onDelete={(id) => (sessions.remove(id), showToast('Recipe deleted'))} onClose={() => setPanel(null)} />
      )}
      {panel === 'help' && <ShortcutsDialog onClose={() => setPanel(null)} />}
      {toast && <div key={toast.id} className="toast" role="status">{toast.message}</div>}
    </>
  );
}
