// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setSlotContext } from './registry.svelte';
import { setLinkRegistry } from '../links/registry';
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
  afterEach(() => {
    vi.unstubAllGlobals(); setSlotContext(() => ({})); setLinkRegistry({});
    resolveExternalConfirm(false); // no pending confirm may leak into the next test
  });

  it('registered type → host handler, kit does nothing', async () => {
    const open = vi.fn();
    setLinkRegistry({ article: { open } });
    await openChatLink('#/article/a1');
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'article', entityId: 'a1' }));
    expect(opened).toEqual([]);
  });

  it('external without handler → confirm gate, open only on yes', async () => {
    const p = openChatLink('https://example.com/x');
    expect(getExternalConfirm()?.link.href).toBe('https://example.com/x');
    resolveExternalConfirm(true);
    await p;
    expect(opened).toEqual(['https://example.com/x']);
  });

  it('external confirm declined → no open', async () => {
    const p = openChatLink('https://example.com/x');
    resolveExternalConfirm(false);
    await p;
    expect(opened).toEqual([]);
  });

  it('external claimed by a host handler skips the kit confirm', async () => {
    const open = vi.fn();
    setLinkRegistry({ external: { open } });
    await openChatLink('https://example.com/x');
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'external' }));
    expect(getExternalConfirm()).toBeNull();
    expect(opened).toEqual([]);
  });

  it('app link without handler is a no-op (raw #/ href is not openable)', async () => {
    await openChatLink('#/booking/b1');
    expect(getExternalConfirm()).toBeNull();
    expect(opened).toEqual([]);
  });
});

describe('link menu state', () => {
  it('open/close round-trip with parsed link and coordinates', () => {
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
