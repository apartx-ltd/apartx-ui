// projects/apartx-ui/src/lib/router/history/browser.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { browserHistoryAdapter as h } from './browser';

describe('browserHistoryAdapter', () => {
  beforeEach(() => {
    window.history.replaceState({ idx: 0 }, '', '/');
  });

  it('reads the current location', () => {
    window.history.replaceState({ idx: 0 }, '', '/foo?x=1#h');
    expect(h.location).toEqual({ pathname: '/foo', search: '?x=1', hash: '#h' });
  });

  it('push increments position and notifies listeners', () => {
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    h.push('/bar');
    expect(window.location.pathname).toBe('/bar');
    expect(h.action).toBe('forward');
    expect(h.canGoBack).toBe(true);
    expect(hits).toBe(1);
    off();
  });

  it('replace keeps position and defaults action to none', () => {
    h.push('/a');
    const before = h.canGoBack;
    h.replace('/b');
    expect(window.location.pathname).toBe('/b');
    expect(h.action).toBe('none');
    expect(h.canGoBack).toBe(before);
  });

  it('pushOverlay marks the entry as an overlay without notifying', () => {
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    h.pushOverlay();
    expect(h.onOverlayEntry).toBe(true);
    expect(hits).toBe(0);
    off();
  });
});
