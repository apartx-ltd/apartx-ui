import type { Message } from './types';
import { isReadByMe } from './replication/read-state';

export type DeliveryTick = 'sent' | 'delivered' | 'read' | 'failed';

/** True if anyone OTHER than me has read the message (legacy read[] / boolean). */
export function isReadByOther(message: Message, meUserId?: string): boolean {
  const read = message.read;
  if (read === true) return true;
  if (Array.isArray(read)) return read.some((u) => u !== meUserId);
  return false;
}

/**
 * 3-state WhatsApp-style tick (feature B). For the current user's own messages: an unsent
 * local echo (no `seq`) is 'sent'; a server-sequenced message is at least 'delivered', flipping
 * to 'read' when the per-dialog watermark `counterpartReadSeq` reaches its `seq` (reactive,
 * strand-proof) — with legacy `read[]` as the stand-in until that watermark replicates. Incoming
 * / pre-migration messages fall back to the server `delivery` field, then `read[]`.
 */
export function deliveryTick(
  message: Message,
  meUserId?: string,
  counterpartReadSeq?: number,
): DeliveryTick {
  if (message.delivery === 'failed') return 'failed';
  // Own, server-sequenced message: a `seq` means the server accepted and fanned it out, so it
  // is AT LEAST 'delivered' — it must never fall back to 'sent'. Read vs delivered is decided by
  // the counterpart watermark (reactive, strand-proof); until that watermark replicates to this
  // client, the legacy read[] stands in. Without this watermark-independent 'delivered' floor, a
  // message whose `counterpartReadSeq` hasn't reached the client yet renders 'sent' and then
  // jumps straight to 'read' when the read arrives (the watermark's first appearance is already
  // >= seq) — visibly SKIPPING the grey-double 'delivered' state. The optimistic local echo has
  // no `seq` yet, so it still shows 'sent' via the fall-through below.
  if (meUserId && message.userId === meUserId && typeof message.seq === 'number') {
    if (typeof counterpartReadSeq === 'number') return counterpartReadSeq >= message.seq ? 'read' : 'delivered';
    return isReadByOther(message, meUserId) ? 'read' : 'delivered';
  }
  // No own-message decision available (incoming message, local echo with no seq, or
  // pre-migration data): preserve prior behavior — `delivery` first, then legacy read[].
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
