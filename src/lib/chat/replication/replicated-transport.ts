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
      const diff = makeSnapshotDiffer<StoredMessage>();
      const q = liveQuery(() => db.chatMessages.where('chatId').equals(chatId).toArray()) as Observable<StoredMessage[]>;
      const sub = q.subscribe({
        next: (rows) => {
          const { upserts, deletedIds } = diff(rows);
          for (const m of upserts) {
            if (m.removedAt) onEvent({ type: 'delete', targetId: m._id, hard: false } as LiveEvent);
            else onEvent({ type: 'upsert', message: toMessage(m) } as LiveEvent);
          }
          for (const id of deletedIds) onEvent({ type: 'delete', targetId: id, hard: true } as LiveEvent);
        },
      });
      return () => { sub.unsubscribe(); };
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
      return page.map(toMessage);
    },

    async sendMessage(draft) { return deps.send(draft); },

    async markRead({ message }) {
      await deps.markReadOnServer({ chatId, toCreatedAt: message.createdAt });
    },
  };
}
