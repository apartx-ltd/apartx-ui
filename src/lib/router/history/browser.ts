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
import type { Action, HistoryAdapter, LeaveGuardHook } from './adapter';

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
// Гард ухода (router/guard). Заблокированный траверс откатывается (history.go(-delta)):
// popstate отката — служебный, роутер о нём не узнаёт, а confirm открывается только после
// него — сам confirm оверлей и пушит запись, посреди незавершённого траверса нельзя.
// На «Уйти»: «назад» — повтор траверса (history.go(delta)), его popstate идёт мимо гарда;
// «вперёд» — назначение новой записью (forward-хвост стёр pushState confirm'а).
let leaveGuard: LeaveGuardHook | null = null;
// Откат ждёт приземления ровно на запись `idx` (откуда ушли); повтор «назад» — на `leaveRetryIdx`.
// Любой другой popstate (hash-якорь, чужой pushState, быстрый второй back) флаг сбрасывает
// и обрабатывается штатно — иначе настоящий back приняли бы за приземление.
let pendingLeaveRevert: { idx: number; ask: () => void } | null = null;
let leaveRetryIdx: number | null = null;
// Страница (pathname + search), которую сейчас показывает роутер. Смена только hash и
// синтетические same-URL записи оверлеев — не уход со страницы, гард их не охраняет.
let pageKey = isBrowser ? window.location.pathname + window.location.search : '';

if (isBrowser) {
  const st = window.history.state as EntryState;
  position = st && typeof st.idx === 'number' ? st.idx : 0;
  root = rootOf(st);
  if (!st || typeof st.idx !== 'number') {
    window.history.replaceState({ ...(st ?? {}), idx: position, root }, '');
  }
  window.addEventListener('popstate', (e: PopStateEvent) => {
    const est = e.state as EntryState;
    const hasIdx = !!est && typeof est.idx === 'number';
    const nextIdx = hasIdx ? (est as { idx: number }).idx : 0;
    const prev = position;
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
    if (pendingLeaveRevert) {
      const pending = pendingLeaveRevert;
      pendingLeaveRevert = null;
      if (hasIdx && nextIdx === pending.idx) {
        // Откат заблокированного ухода приземлился: страница не менялась — молча; теперь
        // можно открывать confirm.
        pending.ask();
        return;
      }
    }
    if (leaveRetryIdx !== null) {
      // Повтор после «Уйти» — наш, а не закрытие оверлея: интерцептор не спрашиваем.
      const expected = leaveRetryIdx;
      leaveRetryIdx = null;
      if (hasIdx && nextIdx === expected) {
        pageKey = window.location.pathname + window.location.search;
        notify();
        return;
      }
    }
    // On a backward step, let the overlay layer close the topmost overlay first.
    // If it handled it, the URL/page is unchanged → do NOT notify the router.
    if (action === 'back' && backInterceptor && backInterceptor()) return;
    const landedKey = window.location.pathname + window.location.search;
    const hook = leaveGuard;
    // Запись без числового idx (hash-якорь, чужой pushState) — дельта бессмысленна, не охраняем.
    if (hasIdx && landedKey !== pageKey && action !== 'none' && hook?.blocked()) {
      const delta = nextIdx - prev;
      // Браузер уже на назначении — для «вперёд» запоминаем его до отката. «Вперёд» на «Уйти»
      // открывает назначение заново новой записью: его root/state не восстанавливаются
      // (принято намеренно, forward-хвост всё равно стёр pushState confirm'а).
      const target = landedKey + window.location.hash;
      pendingLeaveRevert = {
        idx: prev,
        ask: () => hook.onBlocked(() => {
          if (delta > 0) {
            browserHistoryAdapter.push(target, { force: true });
            return;
          }
          leaveRetryIdx = nextIdx;
          window.history.go(delta);
        }),
      };
      window.history.go(-delta);
      return;
    }
    pageKey = landedKey;
    notify();
  });
}

// Назначение push/replace — та же страница (отличается разве что hash): это не уход.
const samePage = (url: string) => {
  const u = new URL(url, window.location.href);
  return u.pathname + u.search === pageKey;
};

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
    if (!opts?.force && leaveGuard?.blocked() && !samePage(url)) {
      leaveGuard.onBlocked(() => browserHistoryAdapter.push(url, { ...opts, force: true }));
      return;
    }
    position += 1;
    if (opts?.root) root = position;
    action = opts?.action ?? 'forward';
    window.history.pushState({ idx: position, root }, '', url);
    pageKey = window.location.pathname + window.location.search;
    notify();
  },
  replace(url, opts) {
    if (!isBrowser) return;
    if (!opts?.force && leaveGuard?.blocked() && !samePage(url)) {
      leaveGuard.onBlocked(() => browserHistoryAdapter.replace(url, { ...opts, force: true }));
      return;
    }
    // Default 'none' (neutral) — but callers that replace AS a forward navigation
    // (e.g. opening a property from the map sheet, which replaces the sheet's
    // overlay entry) can request a directional transition.
    action = opts?.action ?? 'none';
    if (opts?.root) root = position;
    window.history.replaceState({ idx: position, root }, '', url);
    pageKey = window.location.pathname + window.location.search;
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
  /** Подключить гарды ухода (router/guard/leave-guard.ts). */
  setLeaveGuard(hook) {
    leaveGuard = hook;
  },
  goBack() {
    if (!isBrowser) return;
    window.history.back();
  },
};
