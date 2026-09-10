import { useEffect, type ReactNode } from 'react';

type StoredRequest = { email?: string };

const GUARDED = new Set(['#/zone', '#/generating', '#/quote']);

function readRequest(): StoredRequest {
  try {
    const raw = localStorage.getItem('mina-video-request');
    return raw ? JSON.parse(raw) as StoredRequest : {};
  } catch {
    return {};
  }
}

function validRequiredEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function enforceEmail() {
  if (!GUARDED.has(location.hash)) return;
  if (validRequiredEmail(readRequest().email)) return;
  history.replaceState({ mina: true, depth: 0 }, '', '#/order');
  queueMicrotask(() => window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })));
}

export default function AudioRouteGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    const check = () => enforceEmail();
    enforceEmail();
    window.addEventListener('hashchange', check);
    window.addEventListener('popstate', check);
    return () => {
      window.removeEventListener('hashchange', check);
      window.removeEventListener('popstate', check);
    };
  }, []);
  return <>{children}</>;
}
