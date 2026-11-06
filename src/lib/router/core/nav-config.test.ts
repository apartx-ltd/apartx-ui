// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { navigate, link } from './nav';
import { configureNav, resetNavConfig, resolveNavTarget, routerScopeOf, type NavFrom } from './nav-config';
import RouterProbe from './useRouter.probe.svelte';
import { addLeaveGuard } from '../guard/leave-guard';
import { setHistoryAdapter } from '../history/registry';
import { registerOverlay, dismissForNavigation } from '../overlay/overlay-stack';
import type { HistoryAdapter, Action } from '../history/adapter';

type Router = ReturnType<typeof import('./useRouter.svelte').useRouter>;

function fakeAdapter(location = { pathname: '/accounts/chats/c1/chat', search: '?tab=all', hash: '#panel=/properties/p1/info' }) {
  const calls: string[] = [];
  const adapter: HistoryAdapter = {
    location, action: 'none' as Action, canGoBack: true, onOverlayEntry: false,
    listen: () => () => {},
    push: (url) => { calls.push(`push:${url}`); },
    replace: (url) => { calls.push(`replace:${url}`); },
    pushOverlay: () => {}, restoreOverlayEntry: () => {}, setBackInterceptor: () => {}, goBack: () => {},
  };
  return { adapter, calls };
}

describe('resolveNavTarget', () => {
  afterEach(resetNavConfig);
  const from = { pathname: '/a', search: '', hash: '#panel=/p&x=1' };
  it('is identity without config', () => { expect(resolveNavTarget('/b?q=1', from)).toBe('/b?q=1'); });
  it('carries keepHash pairs onto an address without them, keeps explicit ones', () => {
    configureNav({ keepHash: ['panel'] });
    expect(resolveNavTarget('/b', from)).toBe('/b#panel=/p');
    expect(resolveNavTarget('/b#panel=/q', from)).toBe('/b#panel=/q');
    expect(resolveNavTarget('/b#x=2', from)).toBe('/b#x=2&panel=/p');
  });
  it('runs intercept after keepHash and lets it cancel', () => {
    const seen: string[] = [];
    configureNav({ keepHash: ['panel'], intercept: (to, f) => { seen.push(`${to}|${f.origin ?? ''}`); return to.startsWith('/stop') ? null : to.replace('/p', '/z'); } });
    expect(resolveNavTarget('/b', { ...from, origin: 'panel' })).toBe('/b#panel=/z');
    expect(seen).toEqual(['/b#panel=/p|panel']);
    expect(resolveNavTarget('/stop', from)).toBeNull();
  });
});

describe('navigate with nav config', () => {
  beforeEach(() => { vi.useFakeTimers(); setHistoryAdapter(null); resetNavConfig(); });
  afterEach(() => { dismissForNavigation(); vi.runAllTimers(); vi.useRealTimers(); setHistoryAdapter(null); resetNavConfig(); });
  it('keeps the fragment on push', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    configureNav({ keepHash: ['panel'] });
    navigate('/accounts/properties');
    expect(f.calls).toEqual(['push:/accounts/properties#panel=/properties/p1/info']);
  });
  it('applies the config on the overlay replace path too', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    configureNav({ keepHash: ['panel'] });
    registerOverlay({ close: () => {}, exitMs: 0 });
    navigate('/x'); vi.runAllTimers();
    expect(f.calls.at(-1)).toBe('replace:/x#panel=/properties/p1/info');
  });
  it('cancels when intercept returns null and does not re-resolve a resolved target', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    let n = 0;
    configureNav({ intercept: (to) => { n++; return to === '/no' ? null : to; } });
    navigate('/no'); navigate('/yes', { resolved: true });
    expect(f.calls).toEqual(['push:/yes']); expect(n).toBe(1);
  });
  it('reads the origin from the closest data-router-scope', () => {
    document.body.innerHTML = '<div data-router-scope="panel"><a id="a" href="/x"></a></div><a id="b" href="/y"></a>';
    expect(routerScopeOf(document.getElementById('a'))).toBe('panel');
    expect(routerScopeOf(document.getElementById('b'))).toBeUndefined();
    expect(routerScopeOf(null)).toBeUndefined();
  });
  it('raw navigate leaves from.scopedTo undefined', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    const seen: NavFrom[] = [];
    configureNav({ intercept: (to, from) => { seen.push(from); return to; } });
    navigate('/x');
    expect(seen).toHaveLength(1);
    expect(seen[0].scopedTo).toBeUndefined();
  });
  it('forwards opts.scopedTo into from.scopedTo', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    const seen: NavFrom[] = [];
    configureNav({ intercept: (to, from) => { seen.push(from); return to; } });
    navigate('/x', { scopedTo: '/accounts/billing', origin: 'panel' });
    expect(seen[0].scopedTo).toBe('/accounts/billing');
    expect(seen[0].origin).toBe('panel');
  });
  it('keepHash: false skips the carry-over, intercept still runs', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    let n = 0;
    configureNav({ keepHash: ['panel'], intercept: (to) => { n++; return to; } });
    navigate('/a', { keepHash: false });
    expect(f.calls).toEqual(['push:/a']);
    expect(n).toBe(1);
  });
  it('use:link inside [data-router-scope] passes the origin to intercept', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    const origins: (string | undefined)[] = [];
    configureNav({ intercept: (to, from) => { origins.push(from.origin); return to; } });
    document.body.innerHTML = '<div data-router-scope="panel"><a id="a" href="/x"></a></div>';
    const a = document.getElementById('a') as HTMLAnchorElement;
    const action = link(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    action.destroy();
    expect(origins).toEqual(['panel']);
    expect(f.calls).toEqual(['push:/x']);
  });
});

