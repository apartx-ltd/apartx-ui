// projects/apartx-ui/src/lib/router/navigator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createNavigatorFromRouter } from './navigator';

function fakeRouter() {
  return {
    pathname: '/users/42',
    current: { pathname: '/users/42', search: '?q=1', hash: '' },
    push: vi.fn(), replace: vi.fn(), back: vi.fn(),
  };
}

describe('createNavigatorFromRouter', () => {
  it('forwards push/replace/back and exposes current', () => {
    const r = fakeRouter();
    const nav = createNavigatorFromRouter(r as any);
    nav.push('/a'); nav.replace('/b'); nav.back('/c');
    expect(r.push).toHaveBeenCalledWith('/a');
    expect(r.replace).toHaveBeenCalledWith('/b');
    expect(r.back).toHaveBeenCalledWith('/c');
    expect(nav.current.pathname).toBe('/users/42');
  });
  it('isActive prefix-matches by segment', () => {
    const nav = createNavigatorFromRouter(fakeRouter() as any);
    expect(nav.isActive('/users')).toBe(true);
    expect(nav.isActive('/users', { exact: true })).toBe(false);
    expect(nav.isActive('/billing')).toBe(false);
  });
});
