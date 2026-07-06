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
  fetchUpdates: (a: { chatId: string; since?: Date; limit: number }) => Promise<Message[]>;
  send: (draft: OutgoingDraft) => Promise<Message>;
  markReadOnServer: (a: { chatId: string; toCreatedAt: Date }) => Promise<void>;
  /** Host push signal — invoke onNews(chatId) when the server has new/changed messages (Task 2). */
  subscribeSignal: (onNews: (chatId: string) => void) => () => void;
  /** Poll fallback interval (Task 2). Default 20_000. */
  pollIntervalMs?: number;
  pageSize?: number;
}

const toMessage = (d: StoredMessage): Message => d as unknown as Message;

export function createReplicatedTransport(deps: ReplicatedTransportDeps): ChatTransport {
  const { db, chatId } = deps;
  const pageSize = deps.pageSize ?? 25;
  let windowOldest: Date | null = null;
  let historyExhausted = false;
  let windowReady = false;
  let deferredBackfill: (() => void) | null = null;

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
          if (!windowReady) return; // window not established yet → suppress (initial page arrives via fetchOlder's return)
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

      // Forward tail: pull messages updated since the watermark on live signal + poll.
      // fetchUpdates returns messages with updatedAt > since (INCLUDING tombstones) — catches new/edited/deleted.
      let tailWatermark: Date | undefined;
      let tailing = false;
      let pending = false;
      const tailSync = async () => {
        // Trailing re-sync: a signal/poll arriving during an in-flight sync sets `pending` instead of being
        // dropped, and the loop re-runs once the current fetch settles — so no update waits a full poll interval.
        if (tailing) { pending = true; return; }
        tailing = true;
        try {
          do {
            pending = false;
            // Watermark cursor is strict updatedAt > since. Edge: if >pageSize messages share an identical updatedAt ms and the page boundary falls exactly on that ms, a sibling equal to the watermark is excluded and not re-fetched by later tails (they also use strict >). Extremely rare (needs a burst > pageSize with a duplicate ms at the boundary); recovered on chat re-open (fresh pull). A fully robust fix needs a compound (updatedAt,_id) cursor coordinated with the server — out of scope.
            const upd = await deps.fetchUpdates({ chatId, since: tailWatermark, limit: pageSize });
            if (upd.length) {
              const rows = upd.map((m) => ({ ...m, updatedAt: (m as any).updatedAt ?? m.createdAt })) as unknown as StoredMessage[];
              await db.chatMessages.bulkPut(rows);
              for (const r of rows) if (!tailWatermark || r.updatedAt.getTime() > tailWatermark.getTime()) tailWatermark = r.updatedAt;
            }
          } while (pending);
        } catch { /* offline — retry on next signal/poll */ } finally { tailing = false; }
      };
      const offSignal = deps.subscribeSignal((cid) => { if (cid === chatId) void tailSync(); });
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      const schedulePoll = () => { pollTimer = setTimeout(async () => { await tailSync(); schedulePoll(); }, pollIntervalMs); };
      void tailSync();
      schedulePoll();

      // Background backward fill for full offline (throttled, self-stopping on unsubscribe or exhaustion).
      let stopped = false;
      const backfill = async () => {
        try {
          let cursor = (await db.chatMessages
            .where('[chatId+createdAt]').between([chatId, new Date(0)], [chatId, new Date(8.64e15)], true, false)
            .first())?.createdAt;
          while (!stopped && !historyExhausted) {
            const net = await deps.fetchHistory({ chatId, before: cursor, limit: pageSize });
            if (net.length < pageSize) historyExhausted = true;
            if (!net.length) break;
            const rows = net.map((m) => ({ ...m, updatedAt: (m as any).updatedAt ?? m.createdAt })) as unknown as StoredMessage[];
            await db.chatMessages.bulkPut(rows);
            cursor = rows.reduce((min, r) => (r.createdAt.getTime() < min.getTime() ? r.createdAt : min), rows[0].createdAt);
            await new Promise((r) => setTimeout(r, 250));
          }
        } catch { /* offline — a later open retries */ }
      };
      // Defer the background fill until the window is ready (handles BOTH call orders — subscribe-before-fetch
      // AND subscribe-after-fetch). fetchOlder invokes the deferred hook once it establishes windowReady.
      const beginBackfill = () => { void backfill(); };
      if (windowReady) beginBackfill();
      else deferredBackfill = beginBackfill;

      return () => { sub.unsubscribe(); offSignal(); if (pollTimer) clearTimeout(pollTimer); stopped = true; deferredBackfill = null; };
    },

    async fetchOlder({ before, limit }) {
      let page = await readDexie(before, limit);
      if (page.length < limit && !historyExhausted) {
        try {
          const net = await deps.fetchHistory({ chatId, before: page.length ? page[0].createdAt : before, limit });
          // fetchHistory's contract is "short page ⇒ end of history": the server returns up to `limit` newest messages older than `before` and never under-fills for a non-terminal reason (no server-side truncation/rate-limit), so a short page reliably means no older history remains. The latch is per-transport-lifetime by design.
          if (net.length < limit) historyExhausted = true;
          if (net.length) {
            const rows = net.map((m) => ({ ...m, updatedAt: (m as any).updatedAt ?? m.createdAt })) as unknown as StoredMessage[];
            await db.chatMessages.bulkPut(rows);
            page = await readDexie(before, limit);
          }
        } catch { /* offline — return the Dexie slice we have */ }
      }
      if (page.length) {
        const oldest = page[0].createdAt;
        if (!windowOldest || oldest.getTime() < windowOldest.getTime()) windowOldest = oldest;
      }
      // First fetchOlder establishes the window (even if empty) → unblock live emit + start the deferred backfill.
      if (!windowReady) { windowReady = true; const s = deferredBackfill; deferredBackfill = null; s?.(); }
      return page.map(toMessage);
    },

    async sendMessage(draft) { return deps.send(draft); },

    async markRead({ message }) {
      await deps.markReadOnServer({ chatId, toCreatedAt: message.createdAt });
    },
  };
}
