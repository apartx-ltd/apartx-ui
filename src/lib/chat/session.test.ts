import { describe, it, expect, vi } from 'vitest';
import { createChatSession } from './session.svelte';
import type { ChatTransport, LiveEvent, Message } from './types';

function fakeTransport(over: Partial<ChatTransport> = {}): { transport: ChatTransport; emit: (e: LiveEvent) => void } {
  let onEvent: (e: LiveEvent) => void = () => {};
  const transport: ChatTransport = {
    fetchOlder: async () => [],
    subscribeLive: (_id, cb) => { onEvent = cb; return () => {}; },
    sendMessage: async (d) => ({ _id: 'real-' + d.clientToken, chatId: d.chatId, seq: 100, text: d.text, createdAt: new Date(), meta: { clientToken: d.clientToken } }),
    markRead: async () => {},
    ...over,
  };
  return { transport, emit: (e) => onEvent(e) };
}

const m = (id: string, seq: number): Message => ({ _id: id, chatId: 'c', seq, createdAt: new Date(seq * 1000) });

describe('ChatSession', () => {
  it('open() subscribes THEN fetches the initial page → status ready', async () => {
    const order: string[] = [];
    const { transport } = fakeTransport({
      subscribeLive: (_id, _cb) => { order.push('subscribe'); return () => {}; },
      fetchOlder: async () => { order.push('fetch'); return [m('a', 1), m('b', 2)]; },
    });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    expect(order).to.deep.equal(['subscribe', 'fetch']);
    expect(s.status).to.equal('ready');
    expect(s.messages.map((x) => x._id)).to.deep.equal(['a', 'b']);
  });

  it('a live event arriving during open is not lost (subscribe-then-fetch + dedupe)', async () => {
    const { transport, emit } = fakeTransport({ fetchOlder: async () => { emit({ type: 'upsert', message: m('b', 2) }); return [m('a', 1)]; } });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    expect(s.messages.map((x) => x._id)).to.deep.equal(['a', 'b']);
  });

  it('send() shows an optimistic sending message, then swaps to the server message', async () => {
    const { transport } = fakeTransport();
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    s.composer.setDraft('hi');
    const p = s.send();
    expect(s.messages.at(-1)?.sendState).to.equal('sending');
    await p;
    expect(s.messages.at(-1)?.sendState).to.equal(undefined);
    expect(s.messages.at(-1)?._id).to.match(/^real-/);
    expect(s.composer.draft).to.equal(''); // cleared
  });

  it('send() failure marks the optimistic message failed; retry re-sends', async () => {
    let calls = 0;
    const { transport } = fakeTransport({ sendMessage: async (d) => { calls++; if (calls === 1) throw new Error('net'); return { _id: 'real', chatId: d.chatId, seq: 9, text: d.text, createdAt: new Date(), meta: { clientToken: d.clientToken } }; } });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    s.composer.setDraft('hi');
    await s.send();
    const failed = s.messages.at(-1)!;
    expect(failed.sendState).to.equal('failed');
    await s.retry(failed);
    expect(s.messages.at(-1)?.sendState).to.equal(undefined);
  });

  it('sendMedia() shows an optimistic media bubble with progress, then swaps to the server message', async () => {
    const progresses: number[] = [];
    const { transport } = fakeTransport({
      sendMedia: async (d) => {
        d.onProgress(0.5);
        d.onProgress(1);
        return { _id: 'img-' + d.clientToken, chatId: d.chatId, seq: 200, type: d.type, createdAt: new Date(), meta: { clientToken: d.clientToken, file: { url: 'https://x/y.jpg' } } };
      },
    });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    const p = s.sendMedia({ file: { name: 'y.jpg' }, type: 'image', width: 100, height: 80, previewUrl: 'blob:x' });
    const opt = s.messages.at(-1)!;
    expect(opt.sendState).to.equal('sending');
    expect(opt.type).to.equal('image');
    expect(opt.meta?.width).to.equal(100);
    expect(opt.meta?.previewUrl).to.equal('blob:x');
    await p;
    const done = s.messages.at(-1)!;
    expect(done.sendState).to.equal(undefined);
    expect(done._id).to.match(/^img-/);
    expect(done.meta?.file?.url).to.equal('https://x/y.jpg');
  });

  it('sendMedia() reflects upload progress on the optimistic message before it resolves', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => { release = r; });
    const { transport } = fakeTransport({
      sendMedia: async (d) => {
        d.onProgress(0.42);
        await gate;
        return { _id: 'img-' + d.clientToken, chatId: d.chatId, seq: 201, type: d.type, createdAt: new Date(), meta: { clientToken: d.clientToken } };
      },
    });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    const p = s.sendMedia({ file: {}, type: 'image' });
    await Promise.resolve();
    expect(s.messages.at(-1)?.meta?.uploadProgress).to.equal(0.42);
    release!();
    await p;
  });

  it('sendMedia() marks the optimistic message failed when the upload/send throws', async () => {
    const { transport } = fakeTransport({ sendMedia: async () => { throw new Error('upload boom'); } });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    await s.sendMedia({ file: {}, type: 'image' });
    expect(s.messages.at(-1)?.sendState).to.equal('failed');
  });

  it('sendMedia() throws when the transport has no sendMedia seam', async () => {
    const { transport } = fakeTransport();
    delete (transport as any).sendMedia;
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    await expect(s.sendMedia({ file: {}, type: 'image' })).rejects.toThrow(/sendMedia/);
  });

  it('loadOlder() prepends and sets exhausted on a short page', async () => {
    const { transport } = fakeTransport({ fetchOlder: async ({ before }) => (before ? [m('x', 0)] : [m('a', 1), m('b', 2)]) });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 2 });
    await s.open();
    await s.loadOlder();
    expect(s.messages.map((x) => x._id)).to.deep.equal(['x', 'a', 'b']);
    expect(s.olderStatus).to.equal('exhausted');
  });

  const mu = (id: string, seq: number, over: Partial<Message> = {}): Message => ({ _id: id, chatId: 'c', seq, createdAt: new Date(seq * 1000), userId: 'them', ...over });

  it('unreadAnchorId freezes the first incoming unread from the entry page', async () => {
    const { transport } = fakeTransport({ fetchOlder: async () => [mu('a', 1, { read: true }), mu('b', 2, { read: false }), mu('c', 3, { read: false })] });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    expect(s.unreadAnchorId).to.equal('b');
  });

  it('unreadAnchorId is null when nothing was unread on entry, and a later live message does NOT set it', async () => {
    const { transport, emit } = fakeTransport({ fetchOlder: async () => [mu('a', 1, { read: true })] });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    expect(s.unreadAnchorId).to.equal(null);
    emit({ type: 'upsert', message: mu('d', 4, { read: false }) });
    expect(s.messages.map((x) => x._id)).to.deep.equal(['a', 'd']);
    expect(s.unreadAnchorId).to.equal(null); // divider does not appear on live arrivals
  });

  it('a live message arriving after open does NOT move the frozen unreadAnchorId', async () => {
    const { transport, emit } = fakeTransport({ fetchOlder: async () => [mu('a', 1, { read: false })] });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    expect(s.unreadAnchorId).to.equal('a');
    emit({ type: 'upsert', message: mu('d', 4, { read: false }) });
    expect(s.unreadAnchorId).to.equal('a'); // stays put, does not jump to 'd'
  });

  it('with a lastMessageSeq ceiling, backlog loading AFTER open surfaces the divider (re-open bug)', async () => {
    // Stale window on re-open: fetchOlder seeds only the already-read baseline; the unread backlog
    // that arrived while away lands a beat later via the live stream. The frozen-at-open anchor would
    // miss it — with a ceiling the anchor is derived, so it surfaces once the backlog is loaded.
    const { transport, emit } = fakeTransport({ fetchOlder: async () => [mu('a', 1)] });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', lastReadSeq: () => 1, lastMessageSeq: () => 3 });
    await s.open();
    expect(s.unreadAnchorId).to.equal(null); // baseline read, backlog not loaded yet
    emit({ type: 'upsert', message: mu('b', 2) }); // unread backlog that existed at entry (seq <= ceiling)
    expect(s.messages.map((x) => x._id)).to.deep.equal(['a', 'b']);
    expect(s.unreadAnchorId).to.equal('b'); // divider now appears at the loaded backlog
  });

  it('with a ceiling, a live message ABOVE the ceiling does NOT set the divider', async () => {
    const { transport, emit } = fakeTransport({ fetchOlder: async () => [mu('a', 1)] });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', lastReadSeq: () => 1, lastMessageSeq: () => 1 });
    await s.open();
    expect(s.unreadAnchorId).to.equal(null);
    emit({ type: 'upsert', message: mu('d', 4) }); // arrived WHILE viewing (seq above the entry ceiling)
    expect(s.messages.map((x) => x._id)).to.deep.equal(['a', 'd']);
    expect(s.unreadAnchorId).to.equal(null); // stays null — does not chase live arrivals
  });

  it('markRead(message) forwards the message to the transport', async () => {
    const markRead = vi.fn(async () => {});
    const { transport } = fakeTransport({ markRead });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me' });
    await s.open();
    const wm = { _id: 'w', chatId: 'c', createdAt: new Date(5000), seq: 7 };
    await s.markRead(wm);
    expect(markRead).toHaveBeenCalledWith({ chatId: 'c', message: wm });
  });

  // Paged fake transport over a fixed ascending array: fetchOlder returns the newest `limit`
  // messages older than `before` (or the newest `limit` when `before` is undefined), oldest→newest.
  function pagedTransport(all: Message[]): ChatTransport {
    return {
      fetchOlder: async ({ before, limit }) => {
        const pool = before ? all.filter((x) => x.createdAt.getTime() < before.getTime()) : all;
        return pool.slice(Math.max(0, pool.length - limit)); // oldest→newest tail
      },
      subscribeLive: () => () => {},
      sendMessage: async (d) => ({ _id: 'real-' + d.clientToken, chatId: d.chatId, seq: 999, text: d.text, createdAt: new Date(), meta: { clientToken: d.clientToken } }),
      markRead: async () => {},
    };
  }

  // seq 1..n, userId 'other' (incoming), ascending createdAt.
  const chatOf = (n: number): Message[] => Array.from({ length: n }, (_, i) => mu(`m${i + 1}`, i + 1));

  it('expands the initial window backward to include the unread region', async () => {
    const transport = pagedTransport(chatOf(40));
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 25, lastReadSeq: () => 5 });
    await s.open();
    // Oldest loaded crossed into read territory (seq <= 5) instead of stopping at seq 16.
    expect(s.messages[0]!.seq).to.be.at.most(5);
    expect(s.messages.map((x) => x._id)).to.contain('m6');
    expect(s.unreadAnchorId).to.equal('m6'); // first unread
  });

  it('does not over-expand when the unread region already fits the first page', async () => {
    const transport = pagedTransport(chatOf(40));
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 25, lastReadSeq: () => 30 });
    await s.open();
    expect(s.messages.length).to.equal(25); // one page — oldest loaded seq 16 <= 30 already
  });

  it('no expansion when lastReadSeq is absent', async () => {
    // read:true messages → firstUnreadId is null under the legacy (no-lastReadSeq) predicate.
    const allRead = Array.from({ length: 40 }, (_, i) => mu(`m${i + 1}`, i + 1, { read: true }));
    const transport = pagedTransport(allRead);
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 25 });
    await s.open();
    expect(s.messages.length).to.equal(25); // no expansion — lastReadSeq getter absent
    expect(s.unreadAnchorId).to.equal(null);
  });

  it('an exhausted first page stops the loop (all-unread short chat)', async () => {
    const transport = pagedTransport(chatOf(10));
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 25, lastReadSeq: () => 0 });
    await s.open();
    expect(s.messages.length).to.equal(10); // first page returned all → exhausted, no spin
    expect(s.olderStatus).to.equal('exhausted');
  });

  it('a live upsert landing mid-expansion is NOT clobbered by applyOlderPage (fresh read after await)', async () => {
    // Capture the live callback so the expansion fetch can emit through it synchronously.
    let onEvent: (e: LiveEvent) => void = () => {};
    const all = chatOf(40);
    let call = 0;
    const transport: ChatTransport = {
      fetchOlder: async ({ before, limit }) => {
        call++;
        // On the FIRST expansion fetch (2nd call, before is set), emit a live upsert BEFORE resolving.
        // seq 41 is newer than the loaded window; it must survive the applyOlderPage merge that follows.
        if (call === 2) onEvent({ type: 'upsert', message: mu('m41', 41) });
        const pool = before ? all.filter((x) => x.createdAt.getTime() < before.getTime()) : all;
        return pool.slice(Math.max(0, pool.length - limit));
      },
      subscribeLive: (_id, cb) => { onEvent = cb; return () => {}; },
      sendMessage: async (d) => ({ _id: 'real-' + d.clientToken, chatId: d.chatId, seq: 999, text: d.text, createdAt: new Date(), meta: { clientToken: d.clientToken } }),
      markRead: async () => {},
    };
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 25, lastReadSeq: () => 5 });
    await s.open();
    expect(s.messages.map((x) => x._id)).to.contain('m41'); // live upsert preserved through expansion
    expect(s.messages[0]!.seq).to.be.at.most(5);            // expansion still crossed into read territory
  });

  it('a huge-unread chat (>MAX_INITIAL) degrades gracefully — caps the window, anchors at the top', async () => {
    const transport = pagedTransport(chatOf(260));
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 25, lastReadSeq: () => 1 });
    await s.open();
    expect(s.status).to.equal('ready');            // no throw / no spin
    expect(s.messages.length).to.equal(200);       // MAX_INITIAL cap: 25 + 7×25 = 200
    expect(s.unreadAnchorId).to.not.equal(null);   // loop stopped before read territory → oldest loaded is unread
    expect(s.unreadAnchorId).to.equal(s.messages[0]!._id); // divider anchors at the top of the loaded window
  });
});
