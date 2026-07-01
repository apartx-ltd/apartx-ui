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

  it('loadOlder() prepends and sets exhausted on a short page', async () => {
    const { transport } = fakeTransport({ fetchOlder: async ({ before }) => (before ? [m('x', 0)] : [m('a', 1), m('b', 2)]) });
    const s = createChatSession(transport, { chatId: 'c', meUserId: 'me', pageSize: 2 });
    await s.open();
    await s.loadOlder();
    expect(s.messages.map((x) => x._id)).to.deep.equal(['x', 'a', 'b']);
    expect(s.olderStatus).to.equal('exhausted');
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
});
