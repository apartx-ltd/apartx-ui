// projects/apartx-ui/src/lib/router/sveltekit.ts
import { goto, beforeNavigate, afterNavigate, pushState } from '$app/navigation';
import { page } from '$app/state';
import type { HistoryAdapter, Action } from './history/adapter';
import { createOverlayStack, type OverlayStack } from './overlay/overlay-stack';
import { setNavigator, setRouteKey, matchActive } from '../navigation/context';

/**
 * HistoryAdapter backed by SvelteKit. Uses shallow routing (pushState) for the
 * synthetic overlay entries — SvelteKit's blessed modal-history pattern — so the
 * overlay-stack runs unchanged on top of it. Must be constructed during component
 * init (it registers before/afterNavigate), e.g. inside useSvelteKitNavigation().
 */
function createSvelteKitHistoryAdapter(): HistoryAdapter {
  let action: Action = 'none';
  let backInterceptor: (() => boolean) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  beforeNavigate((nav) => {
    if (nav.type === 'popstate' && typeof nav.delta === 'number') {
      action = nav.delta < 0 ? 'back' : nav.delta > 0 ? 'forward' : 'none';
      if (action === 'back' && backInterceptor && backInterceptor()) {
        // overlay consumed the back; SvelteKit still applies the popstate, which
        // is the shallow-state revert we want (page.state loses the overlay).
      }
    } else {
      action = 'forward';
    }
  });
  afterNavigate(() => notify());

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
    get onOverlayEntry() { return !!(page.state as { __overlay?: boolean })?.__overlay; },
    listen(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    push(url, opts) { action = opts?.action ?? 'forward'; void goto(url); },
    replace(url, opts) { action = opts?.action ?? 'none'; void goto(url, { replaceState: true }); },
    pushOverlay() {
      action = 'forward';
      pushState('', { ...(page.state as object), __overlay: true });
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
