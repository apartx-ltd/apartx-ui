// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { navigate } from './nav';
import { configureNav, resetNavConfig, resolveNavTarget, routerScopeOf } from './nav-config';
import { setHistoryAdapter } from '../history/registry';
import { registerOverlay, dismissForNavigation } from '../overlay/overlay-stack';
import type { HistoryAdapter, Action } from '../history/adapter';

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
});
