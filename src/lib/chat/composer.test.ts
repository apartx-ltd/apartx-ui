import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createComposer } from './composer.svelte';
import { createInMemoryDraftStore } from './draft-store';
import type { Message } from './types';

const msg = (over: Partial<Message> = {}): Message => ({ _id: 'm1', chatId: 'c', userId: 'u2', text: 'hello world', createdAt: new Date(), ...over });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('composer', () => {
  it('setReply stores a snapshot {_id, authorName, textPreview}; clearReply clears it', () => {
    const c = createComposer({ key: 'c:1', authorNameOf: () => 'Alice' });
    c.setReply(msg({ _id: 'mX', text: 'a long original message body' }));
    expect(c.replyTo?._id).to.equal('mX');
    expect(c.replyTo?.authorName).to.equal('Alice');
    expect(c.replyTo?.textPreview.length).to.be.greaterThan(0);
    c.clearReply();
    expect(c.replyTo).to.equal(null);
  });

  it('hydrates draft + reply from the DraftStore on creation', () => {
    const store = createInMemoryDraftStore();
    store.set('c:1', JSON.stringify({ draft: 'saved text', replyTo: { _id: 'r', authorName: 'Bob', textPreview: 'p' } }));
    const c = createComposer({ key: 'c:1', store, authorNameOf: () => 'X' });
    expect(c.draft).to.equal('saved text');
    expect(c.replyTo?._id).to.equal('r');
  });

  it('persists draft to the store debounced; clear() removes it', () => {
    const store = createInMemoryDraftStore();
    const c = createComposer({ key: 'c:1', store, debounceMs: 400, authorNameOf: () => 'X' });
    c.setDraft('typing…');
    expect(store.get('c:1')).to.equal(null); // not yet (debounced)
    vi.advanceTimersByTime(400);
    expect(JSON.parse(store.get('c:1')!).draft).to.equal('typing…');
    c.clear();
    expect(store.get('c:1')).to.equal(null);
  });
});
