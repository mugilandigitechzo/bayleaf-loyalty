import { useEffect, useState } from 'react';

const listeners = new Set<() => void>();

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', () => listeners.forEach((l) => l()));

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const l = () => setPath(location.pathname);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return path;
}

export function useQuery(): URLSearchParams {
  usePath();
  return new URLSearchParams(location.search);
}

/** Intercept same-origin link clicks so the app doesn't reload. */
export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
