import { describe, it, expect } from 'vitest';
import { isReadByMe } from './read-state';

describe('isReadByMe', () => {
  const me = 'u1';
  it('own message → from receipts array (unchanged)', () => {
    expect(isReadByMe({ userId: 'u1', read: ['u2'] } as any, me, 5)).toBe(true);
    expect(isReadByMe({ userId: 'u1', read: [] } as any, me, 5)).toBe(false);
  });
  it("other's message with seq → watermark", () => {
    expect(isReadByMe({ userId: 'u2', seq: 5 } as any, me, 5)).toBe(true);  // seq<=wm
    expect(isReadByMe({ userId: 'u2', seq: 6 } as any, me, 5)).toBe(false); // seq>wm
  });
  it("other's message, no seq (legacy) → falls back to read[] membership", () => {
    expect(isReadByMe({ userId: 'u2', read: ['u1'] } as any, me, null)).toBe(true);
    expect(isReadByMe({ userId: 'u2', read: ['u3'] } as any, me, null)).toBe(false);
  });
  it('service message → read', () => {
    expect(isReadByMe({ userId: 'u2', type: 'service' } as any, me, 0)).toBe(true);
  });
});
