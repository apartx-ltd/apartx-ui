import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { createChatReplication } from './chat-replication';
import { closeChatDb, type StoredDialog } from './chat-db';
import type { Checkpoint, PullResult } from '../../sync';

// Realistic dialogs-stream server fake: a fixed set with STATIC updatedAt, checkpoint-filtered
// exactly like the real `pullByCheckpoint` (strict (updatedAt,_id) cursor).
function makeServer(dialogCount: number, lastAuthor = 'them') {
  const base = new Date('2026-07-01T00:00:00Z').getTime();
  const dialogs: StoredDialog[] = Array.from({ length: dialogCount }, (_, i) => ({
    _id: `d${i}`,
    chatId: `c${i}`,
    userId: 'me',
    unread: 1,
    updatedAt: new Date(base + i),
    lastDeliveredSeq: 0,
    chat: { _id: `c${i}`, lastMessage: { seq: 5, userId: lastAuthor } },
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
      appVariant: 'test',
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
    closeChatDb(userId, 'test');
  });
});

describe('createChatReplication meIds wiring', () => {
  const run = async (userId: string, meIds?: () => string[]) => {
    const server = makeServer(1, 'tenant:c0');
    const markDelivered = vi.fn();
    const repl = createChatReplication({
      userId, appVariant: 'test', markDelivered, meIds,
      pullMessages: async () => ({ documents: [], checkpoint: null, hasMore: false }),
      pullDialogs: server.pullDialogs,
    });
    await repl.dialogs.executePull(null);
    repl.startDialogs();
    await new Promise((r) => setTimeout(r, 700)); // > acker debounce (400ms)
    repl.stop();
    closeChatDb(userId, 'test');
    return markDelivered;
  };

  it('acks an alias-authored newest message when no meIds is given', async () => {
    expect((await run('meids-wire-1')).mock.calls.length).toBeGreaterThan(0);
  });

  it('does NOT ack it when meIds getter lists the alias', async () => {
    expect((await run('meids-wire-2', () => ['tenant:c0'])).mock.calls.length).toBe(0);
  });
});
