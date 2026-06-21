// projects/apartx-ui/src/lib/router/overlay/overlay-stack.test.ts
// @vitest-environment jsdom
// initOverlayStack() is a no-op when `typeof window === 'undefined'` (the SSR
// guard, verbatim from the spaces source). The fake-adapter logic itself is
// browser-agnostic, but the back-interceptor is only registered under a window,
// so opt this file into jsdom to exercise the real init path.
import { describe, it, expect } from 'vitest';
import { createOverlayStack } from './overlay-stack';
import type { HistoryAdapter, Action } from '../history/adapter';

function fakeAdapter() {
  let interceptor: (() => boolean) | null = null;
  const calls: string[] = [];
  let overlayEntry = false;
  const adapter: HistoryAdapter = {
    location: null, action: 'none' as Action, canGoBack: true,
    get onOverlayEntry() { return overlayEntry; },
    listen: () => () => {},
    push: () => {}, replace: () => {},
    pushOverlay: () => { calls.push('pushOverlay'); overlayEntry = true; },
    setBackInterceptor: (fn) => { interceptor = fn; },
    goBack: () => { calls.push('goBack'); },
  };
  return { adapter, calls, fireBack: () => interceptor?.(), setOverlayEntry: (v: boolean) => { overlayEntry = v; } };
}

describe('createOverlayStack', () => {
  it('open pushes a synthetic entry; back closes the top', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    let closed = false;
    os.openOverlay(() => { closed = true; });
    expect(f.calls).toContain('pushOverlay');
    expect(os.overlayCount()).toBe(1);
    expect(f.fireBack()).toBe(true); // consumed
    expect(closed).toBe(true);
    expect(os.overlayCount()).toBe(0);
  });

  it('non-back close pops one synthetic entry via goBack, idempotent', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const token = os.openOverlay(() => {});
    os.closeOverlay(token);
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(1);
    os.closeOverlay(token); // already removed → no-op
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(1);
  });

  it('ADOPTs a surviving overlay entry instead of double-pushing', () => {
    const f = fakeAdapter();
    f.setOverlayEntry(true); // already sitting on a synthetic entry
    const os = createOverlayStack(f.adapter);
    os.openOverlay(() => {});
    expect(f.calls).not.toContain('pushOverlay'); // adopted, no push
  });

  it('suppressNextPop: the popstate from a non-back close is consumed without re-closing', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    let closeCount = 0;
    const token = os.openOverlay(() => { closeCount++; });
    // Non-back close: pops the synthetic entry via goBack and arms suppressNextPop.
    os.closeOverlay(token);
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(1);
    expect(os.overlayCount()).toBe(0);
    expect(closeCount).toBe(0); // closeOverlay removes the entry; it does NOT call close()
    // The goBack above produces a backward popstate → interceptor fires. It must be
    // consumed (true) by the suppressNextPop branch and must NOT close anything again
    // (the entry is already gone).
    expect(f.fireBack()).toBe(true);
    expect(closeCount).toBe(0);
    expect(os.overlayCount()).toBe(0);
  });

  it('multi-overlay LIFO: back closes B then A, in that order', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const order: string[] = [];
    os.openOverlay(() => { order.push('A'); });
    os.openOverlay(() => { order.push('B'); });
    expect(os.overlayCount()).toBe(2);
    expect(f.fireBack()).toBe(true); // closes top (B)
    expect(os.overlayCount()).toBe(1);
    expect(f.fireBack()).toBe(true); // closes A
    expect(os.overlayCount()).toBe(0);
    expect(order).toEqual(['B', 'A']); // LIFO close order
  });

  it('non-top close removes the entry without popping a synthetic history entry', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const tokenA = os.openOverlay(() => {});
    os.openOverlay(() => {}); // B is now the top
    const goBackBefore = f.calls.filter((c) => c === 'goBack').length;
    os.closeOverlay(tokenA); // A is NOT the top → guard `!opts?.viaBack && wasTop` is false
    expect(os.overlayCount()).toBe(1);
    // Non-top non-back close does NOT pop a synthetic entry.
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(goBackBefore);
  });
});
