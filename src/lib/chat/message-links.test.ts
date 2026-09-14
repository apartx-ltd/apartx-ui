import { describe, it, expect } from 'vitest';
import { classifyChatLink } from './message-links';

const BASE = 'https://cabinet.example';

describe('classifyChatLink', () => {
  it('classifies any #/<type>/<rest> hash link — the kit does not know the types', () => {
    expect(classifyChatLink('#/booking/abc123', { baseUrl: BASE })).toEqual({ type: 'booking', entityId: 'abc123', href: '#/booking/abc123' });
    expect(classifyChatLink('#/property/p1', { baseUrl: BASE }).type).toBe('property');
    expect(classifyChatLink('#/lock/l1', { baseUrl: BASE })).toMatchObject({ type: 'lock', entityId: 'l1' });
  });

  it('keeps the query string as entityId for search-like links', () => {
    expect(classifyChatLink('#/search/?q=astana&rooms=2', { baseUrl: BASE })).toEqual({
      type: 'search', entityId: '?q=astana&rooms=2', href: '#/search/?q=astana&rooms=2',
    });
  });

  it('classifies absolute URLs with hash routes', () => {
    expect(classifyChatLink('https://cabinet.example/#/article/a2', { baseUrl: BASE }).type).toBe('article');
  });

  it('host type list narrows hash links: unknown type is external', () => {
    const rules = { baseUrl: BASE, types: ['booking', 'article'] };
    expect(classifyChatLink('#/article/a1', rules).type).toBe('article');
    expect(classifyChatLink('#/property/p1', rules).type).toBe('external');
  });

  it('host path rules map legacy path forms, first match wins', () => {
    const rules = {
      baseUrl: BASE,
      paths: [
        { pattern: /^\/show\/([a-zA-Z0-9]+)$/, type: 'property' },
        { pattern: /^\/accounts\/my-bookings\/([a-zA-Z0-9]+)$/, type: 'booking' },
      ],
    };
    expect(classifyChatLink('https://cabinet.example/show/p9', rules)).toMatchObject({ type: 'property', entityId: 'p9' });
    expect(classifyChatLink('https://cabinet.example/accounts/my-bookings/b9', rules)).toMatchObject({ type: 'booking', entityId: 'b9' });
    // Without host rules the kit knows no paths.
    expect(classifyChatLink('https://cabinet.example/show/p9', { baseUrl: BASE }).type).toBe('external');
  });

  it('everything else is external, href preserved', () => {
    expect(classifyChatLink('https://example.com/page?x=1', { baseUrl: BASE })).toEqual({
      type: 'external', entityId: '', href: 'https://example.com/page?x=1',
    });
    expect(classifyChatLink('#/external/x', { baseUrl: BASE }).type).toBe('external');
    expect(classifyChatLink('#/nested/', { baseUrl: BASE }).type).toBe('external');
  });

  it('unparseable input is external, does not throw', () => {
    expect(classifyChatLink('%%%not a url').type).toBe('external');
  });
});
