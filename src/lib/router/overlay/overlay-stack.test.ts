// projects/apartx-ui/src/lib/router/overlay/overlay-stack.test.ts
// @vitest-environment jsdom
// initOverlayStack() is a no-op when `typeof window === 'undefined'` (the SSR
// guard, verbatim from the spaces source). The fake-adapter logic itself is
// browser-agnostic, but the back-interceptor is only registered under a window,
// so opt this file into jsdom to exercise the real init path.
import { describe, it, expect } from 'vitest';
import { createOverlayStack } from './overlay-stack';
import * as overlayStackModule from './overlay-stack';
import { overlayCount, openOverlay, closeOverlay } from './overlay-stack';
import { setHistoryAdapter } from '../history/registry';
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

  it('registerOverlay lazily self-installs the back-interceptor (no explicit initOverlayStack)', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    // NOTE: intentionally NOT calling os.initOverlayStack() here.
    let closed = false;
    os.registerOverlay({ close: () => { closed = true; } });
    // The interceptor must be installed, so a back is consumed and closes the overlay.
    expect(f.fireBack()).toBe(true);
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

  it('same-tick handoff: register while a close pop is pending DEFERS its entry until the pop lands', () => {
    // Dropdown item opens a confirm dialog: closeOverlay(dropdown) armed suppressNextPop and
    // issued a guarded goBack (a TASK), but the confirm's register effect runs as a MICROTASK
    // first — history.state still shows __overlay. Adopting that dying entry means the confirm
    // owns nothing. Pushing immediately does not help either: the browser resolves back()'s
    // target at CALL time, so the traversal lands BELOW the fresh entry anyway and the
    // confirm's own close then pops the real route entry (Escape → about:blank). The entry
    // must be DEFERRED until the pending pop is consumed.
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const dropdown = os.openOverlay(() => {}); // pushOverlay #1 → onOverlayEntry=true
    os.closeOverlay(dropdown); // non-back close: goBack queued, suppressNextPop armed
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(1);
    // Same tick, before the popstate lands: the confirm registers. In the stack at once,
    // but NO history entry yet (neither adopt nor push).
    const confirm = os.openOverlay(() => {});
    expect(os.overlayCount()).toBe(1);
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(1);
    // The pending popstate lands (browser settled on the route entry): consumed by
    // suppressNextPop AND the deferred entry is created now — on top of the route entry.
    expect(f.fireBack()).toBe(true);
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(2);
    expect(os.overlayCount()).toBe(1);
    // The confirm's non-back close (Escape) pops EXACTLY its own entry...
    os.closeOverlay(confirm);
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(2);
    expect(os.overlayCount()).toBe(0);
    // ...and its popstate is consumed — pushes and pops are balanced (2:2), the route
    // entry underneath was never touched.
    expect(f.fireBack()).toBe(true);
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(2);
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(2);
  });

  it('deferred overlay closed BEFORE the pop lands: no entry ever existed, no back issued', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const a = os.openOverlay(() => {}); // pushOverlay #1
    os.closeOverlay(a); // goBack #1, suppressNextPop armed
    const b = os.openOverlay(() => {}); // deferred — no entry yet
    os.closeOverlay(b); // closed before the pop landed → must NOT goBack
    expect(f.calls.filter((c) => c === 'goBack').length).toBe(1);
    expect(os.overlayCount()).toBe(0);
    // The pending pop lands: consumed; b left the stack, so NO deferred push either.
    expect(f.fireBack()).toBe(true);
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(1);
  });

  it('multiple registers while one pop is pending: each gets its own entry on flush, LIFO intact', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const a = os.openOverlay(() => {}); // pushOverlay #1
    os.closeOverlay(a); // goBack #1, suppress armed
    const order: string[] = [];
    os.openOverlay(() => { order.push('B'); }); // deferred
    os.openOverlay(() => { order.push('C'); }); // deferred
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(1);
    expect(f.fireBack()).toBe(true); // pop lands → both entries created, bottom-up
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(3);
    expect(os.overlayCount()).toBe(2);
    // Backs now close C then B, one entry each.
    expect(f.fireBack()).toBe(true);
    expect(f.fireBack()).toBe(true);
    expect(order).toEqual(['C', 'B']);
    expect(os.overlayCount()).toBe(0);
  });

  it('still ADOPTs once the pending pop has been consumed (flag lifecycle intact)', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const a = os.openOverlay(() => {});
    os.closeOverlay(a); // arms suppressNextPop
    expect(f.fireBack()).toBe(true); // pop consumed → flag reset
    // Back-driven remount case: sitting on a genuinely surviving synthetic entry.
    f.setOverlayEntry(true);
    const pushes = f.calls.filter((c) => c === 'pushOverlay').length;
    os.openOverlay(() => {});
    expect(f.calls.filter((c) => c === 'pushOverlay').length).toBe(pushes); // adopted, no push
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

  it('registerOverlay returns depth-based z band (BASE 60, STEP 10)', () => {
    const f = fakeAdapter();
    const os = createOverlayStack(f.adapter);
    os.initOverlayStack();
    const a = os.registerOverlay({ close: () => {} });
    const b = os.registerOverlay({ close: () => {} });
    expect(a.z).toBe(60);
    expect(b.z).toBe(70);
    expect(os.overlayCount()).toBe(2);
  });

  it('detached module-level openOverlay export works standalone (no `this`)', () => {
    // The cabinet MessageMenu imports { openOverlay } from 'apartx-ui/router' and calls
    // it without a receiver. ES modules are strict-mode, so a `this`-based delegation would
    // throw here. Destructure the module-level exports to exercise that exact shape.
    const { openOverlay, closeOverlay, overlayCount } = overlayStackModule;
    const token = openOverlay(() => {}); // must NOT throw
    expect(typeof token).toBe('number');
    expect(overlayCount()).toBeGreaterThanOrEqual(1);
    closeOverlay(token, { viaBack: true }); // cleanup, no real history.back
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

describe('default overlay-stack binds to history registry', () => {
  it('routes pushOverlay through the registered adapter', () => {
    const f = fakeAdapter();
    setHistoryAdapter(f.adapter);
    const token = openOverlay(() => {});
    expect(f.calls).toContain('pushOverlay');
    expect(overlayCount()).toBeGreaterThanOrEqual(1);
    // cleanup
    closeOverlay(token, { viaBack: true });
    setHistoryAdapter(null);
  });
});
