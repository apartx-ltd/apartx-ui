import { describe, it, expect } from 'vitest';
import { emptyWindow, applyInitialPage, applyOlderPage } from './reducer';
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
