import { describe, it, expect, vi } from 'vitest';
import { deliveryTick, isReadByOther, groupStart, groupEnd, showDate, firstUnreadId, countUnread, newerWatermark, createReadFlusher, chatImageGallery, formatDuration } from './helpers';
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
  it('own message, counterpart READ watermark covers seq → read', () => {
    expect(deliveryTick(m({ userId: 'me', seq: 5 }), 'me', 5, 5)).to.equal('read');
    expect(deliveryTick(m({ userId: 'me', seq: 6 }), 'me', 5, 6)).to.equal('delivered'); // read<seq, delivered>=seq
  });
  it('own DELIVERED (counterpart device has it), not yet read → delivered', () => {
    expect(deliveryTick(m({ userId: 'me', seq: 5 }), 'me', 0, 5)).to.equal('delivered');
    expect(deliveryTick(m({ userId: 'me', seq: 5 }), 'me', undefined, 5)).to.equal('delivered');
  });
  it('own CONFIRMED but NOT yet on counterpart device → "sent" (truthful; not "delivered")', () => {
    // Semantic change: server-accepted ≠ delivered. Without a delivered watermark reaching seq,
    // an own confirmed message is 'sent' (single check), matching WhatsApp's "server has it".
    expect(deliveryTick(m({ userId: 'me', seq: 5, read: [] }), 'me', undefined, undefined)).to.equal('sent');
    expect(deliveryTick(m({ userId: 'me', seq: 5 }), 'me', 0, 4)).to.equal('sent'); // delivered<seq
    expect(deliveryTick(m({ userId: 'me', seq: 5, read: ['other'] }), 'me', undefined, undefined)).to.equal('read'); // legacy read[] lifts
  });
  it('own CONFIRMED with NO seq yet → "sent" (no watermark can match)', () => {
    expect(deliveryTick(m({ userId: 'me', read: [] }), 'me', undefined, undefined)).to.equal('sent');
    expect(deliveryTick(m({ userId: 'me' }), 'me', undefined, undefined)).to.equal('sent');
  });
  it('own OPTIMISTIC echo (sendState "sending") → "pending"; "failed" → "failed"', () => {
    expect(deliveryTick(m({ userId: 'me', sendState: 'sending' }), 'me', undefined, undefined)).to.equal('pending');
    expect(deliveryTick(m({ userId: 'me', sendState: 'sending', seq: 5 }), 'me', 9, 9)).to.equal('pending');
    expect(deliveryTick(m({ userId: 'me', sendState: 'failed' }), 'me', undefined, undefined)).to.equal('failed');
  });
  it('failed always wins regardless of watermark', () => {
    expect(deliveryTick(m({ userId: 'me', seq: 5, delivery: 'failed' }), 'me', 9, 9)).to.equal('failed');
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
  it('groupEnd true when next author differs or none follows', () => {
    const cur = m({ userId: 'u1' });
    expect(groupEnd(cur, m({ userId: 'u2' }))).to.equal(true);
    expect(groupEnd(cur, m({ userId: 'u1' }))).to.equal(false);
    expect(groupEnd(cur, null)).to.equal(true);
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
  it('treats undefined read on an incoming message as UNREAD (isReadByMe legacy fallback: !!read) → hit', () => {
    expect(firstUnreadId([mu({ _id: 'z', userId: 'them' })], 'me')).toBe('z');
  });
});

describe('countUnread', () => {
  it('counts incoming unread, skipping own + service + read', () => {
    const msgs = [
      mu({ _id: 'a', userId: 'me', read: false }),        // own → skip
      mu({ _id: 'b', userId: 'them', type: 'service', read: false }), // service → skip
      mu({ _id: 'c', userId: 'them', read: true }),        // read → skip
      mu({ _id: 'd', userId: 'them', read: false }),       // unread → count
      mu({ _id: 'e', userId: 'them', read: ['other'] }),   // not by me → count
      mu({ _id: 'f', userId: 'them', read: ['me'] }),      // by me → skip
      mu({ _id: 'g', userId: 'them' }),                    // undefined read → isReadByMe !!read → unread → count
    ];
    expect(countUnread(msgs, 'me')).toBe(3);
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

describe('deliveryTick — prefers server delivery over read[]', () => {
  it("returns 'read' from delivery even when read[] is empty", () => {
    expect(deliveryTick({ _id: 'a', createdAt: new Date(), delivery: 'read', read: [] } as any, 'me')).toBe('read');
  });
  it("returns 'delivered' from delivery even if read[] wrongly contains another user", () => {
    expect(deliveryTick({ _id: 'a', createdAt: new Date(), delivery: 'delivered', read: ['other'] } as any, 'me')).toBe('delivered');
  });
  it('falls back to read[] only when delivery is absent', () => {
    expect(deliveryTick({ _id: 'a', createdAt: new Date(), read: ['other'] } as any, 'me')).toBe('read');
    expect(deliveryTick({ _id: 'a', createdAt: new Date() } as any, 'me')).toBe('sent');
  });
});

describe('createReadFlusher — read-on-render gated by viewing', () => {
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

  it('marks read after debounce when the window is being viewed', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    const f = createReadFlusher({ markRead, isViewing: () => true, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    expect(markRead).not.toHaveBeenCalled(); // debounced, not yet
    t.fire();
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead.mock.calls[0][0]._id).toBe('a');
  });

  it('does NOT mark read while unviewed (backgrounded / unfocused window)', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    let viewing = false;
    const f = createReadFlusher({ markRead, isViewing: () => viewing, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    t.fire();
    expect(markRead).not.toHaveBeenCalled(); // withheld — nobody looked at it
  });

  it('flushes the accumulated NEWEST watermark on focus/visibility regain', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    let viewing = false;
    const f = createReadFlusher({ markRead, isViewing: () => viewing, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    f.note(m({ _id: 'b', seq: 7 })); // newer arrives while unviewed
    t.fire();
    expect(markRead).not.toHaveBeenCalled();
    viewing = true;
    f.flushIfViewing(); // user returns to the window
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead.mock.calls[0][0]._id).toBe('b'); // newest, not the first
  });

  it('flushIfViewing is a no-op while still unviewed', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    const f = createReadFlusher({ markRead, isViewing: () => false, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    t.fire();
    f.flushIfViewing();
    expect(markRead).not.toHaveBeenCalled();
  });

  it('dispose cancels a pending flush', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    const f = createReadFlusher({ markRead, isViewing: () => true, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    f.dispose();
    expect(t.pending()).toBe(false);
  });

  it('does NOT re-issue markRead for an already-flushed watermark (breaks the pullDialogs loop)', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    const f = createReadFlusher({ markRead, isViewing: () => true, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    t.fire();
    expect(markRead).toHaveBeenCalledTimes(1);
    // Same message re-renders (dialog watermark round-tripped) — must be a no-op, no new timer.
    f.note(m({ _id: 'a', seq: 5 }));
    expect(t.pending()).toBe(false);
    // An OLDER message (below the flushed watermark) is likewise ignored.
    f.note(m({ _id: 'older', seq: 3 }));
    expect(t.pending()).toBe(false);
    t.fire();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('still flushes a genuinely NEWER message after a prior flush', () => {
    const t = makeTimers();
    const markRead = vi.fn();
    const f = createReadFlusher({ markRead, isViewing: () => true, debounceMs: 600, setTimeoutFn: t.set, clearTimeoutFn: t.clear });
    f.note(m({ _id: 'a', seq: 5 }));
    t.fire();
    expect(markRead).toHaveBeenCalledTimes(1);
    f.note(m({ _id: 'b', seq: 8 })); // a real new arrival advances the watermark
    expect(t.pending()).toBe(true);
    t.fire();
    expect(markRead).toHaveBeenCalledTimes(2);
    expect(markRead.mock.calls[1][0]._id).toBe('b');
  });
});

describe('chatImageGallery', () => {
  const img = (id: string, over: Partial<Message> = {}): Message =>
    m({ _id: id, type: 'image', meta: { file: { url: `https://cdn/${id}.jpg` } } as any, ...over });

  it('collects only image messages with a resolved file URL, in order', () => {
    const msgs = [
      img('a'),
      m({ _id: 'txt', type: 'text' }),
      img('b'),
    ];
    expect(chatImageGallery(msgs)).toEqual([
      { src: 'https://cdn/a.jpg', alt: '' },
      { src: 'https://cdn/b.jpg', alt: '' },
    ]);
  });

  it('skips videos and still-uploading images (no file URL yet, only a preview blob)', () => {
    const msgs = [
      m({ _id: 'vid', type: 'video', meta: { file: { url: 'https://cdn/v.mp4' } } as any }),
      m({ _id: 'up', type: 'image', sendState: 'sending', meta: { previewUrl: 'blob:local' } as any }),
      img('ok'),
    ];
    expect(chatImageGallery(msgs)).toEqual([{ src: 'https://cdn/ok.jpg', alt: '' }]);
  });

  it('returns an empty gallery for a set with no images', () => {
    expect(chatImageGallery([m({ type: 'text' })])).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(0)).to.equal('0:00');
    expect(formatDuration(5)).to.equal('0:05');
    expect(formatDuration(42)).to.equal('0:42');
    expect(formatDuration(90)).to.equal('1:30');
    expect(formatDuration(605)).to.equal('10:05');
  });
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDuration(3661)).to.equal('1:01:01');
    expect(formatDuration(7325)).to.equal('2:02:05');
  });
  it('rounds fractional seconds down', () => {
    expect(formatDuration(42.9)).to.equal('0:42');
  });
  it('returns empty string for missing/invalid input', () => {
    expect(formatDuration(undefined)).to.equal('');
    expect(formatDuration(null as any)).to.equal('');
    expect(formatDuration(NaN)).to.equal('');
    expect(formatDuration(-3)).to.equal('');
  });
});
