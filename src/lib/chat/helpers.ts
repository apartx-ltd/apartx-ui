import type { Message } from './types';
import { isReadByMe } from './replication/read-state';

export type DeliveryTick = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Media types rendered edge-to-edge (telegram-style): the bubble drops its padding and the media
 *  fills it, corner-clipped, with the time overlaid when there's no caption. Audio/document are NOT
 *  full-bleed — they stay in the normal padded stacked layout. */
export function isFullBleedMedia(type?: string): boolean {
  if (!type) return false;
  return type === 'image' || type === 'video' || type.indexOf('image') > -1 || type.indexOf('video') > -1;
}

/** True if anyone OTHER than me has read the message (legacy read[] / boolean). */
export function isReadByOther(message: Message, meUserId?: string): boolean {
  const read = message.read;
  if (read === true) return true;
  if (Array.isArray(read)) return read.some((u) => u !== meUserId);
  return false;
}

/**
 * Source-messenger key for a message, or null for a native in-app message. Reads `meta.messenger`
 * (explicit channel tag) first, then falls back to `meta.fromMessengerType` when `meta.fromMessenger`
 * is set (inbound WhatsApp/Telegram/OTA). Consumers map the key to a brand icon (see MessengerIcon).
 */
export function messengerKey(message: Message): string | null {
  const meta: any = message?.meta;
  if (!meta) return null;
  return meta.messenger || (meta.fromMessenger ? meta.fromMessengerType : null) || null;
}

/**
 * Truthful 4-state WhatsApp-style tick for the current user's OWN messages:
 *   ⏱ pending   — optimistic echo, server has NOT acked yet (`sendState: 'sending'`)
 *   ✓ sent      — server accepted it, but the counterpart's DEVICE has not received it yet
 *   ✓✓ delivered — counterpart's device received it (`counterpartDeliveredSeq >= seq`)
 *   ✓✓ read      — counterpart opened/read it (`counterpartReadSeq >= seq`)
 *
 * `delivered` is truthful device-received, NOT merely "server has it": the receiver's background
 * dialogs stream acks `message.delivered` when the message lands on their device (chat closed or
 * open), which bumps the sender's per-dialog `counterpartDeliveredSeq`. `sent` therefore correctly
 * means "server has it, not yet on their device" — mirroring WhatsApp's single check. Both
 * watermarks are compared against the message `seq`; until seq/watermarks replicate, the legacy
 * `read[]` still lifts an own message to `read`, otherwise it reads as `sent`.
 *
 * Incoming / pre-migration messages keep the server `delivery` aggregate, then `read[]`.
 */
export function deliveryTick(
  message: Message,
  meUserId?: string,
  counterpartReadSeq?: number,
  counterpartDeliveredSeq?: number,
): DeliveryTick {
  if (message.delivery === 'failed' || message.sendState === 'failed') return 'failed';
  if (meUserId && message.userId === meUserId) {
    // Optimistic local echo, not yet accepted by the server.
    if (message.sendState === 'sending') return 'pending';
    // Confirmed own message: read > delivered > sent, each gated on the counterpart watermark
    // reaching this message's seq.
    if (typeof message.seq === 'number') {
      if (typeof counterpartReadSeq === 'number' && counterpartReadSeq >= message.seq) return 'read';
      if (typeof counterpartDeliveredSeq === 'number' && counterpartDeliveredSeq >= message.seq) return 'delivered';
    }
    // Until seq/watermarks replicate: legacy read[] lifts to read, else the server has it = sent.
    return isReadByOther(message, meUserId) ? 'read' : 'sent';
  }
  // Incoming / pre-migration message: preserve prior behavior — `delivery` first, then read[].
  switch (message.delivery) {
    case 'read': return 'read';
    case 'delivered': return 'delivered';
    case 'queued':
    case 'sent': return 'sent';
    default: return isReadByOther(message, meUserId) ? 'read' : 'sent';
  }
}

/**
 * Ordered list of viewable image attachments in a message set — the gallery a chat lightbox opens
 * over. Includes only `image`-type messages whose upload has resolved to a file URL (skips videos and
 * still-uploading optimistic sends, which have only a transient preview blob). `src` mirrors what
 * ImageMedia renders, so a clicked thumbnail's URL indexes straight into this list.
 */
export function chatImageGallery(messages: readonly Message[]): { src: string; alt: string }[] {
  const out: { src: string; alt: string }[] = [];
  for (const m of messages) {
    if ((m.type || '') !== 'image') continue;
    const src = (m.meta as any)?.file?.url;
    if (typeof src === 'string' && src) out.push({ src, alt: '' });
  }
  return out;
}

/**
 * Human duration for a media badge/time display. Seconds → `m:ss`, or `h:mm:ss` past an hour.
 * Empty string for missing/invalid input (absent/negative/NaN) so callers can render nothing.
 */
