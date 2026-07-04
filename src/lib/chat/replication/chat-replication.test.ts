import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createChatReplication } from './chat-replication';
import { closeChatDb, type StoredMessage, type StoredDialog } from './chat-db';
import type { Checkpoint, PullResult } from '../../sync';

const D = (ms: number) => new Date('2026-07-01T00:00:00Z').getTime() + ms;
const mkMsg = (id: string, chatId: string, ms: number, extra: Partial<StoredMessage> = {}): StoredMessage => ({
  _id: id, chatId, createdAt: new Date(ms), updatedAt: new Date(ms), text: id, ...extra,
});

describe('createChatReplication', () => {
  it('pulls messages across pages, advances the checkpoint, and KEEPS removedAt tombstones', async () => {
    const chatId = 'c1';

    // Page 1 (full), page 2 (full incl. a removedAt tombstone), page 3 (empty → stop).
    const pages: PullResult<StoredMessage>[] = [
      {
        documents: [mkMsg('m1', chatId, D(0)), mkMsg('m2', chatId, D(1000))],
        checkpoint: { updatedAt: new Date(D(1000)), id: 'm2' },
        hasMore: true,
      },
      {
        documents: [
          mkMsg('m3', chatId, D(2000)),
          mkMsg('m4', chatId, D(3000), { removedAt: new Date(D(3000)) }),
        ],
        checkpoint: { updatedAt: new Date(D(3000)), id: 'm4' },
        hasMore: true,
      },
      {
        documents: [],
        checkpoint: { updatedAt: new Date(D(3000)), id: 'm4' },
        hasMore: false,
      },
    ];

    let call = 0;
    const seenCheckpoints: (Checkpoint | null)[] = [];
    const pullMessages = async (cp: Checkpoint | null): Promise<PullResult<StoredMessage>> => {
      seenCheckpoints.push(cp);
      return pages[Math.min(call++, pages.length - 1)];
    };

    const pullDialogs = async (): Promise<PullResult<StoredDialog>> => ({
      documents: [],
      checkpoint: null,
      hasMore: false,
    });

    const repl = createChatReplication({
      userId: 'user-repl-1',
      pullMessages,
      pullDialogs,
    });

    const processed = await repl.messages.executePull(chatId);
    expect(processed).toBe(4);

    // All docs present, including the removedAt tombstone (deletedField is hardRemovedAt, absent here).
    const all = await repl.db.chatMessages.where('chatId').equals(chatId).toArray();
    const ids = all.map((r) => r._id).sort();
    expect(ids).toEqual(['m1', 'm2', 'm3', 'm4']);

    const m4 = await repl.db.chatMessages.get('m4');
    expect(m4).toBeTruthy();
    expect(m4?.removedAt).toBeInstanceOf(Date);

    // First pull started from null checkpoint.
    expect(seenCheckpoints[0]).toBeNull();

    // Checkpoint advanced and persisted in meta.
    const meta = await repl.db._replicationMeta.get('chatMessages:c1');
    expect(meta?.checkpoint?.id).toBe('m4');

    repl.stop();
    closeChatDb('user-repl-1');
  });

  it('runs the dialogs pull independently', async () => {
    const pullMessages = async (): Promise<PullResult<StoredMessage>> => ({
      documents: [], checkpoint: null, hasMore: false,
    });
    const pullDialogs = async (cp: Checkpoint | null): Promise<PullResult<StoredDialog>> => {
      if (cp) return { documents: [], checkpoint: cp, hasMore: false };
      return {
        documents: [
          { _id: 'd1', chatId: 'c1', unread: 2, updatedAt: new Date(D(0)) },
          { _id: 'd2', chatId: 'c2', unread: 0, updatedAt: new Date(D(1000)) },
        ],
        checkpoint: { updatedAt: new Date(D(1000)), id: 'd2' },
        hasMore: false,
      };
    };

    const repl = createChatReplication({ userId: 'user-repl-2', pullMessages, pullDialogs });
    const processed = await repl.dialogs.executePull(null);
    expect(processed).toBe(2);
    const dialogs = await repl.db.chatDialogs.toArray();
    expect(dialogs.map((d) => d._id).sort()).toEqual(['d1', 'd2']);

    repl.stop();
    closeChatDb('user-repl-2');
  });
});
