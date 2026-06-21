// projects/apartx-ui/src/lib/router/sveltekit.ts
import { goto, beforeNavigate, afterNavigate, pushState } from '$app/navigation';
import { page } from '$app/state';
import type { HistoryAdapter, Action } from './history/adapter';
import { createOverlayStack, type OverlayStack } from './overlay/overlay-stack';
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
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  beforeNavigate((nav) => {
    if (nav.type === 'popstate' && typeof nav.delta === 'number') {
      action = nav.delta < 0 ? 'back' : nav.delta > 0 ? 'forward' : 'none';
    } else {
      action = 'forward';
    }
  });
  afterNavigate(() => notify());

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
    push(url, opts) { action = opts?.action ?? 'forward'; void goto(url); },
    replace(url, opts) { action = opts?.action ?? 'none'; void goto(url, { replaceState: true }); },
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
 * Call once in the root +layout.svelte. Wires the kit Navigator + route key to
 * SvelteKit, sets up the overlay-stack over the SvelteKit adapter, and exposes the
 * direction signal for <PageTransition>.
 */
export function useSvelteKitNavigation(): SvelteKitNavigation {
  const adapter = createSvelteKitHistoryAdapter();
  const overlay = createOverlayStack(adapter);
  overlay.initOverlayStack();

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
    overlay,
  };
}