export function formatDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** First message of a visual group (author changed from the previous message). */
export function groupStart(message: Message, prev: Message | null): boolean {
  if (!prev) return true;
  return message.userId !== prev.userId;
}

/** Last message of a visual group (author changes on the next message, or none follows). */
export function groupEnd(message: Message, next: Message | null): boolean {
  if (!next) return true;
  return message.userId !== next.userId;
}

/** Show a date separator when this message is on a different calendar day than the previous. */
export function showDate(message: Message, prev: Message | null): boolean {
  if (!prev) return true;
  const a = message.createdAt, b = prev.createdAt;
  return a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
}

/**
 * First incoming unread message id (for the unread divider), else null. Parity with the admin store:
 * skip own messages and `type==='service'`; unread = `read[]` without me, or boolean `read === false`
 * (an absent `read` counts as read — matches admin's `_updateUnreadIndex`).
 */
export function firstUnreadId(messages: readonly Message[], meUserId?: string, lastReadSeq?: number | null): string | null {
  for (const msg of messages) {
    if (msg.userId === meUserId) continue;
    if (msg.type === 'service') continue;
    if (!isReadByMe(msg as any, meUserId ?? '', lastReadSeq)) return msg._id;
  }
  return null;
}

/**
 * Unread-divider anchor with frozen "entry" semantics: the first incoming message that was unread
 * AND already existed when the chat was opened. `entryLrs` is the read watermark at open; `entryMaxSeq`
 * is the chat's newest seq at open (the ceiling). A message qualifies only if `seq <= entryMaxSeq`
 * (so messages arriving WHILE viewing never become the anchor) and it is not read-by-me relative to
 * `entryLrs`. Reactive-safe: given frozen bounds it is deterministic over the loaded message set, so
 * backlog that loads a beat after open() surfaces the divider without it chasing live arrivals.
 * With `entryMaxSeq` null it degrades to `firstUnreadId` (no ceiling).
 */
export function unreadAnchor(
  messages: readonly Message[],
  meUserId: string | undefined,
  entryLrs: number | null | undefined,
  entryMaxSeq: number | null | undefined,
): string | null {
  for (const msg of messages) {
    if (msg.userId === meUserId) continue;
    if (msg.type === 'service') continue;
    if (entryMaxSeq != null && msg.seq != null && msg.seq > entryMaxSeq) continue; // arrived after entry
    if (!isReadByMe(msg as any, meUserId ?? '', entryLrs)) return msg._id;
  }
  return null;
}

/** Count of incoming unread messages (skip own + `type==='service'`) — same predicate as
 *  `firstUnreadId`. Drives the unread badge on the scroll-to-bottom button. */
export function countUnread(messages: readonly Message[], meUserId?: string, lastReadSeq?: number | null): number {
  let n = 0;
  for (const msg of messages) {
    if (msg.userId === meUserId) continue;
    if (msg.type === 'service') continue;
    if (!isReadByMe(msg as any, meUserId ?? '', lastReadSeq)) n++;
  }
  return n;
}

/** Newer of two read-watermark candidates: by `seq` when both have it, else by `createdAt`. */
export function newerWatermark(a: Message | null, b: Message): Message {
  if (!a) return b;
  if (a.seq != null && b.seq != null) return b.seq > a.seq ? b : a;
  return b.createdAt.getTime() > a.createdAt.getTime() ? b : a;
}

// --- Cold-open row-height estimation --------------------------------------------------------
// Feeds `VirtualList.estimateSize` so virtua's first positioning pass works from near-final
// heights instead of its flat ~40px default. Wildly-wrong defaults are what cascade into the
// visible correction churn on slow devices (measure visible → shift → newly-visible unmeasured
// rows → measure → shift…). Estimates only need to be CLOSE: ±20px is corrected invisibly,
// 40px-vs-300px flashes. Numbers mirror the real Message.svelte/slot layout (Tailwind spacing,
// body-md 20px line-height, ImageMedia's MAX=300 clamp) — keep them in sync when that changes.

/** Max media box edge — mirrors ImageMedia/VideoMedia `MAX`. */
export const MEDIA_BOX_MAX = 300;
const LINE_H = 20; // text-body-md line height
const BUBBLE_PAD_Y = 12; // bubble px-2 py-1.5 → 6px top + 6px bottom
const CHARS_PER_LINE = 35; // ≈ chars per body-md line in an 80%-width mobile bubble

/** Rendered media box height per ImageMedia's reserve formula: scale w×h into MAX, or the fixed
 *  4:3 fallback box when dimensions are unknown. */
