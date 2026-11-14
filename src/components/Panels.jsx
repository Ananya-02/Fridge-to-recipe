import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import SessionCard from './SessionCard.jsx';

export function HistoryDrawer({ sessions, activeId, onOpen, onDelete, onClose }) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Modal className="sheet" label="Saved recipes" onClose={onClose}>
      <div className="sheet-head">
        <h2>Saved recipes</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <p className="muted small">Kept in this browser. Your progress, servings, swaps and versions come back too.</p>
      {sorted.length === 0 ? (
        <div className="empty-hint"><span aria-hidden="true">🫙</span> Nothing saved yet. Recipes you generate show up here.</div>
      ) : (
        <ul className="session-list">
          {sorted.map((s) => (
            <li key={s.id}>
              <SessionCard session={s} active={s.id === activeId} onOpen={() => (onOpen(s.id), onClose())} />
              <button type="button" className="icon-btn is-danger" onClick={() => onDelete(s.id)}
                aria-label={`Delete ${s.versions[s.current].recipe.title}`}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const SHORTCUTS = [
  ['/', 'Type ingredients'],
  ['Enter', 'Generate (Shift+Enter for a new line)'],
  ['Esc', 'Cancel a request, leave a field, close a panel'],
  ['C', 'Open cook mode'],
  ['R', 'Tweak the current recipe'],
  ['+  −', 'More or fewer servings'],
  ['H', 'Saved recipes'],
  ['T', 'Light or dark theme'],
  ['← →', 'Previous or next step in cook mode'],
  ['?', 'This list'],
];

export function ShortcutsDialog({ onClose }) {
  return (
    <Modal className="help" label="Keyboard shortcuts" onClose={onClose}>
      <div className="sheet-head">
        <h2>Keyboard shortcuts</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <dl className="shortcuts">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
        ))}
      </dl>
    </Modal>
  );
}
