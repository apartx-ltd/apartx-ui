import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { createReplicatedTransport } from './replicated-transport';
import { createChatSession } from '../session.svelte';
import { getChatDb, closeChatDb, type StoredMessage } from './chat-db';
import type { ChatReplication } from './chat-replication';

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

const CHAT = 'c1';
const BASE = new Date('2026-07-01T00:00:00Z').getTime();
const mkMsg = (i: number, extra: Partial<StoredMessage> = {}): StoredMessage => {
  const d = new Date(BASE + i * 1000);
  return { _id: `m${String(i).padStart(3, '0')}`, chatId: CHAT, userId: 'other', text: `msg ${i}`, createdAt: d, updatedAt: d, ...extra };
};

/** A fake ChatReplication whose db is the real seeded Dexie and whose message scope reports synced. */
function fakeReplication(userId: string): { replication: ChatReplication; db: ReturnType<typeof getChatDb>; executePull: ReturnType<typeof vi.fn> } {
  const db = getChatDb(userId);
  const executePull = vi.fn(async () => 0);
  const replication = {
    db,
    messages: {
      // lastSyncAt set → transport treats the scope as already-synced (executePull is a no-op).
      getScope: (_id: string) => ({ lastSyncAt: new Date() }),
      executePull,
      setActiveScopes: () => {},
    },
    setActiveChats: () => {},
  } as unknown as ChatReplication;
  return { replication, db, executePull };
}

describe('ReplicatedTransport.fetchOlder paging (deterministic, no live snapshot)', () => {
  it('returns the newest page first, then older pages via `before`, and reports the initial-sync no-op', async () => {
    const userId = 'user-rt-page';
    const { replication, db, executePull } = fakeReplication(userId);
    await db.chatMessages.bulkPut(Array.from({ length: 60 }, (_, i) => mkMsg(i + 1)));

    const transport = createReplicatedTransport({
      chatId: CHAT, replication,
      send: async () => ({} as any), markReadOnServer: async () => {}, pageSize: 25,
    });

    // Initial page = newest 25 (m036..m060). Scope reports synced → executePull NOT called.
    const p1 = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(p1.map((x) => x._id)).toEqual(
      Array.from({ length: 25 }, (_, i) => `m${String(36 + i).padStart(3, '0')}`),
    );
    expect(executePull).not.toHaveBeenCalled();

    // Older page = previous 25 (m011..m035).
    const p2 = await transport.fetchOlder({ chatId: CHAT, before: p1[0].createdAt, limit: 25 });
    expect(p2.map((x) => x._id)).toEqual(
      Array.from({ length: 25 }, (_, i) => `m${String(11 + i).padStart(3, '0')}`),
    );

    // Final page = remaining 10 (m001..m010) → fewer than pageSize (exhausted signal for the reducer).
    const p3 = await transport.fetchOlder({ chatId: CHAT, before: p2[0].createdAt, limit: 25 });
    expect(p3.map((x) => x._id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `m${String(1 + i).padStart(3, '0')}`),
    );
    expect(p3.length).toBeLessThan(25);

    closeChatDb(userId);
  });

  it('runs executePull on the very first fetch when the scope has never synced', async () => {
    const userId = 'user-rt-firstpull';
    const db = getChatDb(userId);
    const executePull = vi.fn(async () => {
      await db.chatMessages.put(mkMsg(1));
      return 1;
    });
    const replication = {
      db,
      messages: {
        getScope: () => ({ lastSyncAt: null }), // never synced
        executePull,
        setActiveScopes: () => {},
      },
      setActiveChats: () => {},
    } as unknown as ChatReplication;

    const transport = createReplicatedTransport({ chatId: CHAT, replication, send: async () => ({} as any), markReadOnServer: async () => {}, pageSize: 25 });
    const page = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(executePull).toHaveBeenCalledOnce();
    expect(page.map((x) => x._id)).toEqual(['m001']);

    closeChatDb(userId);
  });
});

