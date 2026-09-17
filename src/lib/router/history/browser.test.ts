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

  it('root push starts a new back stack: nothing to go back to until the next push', () => {
    h.push('/list');
    expect(h.canGoBack).toBe(true);
    h.push('/deep', { root: true });
    expect(h.canGoBack).toBe(false);
    h.push('/deeper');
    expect(h.canGoBack).toBe(true);
    // Корень пишется в state — переживает reload и возврат по истории.
    const st = window.history.state as { idx: number; root: number };
    expect(st.root).toBe(st.idx - 1);
  });

  it('popstate restores the stack root of the landed entry', () => {
    h.push('/deep', { root: true });
    const deep = window.history.state as { idx: number; root: number };
    h.push('/deeper');
    window.dispatchEvent(new PopStateEvent('popstate', { state: deep }));
    expect(h.canGoBack).toBe(false);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: deep.idx + 1, root: deep.root } }));
    expect(h.canGoBack).toBe(true);
  });

  it('root replace makes the current entry a stack root; overlays keep it', () => {
    h.push('/a');
    h.replace('/deep', { root: true });
    expect(h.canGoBack).toBe(false);
    h.pushOverlay();
    // Над корнем — запись оверлея: back закрывает его, а не уходит со страницы.
    expect(h.canGoBack).toBe(true);
    expect((window.history.state as { root: number }).root).toBe(
      (window.history.state as { idx: number }).idx - 1,
    );
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
