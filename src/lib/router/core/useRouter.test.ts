// @vitest-environment jsdom
// router.push must be overlay-aware (variant A) out of the box: a programmatic push
// while an overlay is open used to land ON TOP of the synthetic overlay entry, and the
// closing overlay's guarded history.back() ate the fresh entry — page rendered, URL
// rolled back. These tests pin push → navigate() for useRouter AND the kit Navigator
// built from it (createNavigatorFromRouter).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Probe from './useRouter.probe.svelte';
import { setHistoryAdapter } from '../history/registry';
import { registerOverlay, dismissForNavigation } from '../overlay/overlay-stack';
import { createNavigatorFromRouter } from '../navigator';
import type { HistoryAdapter, Action } from '../history/adapter';

function fakeAdapter() {
  const calls: string[] = [];
  let overlayEntry = false;
  const adapter: HistoryAdapter = {
    location: null, action: 'none' as Action, canGoBack: true,
    get onOverlayEntry() { return overlayEntry; },
    listen: () => () => {},
    push: (url, o) => { calls.push(o?.action ? `push:${url}:${o.action}` : `push:${url}`); },
    replace: (url, o) => { calls.push(`replace:${url}:${o?.action ?? 'none'}`); },
    pushOverlay: () => { calls.push('pushOverlay'); overlayEntry = true; },
    restoreOverlayEntry: () => { calls.push('restoreOverlayEntry'); overlayEntry = true; },
    setBackInterceptor: () => {},
    goBack: () => { calls.push('goBack'); },
  };
  return { adapter, calls };
}

type Router = ReturnType<typeof import('./useRouter.svelte').useRouter>;

function mountRouter() {
  let router: Router | undefined;
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Probe, { target, props: { onrouter: (r: Router) => { router = r; } } });
  flushSync();
  return { router: router!, dispose: () => { unmount(handle); target.remove(); } };
}

describe('useRouter().push is overlay-aware', () => {
  beforeEach(() => { vi.useFakeTimers(); setHistoryAdapter(null); });
  afterEach(() => { dismissForNavigation(); vi.runAllTimers(); vi.useRealTimers(); setHistoryAdapter(null); });

  it('no overlays -> plain history push', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountRouter();
    router.push('/translations');
    expect(f.calls).toContain('push:/translations');
    dispose();
  });

  it('still forwards {action} when no overlays are open', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountRouter();
    router.push('/x', { action: 'back' });
    expect(f.calls).toContain('push:/x:back');
    dispose();
  });

  it('overlay open -> dismisses it and REPLACES the overlay entry (no lost entry)', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountRouter();
    let closed = false;
    registerOverlay({ close: () => { closed = true; }, exitMs: 120 });
    router.push('/translations');
    expect(closed).toBe(true);
    vi.advanceTimersByTime(120);
    expect(f.calls).toContain('replace:/translations:forward');
    expect(f.calls.some((c) => c.startsWith('push:/translations'))).toBe(false);
    dispose();
  });

  it('keepOverlays -> push under the overlay, overlay stays open', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountRouter();
    let closed = false;
    registerOverlay({ close: () => { closed = true; } });
    router.push('/property/1', { keepOverlays: true });
    expect(closed).toBe(false);
    expect(f.calls).toContain('push:/property/1');
    dispose();
  });

  it('replace stays direct (NOT overlay-aware — spaces map-sheet replace relies on it)', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountRouter();
    let closed = false;
    registerOverlay({ close: () => { closed = true; } });
    router.replace('/property/1', { action: 'forward' });
    expect(closed).toBe(false); // overlay untouched
    expect(f.calls).toContain('replace:/property/1:forward');
    dispose();
  });
});

describe('createNavigatorFromRouter(useRouter()) push is overlay-aware', () => {
  beforeEach(() => { vi.useFakeTimers(); setHistoryAdapter(null); });
  afterEach(() => { dismissForNavigation(); vi.runAllTimers(); vi.useRealTimers(); setHistoryAdapter(null); });

  it('Navigator.push with an overlay open goes through variant A (replace, not push)', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const { router, dispose } = mountRouter();
    const nav = createNavigatorFromRouter(router);
    let closed = false;
    registerOverlay({ close: () => { closed = true; }, exitMs: 120 });
    nav.push('/bookings');
    expect(closed).toBe(true);
    vi.advanceTimersByTime(120);
    expect(f.calls).toContain('replace:/bookings:forward');
    expect(f.calls.some((c) => c.startsWith('push:/bookings'))).toBe(false);
    dispose();
  });
});
