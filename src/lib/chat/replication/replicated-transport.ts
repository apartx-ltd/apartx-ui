import { liveQuery, type Observable } from 'dexie';
import type { ChatTransport, LiveEvent, Message, OutgoingDraft } from '../types';
import type { ChatReplication } from './chat-replication';
import type { StoredMessage } from './chat-db';
import { makeSnapshotDiffer } from './live-query.svelte';

export interface ReplicatedTransportDeps {
  chatId: string;
  replication: ChatReplication;
  send: (draft: OutgoingDraft) => Promise<Message>;
  markReadOnServer: (args: { chatId: string; toCreatedAt: Date }) => Promise<void>;
  /** Cold-cache fast path: fetch the newest `limit` messages from the network. Called ONLY
   *  when Dexie has no messages for this chat. */
  seedNewest?: (limit: number) => Promise<Message[]>;
  pageSize?: number;
}

const toMessage = (d: StoredMessage): Message => d as unknown as Message;

export function createReplicatedTransport(deps: ReplicatedTransportDeps): ChatTransport {
  const { chatId, replication } = deps;
  const db = replication.db;

  return {
    subscribeLive(_chatId, onEvent) {
      replication.setActiveChats([chatId]);
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
      return () => { sub.unsubscribe(); replication.setActiveChats([]); };
    },

    async fetchOlder({ before, limit }) {
      if (!before) {
        const cached = await db.chatMessages.where('chatId').equals(chatId).count();
        if (cached === 0 && deps.seedNewest) {
          try {
            const newest = await deps.seedNewest(limit);
            if (newest.length) await db.chatMessages.bulkPut(newest as unknown as StoredMessage[]);
          } catch { /* offline cold cache — nothing to seed; live sync fills later */ }
        }
        const scope = replication.messages.getScope(chatId);
        if (!scope || scope.lastSyncAt == null) void replication.messages.executePull(chatId);
      }
      let rows = await db.chatMessages.where('chatId').equals(chatId).sortBy('createdAt');
      if (before) rows = rows.filter((r) => r.createdAt.getTime() < before.getTime());
      const page = rows.slice(Math.max(0, rows.length - limit));
      return page.map(toMessage);
    },

    async sendMessage(draft) { return deps.send(draft); },

    async markRead({ message }) {
      await deps.markReadOnServer({ chatId, toCreatedAt: message.createdAt });
    },
  };
}
