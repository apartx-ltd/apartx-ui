import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLink, openLink, linkShareUrl, setLinkRegistry } from './registry';

afterEach(() => setLinkRegistry({}));

describe('parseLink', () => {
  it('reads `#/<type>/<rest>` — any type, id or query string', () => {
    expect(parseLink('#/booking/b1')).toEqual({ type: 'booking', entityId: 'b1', href: '#/booking/b1' });
    expect(parseLink('#/property/p1')).toMatchObject({ type: 'property', entityId: 'p1' });
    expect(parseLink('#/article/a1')).toMatchObject({ type: 'article', entityId: 'a1' });
    expect(parseLink('#/search/?q=almaty&x=1')).toMatchObject({ type: 'search', entityId: '?q=almaty&x=1' });
    expect(parseLink('#/quick-reply/qr1')).toMatchObject({ type: 'quick-reply', entityId: 'qr1' });
  });

  it('accepts a bare `#/<type>` (an action without an id)', () => {
    expect(parseLink('#/verification')).toMatchObject({ type: 'verification', entityId: '' });
  });

  it('works inside an absolute URL and decodes percent-escapes', () => {
    expect(parseLink('https://cabinet.example/accounts/chats#/booking/b1')).toMatchObject({ type: 'booking', entityId: 'b1' });
    expect(parseLink('#/search/?q=%D0%B0')).toMatchObject({ type: 'search', entityId: '?q=а' });
  });

  it('everything else is external, href untouched', () => {
    for (const href of [
      'https://example.com/x',
      'https://cabinet.example/show/p1',
      '/accounts/my-bookings/b1',
      '#/search?q=legacy-no-slash',
      '#/Booking/b1',
      '#/external/x',
      '#plain-anchor',
      'mailto:a@b.c',
    ]) {
      expect(parseLink(href)).toEqual({ type: 'external', entityId: '', href });
    }
  });

  it('unparseable input is external too', () => {
    expect(parseLink('http://[::1')).toMatchObject({ type: 'external' });
    expect(parseLink('#/search/%E0%A4%A')).toMatchObject({ type: 'external' });
  });
});

describe('openLink', () => {
  it('dispatches to the registered handler and claims synchronously', () => {
    const open = vi.fn();
    setLinkRegistry({ verification: { open } });
    expect(openLink('#/verification')).toBe(true);
    expect(open).toHaveBeenCalledWith({ type: 'verification', entityId: '', href: '#/verification' });
  });

  it('unregistered type → false, nothing called', () => {
    const open = vi.fn();
    setLinkRegistry({ booking: { open } });
    expect(openLink('#/property/p1')).toBe(false);
    expect(openLink('https://example.com')).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('a host may claim external links too (e.g. Cordova InAppBrowser)', () => {
    const open = vi.fn();
    setLinkRegistry({ external: { open } });
    expect(openLink('https://example.com/x')).toBe(true);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'external', href: 'https://example.com/x' }));
  });

  it('an async handler is claimed at once, its work continues in the background', async () => {
    let done = false;
    setLinkRegistry({ booking: { open: async () => { await Promise.resolve(); done = true; } } });
    expect(openLink('#/booking/b1')).toBe(true);
    expect(done).toBe(false);
    await Promise.resolve();
    expect(done).toBe(true);
  });
});

describe('linkShareUrl', () => {
  it('uses the handler shareUrl (sync or async), else the raw href', async () => {
    setLinkRegistry({
      article: { open() {}, shareUrl: (l) => `https://help.example/article/${l.entityId}` },
      booking: { open() {}, shareUrl: async (l) => `https://spaces.example/bookings/${l.entityId}` },
      property: { open() {} },
    });
    await expect(linkShareUrl('#/article/a1')).resolves.toBe('https://help.example/article/a1');
    await expect(linkShareUrl('#/booking/b1')).resolves.toBe('https://spaces.example/bookings/b1');
    await expect(linkShareUrl('#/property/p1')).resolves.toBe('#/property/p1');
    await expect(linkShareUrl('https://example.com/x')).resolves.toBe('https://example.com/x');
  });
});
