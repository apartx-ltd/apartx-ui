// projects/apartx-ui/src/lib/router/history/browser.ts
//
// Minimal browser-history adapter — replaces the `history` npm package and the
// old `svelte-routing` history. Ported from apartx-admin, made SSR-safe: every
// access to `window`/`window.history` is guarded so importing this module on the
// server (during SSR) does not throw. On the server the router never calls these
// methods — the initial location flows in per-request via router-context (seeded
// from App's `url` prop), so there is NO shared mutable location here that could
// leak across concurrent SSR requests.
//
// The router (lib/router/useRouter.svelte.ts) needs: .location, .action,
// .listen(cb), .push(url), .replace(url), .goBack(). Native pushState/replaceState
// do NOT emit `popstate`, so we notify listeners manually on programmatic
// navigation; the back/forward buttons fire `popstate`.
//
// History-driven back (modal-history-back-plan):
//  • position (idx) lives in history.state; idx 0 is the app's first entry
//    (we replaceState idx:0 on first load). Each entry also carries `root` — idx of
//    its stack root: 0 by default, or its own idx for a `root` push (a deep link
//    opened over the running app: push tap, service-worker message). canGoBack =
//    position > root, so back from a deep link falls to <Route back> like a cold
//    entry. Both survive reload (state persists).
//  • pushOverlay() adds a synthetic same-URL entry WITHOUT notifying the router
//    (a modal opened; the page view must not re-render).
//  • a single backInterceptor is consulted on `back` popstate BEFORE notifying
//    the router; if it handled the back (closed an overlay), the router is not
//    notified (view unchanged).
import type { Action, HistoryAdapter } from './adapter';

const isBrowser = typeof window !== 'undefined';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

type EntryState = { idx?: number; root?: number; __overlay?: boolean } | null;
const rootOf = (st: EntryState) => (st && typeof st.root === 'number' ? st.root : 0);

let action: Action = 'none';
let position = 0;
let root = 0;
let backInterceptor: (() => boolean) | null = null;
// Ждём forward-возврата на синтетическую запись после вето back'а (см.
// restoreOverlayEntry): этот popstate — служебный, роутер о нём не узнаёт.
let pendingOverlayRestore = false;

if (isBrowser) {
  const st = window.history.state as EntryState;
  position = st && typeof st.idx === 'number' ? st.idx : 0;
  root = rootOf(st);
  if (!st || typeof st.idx !== 'number') {
    window.history.replaceState({ ...(st ?? {}), idx: position, root }, '');
  }
  window.addEventListener('popstate', (e: PopStateEvent) => {
    const est = e.state as EntryState;
    const nextIdx = est && typeof est.idx === 'number' ? est.idx : 0;
    action = nextIdx < position ? 'back' : nextIdx > position ? 'forward' : 'none';
    position = nextIdx;
    root = rootOf(est);
    if (pendingOverlayRestore) {
      pendingOverlayRestore = false;
      // Ожидаемый служебный возврат на запись оверлея: URL/страница не менялись —
      // молча. Любой другой popstate (гонка с быстрым вторым back) сбрасывает
      // флаг и обрабатывается штатно.
      if (action === 'forward' && (e.state as { __overlay?: boolean } | null)?.__overlay) return;
    }
    // On a backward step, let the overlay layer close the topmost overlay first.
    // If it handled it, the URL/page is unchanged → do NOT notify the router.
    if (action === 'back' && backInterceptor && backInterceptor()) return;
    notify();
  });
}

export const browserHistoryAdapter: HistoryAdapter = {
  /** Current browser location, or null on the server (router uses context there). */
  get location() {
    if (!isBrowser) return null;
    const { pathname, search, hash } = window.location;
    return { pathname, search, hash };
  },
  get action() {
    return action;
  },
  /** True when there is an in-app history entry to go back to (idx above the stack root). */
  get canGoBack() {
    return isBrowser && position > root;
  },
  /** True when the CURRENT browser entry is a synthetic overlay entry (state.__overlay).
   *  Used by overlay-stack to ADOPT a surviving overlay entry on a back-driven remount
   *  instead of pushing a new (gesture-less, skip-on-back) one. */
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
    if (opts?.root) root = position;
    action = opts?.action ?? 'forward';
    window.history.pushState({ idx: position, root }, '', url);
    notify();
  },
  replace(url, opts) {
    if (!isBrowser) return;
    // Default 'none' (neutral) — but callers that replace AS a forward navigation
    // (e.g. opening a property from the map sheet, which replaces the sheet's
    // overlay entry) can request a directional transition.
    action = opts?.action ?? 'none';
    if (opts?.root) root = position;
    window.history.replaceState({ idx: position, root }, '', url);
    notify();
  },
  /** Synthetic same-URL entry for an opened overlay; does NOT notify the router. */
  pushOverlay() {
    if (!isBrowser) return;
    position += 1;
    action = 'forward';
    window.history.pushState({ idx: position, root, __overlay: true }, '');
  },
  /** Возврат на пережившую back синтетическую запись (вето beforeBackClose).
   *  Именно forward-траверс, НЕ pushState: gesture-less pushState пометил бы
   *  нижнюю запись skip-on-back (Chrome-интервенция) и убил реальную кнопку
   *  «назад» — back срабатывал бы ровно один раз. */
  restoreOverlayEntry() {
    if (!isBrowser) return;
    pendingOverlayRestore = true;
    window.history.forward();
  },
  /** Register the overlay layer's back handler (returns true if it consumed the back). */
  setBackInterceptor(fn) {
    backInterceptor = fn;
  },
  goBack() {
    if (!isBrowser) return;
    window.history.back();
  },
};
