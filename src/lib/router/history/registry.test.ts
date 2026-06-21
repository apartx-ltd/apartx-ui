// projects/apartx-ui/src/lib/router/history/registry.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { getHistory, setHistoryAdapter } from './registry';
import type { HistoryAdapter } from './adapter';

const fake: HistoryAdapter = {
  location: { pathname: '/x', search: '', hash: '' },
  action: 'none', canGoBack: false, onOverlayEntry: false,
  listen: () => () => {}, push: () => {}, replace: () => {},
  pushOverlay: () => {}, setBackInterceptor: () => {}, goBack: () => {},
};

describe('history registry', () => {
  afterEach(() => setHistoryAdapter(null)); // reset to default

  it('returns the browser adapter by default', () => {
    expect(getHistory()).toBeDefined();
    expect(typeof getHistory().push).toBe('function');
  });

  it('swaps to an injected adapter and back to default on null', () => {
    setHistoryAdapter(fake);
    expect(getHistory().location?.pathname).toBe('/x');
    setHistoryAdapter(null);
    expect(getHistory().location?.pathname).not.toBe('/x');
  });
});
