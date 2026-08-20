// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { navigate } from './nav';
import { setHistoryAdapter } from '../history/registry';
import { registerOverlay, dismissForNavigation } from '../overlay/overlay-stack';
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

describe('overlay-aware navigate', () => {
  beforeEach(() => { vi.useFakeTimers(); setHistoryAdapter(null); });
  afterEach(() => { dismissForNavigation(); vi.runAllTimers(); vi.useRealTimers(); });

  it('no overlays -> plain push', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    navigate('/x');
    expect(f.calls).toEqual(['push:/x']);
    setHistoryAdapter(null);
  });

  it('one overlay open -> closes it and replaces the overlay entry (variant A)', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    let closed = false;
    registerOverlay({ close: () => { closed = true; }, exitMs: 120 }); // pushOverlay
    navigate('/booking/1');
    // Overlay closes synchronously; the route swap is HELD for the exit-animation window so the
    // overlay can animate out (not blink away) before its host page unmounts.
    expect(closed).toBe(true);
    expect(f.calls).not.toContain('replace:/booking/1:forward');
    vi.advanceTimersByTime(120);
    expect(f.calls).toContain('replace:/booking/1:forward');
    expect(f.calls).not.toContain('push:/booking/1');
    setHistoryAdapter(null);
  });

  it('forwards {action} to history.push when no overlays are open', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    navigate('/x', { action: 'back' });
    expect(f.calls).toEqual(['push:/x:back']);
    setHistoryAdapter(null);
  });

  it('forwards {action} to history.replace on the replace path', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    navigate('/x', { replace: true, action: 'forward' });
    expect(f.calls).toEqual(['replace:/x:forward']);
    setHistoryAdapter(null);
  });

  it('keepOverlays -> plain push under the overlay (survive)', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    registerOverlay({ close: () => {} });
    navigate('/property/1', { keepOverlays: true });
    expect(f.calls).toContain('push:/property/1');
    expect(f.calls).not.toContain('replace:/property/1:forward');
    setHistoryAdapter(null);
  });
});
