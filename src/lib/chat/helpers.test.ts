import { describe, it, expect } from 'vitest';
import { deliveryTick, isReadByOther, groupStart, showDate, firstUnreadId, newerWatermark } from './helpers';
import type { Message } from './types';

const m = (over: Partial<Message> = {}): Message => ({ _id: 'm', chatId: 'c', userId: 'u1', createdAt: new Date('2026-06-30T10:00:00Z'), ...over });

describe('deliveryTick', () => {
  it('prefers msg.delivery (failed/read/delivered/sent)', () => {
    expect(deliveryTick(m({ delivery: 'failed' }), 'me')).to.equal('failed');
    expect(deliveryTick(m({ delivery: 'read' }), 'me')).to.equal('read');
    expect(deliveryTick(m({ delivery: 'delivered' }), 'me')).to.equal('delivered');
    expect(deliveryTick(m({ delivery: 'queued' }), 'me')).to.equal('sent');
  });
  it('falls back to read[] when delivery is absent', () => {
    expect(deliveryTick(m({ read: ['other'] }), 'me')).to.equal('read');
    expect(deliveryTick(m({ read: [] }), 'me')).to.equal('sent');
  });
});

describe('isReadByOther', () => {
  it('true when read[] contains a user other than me', () => {
    expect(isReadByOther(m({ read: ['other'] }), 'me')).to.equal(true);
    expect(isReadByOther(m({ read: ['me'] }), 'me')).to.equal(false);
    expect(isReadByOther(m({ read: true }), 'me')).to.equal(true);
  });
});

describe('grouping', () => {
  it('groupStart true when previous author differs', () => {
    const prev = m({ userId: 'u1' });
    expect(groupStart(m({ userId: 'u2' }), prev)).to.equal(true);
    expect(groupStart(m({ userId: 'u1' }), prev)).to.equal(false);
    expect(groupStart(m({ userId: 'u1' }), null)).to.equal(true);
  });
  it('showDate true on a new calendar day', () => {
    // Build dates from LOCAL components (Date(y, monthIndex, d, h, m)) so the assertions are timezone-independent —
    // showDate compares local date parts, so UTC `Z` literals would flip depending on the runner's timezone.
    const prev = m({ createdAt: new Date(2026, 5, 29, 23, 0, 0) });        // Jun 29, 23:00 local
    expect(showDate(m({ createdAt: new Date(2026, 5, 30, 1, 0, 0) }), prev)).to.equal(true);   // Jun 30 → new day
    expect(showDate(m({ createdAt: new Date(2026, 5, 29, 23, 30, 0) }), prev)).to.equal(false); // same day
  });
});

const mu = (over: Partial<Message>): Message => ({ _id: 'x', chatId: 'c', createdAt: new Date(1000), ...over });

describe('firstUnreadId', () => {
  it('returns the first incoming unread (read===false) id', () => {
    const msgs = [
      mu({ _id: 'a', userId: 'me', read: false }),       // own → skip
      mu({ _id: 'b', userId: 'them', read: true }),       // read → skip
      mu({ _id: 'c', userId: 'them', read: false }),      // unread → hit
      mu({ _id: 'd', userId: 'them', read: false }),
    ];
    expect(firstUnreadId(msgs, 'me')).toBe('c');
  });
  it('uses read[] membership and skips service', () => {
    const msgs = [
      mu({ _id: 'a', userId: 'them', type: 'service', read: false }), // service → skip
      mu({ _id: 'b', userId: 'them', read: ['me'] }),                  // read by me → skip
      mu({ _id: 'c', userId: 'them', read: ['other'] }),              // not by me → hit
    ];
    expect(firstUnreadId(msgs, 'me')).toBe('c');
  });
  it('treats undefined read as read (parity with admin) → null', () => {
    expect(firstUnreadId([mu({ userId: 'them' })], 'me')).toBeNull();
  });
});

describe('newerWatermark', () => {
  it('returns b when a is null', () => {
    const b = mu({ _id: 'b' });
    expect(newerWatermark(null, b)).toBe(b);
  });
  it('compares by seq when both present', () => {
    const a = mu({ _id: 'a', seq: 5 }), b = mu({ _id: 'b', seq: 3 });
    expect(newerWatermark(a, b)).toBe(a);
  });
  it('falls back to createdAt when seq missing', () => {
    const a = mu({ _id: 'a', createdAt: new Date(1000) });
    const b = mu({ _id: 'b', createdAt: new Date(2000) });
    expect(newerWatermark(a, b)).toBe(b);
  });
});