describe('replicated-transport cold-cache seed + non-blocking backfill', () => {
  it('cold cache: seeds newest page via seedNewest, returns it WITHOUT awaiting full executePull', async () => {
    const userId = 'user-rt-coldseed';
    const db = getChatDb(userId);
    // seedNewest returns newest-first (as a real network "newest page" would); transport must
    // store them and return the page oldest→newest.
    const seeded: StoredMessage[] = [
      mkMsg(2, { _id: 'm2', text: 'newer', createdAt: new Date(2000), updatedAt: new Date(2000) }),
      mkMsg(1, { _id: 'm1', text: 'older', createdAt: new Date(1000), updatedAt: new Date(1000) }),
    ];
    // executePull NEVER resolves → asserts fetchOlder does not await it.
    const executePull = vi.fn(() => new Promise<number>(() => {}));
    const replication = {
      db,
      messages: {
        getScope: () => ({ lastSyncAt: null }), // never synced → background pull would fire
        executePull,
        setActiveScopes: () => {},
      },
      setActiveChats: () => {},
    } as unknown as ChatReplication;

    const seedNewest = vi.fn(async () => seeded as unknown as StoredMessage[] as any);
    const transport = createReplicatedTransport({
      chatId: CHAT, replication, send: async () => ({} as any), markReadOnServer: async () => {}, seedNewest,
    });

    // Must resolve despite executePull hanging forever.
    const page = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(seedNewest).toHaveBeenCalledWith(25);
    expect(page.map((m) => m._id)).toEqual(['m1', 'm2']); // oldest→newest
    expect(await db.chatMessages.where('chatId').equals(CHAT).count()).toBe(2);
    expect(executePull).toHaveBeenCalledOnce();

    closeChatDb(userId);
  });

  it('cold cache with empty history: seedNewest resolves [], returns [] and still fires executePull once', async () => {
    const userId = 'user-rt-emptyseed';
    const db = getChatDb(userId);
    const executePull = vi.fn(() => new Promise<number>(() => {})); // never resolves
    const replication = {
      db,
      messages: {
        getScope: () => ({ lastSyncAt: null }), // never synced → background pull fires
        executePull,
        setActiveScopes: () => {},
      },
      setActiveChats: () => {},
    } as unknown as ChatReplication;

    const seedNewest = vi.fn(async () => [] as any);
    const transport = createReplicatedTransport({
      chatId: CHAT, replication, send: async () => ({} as any), markReadOnServer: async () => {}, seedNewest,
    });

    const page = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(seedNewest).toHaveBeenCalledWith(25);
    expect(page).toEqual([]);
    expect(await db.chatMessages.where('chatId').equals(CHAT).count()).toBe(0);
    expect(executePull).toHaveBeenCalledOnce();

    closeChatDb(userId);
  });

  it('warm cache: returns newest `limit` from Dexie WITHOUT calling seedNewest', async () => {
    const userId = 'user-rt-warmseed';
    const { replication, db } = fakeReplication(userId);
    await db.chatMessages.bulkPut([mkMsg(1), mkMsg(2)]);

    const seedNewest = vi.fn(async () => [] as any);
    const transport = createReplicatedTransport({
      chatId: CHAT, replication, send: async () => ({} as any), markReadOnServer: async () => {}, seedNewest,
    });

    const page = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(seedNewest).not.toHaveBeenCalled();
    expect(page.map((m) => m._id)).toEqual(['m001', 'm002']);

    closeChatDb(userId);
  });
});

describe('ReplicatedTransport live behavior driven through the real ChatSession', () => {
  it('reflects the Dexie snapshot, then live upsert / soft-delete / hard-delete', async () => {
    const userId = 'user-rt-live';
    const { replication, db } = fakeReplication(userId);

    // Seed a small ascending set so the whole-chat live snapshot is the loaded window.
    const seeded = Array.from({ length: 5 }, (_, i) => mkMsg(i + 1));
    await db.chatMessages.bulkPut(seeded);

    const send = vi.fn(async (draft: any) => ({ _id: 'srv-' + draft.clientToken, chatId: CHAT, text: draft.text, createdAt: new Date(), meta: { clientToken: draft.clientToken } }));
    const transport = createReplicatedTransport({ chatId: CHAT, replication, send, markReadOnServer: async () => {}, pageSize: 25 });
    const session = createChatSession(transport, { chatId: CHAT, meUserId: 'me', pageSize: 25 });

    await session.open();
    await tick();

    // The Dexie live snapshot for the chat is the loaded window (all 5, oldest→newest).
    expect(session.status).toBe('ready');
    expect(session.messages.map((x) => x._id)).toEqual(['m001', 'm002', 'm003', 'm004', 'm005']);
    // Fewer than pageSize → reducer marks the history exhausted.
    expect(session.olderStatus).toBe('exhausted');

    // A NEW message put into Dexie → live upsert appended to the window.
    await db.chatMessages.put(mkMsg(6));
    await tick();
    expect(session.messages.map((x) => x._id)).toContain('m006');

    // Setting removedAt on a loaded message → soft delete (row kept, removedAt stamped).
    await db.chatMessages.update('m006', { removedAt: new Date(), updatedAt: new Date(BASE + 100_000) });
    await tick();
    const soft = session.messages.find((x) => x._id === 'm006');
    expect(soft).toBeTruthy();
    expect(soft?.removedAt).toBeInstanceOf(Date);

    // Hard-removing a row (delete from Dexie) → hard delete event, message drops out of the window.
    await db.chatMessages.delete('m005');
    await tick();
    expect(session.messages.map((x) => x._id)).not.toContain('m005');

    session.dispose();
    closeChatDb(userId);
  });

  it('markRead forwards the message createdAt to the server watermark', async () => {
    const userId = 'user-rt-markread';
    const { replication, db } = fakeReplication(userId);
    const when = new Date(BASE + 5000);
    await db.chatMessages.put(mkMsg(1, { createdAt: when, updatedAt: when }));

    const markReadOnServer = vi.fn(async () => {});
    const transport = createReplicatedTransport({
      chatId: CHAT, replication, send: async () => ({ _id: 'x', chatId: CHAT, createdAt: new Date() } as any), markReadOnServer,
    });

    await transport.markRead({ chatId: CHAT, message: { _id: 'm001', chatId: CHAT, createdAt: when } as any });
    expect(markReadOnServer).toHaveBeenCalledWith({ chatId: CHAT, toCreatedAt: when });

    closeChatDb(userId);
  });
});
