import { describe, it, expect, vi } from 'vitest';
import { deliveryTick, isReadByOther, groupStart, groupEnd, showDate, firstUnreadId, countUnread, newerWatermark, createReadFlusher, chatImageGallery, formatDuration, mediaBoxHeight, textBlockHeight, estimateMessageHeight, MEDIA_BOX_MAX, messageAttachments, splitAttachments, albumBoxHeight, albumLayout, ALBUM_MAX_CELLS, DOC_ROW_H } from './helpers';
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

describe('messageAttachments', () => {
  it('prefers the ordered meta.files array', () => {
    const files = [{ url: 'a', type: 'image/jpeg' }, { url: 'b', type: 'application/pdf' }];
    expect(messageAttachments(m({ meta: { files, file: files[0] } as any }))).toEqual(files);
  });
  it('falls back to legacy meta.file when meta.files is empty', () => {
    const file = { url: 'a', type: 'image/jpeg' };
    expect(messageAttachments(m({ meta: { files: [], file } as any }))).toEqual([file]);
  });
  it('reads a lone legacy meta.file', () => {
    const file = { url: 'a' };
    expect(messageAttachments(m({ meta: { file } as any }))).toEqual([file]);
  });
  it('returns [] for a message with no attachments', () => {
    expect(messageAttachments(m({ type: 'text' }))).toEqual([]);
    expect(messageAttachments(m({ meta: {} as any }))).toEqual([]);
  });
});

describe('splitAttachments', () => {
  it('splits image/video from everything else, keeping order inside each group', () => {
    const a = { url: '1', type: 'image/jpeg' };
    const b = { url: '2', type: 'application/pdf' };
    const c = { url: '3', type: 'video/mp4' };
    const d = { url: '4', type: 'audio/ogg' };
    expect(splitAttachments([a, b, c, d])).toEqual({ visual: [a, c], docs: [b, d] });
  });
  it('treats an attachment without a usable mime as a document row', () => {
    const noType = { url: '1' };
    const badType = { url: '2', type: 42 as any };
    expect(splitAttachments([noType, badType])).toEqual({ visual: [], docs: [noType, badType] });
  });
  it('handles an empty list', () => {
    expect(splitAttachments([])).toEqual({ visual: [], docs: [] });
  });
});

describe('albumBoxHeight', () => {
  // Сетка 300px шириной, gap 2 → квадратная ячейка 149; нечётное количество даёт hero 16:9 = 169.
  it('is 0 when there is nothing to show', () => {
    expect(albumBoxHeight(0)).to.equal(0);
    expect(albumBoxHeight(-3)).to.equal(0);
  });
  it('lays 2 cells in one square row', () => {
    expect(albumBoxHeight(2)).to.equal(149);
  });
  it('gives an odd count a full-width 16:9 hero plus one square row', () => {
    expect(albumBoxHeight(3)).to.equal(169 + 2 + 149);
  });
  it('lays 4 cells in two square rows', () => {
    expect(albumBoxHeight(4)).to.equal(149 * 2 + 2);
  });
  it('does not grow past ALBUM_MAX_CELLS — the rest collapses into the "+N" overlay', () => {
    expect(albumBoxHeight(7)).to.equal(albumBoxHeight(ALBUM_MAX_CELLS));
    expect(albumBoxHeight(7)).to.equal(300);
  });
});

