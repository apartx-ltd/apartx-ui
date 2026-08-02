// projects/apartx-ui/src/lib/router/sveltekit.ts
import { goto, beforeNavigate, afterNavigate, pushState } from '$app/navigation';
import { page } from '$app/state';
import type { HistoryAdapter, Action } from './history/adapter';
import { defaultOverlayStack, type OverlayStack } from './overlay/overlay-stack';
import { setHistoryAdapter } from './history/registry';
import { setNavigator, setRouteKey, matchActive } from '../navigation/context';

/** Overlay nesting depth carried in SvelteKit's shallow page.state. */
type OverlayState = { __overlayDepth?: number };
const overlayDepthOf = (s: unknown): number => (s as OverlayState)?.__overlayDepth ?? 0;

/**
 * Read the overlay depth from the RAW browser history entry. SvelteKit nests
 * app-supplied shallow state under its internal `sveltekit:states` key, and unlike
 * the reactive `page.state` this is updated synchronously by the browser when a
 * `popstate` fires (SvelteKit's own reactive update lands later/async). Reading it
 * here lets the popstate handler see the landed entry's depth immediately.
 */
const depthFromHistory = (): number => {
  if (typeof history === 'undefined') return 0;
  const s = history.state as { 'sveltekit:states'?: OverlayState } | null;
  return overlayDepthOf(s?.['sveltekit:states']);
};

/**
 * HistoryAdapter backed by SvelteKit. Overlay entries use shallow routing
 * (`pushState`) — SvelteKit's blessed modal-history pattern — carrying a nesting
 * DEPTH in `page.state` so the shared overlay-stack runs on top.
 *
 * Back handling differs from the browser adapter on purpose: SvelteKit reverts
 * `page.state` for a shallow-routing back WITHOUT firing `beforeNavigate`
 * (verified — only real route navigations fire it), so the overlay-stack's
 * back-interceptor cannot hang off `beforeNavigate`. Instead we listen to the
 * native `popstate` (which always fires) and, when the overlay depth DROPS, invoke
 * the interceptor once per closed level — driving the exact same `handleBack` the
 * browser adapter uses. `beforeNavigate` is kept ONLY to compute the forward/back
 * direction for `<PageTransition>` on real navigations.
 *
 * Must be constructed during component init (registers before/afterNavigate +
 * popstate), e.g. inside `useSvelteKitNavigation()`.
 */
