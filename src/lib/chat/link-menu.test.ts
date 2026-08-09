// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setSlotContext } from './registry.svelte';
import {
  openChatLink, openLinkMenu, closeLinkMenu, getLinkMenu,
  confirmExternalOpen, resolveExternalConfirm, getExternalConfirm,
} from './link-menu.svelte';

describe('openChatLink', () => {
  let opened: string[];
  beforeEach(() => {
    opened = [];
    vi.stubGlobal('open', (url: string) => { opened.push(url); return null; });
  });
  afterEach(() => { vi.unstubAllGlobals(); setSlotContext(() => ({})); });

  it('host onLinkOpen returning true claims the click, kit does nothing', async () => {
    const onLinkOpen = vi.fn(() => true);
    setSlotContext(() => ({ onLinkOpen }));
    await openChatLink('#/article/a1');
    expect(onLinkOpen).toHaveBeenCalledWith(expect.objectContaining({ type: 'article', entityId: 'a1' }));
    expect(opened).toEqual([]);
  });

  it('external without handler → confirm gate, open only on yes', async () => {
    setSlotContext(() => ({}));
    const p = openChatLink('https://example.com/x');
    expect(getExternalConfirm()?.link.href).toBe('https://example.com/x');
    resolveExternalConfirm(true);
    await p;
    expect(opened).toEqual(['https://example.com/x']);
  });

  it('external confirm declined → no open', async () => {
    setSlotContext(() => ({}));
    const p = openChatLink('https://example.com/x');
    resolveExternalConfirm(false);
    await p;
    expect(opened).toEqual([]);
  });

  it('internal type without handler is a no-op (raw #/ href is not openable)', async () => {
    setSlotContext(() => ({}));
    await openChatLink('#/booking/b1');
    expect(opened).toEqual([]);
  });
});

describe('link menu state', () => {
  it('open/close round-trip with classified link and coordinates', () => {
    setSlotContext(() => ({}));
    openLinkMenu('#/article/a1', 10, 20);
    expect(getLinkMenu()).toMatchObject({ x: 10, y: 20, link: { type: 'article' } });
    closeLinkMenu();
    expect(getLinkMenu()).toBeNull();
  });
});

describe('confirmExternalOpen', () => {
  it('resolves its promise with the dialog answer', async () => {
    const p = confirmExternalOpen({ type: 'external', entityId: '', href: 'https://e.com' });
    resolveExternalConfirm(true);
    await expect(p).resolves.toBe(true);
    expect(getExternalConfirm()).toBeNull();
  });
});
