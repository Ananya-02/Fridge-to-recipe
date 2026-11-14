import { useCallback, useReducer, useRef } from 'react';
import { validateResponse } from '../../shared/recipeSchema.js';
import { readEvents } from '../lib/sse.js';

const STALL_MS = 20_000; // no event at all (the server pings every 5s) = dead connection
const HARD_MS = 80_000; // absolute cap; the server gives up after 2 x 30s

export const initial = { status: 'idle', kind: null, phase: null, text: '', attempt: 1, message: '', code: '' };

// status: idle | loading | success | empty (AI refused) | error
// phase while loading: connecting | thinking | writing | retrying
export function reducer(state, a) {
  switch (a.type) {
    case 'start': return { ...initial, status: 'loading', kind: a.kind, phase: 'connecting' };
    case 'phase': return state.status === 'loading' ? { ...state, phase: a.phase } : state;
    case 'chunk': return state.status === 'loading' ? { ...state, text: state.text + a.text } : state;
    case 'reset': return { ...state, text: '', phase: 'retrying', attempt: state.attempt + 1 };
    case 'success': return { ...initial, status: 'success', kind: state.kind };
    case 'refused': return { ...initial, status: 'empty', kind: state.kind, message: a.reason };
    case 'error': return { ...initial, status: 'error', kind: state.kind, code: a.code, message: a.message };
    case 'clear': return initial;
    default: return state;
  }
}

const FAILURES = {
  STALL: 'The connection went quiet. Check your network and try again.',
  TIMEOUT: 'The request took too long. Try again.',
  NETWORK: "Can't reach the server. Check your connection and that the API is running.",
  DROPPED: 'The connection closed before the recipe was finished. Try again.',
  INVALID_OUTPUT: 'The recipe came back in a format the app could not read. Try again.',
};

// One request at a time. Starting a new one aborts the old one, and a request id makes sure a
// late response from an old request can never overwrite the newer one.
export function useRecipeRequest(onRecipe) {
  const [state, dispatch] = useReducer(reducer, initial);
  const latest = useRef(0);
  const controller = useRef(null);
  const last = useRef(null);
  const onRecipeRef = useRef(onRecipe);
  onRecipeRef.current = onRecipe;

  const run = useCallback(async (body, meta = {}) => {
    last.current = { body, meta };
    controller.current?.abort();
    const id = ++latest.current;
    const isCurrent = () => id === latest.current;
    const c = (controller.current = new AbortController());
    let why = 'NETWORK';
    const abortWith = (reason) => ((why = reason), c.abort());
    let stall = setTimeout(() => abortWith('STALL'), STALL_MS);
    const hard = setTimeout(() => abortWith('TIMEOUT'), HARD_MS);
    const fail = (code, message) => dispatch({ type: 'error', code, message: message || FAILURES[code] });

    dispatch({ type: 'start', kind: body.mode });
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: c.signal,
      });
      if (!isCurrent()) return;

      // Errors found before streaming starts (bad input, rate limit) come back as plain JSON.
      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const err = (await res.json().catch(() => null))?.error;
        if (isCurrent()) fail(err?.code ?? 'UPSTREAM', err?.message ?? `The server answered ${res.status}. Try again.`);
        return;
      }

      let finished = false;
      await readEvents(res.body, (event, data) => {
        if (!isCurrent() || finished) return;
        clearTimeout(stall);
        stall = setTimeout(() => abortWith('STALL'), STALL_MS);
        if (event === 'status') dispatch({ type: 'phase', phase: data.phase });
        else if (event === 'chunk') dispatch({ type: 'chunk', text: String(data.text ?? '') });
        else if (event === 'reset') dispatch({ type: 'reset' });
        else if (event === 'error') {
          finished = true;
          fail(data.code ?? 'UPSTREAM', data.message);
        } else if (event === 'done') {
          finished = true;
          const check = validateResponse(data.result); // never trust the network: validate again
          if (!check.valid) return fail('INVALID_OUTPUT');
          if (!check.data.ok) return dispatch({ type: 'refused', reason: check.data.reason });
          onRecipeRef.current?.(meta, check.data.recipe, data.warnings ?? []);
          dispatch({ type: 'success' });
        }
      });
      if (isCurrent() && !finished) fail('DROPPED');
    } catch {
      if (isCurrent()) fail(why); // aborted by our timers, or a network error
    } finally {
      clearTimeout(stall);
      clearTimeout(hard);
    }
  }, []);

  // Cancel: bump the id first so the aborted request's handlers see they are stale.
  const cancel = useCallback(() => {
    latest.current++;
    controller.current?.abort();
    dispatch({ type: 'clear' });
  }, []);

  const retry = useCallback(() => last.current && run(last.current.body, last.current.meta), [run]);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { ...state, run, retry, cancel, clear };
}
