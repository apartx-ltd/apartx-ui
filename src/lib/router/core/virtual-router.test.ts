// @vitest-environment jsdom
// <VirtualRouter>: a subtree routes on the path held in a `#key=value` fragment pair of the
// real URL, while the outer router keeps routing on the real pathname.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Probe from './virtual-router.probe.svelte';
import { setHistoryAdapter } from '../history/registry';
import { configureNav, resetNavConfig } from './nav-config';
import { getRouteBack, setRouteBack } from './active-route';
import type { HistoryAdapter, Action } from '../history/adapter';
import type { RouteSnapshot, Navigator } from '../../navigation/context';
import type { NavFrom } from './nav-config';

type Router = ReturnType<typeof import('./useRouter.svelte').useRouter>;

function fakeAdapter(url: string) {
  const calls: string[] = [];
  const listeners = new Set<() => void>();
  const [rest, hashPart] = url.split('#');
  const [pathname, searchPart] = rest.split('?');
  const state = {
    location: { pathname, search: searchPart ? `?${searchPart}` : '', hash: hashPart ? `#${hashPart}` : '' } as RouteSnapshot,
    canGoBack: true,
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
  return { adapter, calls, state, notify: () => listeners.forEach((f) => f()) };
}

function mountProbe(outerBase?: string) {
  let router: Router | undefined;
  let navigator: Navigator | undefined;
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Probe, {
    target,
    props: { outerBase, onrouter: (r: Router) => { router = r; }, onnavigator: (n?: Navigator) => { navigator = n; } },
  });
  flushSync();
  return { router: router!, navigator, target, dispose: () => { unmount(handle); target.remove(); } };
}

describe('<VirtualRouter>', () => {
  beforeEach(() => { setHistoryAdapter(null); resetNavConfig(); setRouteBack(null); });
  afterEach(() => { setHistoryAdapter(null); resetNavConfig(); setRouteBack(null); });

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
