// Small UI hooks: theme, global keyboard shortcuts, toast.
import { useCallback, useEffect, useRef, useState } from 'react';

const THEME_KEY = 'fridge.theme';

// 'system' follows the OS until the user picks light or dark. index.html applies the saved
// choice before React loads, so there is no flash of the wrong theme.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const toggle = useCallback(() => setTheme(dark ? 'light' : 'dark'), [dark]);
  return { dark, toggle };
}

// Single-key shortcuts. Ignored while typing in a field (except Escape) and while a dialog is open,
// so a dialog's own keys never trigger shortcuts behind it.
export function useHotkeys(map) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.querySelector('dialog[open]')) return;
      const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if (typing && e.key !== 'Escape') return;
      const fn = ref.current[e.key];
      if (fn && fn(e) !== false) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((message, tone = 'info') => {
    clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, show];
}
