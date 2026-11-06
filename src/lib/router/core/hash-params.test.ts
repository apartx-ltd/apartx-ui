import { describe, it, expect } from 'vitest';
import { parseHashParams, formatHashParams, splitUrl, withHashParams } from './hash-params';

describe('hash-params', () => {
  it('parses one or several pairs, with and without #', () => {
    expect(parseHashParams('#panel=/properties/p1/booking/new?fromDate=2026-11-10')).toEqual({ panel: '/properties/p1/booking/new?fromDate=2026-11-10' });
    expect(parseHashParams('a=1&b=x=y')).toEqual({ a: '1', b: 'x=y' });
    expect(parseHashParams('')).toEqual({});
    expect(parseHashParams('#flag')).toEqual({ flag: '' });
  });
  it('formats readable values and round-trips & # %', () => {
    expect(formatHashParams({})).toBe('');
    expect(formatHashParams({ panel: '/chats/assistant' })).toBe('#panel=/chats/assistant');
    const v = '/search?q=a&b#c 100%';
    expect(parseHashParams(formatHashParams({ p: v }))).toEqual({ p: v });
    expect(formatHashParams({ p: v })).not.toContain('&b');
  });
  it('splits and patches urls', () => {
    expect(splitUrl('/a/b?x=1#panel=/p')).toEqual({ pathname: '/a/b', search: '?x=1', hash: '#panel=/p' });
    expect(splitUrl('/a')).toEqual({ pathname: '/a', search: '', hash: '' });
    expect(withHashParams('/a?x=1', { panel: '/p' })).toBe('/a?x=1#panel=/p');
    expect(withHashParams('/a#panel=/p&o=1', { panel: null })).toBe('/a#o=1');
    expect(withHashParams('/a#panel=/p', { panel: null })).toBe('/a');
  });
});
