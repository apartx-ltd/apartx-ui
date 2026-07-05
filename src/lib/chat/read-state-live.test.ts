import { describe, it, expect } from 'vitest';
import { countUnread, firstUnreadId } from './helpers';

// u1 is "me"; u2 is the other participant.
const ME = 'u1';

describe('watermark path (lastReadSeq provided)', () => {
  const messages = [
    { _id: 'a', userId: 'u2', seq: 5 },
    { _id: 'b', userId: 'u2', seq: 6 },
    { _id: 'c', userId: 'u1', seq: 7 },
  ] as any;

  it('lastReadSeq=5 → only seq 6 unread', () => {
    expect(countUnread(messages, ME, 5)).toBe(1);
    expect(firstUnreadId(messages, ME, 5)).toBe('b');
  });

  it('lastReadSeq=6 → nothing unread', () => {
    expect(countUnread(messages, ME, 6)).toBe(0);
    expect(firstUnreadId(messages, ME, 6)).toBe(null);
  });

  it('own message is never counted, even with empty read', () => {
    const msgs = [
      { _id: 'a', userId: 'u1', seq: 5, read: [] },
      { _id: 'b', userId: 'u2', seq: 6 },
    ] as any;
    // lastReadSeq high enough to mark the other's message read → 0
    expect(countUnread(msgs, ME, 6)).toBe(0);
    expect(firstUnreadId(msgs, ME, 6)).toBe(null);
  });

  it('service message is skipped', () => {
    const msgs = [
      { _id: 's', userId: 'u2', type: 'service', seq: 6 },
      { _id: 'b', userId: 'u2', seq: 6 },
    ] as any;
    expect(countUnread(msgs, ME, 6)).toBe(0);
    expect(firstUnreadId(msgs, ME, 6)).toBe(null);
  });
});

describe('legacy fallback (lastReadSeq undefined/null)', () => {
  it('read[] includes me → read; else unread', () => {
    const msgs = [
      { _id: 'a', userId: 'u2', read: ['u1'] }, // read by me
      { _id: 'b', userId: 'u2', read: ['u3'] }, // not read by me → unread
      { _id: 'c', userId: 'u2', read: [] },     // unread
    ] as any;
    expect(countUnread(msgs, ME)).toBe(2);
    expect(firstUnreadId(msgs, ME)).toBe('b');
    // null behaves the same as undefined
    expect(countUnread(msgs, ME, null)).toBe(2);
    expect(firstUnreadId(msgs, ME, null)).toBe('b');
  });

  it('own + service still skipped in legacy path', () => {
    const msgs = [
      { _id: 'own', userId: 'u1', read: [] },
      { _id: 'svc', userId: 'u2', type: 'service', read: [] },
      { _id: 'x', userId: 'u2', read: ['u1'] }, // read by me
    ] as any;
    expect(countUnread(msgs, ME)).toBe(0);
    expect(firstUnreadId(msgs, ME)).toBe(null);
  });
});
