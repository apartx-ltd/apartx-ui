// projects/apartx-ui/src/lib/router/history/browser.ts
import type { Action, HistoryAdapter } from './adapter';

const isBrowser = typeof window !== 'undefined';
const ROOT_IDX = 0;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let action: Action = 'none';
let position = 0;
let backInterceptor: (() => boolean) | null = null;

if (isBrowser) {
  const st = window.history.state as { idx?: number } | null;
  position = st && typeof st.idx === 'number' ? st.idx : 0;
  if (!st || typeof st.idx !== 'number') {
    window.history.replaceState({ ...(st ?? {}), idx: position }, '');
  }
  window.addEventListener('popstate', (e: PopStateEvent) => {
    const nextIdx =
      e.state && typeof (e.state as { idx?: number }).idx === 'number'
        ? (e.state as { idx: number }).idx
        : 0;
    action = nextIdx < position ? 'back' : nextIdx > position ? 'forward' : 'none';
    position = nextIdx;
    if (action === 'back' && backInterceptor && backInterceptor()) return;
    notify();
  });
}

export const browserHistoryAdapter: HistoryAdapter = {
  get location() {
    if (!isBrowser) return null;
    const { pathname, search, hash } = window.location;
    return { pathname, search, hash };
  },
  get action() {
    return action;
  },
  get canGoBack() {
    return isBrowser && position > ROOT_IDX;
  },
  get onOverlayEntry() {
    return isBrowser && !!(window.history.state as { __overlay?: boolean } | null)?.__overlay;
  },
  listen(cb) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
  push(url, opts) {
    if (!isBrowser) return;
    position += 1;
    action = opts?.action ?? 'forward';
    window.history.pushState({ idx: position }, '', url);
    notify();
  },
  replace(url, opts) {
    if (!isBrowser) return;
    action = opts?.action ?? 'none';
    window.history.replaceState({ idx: position }, '', url);
    notify();
  },
  pushOverlay() {
    if (!isBrowser) return;
    position += 1;
    action = 'forward';
    window.history.pushState({ idx: position, __overlay: true }, '');
  },
  setBackInterceptor(fn) {
    backInterceptor = fn;
  },
  goBack() {
    if (!isBrowser) return;
    window.history.back();
  },
};
