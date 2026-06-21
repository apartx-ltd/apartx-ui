import { describe, it, expect } from 'vitest';
import { matchRoute, matchParams, rankRoute, pick, stripBase } from './match-route';

describe('matchRoute', () => {
  it('matches params and prefix', () => {
    expect(matchRoute('/property/42', '/property/:id')).toBe(true);
    expect(matchRoute('/property/42/extra', '/property/:id')).toBe(true);
  });
  it('respects exact', () => {
    expect(matchRoute('/property/42/extra', '/property/:id', { exact: true })).toBe(false);
    expect(matchRoute('/property/42', '/property/:id', { exact: true })).toBe(true);
  });
  it('wildcard matches anything', () => {
    expect(matchRoute('/anything/here', '*')).toBe(true);
  });
});

describe('matchParams', () => {
  it('extracts and decodes params', () => {
    expect(matchParams('/p/a%20b/123', '/p/:slot/:id')).toEqual({ slot: 'a b', id: '123' });
  });
  it('returns {} for wildcard and non-match', () => {
    expect(matchParams('/x', '*')).toEqual({});
    expect(matchParams('/x', '/y/:id')).toEqual({});
  });
});

describe('rankRoute + pick', () => {
  it('ranks static above param above wildcard', () => {
    expect(rankRoute('/a/b')).toBeGreaterThan(rankRoute('/a/:b'));
    expect(rankRoute('/a/:b')).toBeGreaterThan(rankRoute('*'));
    expect(rankRoute('/')).toBe(1);
  });
  it('picks the most specific match, ties → first', () => {
    const routes = [{ path: '*' }, { path: '/p/:id' }, { path: '/p/new' }];
    expect(pick(routes, '/p/new')?.path).toBe('/p/new');
    expect(pick(routes, '/p/42')?.path).toBe('/p/:id');
    expect(pick(routes, '/zzz')?.path).toBe('*');
  });
});

describe('stripBase', () => {
  it('is a no-op for root base', () => expect(stripBase('/a', '/')).toBe('/a'));
  it('strips a nested base', () => {
    expect(stripBase('/shell/a', '/shell')).toBe('/a');
    expect(stripBase('/shell', '/shell')).toBe('/');
  });
});
