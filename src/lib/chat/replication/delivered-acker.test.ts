import { describe, it, expect, vi } from 'vitest';
import { createDeliveredAcker } from './delivered-acker';

// Manual fake timer: capture the scheduled callback so the test drives when the debounce fires.
const makeTimers = () => {
  let cb: (() => void) | null = null;
  return {
    set: (fn: () => void) => { cb = fn; return 1 as any; },
    clear: () => { cb = null; },
    fire: () => { const f = cb; cb = null; f?.(); },
    pending: () => cb != null,
  };
};

const dialog = (chatId: string, seq: number, userId: string) =>
  ({ chatId, chat: { _id: chatId, lastMessage: { seq, userId } } });

describe('createDeliveredAcker', () => {
  it('acks a freshly received counterpart message up to its seq (debounced)', () => {
    const t = makeTimers();
    const ack = vi.fn();
    const a = createDeliveredAcker({ ack, debounceMs: 400, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    a.note([dialog('c1', 7, 'them')], 'me');
    expect(ack).not.toHaveBeenCalled(); // debounced
    t.fire();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack.mock.calls[0][0]).toEqual({ chatId: 'c1', uptoSeq: 7 });
  });

  it('does NOT re-ack the same seq on a repeated snapshot', () => {
    const t = makeTimers();
    const ack = vi.fn();
    const a = createDeliveredAcker({ ack, debounceMs: 400, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    a.note([dialog('c1', 7, 'them')], 'me'); t.fire();
    a.note([dialog('c1', 7, 'them')], 'me'); // same seq
    expect(t.pending()).toBe(false);          // nothing scheduled
    a.note([dialog('c1', 9, 'them')], 'me'); t.fire(); // higher seq → acks again
    expect(ack).toHaveBeenCalledTimes(2);
    expect(ack.mock.calls[1][0]).toEqual({ chatId: 'c1', uptoSeq: 9 });
  });

  it('skips dialogs whose newest message is my own (no receive event)', () => {
    const t = makeTimers();
    const ack = vi.fn();
    const a = createDeliveredAcker({ ack, debounceMs: 400, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    a.note([dialog('c1', 7, 'me')], 'me');
    expect(t.pending()).toBe(false);
    t.fire();
    expect(ack).not.toHaveBeenCalled();
  });

  it('skips dialogs with no seq on the last message', () => {
    const t = makeTimers();
    const ack = vi.fn();
    const a = createDeliveredAcker({ ack, debounceMs: 400, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    a.note([{ chatId: 'c1', chat: { _id: 'c1', lastMessage: { userId: 'them' } } }], 'me');
    expect(t.pending()).toBe(false);
  });

  it('acks multiple chats in one flush', () => {
    const t = makeTimers();
    const ack = vi.fn();
    const a = createDeliveredAcker({ ack, debounceMs: 400, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    a.note([dialog('c1', 3, 'them'), dialog('c2', 5, 'them')], 'me');
    t.fire();
    expect(ack).toHaveBeenCalledTimes(2);
    const byChat = Object.fromEntries(ack.mock.calls.map((c) => [c[0].chatId, c[0].uptoSeq]));
    expect(byChat).toEqual({ c1: 3, c2: 5 });
  });

  it('dispose cancels a pending flush', () => {
    const t = makeTimers();
    const ack = vi.fn();
    const a = createDeliveredAcker({ ack, debounceMs: 400, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    a.note([dialog('c1', 7, 'them')], 'me');
    a.dispose();
    expect(t.pending()).toBe(false);
    t.fire();
    expect(ack).not.toHaveBeenCalled();
  });
});
