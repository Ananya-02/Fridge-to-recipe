// Saved sessions: pure functions, so they can be unit-tested without a browser.
// A session is one recipe "thread": its versions (original + refinements) and the cook's progress.
import { parseRecipe } from '../../shared/recipeSchema.js';

export const SESSIONS_KEY = 'fridge.sessions.v1';
export const ACTIVE_KEY = 'fridge.active.v1';
export const MAX_SESSIONS = 20;
const MAX_VERSIONS = 8;

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function newSession(input, prefs, recipe) {
  const now = Date.now();
  return {
    id: newId(), createdAt: now, updatedAt: now, input, prefs,
    versions: [{ recipe, instruction: null }], current: 0,
    servings: recipe.baseServings, checked: [], swaps: {},
  };
}

// A refinement adds a version and switches to it. Checked steps and swaps reset because the
// steps and ingredients may have changed; servings stay because that's the cook's choice.
export function withVersion(session, recipe, instruction) {
  const versions = [...session.versions, { recipe, instruction }].slice(-MAX_VERSIONS);
  return { ...session, updatedAt: Date.now(), versions, current: versions.length - 1, checked: [], swaps: {} };
}

// Everything read from storage is re-validated: it may be old, edited by hand, or corrupt.
export function sanitizeSession(s) {
  if (!s || typeof s !== 'object' || typeof s.id !== 'string') return null;
  const versions = (Array.isArray(s.versions) ? s.versions : [])
    .map((v) => ({ recipe: parseRecipe(v?.recipe), instruction: typeof v?.instruction === 'string' ? v.instruction : null }))
    .filter((v) => v.recipe);
  if (!versions.length) return null;

  const current = Number.isInteger(s.current) && s.current >= 0 && s.current < versions.length ? s.current : versions.length - 1;
  const recipe = versions[current].recipe;
  const stepIds = new Set(recipe.steps.map((x) => x.id));
  const swaps = {};
  for (const ing of recipe.ingredients) {
    const v = s.swaps?.[ing.id];
    if (Number.isInteger(v) && v >= 0 && v < ing.swaps.length) swaps[ing.id] = v;
  }
  return {
    id: s.id,
    createdAt: Number(s.createdAt) || Date.now(),
    updatedAt: Number(s.updatedAt) || Date.now(),
    input: typeof s.input === 'string' ? s.input : '',
    prefs: Array.isArray(s.prefs) ? s.prefs.filter((p) => typeof p === 'string') : [],
    versions,
    current,
    servings: Number.isInteger(s.servings) && s.servings >= 1 && s.servings <= 24 ? s.servings : recipe.baseServings,
    checked: Array.isArray(s.checked) ? s.checked.filter((id) => stepIds.has(id)) : [],
    swaps,
  };
}

export function loadSessions(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(SESSIONS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.map(sanitizeSession).filter(Boolean).slice(0, MAX_SESSIONS) : [];
  } catch {
    return []; // corrupt JSON: start fresh rather than crash
  }
}

export function saveSessions(storage, sessions) {
  try {
    storage?.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or blocked: keep the newest half so at least recent work survives.
    try {
      storage?.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, Math.ceil(sessions.length / 2))));
    } catch {
      /* nothing else we can do; the app still works for this visit */
    }
  }
}
