/**
 * Delivered-acker — the receiver side of the "delivered" watermark. Watches the always-on
 * dialogs stream and, whenever a dialog's newest message is authored by the COUNTERPART (i.e. this
 * device just received one of their messages — chat open or closed), debounce-acks
 * `markDelivered({ chatId, uptoSeq })` up to that message's `seq`. The server projects this onto the
 * SENDER's per-dialog `counterpartDeliveredSeq`, flipping their tick to ✓✓ delivered before they are
 * read. Mirror of `createReadFlusher` in structure; pure and injectable (timers are params) so it
 * unit-tests without a DOM or Dexie.
 *
 * Own newest messages are skipped: acking my own send would be a no-op storm (their view of my
 * delivered position is only meaningful for messages I RECEIVED from them). Per-chat monotonic:
 * never re-acks a seq already acked or already scheduled.
 */
export interface DeliveredAcker {
  /** Feed the current dialogs snapshot; schedules acks for freshly received counterpart messages. */
  note(dialogs: readonly any[], meUserId?: string): void;
  /** Cancel any pending flush (teardown). */
  dispose(): void;
}

export function createDeliveredAcker(opts: {
  ack: (a: { chatId: string; uptoSeq: number }) => void;
  debounceMs?: number;
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (t: ReturnType<typeof setTimeout>) => void;
}): DeliveredAcker {
  const st = opts.setTimeoutFn ?? setTimeout;
  const ct = opts.clearTimeoutFn ?? clearTimeout;
  const debounceMs = opts.debounceMs ?? 400;
  const acked = new Map<string, number>();   // chatId → last seq we've acked
  const pending = new Map<string, number>();  // chatId → seq awaiting a debounced ack
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    for (const [chatId, seq] of pending) {
      if (seq > (acked.get(chatId) ?? 0)) {
        acked.set(chatId, seq);
        opts.ack({ chatId, uptoSeq: seq });
      }
    }
    pending.clear();
  };

  return {
    note(dialogs, meUserId) {
      for (const d of dialogs) {
        const lm = d?.chat?.lastMessage ?? d?.lastMessage;
        const seq = lm?.seq;
        if (typeof seq !== 'number') continue;
        const chatId = d?.chatId ?? d?.chat?._id;
        if (!chatId) continue;
        // Only ack when the newest message is from the counterpart — a genuine receive event.
        if (meUserId && lm?.userId === meUserId) continue;
        if (seq > (acked.get(chatId) ?? 0) && seq > (pending.get(chatId) ?? 0)) {
          pending.set(chatId, seq);
          if (!timer) timer = st(flush, debounceMs);
        }
      }
    },
    dispose() {
      if (timer) { ct(timer); timer = null; }
      pending.clear();
    },
  };
}
