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
});