export function mediaBoxHeight(m: Message): number {
  const meta: any = m.meta;
  const w = meta?.file?.width ?? meta?.width;
  const h = meta?.file?.height ?? meta?.height;
  if (!w || !h) return Math.round(MEDIA_BOX_MAX * 0.75);
  const scale = Math.min(1, MEDIA_BOX_MAX / w, MEDIA_BOX_MAX / h);
  return Math.round(h * scale);
}

/** Estimated rendered height of a text block (explicit newlines + soft wrap by CHARS_PER_LINE). */
export function textBlockHeight(text?: string | null): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  let lines = 0;
  for (const seg of t.split('\n')) lines += Math.max(1, Math.ceil(seg.length / CHARS_PER_LINE));
  return lines * LINE_H;
}

/**
 * Estimated total row height for a message as ChatMessageList renders it: date separator + unread
 * divider + group margin + bubble. `ctx.bubble` (when a number) REPLACES the bubble estimate —
 * hosts supply it for registered card types via `SlotSet.estimateHeight` (a booking card's height
 * is app knowledge the kit can't derive).
 */
export function estimateMessageHeight(
  m: Message,
  prev: Message | null,
  ctx: { unreadAnchorId?: string | null; isLast?: boolean; mine?: boolean; bubble?: number } = {},
): number {
  let h = 0;
  if (showDate(m, prev)) h += 32; // my-2 (16) + text-xs line (16)
  if (ctx.unreadAnchorId && m._id === ctx.unreadAnchorId) h += 32; // my-1 + py-1 (16) + text-xs (16)
  if (m.type === 'service') return h + 28; // my-1 (8) + body-sm line (20)
  h += groupStart(m, prev) ? 8 : 2; // row mt-2 / mt-0.5
  if (ctx.isLast) h += 8; // pb-2 on the last row (ChatMessageList wrapper)
  if (m.removedAt) return h + 32; // one-line italic bubble (py-1.5 + text-sm)
  if (ctx.bubble != null) return h + ctx.bubble;
  const meta: any = m.meta;
  if (meta?.replyMessage) h += 40; // reply-quote header block
  if (!ctx.mine && groupStart(m, prev)) h += 18; // incoming group-start author line
  if (isFullBleedMedia(m.type)) {
    h += mediaBoxHeight(m);
    const caption = textBlockHeight(m.text);
    if (caption) h += caption + BUBBLE_PAD_Y;
    return h;
  }
  if (m.type === 'audio' || m.type === 'document') return h + 56; // icon row + paddings
  // Plain text (and unknown types without a host estimate): floated-time text bubble.
  return h + Math.max(LINE_H, textBlockHeight(m.text)) + BUBBLE_PAD_Y;
}

export interface ReadFlusher {
  /** Record a rendered incoming-unread message; schedules a debounced flush. */
  note(m: Message): void;
  /** Flush the accumulated watermark IF currently viewing — call on focus/visibility regain. */
  flushIfViewing(): void;
  /** Cancel any pending timer (component teardown). */
  dispose(): void;
}

/**
 * Debounced read-watermark flusher with a "viewing" gate. `note()` always keeps the NEWEST rendered
 * unread (so nothing is lost while the window is unviewed); the debounced flush calls `markRead` only
 * when `isViewing()` is true, otherwise the watermark stays pending until `flushIfViewing()` fires on
 * the next focus/visibility regain. This is why a message that merely renders in a backgrounded or
 * unfocused window is NOT marked read until the user actually returns to it. Pure/injectable (timers +
 * `isViewing` are parameters) so it unit-tests without a DOM or component harness.
 */
export function createReadFlusher(opts: {
  markRead: (m: Message) => void;
  isViewing: () => boolean;
  debounceMs: number;
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (t: ReturnType<typeof setTimeout>) => void;
}): ReadFlusher {
  const st = opts.setTimeoutFn ?? setTimeout;
  const ct = opts.clearTimeoutFn ?? clearTimeout;
  let pending: Message | null = null;
  let flushed: Message | null = null; // highest watermark already sent to markRead — idempotency memory
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!pending || !opts.isViewing()) return; // withhold while unviewed; watermark stays pending
    opts.markRead(pending);
    flushed = pending; // remember it so re-renders of the same message don't re-issue markRead
    pending = null;
  };
  return {
    note(m: Message) {
      // Idempotency: read-on-render re-fires for messages that are already read once the dialog
      // watermark round-trips back. Without this guard every re-render re-issues markRead → the
      // server always self-pushes `::chats` → dialog re-pull → re-render → ∞ (the DDP pullDialogs
      // loop). Skip anything not strictly newer than what we've already flushed.
      if (flushed && newerWatermark(flushed, m) === flushed) return;
      pending = newerWatermark(pending, m);
      if (timer) return;
      timer = st(flush, opts.debounceMs);
    },
    flushIfViewing() {
      if (opts.isViewing()) flush();
    },
    dispose() {
      if (timer) { ct(timer); timer = null; }
    },
  };
}
