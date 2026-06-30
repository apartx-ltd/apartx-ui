import { describe, it, expect, beforeEach } from 'vitest';
import { setMessageRendererRegistry, setDefaultSlots, resolveComponents } from './registry.svelte';

const A = { name: 'A' } as any, B = { name: 'B' } as any, DEF = { name: 'DEF' } as any;

beforeEach(() => {
  setDefaultSlots({ body: DEF });
  setMessageRendererRegistry({});
});

describe('renderer registry', () => {
  it('returns default slots for an unregistered type', () => {
    expect(resolveComponents('nope').body).to.equal(DEF);
  });
  it('merges a registered slot set over defaults', () => {
    setMessageRendererRegistry({ booking: { body: A, footer: B } });
    const r = resolveComponents('booking');
    expect(r.body).to.equal(A);    // override
    expect(r.footer).to.equal(B);  // added
  });
  it('undefined type falls back to defaults', () => {
    expect(resolveComponents(undefined).body).to.equal(DEF);
  });
});
