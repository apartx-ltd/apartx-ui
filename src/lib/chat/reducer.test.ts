import { describe, it, expect } from 'vitest';
import { emptyWindow, applyInitialPage, applyOlderPage, applyLiveUpsert } from './reducer';
import type { Message } from './types';

const m = (id: string, seq: number): Message => ({ _id: id, chatId: 'c', seq, createdAt: new Date(seq * 1000) });

describe('reducer: pages', () => {
  it('applyInitialPage sorts by seq ascending and sets olderStatus idle', () => {
    const w = applyInitialPage(emptyWindow(), [m('b', 2), m('a', 1)], 2);
    expect(w.messages.map((x) => x._id)).to.deep.equal(['a', 'b']);
    expect(w.olderStatus).to.equal('idle');
  });

  it('applyInitialPage marks exhausted when page smaller than pageSize', () => {
    const w = applyInitialPage(emptyWindow(), [m('a', 1)], 25);
    expect(w.olderStatus).to.equal('exhausted');
  });

  it('applyOlderPage prepends older messages preserving identity and order', () => {
    let w = applyInitialPage(emptyWindow(), [m('c', 3), m('d', 4)], 2);
    w = applyOlderPage(w, [m('a', 1), m('b', 2)], 2);
    expect(w.messages.map((x) => x._id)).to.deep.equal(['a', 'b', 'c', 'd']);
    expect(w.olderStatus).to.equal('idle'); // got a full page → maybe more
  });

  it('applyOlderPage marks exhausted on a short page and dedupes overlap by _id', () => {
    let w = applyInitialPage(emptyWindow(), [m('b', 2), m('c', 3)], 5);
    w = applyOlderPage(w, [m('a', 1), m('b', 2)], 5); // 'b' overlaps
    expect(w.messages.map((x) => x._id)).to.deep.equal(['a', 'b', 'c']);
    expect(w.olderStatus).to.equal('exhausted');
  });
});

describe('reducer: live upsert', () => {
  it('inserts a new message in seq order', () => {
    let w = applyInitialPage(emptyWindow(), [m('a', 1), m('c', 3)], 5);
    w = applyLiveUpsert(w, m('b', 2));
    expect(w.messages.map((x) => x._id)).to.deep.equal(['a', 'b', 'c']);
  });

  it('replaces an existing message by _id (e.g. delivery state change) without duplicating', () => {
    let w = applyInitialPage(emptyWindow(), [m('a', 1)], 5);
    w = applyLiveUpsert(w, { ...m('a', 1), delivery: 'read' });
    expect(w.messages).to.have.length(1);
    expect(w.messages[0].delivery).to.equal('read');
  });
});

import { applyOptimisticSend, resolveSend, failSend, applyDelete } from './reducer';

describe('reducer: optimistic send', () => {
  it('appends a sending message at the tail (no seq → newest)', () => {
    let w = applyInitialPage(emptyWindow(), [m('a', 1)], 5);
    w = applyOptimisticSend(w, { _id: 'tmp1', chatId: 'c', text: 'hi', createdAt: new Date(9_000_000), sendState: 'sending', meta: { clientToken: 'tok1' } });
    expect(w.messages.map((x) => x._id)).to.deep.equal(['a', 'tmp1']);
    expect(w.messages[1].sendState).to.equal('sending');
  });

  it('resolveSend swaps the temp message for the real one (state cleared), no duplicate', () => {
    let w = applyOptimisticSend(emptyWindow(), { _id: 'tmp1', chatId: 'c', text: 'hi', createdAt: new Date(1), sendState: 'sending', meta: { clientToken: 'tok1' } });
    w = resolveSend(w, 'tmp1', { _id: 'real1', chatId: 'c', seq: 5, text: 'hi', createdAt: new Date(2), meta: { clientToken: 'tok1' } });
    expect(w.messages.map((x) => x._id)).to.deep.equal(['real1']);
    expect(w.messages[0].sendState).to.equal(undefined);
  });

  it('resolveSend is idempotent if the live upsert of the real message already landed', () => {
    let w = applyOptimisticSend(emptyWindow(), { _id: 'tmp1', chatId: 'c', text: 'hi', createdAt: new Date(1), sendState: 'sending', meta: { clientToken: 'tok1' } });
    // live upsert of real message arrives first (same clientToken)
    w = applyLiveUpsert(w, { _id: 'real1', chatId: 'c', seq: 5, text: 'hi', createdAt: new Date(2), meta: { clientToken: 'tok1' } });
    w = resolveSend(w, 'tmp1', { _id: 'real1', chatId: 'c', seq: 5, text: 'hi', createdAt: new Date(2), meta: { clientToken: 'tok1' } });
    expect(w.messages.map((x) => x._id)).to.deep.equal(['real1']); // tmp removed, no dup
  });

  it('failSend marks the temp message failed (retry affordance)', () => {
    let w = applyOptimisticSend(emptyWindow(), { _id: 'tmp1', chatId: 'c', text: 'hi', createdAt: new Date(1), sendState: 'sending', meta: { clientToken: 'tok1' } });
    w = failSend(w, 'tmp1');
    expect(w.messages[0].sendState).to.equal('failed');
  });
});

describe('reducer: delete', () => {
  it('soft delete marks removedAt but keeps the message', () => {
    let w = applyInitialPage(emptyWindow(), [m('a', 1), m('b', 2)], 5);
    w = applyDelete(w, 'a', false);
    expect(w.messages).to.have.length(2);
    expect(w.messages[0].removedAt).to.be.instanceOf(Date);
  });

  it('hard delete drops the message', () => {
    let w = applyInitialPage(emptyWindow(), [m('a', 1), m('b', 2)], 5);
    w = applyDelete(w, 'a', true);
    expect(w.messages.map((x) => x._id)).to.deep.equal(['b']);
  });
});
