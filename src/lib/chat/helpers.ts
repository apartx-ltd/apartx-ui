import type { Message } from './types';
import { isReadByMe } from './replication/read-state';

export type DeliveryTick = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** True if anyone OTHER than me has read the message (legacy read[] / boolean). */
export function isReadByOther(message: Message, meUserId?: string): boolean {
  const read = message.read;
  if (read === true) return true;
  if (Array.isArray(read)) return read.some((u) => u !== meUserId);
  return false;
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (!pending || !opts.isViewing()) return; // withhold while unviewed; watermark stays pending
    opts.markRead(pending);
    pending = null;
  };
  return {
    note(m: Message) {
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
