// LIFO открытых оверлеев. Открытие кладёт синтетическую history-запись (pushOverlay);
// единственный back-interceptor (history.ts) на backward-popstate закрывает верхний.
// Закрытие НЕ через back (бэкдроп/Escape/X/программно) снимает лишнюю history-запись
// одним guard'ованным history.back(). Идемпотентно: токен уже снят → no-op.
import type { HistoryAdapter } from '../history/adapter';

type Close = () => void;
interface Entry {
  token: number;
  close: Close;
}

const Z_BASE = 60;
const Z_STEP = 10;

export interface OverlayHandle {
  token: number;
  z: number;
  close: () => void;
}

export interface OverlayStack {
  overlayCount(): number;
  subscribeOverlay(cb: () => void): () => void;
  registerOverlay(opts: { close: Close; scrim?: boolean }): OverlayHandle;
  openOverlay(close: Close): number; // back-compat
  closeOverlay(token: number, opts?: { viaBack?: boolean }): void;
  initOverlayStack(): void;
}

export function createOverlayStack(adapter: HistoryAdapter): OverlayStack {
  const stack: Entry[] = [];
  let seq = 0;
  let suppressNextPop = false;
  let inited = false;

  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());

  /** Вызывается history.ts на backward-popstate. true = back поглощён (роутер не нотифать). */
  function handleBack(): boolean {
    if (suppressNextPop) {
      suppressNextPop = false;
      // The synthetic overlay entry has now been popped, so history.position is back
      // to its pre-overlay depth. closeOverlay() already fired notify() BEFORE this
      // popstate — while canGoBack was still inflated by this entry — so any subscriber
      // that reads canGoBack (the superapp back-button controller) computed a stale
      // value and, because this back is consumed (router not notified), would never
      // re-run on its own. Re-notify HERE, after the correction, so a non-back close at
      // the history root (e.g. closing the map bottom-sheet) updates the native back
      // button immediately instead of staying until the next unrelated history change.
      notify();
      return true;
    }
    if (stack.length === 0) return false;
    const top = stack.pop()!;
    notify();
    // close() ставит isOpen=false; хук useOverlayBack увидит переход и вызовет
    // closeOverlay(token), но токен уже снят → no-op (без второго history.back).
    top.close();
    return true;
  }

  function overlayCount(): number {
    return stack.length;
  }

  function subscribeOverlay(cb: () => void): () => void {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }

  function registerOverlay({ close }: { close: Close; scrim?: boolean }): OverlayHandle {
    const token = ++seq;
    const z = Z_BASE + stack.length * Z_STEP; // depth = длина стека ДО push
    stack.push({ token, close });
    // ADOPT vs PUSH. Normally opening an overlay pushes a synthetic history entry so a
    // back closes it. But on a BACK-DRIVEN remount (the map sheet survives a property
    // round-trip and reopens from the survival store), the browser is already SITTING on
    // the surviving overlay entry — pushing another one there is a programmatic pushState
    // with NO user gesture, which Chrome's history-manipulation intervention flags
    // skip-on-back → the next back skips it (and the map) and exits the app. So when this
    // is the only overlay AND the current entry is already synthetic, ADOPT it (no push);
    // `position` already matches that entry.
    const adopt = stack.length === 1 && adapter.onOverlayEntry;
    if (!adopt) adapter.pushOverlay();
    notify();
    return { token, z, close };
  }

  function openOverlay(close: Close): number {
    return registerOverlay({ close }).token;
  }

  function closeOverlay(token: number, opts?: { viaBack?: boolean }): void {
    const i = stack.findIndex((e) => e.token === token);
    if (i < 0) return; // уже снят (закрыт через back) → no-op, без двойного history.back
    const wasTop = i === stack.length - 1;
    stack.splice(i, 1);
    notify();
    // Закрыли не через back и это была верхняя → снять синтетическую history-запись.
    // suppressNextPop гасит вызванный этим popstate, чтобы не закрыть ещё раз.
    if (!opts?.viaBack && wasTop) {
      suppressNextPop = true;
      adapter.goBack();
    }
    // Не-верхнее не-back закрытие: history может на шаг разойтись — известное
    // ограничение (почти все модалки LIFO), не усложняем (YAGNI).
  }

  /** Один раз на клиенте: подключить back-interceptor. SSR — no-op. */
  function initOverlayStack(): void {
    if (inited || typeof window === 'undefined') return;
    inited = true;
    adapter.setBackInterceptor(handleBack);
  }

  return { overlayCount, subscribeOverlay, registerOverlay, openOverlay, closeOverlay, initOverlayStack };
}

// Default instance for kit consumers. Reads the ACTIVE history adapter from the
// registry lazily (per call), so overlay-back shares the SAME backend the router
// uses (SvelteKit/Meteor/browser) instead of the import-time hardcoded browser one.
import { getHistory } from '../history/registry';

const lazyAdapter: HistoryAdapter = new Proxy({} as HistoryAdapter, {
  get(_t, prop) {
    const a = getHistory() as any;
    const v = a[prop];
    return typeof v === 'function' ? v.bind(a) : v;
  },
});

const defaultStack = createOverlayStack(lazyAdapter);
export const overlayCount = defaultStack.overlayCount;
export const subscribeOverlay = defaultStack.subscribeOverlay;
export const registerOverlay = defaultStack.registerOverlay;
export const openOverlay = defaultStack.openOverlay;
export const closeOverlay = defaultStack.closeOverlay;
export const initOverlayStack = defaultStack.initOverlayStack;
