// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './media-tap-guard.harness.svelte';

// Real-DOM integration test for the media tap-guard. Unlike the unit test (fake event objects),
// this mounts the ACTUAL Svelte-compiled structure of a chat message row (row `onclick` menu +
// bubble `oncontextmenu` menu + media button) and dispatches real bubbling events, so it verifies
// the things the unit test only assumed: Svelte 5 event delegation honours `stopPropagation` (a
// media tap never reaches the row menu) and a non-stopped `contextmenu` bubbles up to open the menu.

let comp: any = null;
let target: HTMLElement;

function setup() {
  const calls = { row: 0, bubble: 0, viewer: 0 };
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Harness, {
    target,
    props: {
      onRowMenu: () => { calls.row++; },
      onBubbleMenu: () => { calls.bubble++; },
      onViewer: () => { calls.viewer++; },
    },
  });
  flushSync();
  const media = target.querySelector('[data-testid="media"]') as HTMLElement;
  return { calls, media };
}

function fire(el: HTMLElement, type: string) {
  const e =
    type === 'pointerdown'
      ? new Event(type, { bubbles: true, cancelable: true })
      : new MouseEvent(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  flushSync();
  return e;
}

afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('media tap-guard — real DOM event flow', () => {
  it('plain tap opens ONLY the viewer (stopPropagation gates the row menu)', () => {
    const { calls, media } = setup();
    fire(media, 'pointerdown');
    fire(media, 'click');
    expect(calls.viewer).toBe(1);
    expect(calls.row).toBe(0); // click never reaches the row's tap-to-menu handler
    expect(calls.bubble).toBe(0);
  });

  it('long-press opens ONLY the menu, never the viewer (the double-open bug)', () => {
    const { calls, media } = setup();
    // touch long-press sequence: pointerdown → contextmenu (menu) → trailing click
    fire(media, 'pointerdown');
    const ctx = fire(media, 'contextmenu');
    const click = fire(media, 'click');
    expect(calls.bubble).toBe(1); // contextmenu bubbled up → message menu opened
    expect(calls.viewer).toBe(0); // trailing click did NOT also open the viewer
    expect(calls.row).toBe(0);
    expect(ctx.defaultPrevented).toBe(true); // native browser menu suppressed
    expect(click.defaultPrevented).toBe(true); // trailing click consumed
  });

  it('re-arms per gesture: a tap after a long-press opens the viewer again', () => {
    const { calls, media } = setup();
    fire(media, 'pointerdown');
    fire(media, 'contextmenu');
    fire(media, 'click');
    expect(calls.viewer).toBe(0);
    fire(media, 'pointerdown');
    fire(media, 'click');
    expect(calls.viewer).toBe(1);
  });
});
