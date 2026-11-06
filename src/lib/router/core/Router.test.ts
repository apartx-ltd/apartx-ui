// @vitest-environment jsdom
// The page LEAVING a <Router outlet> (still mounted while PageTransition plays its outro, or
// a closure it left behind — a TanStack queryFn) must keep the params it was mounted with.
// It used to read the Router's LIVE params: after router.replace('/bookings/:id') from
// /storages/:id/cells/:cellId the leaving CellPage re-fetched findById(<booking id>) and the
// error landed in the query cache (sandyq!53). Inside ONE transition key (keyByMatch + a param
// change, a shared stableKey) the page is the same live view and must still see new params.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Probe from './Router.probe.svelte';
import { setHistoryAdapter } from '../history/registry';
import type { HistoryAdapter, Action } from '../history/adapter';

function memoryAdapter(initial: string) {
  let pathname = initial;
  const listeners = new Set<() => void>();
  const adapter: HistoryAdapter = {
    get location() { return { pathname, search: '', hash: '' } as any; },
    action: 'none' as Action,
    canGoBack: false,
    onOverlayEntry: false,
    listen: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    push: (url) => { pathname = url; listeners.forEach((l) => l()); },
    replace: (url) => { pathname = url; listeners.forEach((l) => l()); },
    pushOverlay: () => {},
    restoreOverlayEntry: () => {},
    setBackInterceptor: () => {},
    goBack: () => {},
  };
  return {
    adapter,
    go: (url: string) => { adapter.replace(url); flushSync(); },
    // No flush: what a caller sees right after router.replace() in the same task — e.g.
    // invalidateQueries() right after it runs the leaving page's queryFn synchronously.
    goNoFlush: (url: string) => adapter.replace(url),
  };
}

type Mounted = { route: string; read: () => Record<string, string> };

function mountProbe(start: string, props: { outlet?: 'keyed' | 'transition' | 'unkeyed' | 'none'; keyByMatch?: boolean } = {}) {
  const h = memoryAdapter(start);
  setHistoryAdapter(h.adapter);
  const mounts: Mounted[] = [];
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Probe, {
    target,
    props: { ...props, onmount: (route: string, read: () => Record<string, string>) => mounts.push({ route, read }) },
  });
  flushSync();
  return { go: h.go, goNoFlush: h.goNoFlush, mounts, target, dispose: () => { unmount(handle); target.remove(); } };
}

describe('<Router outlet>: leaving page keeps its own params', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no Web Animations; Svelte drives transitions through element.animate. A stub
    // that never finishes keeps an outroing PageTransition layer mounted — the window the bug
    // lives in.
    (Element.prototype as any).animate = () => ({ onfinish: null, cancel() {}, currentTime: 0 });
  });
  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    setHistoryAdapter(null);
    delete (Element.prototype as any).animate;
  });

  it('another record (keyed outlet): the old page reads its params, the new one its own', () => {
    const p = mountProbe('/a/1');
    p.go('/b/2');
    expect(p.mounts.map((m) => m.route)).toEqual(['a', 'b']);
    expect(p.mounts[0].read()).toEqual({ id: '1' });
    expect(p.mounts[1].read()).toEqual({ id: '2' });
    p.dispose();
  });

  it('same record, pathname key: the remounted old page does not see the new id', () => {
    const p = mountProbe('/a/1');
    p.go('/a/2');
    expect(p.mounts).toHaveLength(2);
    expect(p.mounts[0].read()).toEqual({ id: '1' });
    expect(p.mounts[1].read()).toEqual({ id: '2' });
    p.dispose();
  });

  it('keyByMatch, param change inside one key: the same page sees the new params', () => {
    const p = mountProbe('/a/1', { keyByMatch: true });
    p.go('/a/2');
    p.go('/a/3');
    expect(p.mounts).toHaveLength(1);
    expect(p.mounts[0].read()).toEqual({ id: '3' });
    expect(p.target.textContent?.trim()).toBe('3');
    p.dispose();
  });

  it('keyByMatch: leaving to another record freezes the params from the moment of leaving', () => {
    const p = mountProbe('/a/1', { keyByMatch: true });
    p.go('/a/2'); // same key — still live
    p.go('/b/9'); // key changes — /a page leaves with id 2
    expect(p.mounts.map((m) => m.route)).toEqual(['a', 'b']);
    expect(p.mounts[0].read()).toEqual({ id: '2' });
    expect(p.mounts[1].read()).toEqual({ id: '9' });
    p.dispose();
  });

  it('a read in the same task as the navigation (before the flush) gets the old params', () => {
    const p = mountProbe('/a/1', { outlet: 'transition' });
    p.goNoFlush('/b/2');
    expect(p.mounts[0].read()).toEqual({ id: '1' });
    flushSync();
    expect(p.mounts[0].read()).toEqual({ id: '1' });
    expect(p.mounts[1].read()).toEqual({ id: '2' });
    p.dispose();
  });

  it('keyByMatch: a pre-flush read after a param change inside the key is live', () => {
    const p = mountProbe('/a/1', { keyByMatch: true });
    p.goNoFlush('/a/2');
    expect(p.mounts[0].read()).toEqual({ id: '2' });
    p.dispose();
  });

  it('PageTransition: the outroing layer is still mounted and keeps its params', () => {
    const p = mountProbe('/a/1', { outlet: 'transition' });
    p.go('/b/2');
    // Both layers in the DOM: the leaving one plays its exit, the entering one is live.
    expect(p.target.querySelectorAll('.pt-layer')).toHaveLength(2);
    expect(p.mounts[0].read()).toEqual({ id: '1' });
    expect(p.mounts[1].read()).toEqual({ id: '2' });
    p.dispose();
  });

  it('PageTransition: a page whose key re-enters before its outro ends is live again', () => {
    const p = mountProbe('/a/1', { outlet: 'transition' });
    p.go('/b/2');
    p.go('/a/1'); // A's layer is resurrected (same key) — no new mount
    p.go('/a/1');
    const a = p.mounts.filter((m) => m.route === 'a');
    const b = p.mounts.filter((m) => m.route === 'b');
    expect(b[0].read()).toEqual({ id: '2' });
    expect(a.at(-1)!.read()).toEqual({ id: '1' });
    p.dispose();
  });

  it('an outlet that ignores key keeps one live render across navigations', () => {
    const p = mountProbe('/a/1', { outlet: 'unkeyed' });
    p.go('/a/2');
    expect(p.mounts).toHaveLength(1);
    expect(p.mounts[0].read()).toEqual({ id: '2' });
    expect(p.target.textContent?.trim()).toBe('2');
    p.go('/b/3'); // another record in the same, never re-keyed view
    expect(p.target.textContent?.trim()).toBe('3');
    p.go('/a/4');
    expect(p.target.textContent?.trim()).toBe('4');
    p.dispose();
  });

  it('no outlet: the rendered page follows the live params', () => {
    const p = mountProbe('/a/1', { outlet: 'none' });
    p.go('/a/2');
    expect(p.mounts).toHaveLength(1);
    expect(p.mounts[0].read()).toEqual({ id: '2' });
    expect(p.target.textContent?.trim()).toBe('2');
    p.dispose();
  });
});
