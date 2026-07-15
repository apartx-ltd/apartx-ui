import { describe, it, expect, vi } from 'vitest';
import { createMediaTapGuard } from './helpers';

// A press on chat media must open EITHER the viewer (tap) OR the message context menu
// (long-press / right-click) — never both. Regression for the double-open bug: a touch
// long-press emits `contextmenu` (menu, via the bubble) AND a trailing `click` (viewer).
function fakeEvent() {
  return { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;
}

describe('createMediaTapGuard', () => {
  it('plain tap opens the viewer', () => {
    const openViewer = vi.fn();
    const g = createMediaTapGuard(openViewer);
    g.onpointerdown();
    const click = fakeEvent();
    g.onclick(click);
    expect(openViewer).toHaveBeenCalledTimes(1);
    expect(click.stopPropagation).toHaveBeenCalled(); // never reaches the row's tap-to-menu target
  });

  it('long-press (contextmenu then trailing click) does NOT open the viewer', () => {
    const openViewer = vi.fn();
    const g = createMediaTapGuard(openViewer);
    g.onpointerdown();
    const ctx = fakeEvent();
    g.oncontextmenu(ctx); // opens the message menu (bubbles up); native menu suppressed
    expect(ctx.preventDefault).toHaveBeenCalled();
    const click = fakeEvent();
    g.onclick(click); // the trailing synthetic click
    expect(openViewer).not.toHaveBeenCalled();
    expect(click.preventDefault).toHaveBeenCalled();
  });

  it('re-arms per gesture: a tap after a long-press opens the viewer again', () => {
    const openViewer = vi.fn();
    const g = createMediaTapGuard(openViewer);
    // gesture 1 — long-press
    g.onpointerdown();
    g.oncontextmenu(fakeEvent());
    g.onclick(fakeEvent());
    expect(openViewer).not.toHaveBeenCalled();
    // gesture 2 — plain tap
    g.onpointerdown();
    g.onclick(fakeEvent());
    expect(openViewer).toHaveBeenCalledTimes(1);
  });

  it('right-click without a trailing click leaves the next tap working', () => {
    const openViewer = vi.fn();
    const g = createMediaTapGuard(openViewer);
    g.onpointerdown();
    g.oncontextmenu(fakeEvent()); // desktop right-click → menu, no click follows
    // next interaction
    g.onpointerdown(); // disarms
    g.onclick(fakeEvent());
    expect(openViewer).toHaveBeenCalledTimes(1);
  });
});
