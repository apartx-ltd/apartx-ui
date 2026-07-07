import { liveQuery, type Observable } from 'dexie';
import type { ChatTransport, LiveEvent, Message, OutgoingDraft } from '../types';
import type { ChatDatabase, StoredMessage } from './chat-db';
import { makeSnapshotDiffer } from './live-query.svelte';

export interface ReplicatedTransportDeps {
  db: ChatDatabase;
  chatId: string;
  /** Backward history page: newest `limit` messages with createdAt < before (before omitted = newest). */
  fetchHistory: (a: { chatId: string; before?: Date; limit: number }) => Promise<Message[]>;
  /** Forward tail (Task 2): messages with createdAt > since. */
  fetchUpdates: (a: { chatId: string; since?: Date; sinceId?: string; limit: number }) => Promise<Message[]>;
  send: (draft: OutgoingDraft) => Promise<Message>;
  markReadOnServer: (a: { chatId: string; toCreatedAt: Date }) => Promise<void>;
  /** Host push signal — invoke onNews(chatId) when the server has new/changed messages (Task 2). */
  subscribeSignal: (onNews: (chatId: string) => void) => () => void;
  /** Poll fallback interval (Task 2). Default 20_000. */
  pollIntervalMs?: number;
  pageSize?: number;
}

const toMessage = (d: StoredMessage): Message => d as unknown as Message;

// The transport's fetch/store loops fail silently while OFFLINE by design (a later signal/poll retries).
// But a store-side fault that persists regardless of connectivity — e.g. a non-structured-cloneable value
// reaching Dexie's bulkPut (DataCloneError) — would otherwise be swallowed forever, leaving the chat blank.
// Surface such errors when the browser believes it is online; stay quiet on genuine offline failures.
const logUnexpected = (where: string, chatId: string, e: unknown): void => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  console.error(`[chat] ${where} failed`, chatId, e);
};

