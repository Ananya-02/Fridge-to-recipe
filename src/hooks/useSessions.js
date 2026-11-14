import { useCallback, useEffect, useState } from 'react';
import { ACTIVE_KEY, MAX_SESSIONS, loadSessions, newSession, saveSessions, withVersion } from '../lib/sessions.js';

function getStorage() {
  try {
    return window.localStorage; // can throw in some private modes
  } catch {
    return null;
  }
}

// Owns all saved recipes. Every change is written to localStorage, so a reload restores everything.
export function useSessions() {
  const [storage] = useState(getStorage);
  const [sessions, setSessions] = useState(() => loadSessions(storage));
  const [activeId, setActiveId] = useState(() => {
    let id = null;
    try {
      id = storage?.getItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    return sessions.some((s) => s.id === id) ? id : null;
  });

  useEffect(() => saveSessions(storage, sessions), [storage, sessions]);
  useEffect(() => {
    try {
      if (activeId) storage?.setItem(ACTIVE_KEY, activeId);
      else storage?.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [storage, activeId]);

  const create = useCallback((input, prefs, recipe) => {
    const s = newSession(input, prefs, recipe);
    setSessions((list) => [s, ...list].slice(0, MAX_SESSIONS));
    setActiveId(s.id);
  }, []);

  const addVersion = useCallback((id, recipe, instruction) => {
    setSessions((list) => list.map((s) => (s.id === id ? withVersion(s, recipe, instruction) : s)));
    setActiveId(id);
  }, []);

  const update = useCallback((id, patch) => {
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
  }, []);

  const remove = useCallback((id) => {
    setSessions((list) => list.filter((s) => s.id !== id));
    setActiveId((a) => (a === id ? null : a));
  }, []);

  const active = sessions.find((s) => s.id === activeId) ?? null;
  return { sessions, active, setActiveId, create, addVersion, update, remove };
}
