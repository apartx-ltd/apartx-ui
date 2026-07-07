import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createChatReplication } from './chat-replication';
import { closeChatDb, type StoredDialog } from './chat-db';
import type { Checkpoint, PullResult } from '../../sync';

// Realistic dialogs-stream server fake: a fixed set with STATIC updatedAt, checkpoint-filtered
// exactly like the real `pullByCheckpoint` (strict (updatedAt,_id) cursor).
function makeServer(dialogCount: number) {
  const base = new Date('2026-07-01T00:00:00Z').getTime();
  const dialogs: StoredDialog[] = Array.from({ length: dialogCount }, (_, i) => ({
    _id: `d${i}`,
    chatId: `c${i}`,
    userId: 'me',
    unread: 1,
    updatedAt: new Date(base + i),
    lastDeliveredSeq: 0,
    chat: { _id: `c${i}`, lastMessage: { seq: 5, userId: 'them' } },
  })) as unknown as StoredDialog[];

  const seenCheckpoints: (Checkpoint | null)[] = [];
  return {
    dialogs,
    seenCheckpoints,
    pullDialogs: async (cp: Checkpoint | null): Promise<PullResult<StoredDialog>> => {
      seenCheckpoints.push(cp);
      const after = cp
        ? dialogs.filter((d) => {
            const du = d.updatedAt.getTime();
            const cu = cp.updatedAt.getTime();
            return du > cu || (du === cu && d._id > cp.id);
          })
        : dialogs.slice();
      after.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || (a._id < b._id ? -1 : 1));
      const last = after[after.length - 1];
      return {
        documents: after,
        checkpoint: last ? { updatedAt: last.updatedAt, id: last._id } : cp,
        hasMore: false,
      };
    },
  };
}

describe('dialogs checkpoint persistence (the loop hinge)', () => {
  it('second pull against static server state returns 0 (checkpoint persisted & honored)', async () => {
    const userId = 'loop-hinge-1';
    const server = makeServer(5);
    const repl = createChatReplication({
      userId,
      pullMessages: async () => ({ documents: [], checkpoint: null, hasMore: false }),
      pullDialogs: server.pullDialogs,
    });

    const first = await repl.dialogs.executePull(null);
    const second = await repl.dialogs.executePull(null);
    const third = await repl.dialogs.executePull(null);

    expect(first).toBe(5);
    expect(second).toBe(0);
    expect(third).toBe(0);
    expect(server.seenCheckpoints[1]).not.toBeNull();

    repl.stop();
    closeChatDb(userId);
  });
});