export function createReplicatedTransport(deps: ReplicatedTransportDeps): ChatTransport {
  const { db, chatId } = deps;
  const pageSize = deps.pageSize ?? 25;
  let windowOldest: Date | null = null;
  let historyExhausted = false;
  let windowReady = false;
  let deferredBackfill: (() => void) | null = null;
  // Invoked once fetchOlder establishes the window: re-surfaces any in-window Dexie rows the
  // pre-windowReady emit gate dropped (and the differ already baselined), so a message written
  // during the subscribe→fetchOlder gap can't be stranded in Dexie yet invisible in the window.
  let deferredReconcile: (() => void) | null = null;

  // Persisted per-chat checkpoint (mirrors the dialogs Replication's `_replicationMeta`). Without
  // it every fresh page-load spun a NEW transport with cursor=undefined + historyExhausted=false,
  // so a warm chat still cost: tailSync re-fetching the newest page AND fetchOlder re-probing the
  // network for the initial + unread-expansion pages (~3 `findAllNew` per open, all returning the
  // same cached rows). Resuming from the checkpoint makes a warm reopen serve fetchOlder from Dexie
  // (0 network) and tailSync a single empty incremental check. Reads/writes are best-effort: on a
  // fresh IndexedDB / offline fault we fall back to the full-window behaviour (seed undefined).
  const META_TAIL = `msgTail:${chatId}`;       // { updatedAt, id } — forward (updatedAt,_id) tail cursor
  const META_HIST = `msgHistory:${chatId}`;    // { oldestAt, done } — backward progress + exhausted latch
  let seedCursorAt: Date | undefined;
  let seedCursorId: string | undefined;
  // Furthest-back createdAt fetched so far. Persisted so an INTERRUPTED backfill (network error /
  // tab close) resumes from where it stopped on the next open instead of re-walking history from
  // the newest page: backfill seeds its cursor from this floor, and `done` latches only at the true
  // start. Defaults to the Dexie oldest row when unset (data == position), so it degrades safely.
  let historyOldest: Date | undefined;
  const metaReady = (async () => {
    try {
      const [tail, hist] = await Promise.all([
        db._replicationMeta.get(META_TAIL),
        db._replicationMeta.get(META_HIST),
      ]);
      if (tail?.value?.updatedAt) { seedCursorAt = new Date(tail.value.updatedAt); seedCursorId = tail.value.id; }
      if (hist?.value?.oldestAt) historyOldest = new Date(hist.value.oldestAt);
      if (hist?.value?.done === true) historyExhausted = true;
    } catch { /* first run / offline: keep the full-window fallback */ }
  })();
  const persistTail = (at: Date, id: string): void => {
    void db._replicationMeta.put({ key: META_TAIL, value: { updatedAt: at, id } }).catch(() => {});
  };
  // Record backward progress: advance the oldest-fetched floor and/or latch `done`. Called after
  // every older page so an interrupted backfill can resume from `oldestAt`.
  const persistHistory = (oldestAt: Date | undefined, done: boolean): void => {
    if (oldestAt && (!historyOldest || oldestAt.getTime() < historyOldest.getTime())) historyOldest = oldestAt;
    void db._replicationMeta.put({ key: META_HIST, value: { oldestAt: historyOldest ?? null, done } }).catch(() => {});
  };

  // Read the newest `limit` Dexie rows with createdAt < upper (upper omitted = newest). Returns oldest→newest.
  // Backward cursor is `createdAt` (strict `<` on both Dexie and the network `before`), matching the server's findAllNew cursor. Assumes per-chat createdAt ordering with gap-free `seq`; the one edge this cursor cannot disambiguate is >`limit` messages sharing an identical createdAt straddling a page boundary (equal-timestamp rows at the anchor are excluded next page). Acceptable for organic chat; a fully robust fix needs a compound (createdAt,_id) cursor coordinated with the server — out of scope here.
  const readDexie = async (upper: Date | undefined, limit: number): Promise<StoredMessage[]> => {
    const lo: any = [chatId, new Date(0)];
    const hi: any = [chatId, upper ?? new Date(8.64e15)];
    const rows = await db.chatMessages
      .where('[chatId+createdAt]').between(lo, hi, true, false) // createdAt in [0, upper)
      .reverse().limit(limit).toArray();                        // newest `limit` older than upper
    return rows.reverse();                                      // oldest→newest
  };

  return {
    subscribeLive(_chatId, onEvent) {
      const pollIntervalMs = deps.pollIntervalMs ?? 20_000;
      const diff = makeSnapshotDiffer<StoredMessage>();
      const known = new Set<string>();
      const q = liveQuery(() => db.chatMessages.where('chatId').equals(chatId).toArray()) as Observable<StoredMessage[]>;
      const sub = q.subscribe({
        next: (rows) => {
          const { upserts, deletedIds } = diff(rows); // always baseline the differ, even before the window is ready
          // Bounded emit: nothing is surfaced until the first fetchOlder establishes the window (windowReady) — this prevents the Dexie liveQuery's initial warm-cache snapshot and the background fill from flooding the visible list regardless of subscribe/fetch call order. Once ready: suppress rows older than windowOldest; edits/deletes of known (loaded) rows still pass; when windowOldest is null the chat is genuinely empty and new live rows pass through. The initial window itself always arrives via fetchOlder's return value, not this stream.
          // NOTE: dropping here still ADVANCES the differ baseline (line above), so a row written to
          // Dexie during this pre-ready gap is consumed and never re-emitted. `reconcile` (invoked when
          // fetchOlder flips windowReady) re-surfaces any such in-window rows so they can't be stranded.
          if (!windowReady) return; // window not established yet → suppress (initial page arrives via fetchOlder's return / reconcile)
          for (const m of upserts) {
            const inWindow = windowOldest == null || m.createdAt.getTime() >= windowOldest.getTime() || known.has(m._id);
            if (!inWindow) continue;
            known.add(m._id);
            if (m.removedAt) onEvent({ type: 'delete', targetId: m._id, hard: false } as LiveEvent);
            else onEvent({ type: 'upsert', message: toMessage(m) } as LiveEvent);
          }
          for (const id of deletedIds) { known.delete(id); onEvent({ type: 'delete', targetId: id, hard: true } as LiveEvent); }
        },
      });

      // Forward tail: pull messages updated since the (updatedAt,_id) cursor on live signal + poll.
      // fetchUpdates returns messages after the compound cursor (INCLUDING tombstones) — catches new/edited/deleted.
      let cursorAt: Date | undefined;
      let cursorId: string | undefined;
      let seeded = false;
      let tailing = false;
      let pending = false;
      const tailSync = async () => {
        // Resume from the persisted checkpoint on the first run so a warm reopen probes only for
        // messages newer than the last-seen (updatedAt,_id) — usually an empty round — instead of
        // re-fetching the newest page from since=undefined.
        await metaReady;
        if (!seeded) { seeded = true; if (seedCursorAt) { cursorAt = seedCursorAt; cursorId = seedCursorId; } }
        // Trailing re-sync: a signal/poll arriving during an in-flight sync sets `pending` instead of being
        // dropped, and the loop re-runs once the current fetch settles — so no update waits a full poll interval.
        if (tailing) { pending = true; return; }
        tailing = true;
        let advanced = false;
        try {
          do {
            pending = false;
            // Drain to a partial page. The server pages with a compound (updatedAt,_id) cursor
            // (mirrors pullByCheckpoint): a read that bumps MANY messages to one identical
            // updatedAt is walked gap-free and bounded to pageSize per round-trip, instead of
            // stranding the tie-group beyond a strict `updatedAt > since` limit (read tick stuck
            // grey until reload) or pulling the whole group unbounded. `sinceId` breaks the tie.
            let full = true;
            while (full) {
              const upd = await deps.fetchUpdates({ chatId, since: cursorAt, sinceId: cursorId, limit: pageSize });
              full = upd.length === pageSize;
              if (!upd.length) break;
              const rows = upd.map((m) => ({ ...m, updatedAt: (m as any).updatedAt ?? m.createdAt })) as unknown as StoredMessage[];
              await db.chatMessages.bulkPut(rows);
              // Advance to the max (updatedAt,_id) tuple seen — order-independent, so it holds
              // whichever order the server returns the page in.
              for (const r of rows) {
                const rt = r.updatedAt.getTime();
                const ct = cursorAt ? cursorAt.getTime() : -1;
                if (!cursorAt || rt > ct || (rt === ct && (cursorId == null || r._id > cursorId))) {
                  cursorAt = r.updatedAt; cursorId = r._id; advanced = true;
                }
              }
            }
          } while (pending);
          // Persist the advanced tail so the next transport (fresh page-load) resumes here.
          if (advanced && cursorAt && cursorId) persistTail(cursorAt, cursorId);
        } catch (e) { logUnexpected('tailSync', chatId, e); } finally { tailing = false; }
      };
      const offSignal = deps.subscribeSignal((cid) => { if (cid === chatId) void tailSync(); });
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false; // set on unsubscribe; guards poll re-arming (below) and backfill
      // Guard both entry and re-arm: without the `if (stopped)` checks, a tick already awaiting
      // tailSync() at unsubscribe would spawn a fresh timer that nothing clears → orphan poll.
      const schedulePoll = () => {
        if (stopped) return;
        pollTimer = setTimeout(async () => { await tailSync(); if (!stopped) schedulePoll(); }, pollIntervalMs);
      };
      void tailSync();
      schedulePoll();

      // Background backward fill for full offline (throttled, self-stopping on unsubscribe or exhaustion).
      const backfill = async () => {
        try {
          // Resume from the persisted floor (survives a Dexie that was partly cleared); fall back to
          // the oldest cached row. Whichever is further back wins, so we never re-walk covered pages.
          const dexieOldest = (await db.chatMessages
            .where('[chatId+createdAt]').between([chatId, new Date(0)], [chatId, new Date(8.64e15)], true, false)
            .first())?.createdAt;
          let cursor = historyOldest && (!dexieOldest || historyOldest.getTime() <= dexieOldest.getTime())
            ? historyOldest
            : dexieOldest;
          while (!stopped && !historyExhausted) {
            const net = await deps.fetchHistory({ chatId, before: cursor, limit: pageSize });
            const done = net.length < pageSize;
            if (done) historyExhausted = true;
            if (!net.length) { persistHistory(cursor, true); break; }
            const rows = net.map((m) => ({ ...m, updatedAt: (m as any).updatedAt ?? m.createdAt })) as unknown as StoredMessage[];
            await db.chatMessages.bulkPut(rows);
            cursor = rows.reduce((min, r) => (r.createdAt.getTime() < min.getTime() ? r.createdAt : min), rows[0].createdAt);
            persistHistory(cursor, done); // record backward progress after EACH page so an interruption resumes here
            await new Promise((r) => setTimeout(r, 250));
          }
        } catch (e) { logUnexpected('backfill', chatId, e); }
      };
      // Defer the background fill until the window is ready (handles BOTH call orders — subscribe-before-fetch
      // AND subscribe-after-fetch). fetchOlder invokes the deferred hook once it establishes windowReady.
      const beginBackfill = () => { void backfill(); };
      if (windowReady) beginBackfill();
      else deferredBackfill = beginBackfill;

      // Reconcile the emit gate against Dexie once the window is ready. The pre-windowReady gate
      // drops live emissions but still advances the differ baseline, so a row written to Dexie during
      // the subscribe→fetchOlder gap (e.g. tailSync's catch-up on re-open) is consumed and never
      // re-emitted — present in Dexie but absent from the rendered window (the "reopened chat shows
      // no new messages / no unread divider" bug). Emitting every in-window row not yet surfaced
      // closes that race; onEvent upserts are id-keyed/idempotent, so re-emitting the fetchOlder seed
      // is harmless. Rows arriving AFTER this run are handled by the normal (now windowReady) gate.
      const reconcile = async () => {
        try {
          const rows = await db.chatMessages.where('chatId').equals(chatId).toArray();
          for (const m of rows) {
            const inWindow = windowOldest == null || m.createdAt.getTime() >= windowOldest.getTime() || known.has(m._id);
            if (!inWindow || known.has(m._id)) continue;
            known.add(m._id);
            if (m.removedAt) onEvent({ type: 'delete', targetId: m._id, hard: false } as LiveEvent);
            else onEvent({ type: 'upsert', message: toMessage(m) } as LiveEvent);
          }
        } catch (e) { logUnexpected('reconcile', chatId, e); }
      };
      if (windowReady) void reconcile();
      else deferredReconcile = reconcile;

      return () => { sub.unsubscribe(); offSignal(); if (pollTimer) clearTimeout(pollTimer); stopped = true; deferredBackfill = null; deferredReconcile = null; };
    },

    async fetchOlder({ before, limit }) {
      // Resume the persisted history-exhausted latch first, so a warm reopen whose backward history
      // was already fully cached reads purely from Dexie and never re-probes fetchHistory.
      await metaReady;
      let page = await readDexie(before, limit);
      if (page.length < limit && !historyExhausted) {
        try {
          const net = await deps.fetchHistory({ chatId, before: page.length ? page[0].createdAt : before, limit });
          // fetchHistory's contract is "short page ⇒ end of history": the server returns up to `limit` newest messages older than `before` and never under-fills for a non-terminal reason (no server-side truncation/rate-limit), so a short page reliably means no older history remains. The latch persists across transports via META_HIST.
          const done = net.length < limit;
          if (done) historyExhausted = true;
          if (net.length) {
            const rows = net.map((m) => ({ ...m, updatedAt: (m as any).updatedAt ?? m.createdAt })) as unknown as StoredMessage[];
            await db.chatMessages.bulkPut(rows);
            const oldest = rows.reduce((min, r) => (r.createdAt.getTime() < min.getTime() ? r.createdAt : min), rows[0].createdAt);
            persistHistory(oldest, done); // record backward progress (+ done latch) so a fresh load resumes here
            page = await readDexie(before, limit);
          } else if (done) {
            persistHistory(undefined, true);
          }
        } catch (e) { logUnexpected('fetchOlder', chatId, e); }
      }
      if (page.length) {
        const oldest = page[0].createdAt;
        if (!windowOldest || oldest.getTime() < windowOldest.getTime()) windowOldest = oldest;
      }
      // First fetchOlder establishes the window (even if empty) → unblock live emit, reconcile any
      // rows the pre-ready gate dropped, and start the deferred backfill.
      if (!windowReady) {
        windowReady = true;
        const rc = deferredReconcile; deferredReconcile = null; void rc?.();
        const s = deferredBackfill; deferredBackfill = null; s?.();
      }
      return page.map(toMessage);
    },

    async sendMessage(draft) { return deps.send(draft); },

    async markRead({ message }) {
      await deps.markReadOnServer({ chatId, toCreatedAt: message.createdAt });
    },
  };
}
