// @vitest-environment jsdom
// <VirtualRouter>: a subtree routes on the path held in a `#key=value` fragment pair of the
// real URL, while the outer router keeps routing on the real pathname.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Probe from './virtual-router.probe.svelte';
import { setHistoryAdapter } from '../history/registry';
import { configureNav, resetNavConfig } from './nav-config';
import { getRouteBack, setRouteBack } from './active-route';
import { resetPanelJournals } from './panel-journal';
import type { HistoryAdapter, Action } from '../history/adapter';
import type { RouteSnapshot, Navigator, RouteKeyGetter, BackVisibilityGetter } from '../../navigation/context';
import type { NavFrom } from './nav-config';

type Router = ReturnType<typeof import('./useRouter.svelte').useRouter>;

function snapshot(url: string): RouteSnapshot {
  const [rest, hashPart] = url.split('#');
  const [pathname, searchPart] = rest.split('?');
  return { pathname, search: searchPart ? `?${searchPart}` : '', hash: hashPart ? `#${hashPart}` : '' };
}

/** `position` given → the adapter exposes a mutable `position` (journal on); omitted → no field. */
function fakeAdapter(url: string, opts: { position?: number } = {}) {
  const calls: string[] = [];
  const listeners = new Set<() => void>();
  const state = {
    location: snapshot(url),
    canGoBack: true,
    position: opts.position ?? 0,
  };
  const adapter: HistoryAdapter = {
    get location() { return state.location; },
    action: 'none' as Action,
    get canGoBack() { return state.canGoBack; },
    onOverlayEntry: false,
    listen: (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    push: (u, o) => { calls.push(o?.action ? `push:${u}:${o.action}` : `push:${u}`); },
    replace: (u, o) => { calls.push(`replace:${u}:${o?.action ?? 'none'}`); },
    pushOverlay: () => {},
    restoreOverlayEntry: () => {},
    setBackInterceptor: () => {},
    goBack: () => { calls.push('goBack'); },
  };
  if (opts.position !== undefined) Object.defineProperty(adapter, 'position', { get: () => state.position });
  const notify = () => listeners.forEach((f) => f());
  /** A navigation the adapter reports: new location at `position`, listeners notified. */
  const visit = (u: string, position: number) => {
    state.location = snapshot(u);
    state.position = position;
    notify();
    flushSync();
  };
  return { adapter, calls, state, notify, visit };
}

function mountProbe(outerBase?: string, backAtRoot?: 'show' | 'hide') {
  let router: Router | undefined;
  let navigator: Navigator | undefined;
  let routeKey: RouteKeyGetter | undefined;
  let backVisibility: BackVisibilityGetter | undefined;
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Probe, {
    target,
    props: {
      outerBase,
      backAtRoot,
      onbackvisibility: (g?: BackVisibilityGetter) => { backVisibility = g; },
      onrouter: (r: Router) => { router = r; },
      onnavigator: (n?: Navigator) => { navigator = n; },
      onroutekey: (g?: RouteKeyGetter) => { routeKey = g; },
    },
  });
  flushSync();
  const hasParent = () => target.querySelector('[data-testid="has-parent"]')!.getAttribute('data-value');
  return { router: router!, navigator, routeKey, backVisibility, hasParent, target, dispose: () => { unmount(handle); target.remove(); } };
}

