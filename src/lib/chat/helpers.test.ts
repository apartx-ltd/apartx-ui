import { describe, it, expect } from 'vitest';
import { deliveryTick, isReadByOther, groupStart, showDate } from './helpers';
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