describe('albumLayout', () => {
  const img = (n: number) => ({ url: `${n}.jpg`, type: 'image/jpeg' });
  const pdf = { url: 'a.pdf', type: 'application/pdf' };

  it('нечётное число превью → hero-ячейка на обе колонки', () => {
    const l = albumLayout([img(1), img(2), img(3)]);
    expect(l.cells).toHaveLength(3);
    expect(l.hero).to.equal(true);
    expect(l.overflow).to.equal(0);
  });
  it('чётное число превью → hero нет', () => {
    expect(albumLayout([img(1), img(2)]).hero).to.equal(false);
    expect(albumLayout([img(1), img(2), img(3), img(4)]).hero).to.equal(false);
  });
  it('больше ALBUM_MAX_CELLS → рисуются только 4, остальное в «+N»', () => {
    const l = albumLayout([1, 2, 3, 4, 5, 6].map(img));
    expect(l.cells).toHaveLength(ALBUM_MAX_CELLS);
    expect(l.overflow).to.equal(2);
    expect(l.hero).to.equal(false); // shown = 4, чётное
    expect(l.cells[3]).toEqual(img(4)); // оверлей ложится на четвёртое превью, пятое-шестое не рисуются
  });
  it('документы уходят строками под сетку, порядок сохраняется', () => {
    const l = albumLayout([img(1), pdf, img(2)]);
    expect(l.cells).toEqual([img(1), img(2)]);
    expect(l.docs).toEqual([pdf]);
  });
  it('только документы → сетки нет', () => {
    const l = albumLayout([pdf, pdf]);
    expect(l.cells).toHaveLength(0);
    expect(l.hero).to.equal(false);
    expect(l.docs).toHaveLength(2);
  });
  it('высота сетки считается по тем же ячейкам, что и рисуются', () => {
    const l = albumLayout([1, 2, 3, 4, 5].map(img));
    expect(albumBoxHeight(l.cells.length)).to.equal(albumBoxHeight(ALBUM_MAX_CELLS));
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

  it('collects every image of an album, in attachment order', () => {
    const album = m({
      _id: 'al', type: 'image',
      meta: {
        files: [
          { url: 'https://cdn/1.jpg', type: 'image/jpeg' },
          { url: 'https://cdn/2.png', type: 'image/png' },
          { url: 'https://cdn/3.jpg', type: 'image/jpeg' },
        ],
        file: { url: 'https://cdn/1.jpg', type: 'image/jpeg' },
      } as any,
    });
    expect(chatImageGallery([album])).toEqual([
      { src: 'https://cdn/1.jpg', alt: '' },
      { src: 'https://cdn/2.png', alt: '' },
      { src: 'https://cdn/3.jpg', alt: '' },
    ]);
  });

  it('still collects images from a MIXED album whose first attachment is a pdf (message type "document")', () => {
    const mixed = m({
      _id: 'mx', type: 'document',
      meta: {
        files: [
          { url: 'https://cdn/doc.pdf', type: 'application/pdf' },
          { url: 'https://cdn/a.jpg', type: 'image/jpeg' },
          { url: 'https://cdn/v.mp4', type: 'video/mp4' },
          { url: 'https://cdn/b.jpg', type: 'image/jpeg' },
        ],
        file: { url: 'https://cdn/doc.pdf', type: 'application/pdf' },
      } as any,
    });
    expect(chatImageGallery([mixed])).toEqual([
      { src: 'https://cdn/a.jpg', alt: '' },
      { src: 'https://cdn/b.jpg', alt: '' },
    ]);
  });

  it('REGRESSION: a legacy image message whose meta.file has no mime is still in the gallery', () => {
    // Сервер ставил att.type только когда находил документ файла — у старых сообщений mime нет,
    // решает тип сообщения. Без этого фолбэка вся старая история выпала бы из лайтбокса.
    const legacy = m({ _id: 'lg', type: 'image', meta: { file: { url: 'https://cdn/legacy.jpg' } } as any });
    expect(chatImageGallery([legacy])).toEqual([{ src: 'https://cdn/legacy.jpg', alt: '' }]);
    // Тот же файл без mime, но у сообщения-документа — не картинка.
    const legacyDoc = m({ _id: 'ld', type: 'document', meta: { file: { url: 'https://cdn/legacy.bin' } } as any });
    expect(chatImageGallery([legacyDoc])).toEqual([]);
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

describe('cold-open height estimation', () => {
  const prev = m({ _id: 'p', userId: 'u1' }); // same author, same day → no separator, no group start

  it('mediaBoxHeight scales known dimensions into the MAX clamp (ImageMedia formula)', () => {
    // 1200×900 → scale 0.25 → 300×225
    expect(mediaBoxHeight(m({ meta: { width: 1200, height: 900 } }))).to.equal(225);
    // Portrait 600×1200 → scale 0.25 → 150×300
    expect(mediaBoxHeight(m({ meta: { width: 600, height: 1200 } }))).to.equal(300);
    // Smaller than MAX → untouched
    expect(mediaBoxHeight(m({ meta: { width: 200, height: 100 } }))).to.equal(100);
    // attachment-style dims under meta.file win over meta
    expect(mediaBoxHeight(m({ meta: { file: { width: 300, height: 300 }, width: 9999, height: 9999 } }))).to.equal(300);
    // Unknown dims → fixed 4:3 fallback box
    expect(mediaBoxHeight(m({}))).to.equal(Math.round(MEDIA_BOX_MAX * 0.75));
  });

  it('textBlockHeight counts soft-wrapped and explicit lines', () => {
    expect(textBlockHeight('')).to.equal(0);
    expect(textBlockHeight('hi')).to.equal(20);
    expect(textBlockHeight('a'.repeat(80))).to.equal(60); // ceil(80/35) = 3 lines
    expect(textBlockHeight('a\nb')).to.equal(40);
  });

  it('media row ≈ box height, not the 40px text default (the cascade killer)', () => {
    const photo = m({ _id: 'x', type: 'image', meta: { width: 1200, height: 900 } });
    const h = estimateMessageHeight(photo, prev, { mine: true });
    expect(h).to.be.greaterThan(200); // dominated by the 225px box
    expect(h).to.be.lessThan(260);
  });

  it('host bubble override (SlotSet.estimateHeight) replaces the bubble estimate', () => {
    const card = m({ _id: 'x', type: 'booking_create_landlord' });
    const h = estimateMessageHeight(card, prev, { mine: true, bubble: 140 });
    expect(h).to.equal(2 + 140); // mt-0.5 + card
  });

  it('service / deleted rows are compact regardless of type math', () => {
    expect(estimateMessageHeight(m({ _id: 'x', type: 'service', text: 'joined' }), prev, {})).to.equal(28);
    const deleted = m({ _id: 'x', type: 'image', removedAt: new Date(), meta: { width: 1200, height: 900 } });
    expect(estimateMessageHeight(deleted, prev, { mine: true })).to.equal(2 + 32);
  });

  it('a SINGLE attachment keeps exactly the pre-album height (no album math leaks in)', () => {
    // Зафиксировано числом по старой формуле: mt-0.5 (2) + mediaBoxHeight(1200×900 → 225) = 227.
    const one = m({ _id: 'x', type: 'image', meta: { file: { url: 'https://cdn/a.jpg', type: 'image/jpeg', width: 1200, height: 900 } } as any });
    expect(estimateMessageHeight(one, prev, { mine: true })).to.equal(227);
    // Легаси-вложение без mime не должно превратиться в строку документа (+56).
    const legacy = m({ _id: 'x', type: 'image', meta: { file: { url: 'https://cdn/a.jpg', width: 1200, height: 900 } } as any });
    expect(estimateMessageHeight(legacy, prev, { mine: true })).to.equal(227);
  });

  it('an album of 3 images is taller than a single image (grid, not one box)', () => {
    const files = [1, 2, 3].map((i) => ({ url: `https://cdn/${i}.jpg`, type: 'image/jpeg', width: 1200, height: 900 }));
    const album = m({ _id: 'x', type: 'image', meta: { files, file: files[0] } as any });
    expect(estimateMessageHeight(album, prev, { mine: true })).to.equal(2 + albumBoxHeight(3));
    expect(estimateMessageHeight(album, prev, { mine: true })).to.be.greaterThan(227);
  });

  it('a mixed album reserves the grid plus one document row per attached file', () => {
    const files = [
      { url: 'https://cdn/1.jpg', type: 'image/jpeg' },
      { url: 'https://cdn/2.jpg', type: 'image/jpeg' },
      { url: 'https://cdn/a.pdf', type: 'application/pdf' },
      { url: 'https://cdn/b.pdf', type: 'application/pdf' },
    ];
    const mixed = m({ _id: 'x', type: 'image', meta: { files, file: files[0] } as any });
    expect(estimateMessageHeight(mixed, prev, { mine: true })).to.equal(2 + albumBoxHeight(2) + 2 * DOC_ROW_H);
  });

  it('одна картинка + pdf: резервируется СЕТКА (её и рисует альбом), а не одиночная коробка', () => {
    // Вложений больше одного → слот выбирает AlbumMedia, значит и оценка обязана считать по
    // albumBoxHeight: одно превью ложится hero-ячейкой 16:9 (169), а не коробкой 1200×900 (225).
    const files = [
      { url: 'https://cdn/1.jpg', type: 'image/jpeg', width: 1200, height: 900 },
      { url: 'https://cdn/a.pdf', type: 'application/pdf' },
    ];
    const mixed = m({ _id: 'x', type: 'image', meta: { files, file: files[0] } as any });
    expect(estimateMessageHeight(mixed, prev, { mine: true })).to.equal(2 + albumBoxHeight(1) + DOC_ROW_H);
  });

  it('a document message with three attachments reserves three rows, not one', () => {
    const files = [1, 2, 3].map((i) => ({ url: `https://cdn/${i}.pdf`, type: 'application/pdf' }));
    const docs = m({ _id: 'x', type: 'document', meta: { files, file: files[0] } as any });
    expect(estimateMessageHeight(docs, prev, { mine: true })).to.equal(2 + 3 * DOC_ROW_H);
    // Без разобранных вложений всё равно одна строка — прежнее поведение.
    expect(estimateMessageHeight(m({ _id: 'x', type: 'document' }), prev, { mine: true })).to.equal(2 + DOC_ROW_H);
  });

  it('separators/divider/group-start add on top', () => {
    const first = m({ _id: 'x', type: 'text', text: 'hi', userId: 'u2' });
    // prev null → date separator (32) + group start (8) + incoming author line (18) + bubble (20 + 12)
    expect(estimateMessageHeight(first, null, { mine: false })).to.equal(32 + 8 + 18 + 32);
    // unread divider adds 32
    expect(estimateMessageHeight(first, null, { mine: false, unreadAnchorId: 'x' })).to.equal(32 + 32 + 8 + 18 + 32);
  });
});