describe('<VirtualRouter>', () => {
  beforeEach(() => { setHistoryAdapter(null); resetNavConfig(); setRouteBack(null); resetPanelJournals(); });
  afterEach(() => { setHistoryAdapter(null); resetNavConfig(); setRouteBack(null); resetPanelJournals(); });

  describe('back by the panel journal', () => {
    it('back on a panel step goes through history.back', () => {
      const f = fakeAdapter('/accounts/properties', { position: 0 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      f.visit('/accounts/properties#panel=/properties/p1/info', 1);
      f.visit('/accounts/properties#panel=/properties/p1/booking/new', 2);
      router.goBack();
      expect(f.calls).toEqual(['goBack']);
      dispose();
    });

    it('back after a follow-me step replaces to the route parent, not history', () => {
      const f = fakeAdapter('/accounts/properties#panel=/properties/p1/info', { position: 1 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      f.visit('/accounts/chats#panel=/properties/p1/info', 2);
      router.goBack();
      expect(f.calls).not.toContain('goBack');
      expect(f.calls.at(-1)).toBe('replace:/accounts/chats#panel=/properties/p1:back');
      dispose();
    });

    it('back to an entry without the panel replaces to the route parent', () => {
      const f = fakeAdapter('/accounts/properties', { position: 0 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      f.visit('/accounts/properties#panel=/properties/p1/info', 1);
      router.goBack();
      expect(f.calls).toEqual(['replace:/accounts/properties#panel=/properties/p1:back']);
      dispose();
    });

    it('an unknown previous entry (overlay, reload) is not a panel step', () => {
      const f = fakeAdapter('/accounts/properties#panel=/properties/p1/info', { position: 5 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      router.goBack();
      expect(f.calls).toEqual(['replace:/accounts/properties#panel=/properties/p1:back']);
      dispose();
    });

    it('route back wins over the href of the page inside the panel', () => {
      const f = fakeAdapter('/accounts/properties#panel=/properties/p1/info', { position: 1 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      f.visit('/accounts/chats#panel=/properties/p1/info', 2);
      router.back('/accounts/chats');
      expect(f.calls).toEqual(['replace:/accounts/chats#panel=/properties/p1:back']);
      dispose();
    });

    it('href is the fallback when the route has no back; nothing at all → no-op', () => {
      const f = fakeAdapter('/accounts/properties#panel=/properties/p1/booking/new', { position: 0 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      router.back();
      expect(f.calls).toEqual([]);
      router.back('/accounts/chats');
      expect(f.calls).toEqual(['replace:/accounts/properties#panel=/chats:back']);
      dispose();
    });

    it('a panel step is not taken when history cannot go back', () => {
      const f = fakeAdapter('/accounts/properties', { position: 0 });
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      f.visit('/accounts/properties#panel=/properties/p1/info', 1);
      f.visit('/accounts/properties#panel=/properties/p1/booking/new', 2);
      f.state.canGoBack = false;
      router.back('/accounts/chats');
      expect(f.calls).toEqual(['replace:/accounts/properties#panel=/chats:back']);
      dispose();
    });

    it('currentHasParent is reactive: false at the root, true after a panel push', () => {
      const f = fakeAdapter('/accounts/properties', { position: 0 });
      setHistoryAdapter(f.adapter);
      const { router, hasParent, dispose } = mountProbe();
      f.visit('/accounts/properties#panel=/properties/p1/booking/new', 1);
      expect(router.currentHasParent).toBe(false);
      expect(hasParent()).toBe('false');
      f.visit('/accounts/properties#panel=/properties/p2/booking/new', 2);
      expect(router.currentHasParent).toBe(true);
      expect(hasParent()).toBe('true');
      f.visit('/accounts/chats#panel=/properties/p2/booking/new', 3);
      expect(hasParent()).toBe('false');
      f.visit('/accounts/chats#panel=/properties/p2/info', 4);
      expect(hasParent()).toBe('true');
      dispose();
    });

    it('without adapter.position: history first, then route back (route back wins over href inside VirtualRouter)', () => {
      const f = fakeAdapter('/accounts/chats#panel=/properties/p1/info');
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      expect(router.currentHasParent).toBe(true);
      router.back('/accounts/chats');
      expect(f.calls).toEqual(['goBack']);
      f.state.canGoBack = false;
      router.back('/accounts/chats');
      expect(f.calls).toEqual(['goBack', 'replace:/accounts/chats#panel=/properties/p1:back']);
      dispose();
    });

    it('backAtRoot="hide" provides a back-visibility getter equal to currentHasParent; default provides none', () => {
      const d = fakeAdapter('/accounts/properties#panel=/properties/p1/booking/new', { position: 0 });
      setHistoryAdapter(d.adapter);
      const def = mountProbe();
      expect(def.backVisibility).toBeUndefined();
      def.dispose();
      resetPanelJournals();

      const f = fakeAdapter('/accounts/properties', { position: 0 });
      setHistoryAdapter(f.adapter);
      const { router, backVisibility, dispose } = mountProbe(undefined, 'hide');
      expect(backVisibility).toBeDefined();
      f.visit('/accounts/properties#panel=/properties/p1/booking/new', 1);
      expect(backVisibility!()).toBe(false);
      f.visit('/accounts/properties#panel=/properties/p2/booking/new', 2);
      expect(backVisibility!()).toBe(true);
      expect(backVisibility!()).toBe(router.currentHasParent);
      dispose();
    });
  });

  it('routes the subtree by the fragment value, not the real pathname', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { router, target, dispose } = mountProbe();
    const info = target.querySelector('[data-testid="info"]');
    expect(info).not.toBeNull();
    expect(info!.getAttribute('data-id')).toBe('p1');
    expect(target.querySelector('[data-testid="outer-chat"]')).not.toBeNull();
    expect(router.pathname).toBe('/accounts/properties/p1/info');
    expect(router.current.search).toBe('');
    dispose();
  });

  it('exposes the panel value search as router.current.search', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/booking/new?fromDate=2026-11-10');
    setHistoryAdapter(f.adapter);
    const { router, target, dispose } = mountProbe();
    expect(router.current.search).toBe('?fromDate=2026-11-10');
    expect(router.pathname).toBe('/accounts/properties/p1/booking/new');
    expect(target.querySelector('[data-testid="booking-new"]')).not.toBeNull();
    dispose();
  });

  it('push rewrites only the fragment and passes origin', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const origins: (string | undefined)[] = [];
    configureNav({ intercept: (to, from) => { origins.push(from.origin); return to; } });
    const { router, dispose } = mountProbe();
    router.push('/accounts/properties/p1/general');
    expect(f.calls).toEqual(['push:/accounts/chats/c1/chat#panel=/properties/p1/general']);
    expect(origins).toEqual(['panel']);
    dispose();
  });

  it('push accepts a path without the prefix', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountProbe();
    router.push('/properties/p1/general');
    expect(f.calls).toEqual(['push:/accounts/chats/c1/chat#panel=/properties/p1/general']);
    dispose();
  });

  it('back uses history when possible, otherwise the scoped <Route back>', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountProbe();
    router.back();
    expect(f.calls).toEqual(['goBack']);
    f.state.canGoBack = false;
    router.back();
    expect(f.calls).toEqual(['goBack', 'replace:/accounts/chats/c1/chat#panel=/properties/p1:back']);
    dispose();
  });

  it('does not overwrite the outer router back target', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountProbe();
    expect(getRouteBack()).toBe('/accounts/chats');
    f.state.canGoBack = false;
    expect(router.currentHasParent).toBe(true);
    dispose();
  });

  it('isolates the subtree from an enclosing router basepath', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { target, dispose } = mountProbe('/accounts');
    const info = target.querySelector('[data-testid="info"]');
    expect(info).not.toBeNull();
    expect(info!.getAttribute('data-id')).toBe('p1');
    dispose();
  });

  it('re-renders the subtree when the real hash changes', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { router, target, dispose } = mountProbe();
    f.state.location = { pathname: '/accounts/chats/c1/chat', search: '', hash: '#panel=/properties/p2/booking/new?x=1' };
    f.notify();
    flushSync();
    expect(target.querySelector('[data-testid="info"]')).toBeNull();
    const booking = target.querySelector('[data-testid="booking-new"]');
    expect(booking).not.toBeNull();
    expect(booking!.getAttribute('data-id')).toBe('p2');
    expect(router.pathname).toBe('/accounts/properties/p2/booking/new');
    expect(router.current.search).toBe('?x=1');
    dispose();
  });

  it('push passes the intended virtual target as from.scopedTo', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const seen: NavFrom[] = [];
    configureNav({ intercept: (to, from) => { seen.push(from); return to; } });
    const { router, dispose } = mountProbe();
    router.push('/accounts/properties/p1/general?x=1');
    router.replace('/accounts/billing');
    expect(seen.map((s) => [s.origin, s.scopedTo])).toEqual([
      ['panel', '/accounts/properties/p1/general?x=1'],
      ['panel', '/accounts/billing'],
    ]);
    expect(f.calls).toEqual([
      'push:/accounts/chats/c1/chat#panel=/properties/p1/general?x=1',
      'replace:/accounts/chats/c1/chat#panel=/billing:none',
    ]);
    dispose();
  });

  it('a url outside the prefix is its own scopedTo, not prefixed', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const seen: NavFrom[] = [];
    configureNav({ intercept: (to, from) => { seen.push(from); return to; } });
    const { router, dispose } = mountProbe();
    router.push('/show/42?x=1');
    expect(seen).toHaveLength(1);
    expect(seen[0].scopedTo).toBe('/show/42?x=1');
    expect(seen[0].origin).toBe('panel');
    dispose();
  });

  it('provides the virtual pathname as the route key to the subtree', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { routeKey, dispose } = mountProbe();
    expect(routeKey).toBeDefined();
    expect(routeKey!()).toBe('/accounts/properties/p1/info');
    f.state.location = { pathname: '/accounts/chats/c1/chat', search: '', hash: '#panel=/properties/p2/booking/new' };
    f.notify();
    flushSync();
    expect(routeKey!()).toBe('/accounts/properties/p2/booking/new');
    dispose();
  });

  it('host intercept can send a scoped navigation to the main screen', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    configureNav({ intercept: (to, from) => (from.scopedTo?.startsWith('/accounts/billing') ? from.scopedTo + from.hash : to) });
    const { router, dispose } = mountProbe();
    router.push('/accounts/billing');
    expect(f.calls).toEqual(['push:/accounts/billing#panel=/properties/p1/info']);
    dispose();
  });

  it('provides a scoped Navigator to the subtree', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const origins: (string | undefined)[] = [];
    configureNav({ intercept: (to, from) => { origins.push(from.origin); return to; } });
    const { navigator, dispose } = mountProbe();
    expect(navigator).toBeDefined();
    expect(navigator!.current.pathname).toBe('/accounts/properties/p1/info');
    expect(navigator!.isActive('/accounts/properties/p1')).toBe(true);
    navigator!.push('/accounts/x');
    expect(f.calls).toEqual(['push:/accounts/chats/c1/chat#panel=/x']);
    expect(origins).toEqual(['panel']);
    dispose();
  });

  it('missing or empty value → the prefix without a trailing slash', () => {
    for (const url of ['/accounts/chats/c1/chat', '/accounts/chats/c1/chat#panel=', '/accounts/chats/c1/chat#panel=/']) {
      const f = fakeAdapter(url);
      setHistoryAdapter(f.adapter);
      const { router, dispose } = mountProbe();
      expect(router.pathname).toBe('/accounts');
      dispose();
    }
  });

  it('a value without a leading slash gets one', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { router, target, dispose } = mountProbe();
    expect(router.pathname).toBe('/accounts/properties/p1/info');
    expect(target.querySelector('[data-testid="info"]')).not.toBeNull();
    dispose();
  });

  it('renders a data-router-scope wrapper', () => {
    const f = fakeAdapter('/accounts/chats/c1/chat#panel=/properties/p1/info');
    setHistoryAdapter(f.adapter);
    const { target, dispose } = mountProbe();
    expect(target.querySelector('[data-router-scope="panel"]')).not.toBeNull();
    dispose();
  });
});
