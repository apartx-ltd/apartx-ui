import { describe, it, expect } from 'vitest';
import { createInMemoryDraftStore, createLocalStorageDraftStore } from './draft-store';

describe('draft-store', () => {
  it('in-memory get/set/remove round-trips', () => {
    const s = createInMemoryDraftStore();
    expect(s.get('k')).to.equal(null);
    s.set('k', 'hello');
    expect(s.get('k')).to.equal('hello');
    s.remove('k');
    expect(s.get('k')).to.equal(null);
  });

  it('localStorage store no-ops safely when localStorage is undefined (SSR)', () => {
    const orig = (globalThis as any).localStorage;
    // @ts-ignore
    delete (globalThis as any).localStorage;
    try {
      const s = createLocalStorageDraftStore('p');
      expect(() => s.set('k', 'v')).to.not.throw();
      expect(s.get('k')).to.equal(null); // no-op, no crash
    } finally {
      (globalThis as any).localStorage = orig;
    }
  });
});
