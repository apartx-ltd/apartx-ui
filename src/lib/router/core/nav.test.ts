// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    push: (url) => { calls.push(`push:${url}`); },
    replace: (url, o) => { calls.push(`replace:${url}:${o?.action ?? 'none'}`); },
    pushOverlay: () => { calls.push('pushOverlay'); overlayEntry = true; },
    setBackInterceptor: () => {},
    goBack: () => { calls.push('goBack'); },
  };
  return { adapter, calls };
}

describe('overlay-aware navigate', () => {
  beforeEach(() => setHistoryAdapter(null));
  afterEach(() => dismissForNavigation());

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
    registerOverlay({ close: () => { closed = true; } }); // pushOverlay
    navigate('/booking/1');
    expect(closed).toBe(true);
    expect(f.calls).toContain('replace:/booking/1:forward');
    expect(f.calls).not.toContain('push:/booking/1');
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
