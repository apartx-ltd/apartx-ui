// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet } from 'svelte';
import { VList } from 'virtua/svelte';

// VirtualList SYNTHESIZES virtua CacheSnapshots — `[sizes: number[], defaultSize: number]` — from
// host `estimateSize` values and the id-keyed measured cache. That tuple layout is virtua-internal
// ("not intended to be modified by users"), so this guard pins it: if a virtua upgrade changes the
// shape, these fail loudly instead of cold-open seeding silently degrading back to 40px defaults.
//
// jsdom has no layout, and ResizeObserver is stubbed inert — rows are never MEASURED here, which
// is exactly what makes the assertions deterministic: getCache() must return precisely what the
// constructor consumed (seeded sizes survive untouched, unseeded rows stay -1).

beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const rowSnippet = createRawSnippet((item: () => unknown) => ({
  render: () => `<div>${String(item())}</div>`,
}));

function mountVList(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle: any = mount(VList as any, {
    target,
    props: { children: rowSnippet, ...props } as any,
  });
  flushSync();
  return {
    handle,
    dispose: () => {
      unmount(handle);
      target.remove();
    },
  };
}

describe('virtua CacheSnapshot shape (version-coupling guard)', () => {
  it('getCache() is [sizes per row, defaultSize]', () => {
    const { handle, dispose } = mountVList({ data: ['a', 'b', 'c'] });
    try {
      const snap: any = handle.getCache();
      expect(Array.isArray(snap)).toBe(true);
      expect(snap).toHaveLength(2);
      expect(Array.isArray(snap[0])).toBe(true);
      expect(snap[0]).toHaveLength(3);
      for (const s of snap[0]) expect(typeof s).toBe('number');
      expect(typeof snap[1]).toBe('number');
    } finally {
      dispose();
    }
  });

  it('a synthesized [sizes, default] passed as `cache` is consumed per row', () => {
    const { handle, dispose } = mountVList({
      data: ['a', 'b', 'c'],
      cache: [[110, 220, 330], 55] as any,
    });
    try {
      const snap: any = handle.getCache();
      expect(snap[0]).toEqual([110, 220, 330]);
      expect(snap[1]).toBe(55);
    } finally {
      dispose();
    }
  });

  it('rows beyond the seeded sizes stay -1 (unmeasured), missing entries are not invented', () => {
    const { handle, dispose } = mountVList({
      data: ['a', 'b', 'c', 'd'],
      cache: [[110, 220], 55] as any,
    });
    try {
      const snap: any = handle.getCache();
      expect(snap[0]).toEqual([110, 220, -1, -1]);
    } finally {
      dispose();
    }
  });
});