describe('navigate leave guard on hash-only navigations', () => {
  beforeEach(() => { setHistoryAdapter(null); resetNavConfig(); });
  afterEach(() => { setHistoryAdapter(null); resetNavConfig(); });
  it('without configureNav a hash-only target still asks', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    let asked = 0;
    let answer!: (v: boolean) => void;
    const dispose = addLeaveGuard({ when: () => true, confirm: () => { asked++; return new Promise((r) => { answer = r; }); } });
    navigate('/accounts/chats/c1/chat?tab=all#panel=/properties/p2/info');
    expect(asked).toBe(1);
    expect(f.calls).toEqual([]);
    answer(false);
    dispose();
  });
  it('with configureNav a hash-only target pushes immediately; a pathname change still asks', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    configureNav({});
    let asked = 0;
    let answer!: (v: boolean) => void;
    const dispose = addLeaveGuard({ when: () => true, confirm: () => { asked++; return new Promise((r) => { answer = r; }); } });
    navigate('/accounts/chats/c1/chat?tab=all#panel=/properties/p2/info');
    expect(f.calls).toEqual(['push:/accounts/chats/c1/chat?tab=all#panel=/properties/p2/info']);
    expect(asked).toBe(0);
    navigate('/accounts/other');
    expect(asked).toBe(1);
    expect(f.calls).toHaveLength(1);
    answer(false);
    dispose();
  });
});

describe('useRouter().replace with nav config', () => {
  beforeEach(() => { setHistoryAdapter(null); resetNavConfig(); });
  afterEach(() => { setHistoryAdapter(null); resetNavConfig(); });
  function mountRouter() {
    let router: Router | undefined;
    const target = document.createElement('div');
    document.body.appendChild(target);
    const handle = mount(RouterProbe, { target, props: { onrouter: (r: Router) => { router = r; } } });
    flushSync();
    return { router: router!, dispose: () => { unmount(handle); target.remove(); } };
  }
  it('resolves through keepHash + intercept and cancels on null', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    configureNav({ keepHash: ['panel'], intercept: (to) => (to.startsWith('/stop') ? null : to) });
    const { router, dispose } = mountRouter();
    router.replace('/b');
    router.replace('/stop');
    expect(f.calls).toEqual(['replace:/b#panel=/properties/p1/info']);
    dispose();
  });
  it('keepHash: false skips the carry-over', () => {
    const f = fakeAdapter(); setHistoryAdapter(f.adapter);
    configureNav({ keepHash: ['panel'] });
    const { router, dispose } = mountRouter();
    router.replace('/a', { keepHash: false });
    router.push('/c', { keepHash: false });
    expect(f.calls).toEqual(['replace:/a', 'push:/c']);
    dispose();
  });
});
