import type { DraftStore } from './types';

export function createInMemoryDraftStore(): DraftStore {
  const map = new Map<string, string>();
  return {
    get: (k) => (map.has(k) ? map.get(k)! : null),
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

/**
 * localStorage-backed DraftStore. SSR-safe: if `localStorage` is unavailable (server render, or a privacy mode that
 * throws), every method silently no-ops. `prefix` namespaces keys; the host should fold the current userId into it.
 */
export function createLocalStorageDraftStore(prefix: string): DraftStore {
  const ls = (): Storage | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  };
  const k = (key: string) => `${prefix}:${key}`;
  return {
    get: (key) => {
      try { return ls()?.getItem(k(key)) ?? null; } catch { return null; }
    },
    set: (key, value) => {
      try { ls()?.setItem(k(key), value); } catch { /* quota/SSR — ignore */ }
    },
    remove: (key) => {
      try { ls()?.removeItem(k(key)); } catch { /* ignore */ }
    },
  };
}
