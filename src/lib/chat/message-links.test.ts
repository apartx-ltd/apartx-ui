import { describe, it, expect } from 'vitest';
import { classifyChatLink } from './message-links';

const BASE = 'https://cabinet.apartx.co';

describe('classifyChatLink', () => {
  it('classifies hash entity links', () => {
    expect(classifyChatLink('#/booking/abc123', BASE)).toEqual({ type: 'booking', entityId: 'abc123', href: '#/booking/abc123' });
    expect(classifyChatLink('#/property/p1', BASE).type).toBe('property');
    expect(classifyChatLink('#/article/a1', BASE)).toMatchObject({ type: 'article', entityId: 'a1' });
  });

  it('classifies search links, entityId keeps the query string', () => {
    expect(classifyChatLink('#/search/?q=astana&rooms=2', BASE)).toEqual({
      type: 'search', entityId: '?q=astana&rooms=2', href: '#/search/?q=astana&rooms=2',
    });
  });

  it('classifies absolute URLs with hash routes', () => {
    expect(classifyChatLink('https://cabinet.apartx.co/#/article/a2', BASE).type).toBe('article');
  });

  it('classifies path forms (legacy)', () => {
    expect(classifyChatLink('https://cabinet.apartx.co/show/p9', BASE)).toMatchObject({ type: 'property', entityId: 'p9' });
    expect(classifyChatLink('https://cabinet.apartx.co/accounts/my-bookings/b9', BASE)).toMatchObject({ type: 'booking', entityId: 'b9' });
  });

  it('everything else is external, href preserved', () => {
    expect(classifyChatLink('https://example.com/page?x=1', BASE)).toEqual({
      type: 'external', entityId: '', href: 'https://example.com/page?x=1',
    });
    expect(classifyChatLink('#/unknown/зюзя', BASE).type).toBe('external');
  });

  it('unparseable input is external, does not throw', () => {
    expect(classifyChatLink('%%%not a url', undefined).type).toBe('external');
  });
});