function createSvelteKitHistoryAdapter(): HistoryAdapter {
  let action: Action = 'none';
  let backInterceptor: (() => boolean) | null = null;
  let depth = 0; // our view of the current overlay nesting depth
  let selfNav = false; // навигацию инициировал кит (push/replace ниже) — не хост
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  beforeNavigate((nav) => {
    if (nav.type === 'popstate' && typeof nav.delta === 'number') {
      action = nav.delta < 0 ? 'back' : nav.delta > 0 ? 'forward' : 'none';
    } else {
      action = 'forward';
    }
    // Хостовая навигация (plain <a>, адресная строка, host goto) при открытых
    // оверлеях: отпустить их, history не трогать (вариант B — см. дизайн
    // docs/plans/2026-08-02-kit-overlay-host-navigation в репо apartx).
    // selfNav = навигация пришла из push/replace НИЖЕ (вариант A кита или
    // keepOverlays-путь) — кит сам управляет стеком, не вмешиваемся.
    // Shallow-pop оверлея сюда не попадает: SvelteKit не зовёт beforeNavigate
    // для shallow-навигаций (см. комментарий адаптера выше).
    if (selfNav) { selfNav = false; return; }
    // Уход со страницы целиком (закрытие вкладки, внешняя ссылка, beforeunload):
    // dismiss необратим, а такую навигацию пользователь ещё может отменить в
    // нативном диалоге — снимем оверлеи и останемся с закрытым «без причины».
    // На уходящей странице снимать их всё равно незачем.
    if (nav.willUnload) return;
    defaultOverlayStack.dismissForHostNavigation();
  });
  afterNavigate(() => {
    // Страховка от протухшего selfNav: goto, не породивший beforeNavigate
    // (тот же URL, отмена другим слушателем), не должен съесть dismiss у
    // СЛЕДУЮЩЕЙ хостовой навигации.
    selfNav = false;
    // depth — правда из history, а не ручной счётчик: реальная навигация раньше
    // его не трогала, и после хостового push поверх синтетической записи
    // popstate считал closed = 0 (вторая половина бага). Shallow pushState
    // afterNavigate не дёргает, так что depth от pushOverlay не затирается;
    // а если бы дёргал — depthFromHistory() всё равно вернул бы верный depth.
    depth = depthFromHistory();
    notify();
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      const landed = depthFromHistory();
      const closed = depth - landed;
      depth = landed;
      // Closing N overlay levels → run the interceptor N times. For a back
      // (no suppression) handleBack pops+closes the top; for a programmatic
      // close (X/backdrop) the stack pre-suppressed, so it's a consumed no-op.
      for (let i = 0; i < closed && backInterceptor; i++) backInterceptor();
    });
  }

  return {
    get location() {
      const u = page.url;
      return { pathname: u.pathname, search: u.search, hash: u.hash };
    },
    get action() { return action; },
    get canGoBack() {
      // SvelteKit doesn't expose stack depth; treat presence of overlay state or a
      // referrer-driven entry as "can go back". Consumers that need the cold-deeplink
      // fallback rely on <Route back>, which the engine path owns (not used here).
      return typeof history !== 'undefined' && history.length > 1;
    },
    get onOverlayEntry() { return overlayDepthOf(page.state) > 0; },
    listen(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    push(url, opts) { action = opts?.action ?? 'forward'; selfNav = true; void goto(url); },
    replace(url, opts) { action = opts?.action ?? 'none'; selfNav = true; void goto(url, { replaceState: true }); },
    pushOverlay() {
      action = 'forward';
      depth = overlayDepthOf(page.state) + 1;
      pushState('', { ...(page.state as object), __overlayDepth: depth });
    },
    setBackInterceptor(fn) { backInterceptor = fn; },
    goBack() { if (typeof history !== 'undefined') history.back(); },
  };
}

export interface SvelteKitNavigation {
  /** Current navigation direction for <PageTransition direction={() => nav.direction}>. */
  readonly direction: Action;
  readonly overlay: OverlayStack;
}

/**
 * Call in the root +layout.svelte. Wires the kit Navigator + route key to SvelteKit,
 * registers the SvelteKit history adapter as the ACTIVE backend, and exposes the
 * direction signal for <PageTransition>.
 *
 * Registering via `setHistoryAdapter(adapter)` (not a private stack) is what makes
 * overlays work: kit components close over the module-singleton `defaultOverlayStack`,
 * whose `lazyAdapter` reads `getHistory()` per call. Building a LOCAL stack here would
 * leave those components on the browser adapter → Dialog ✕/Escape/scrim wouldn't close
 * under SvelteKit. So the host must hand the singleton stack the SvelteKit backend.
 *
 * Idempotent — the adapter is memoized. SvelteKit's router/history is a singleton, so
 * the adapter must be too, but this function can run more than once (Svelte re-runs the
 * layout's setup effect; a host might call it in several places). A fresh adapter per
 * call split-brained the overlay wiring: the back-interceptor landed on the FIRST
 * adapter (initOverlayStack's one-shot `inited` guard) while `setHistoryAdapter`
 * repointed the lazy push/goBack path at a LATER one — so a browser BACK popped the
 * history entry but never closed the overlay, and each call leaked another popstate
 * listener. Memoizing collapses it to one adapter, one popstate listener, one truth.
 */
let skAdapter: HistoryAdapter | null = null;
export function useSvelteKitNavigation(): SvelteKitNavigation {
  const adapter = (skAdapter ??= createSvelteKitHistoryAdapter());
  setHistoryAdapter(adapter);
  defaultOverlayStack.initOverlayStack();

  setNavigator({
    push: (href) => adapter.push(href),
    replace: (href) => adapter.replace(href),
    back: (href) => { if (href) adapter.push(href, { action: 'back' }); else adapter.goBack(); },
    get current() { return adapter.location ?? { pathname: '/', search: '', hash: '' }; },
    isActive: (href, opts) => matchActive(page.url.pathname, href, opts),
  });
  setRouteKey(() => page.url.pathname);

  return {
    get direction() { return adapter.action; },
    overlay: defaultOverlayStack,
  };
}
