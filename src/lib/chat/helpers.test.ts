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
    const prev = m({ createdAt: new Date('2026-06-29T23:00:00Z') });
    expect(showDate(m({ createdAt: new Date('2026-06-30T01:00:00Z') }), prev)).to.equal(true);
    expect(showDate(m({ createdAt: new Date('2026-06-29T23:30:00Z') }), prev)).to.equal(false);
  });
});
