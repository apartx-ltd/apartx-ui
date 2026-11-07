// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ensurePanelJournal, resetPanelJournals } from './panel-journal';
import { setHistoryAdapter } from '../history/registry';
import type { HistoryAdapter, Action } from '../history/adapter';
import type { RouteSnapshot } from '../../navigation/context';

function fakeAdapter(url: string, withPosition = true) {
  const listeners = new Set<() => void>();
  const state = { location: split(url), position: 0 };
  const adapter: HistoryAdapter = {
    get location() { return state.location; },
    action: 'none' as Action,
    canGoBack: true,
    onOverlayEntry: false,
    listen: (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    push: () => {},
    replace: () => {},
    pushOverlay: () => {},
    restoreOverlayEntry: () => {},
    setBackInterceptor: () => {},
    goBack: () => {},
  };
  if (withPosition) Object.defineProperty(adapter, 'position', { get: () => state.position });
  const go = (u: string, position: number) => {
    state.location = split(u);
    state.position = position;
    listeners.forEach((f) => f());
  };
  return { adapter, go };
}

function split(url: string): RouteSnapshot {
  const [rest, hash] = url.split('#');
  const [pathname, search] = rest.split('?');
  return { pathname, search: search ? `?${search}` : '', hash: hash ? `#${hash}` : '' };
}

describe('panel journal', () => {
  beforeEach(() => {
    resetPanelJournals();
    setHistoryAdapter(null);
  });

  it('records every navigation of the adapter, mounted or not', () => {
    const f = fakeAdapter('/accounts/properties');
    setHistoryAdapter(f.adapter);
    const j = ensurePanelJournal('panel');
    expect(j.get(0)).toEqual({ main: '/accounts/properties', value: undefined });
    f.go('/accounts/properties#panel=/properties/p1/info', 1);
    expect(j.get(1)).toEqual({ main: '/accounts/properties', value: '/properties/p1/info' });
    f.go('/accounts/properties', 2);
    expect(j.get(2)?.value).toBeUndefined();
    f.go('/accounts/properties#panel=/properties/p1/info', 1);
    expect(j.position).toBe(1);
    expect(j.get(1)).toEqual({ main: '/accounts/properties', value: '/properties/p1/info' });
    f.go('/accounts/chats#panel=/chats/c1/chat', 2);
    expect(j.get(2)).toEqual({ main: '/accounts/chats', value: '/chats/c1/chat' });
  });

  it('notifies subscribers on updates', () => {
    const f = fakeAdapter('/a');
    setHistoryAdapter(f.adapter);
    const j = ensurePanelJournal('panel');
    let hits = 0;
    const off = j.subscribe(() => { hits += 1; });
    f.go('/b', 1);
    off();
    f.go('/c', 2);
    expect(hits).toBe(1);
  });

  it('is a singleton per hashParam and ignores an adapter without position', () => {
    const f = fakeAdapter('/a', false);
    setHistoryAdapter(f.adapter);
    const j = ensurePanelJournal('panel');
    expect(ensurePanelJournal('panel')).toBe(j);
    f.go('/b', 1);
    expect(j.position).toBe(-1);
    expect(j.get(0)).toBeUndefined();
  });
});
