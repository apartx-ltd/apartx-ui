import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { createReplicatedTransport, type ReplicatedTransportDeps } from './replicated-transport';
import { createChatSession } from '../session.svelte';
import { getChatDb, closeChatDb, type ChatDatabase, type StoredMessage } from './chat-db';
import type { Message } from '../types';

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

const CHAT = 'c1';
const BASE = new Date('2026-07-01T00:00:00Z').getTime();
const mkMsg = (i: number, extra: Partial<StoredMessage> = {}): StoredMessage => {
  const d = new Date(BASE + i * 1000);
  return { _id: `m${String(i).padStart(3, '0')}`, chatId: CHAT, userId: 'other', text: `msg ${i}`, createdAt: d, updatedAt: d, ...extra };
};

/** Build a transport over the NEW deps: a real fake-indexeddb Dexie + injected closures. */
function build(
  userId: string,
  overrides: Partial<ReplicatedTransportDeps> = {},
): { db: ChatDatabase; fetchHistory: ReturnType<typeof vi.fn>; deps: ReplicatedTransportDeps; transport: ReturnType<typeof createReplicatedTransport> } {
  const db = getChatDb(userId);
  const fetchHistory = vi.fn(async () => [] as Message[]);
  const deps: ReplicatedTransportDeps = {
    db,
    chatId: CHAT,
    fetchHistory,
    fetchUpdates: async () => [],
    send: async () => ({} as any),
    markReadOnServer: async () => {},
    subscribeSignal: () => () => {},
    ...overrides,
  };
  const transport = createReplicatedTransport(deps);
  return { db, fetchHistory, deps, transport };
}

describe('ReplicatedTransport.fetchOlder — backward paginator on fetchHistory contract', () => {
  it('cold: empty Dexie → fetchHistory once, bulkPuts, returns page oldest→newest', async () => {
    const userId = 'user-rt-cold';
    // Server `before` query returns the newest `limit` messages, newest-first.
    const server = Array.from({ length: 25 }, (_, i) => mkMsg(i + 1)).reverse() as unknown as Message[];
    const fetchHistory = vi.fn(async () => server);
    const { db, transport } = build(userId, { fetchHistory });

    const page = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(fetchHistory).toHaveBeenCalledOnce();
    expect(fetchHistory).toHaveBeenCalledWith({ chatId: CHAT, before: undefined, limit: 25 });
    expect(page.map((x) => x._id)).toEqual(
      Array.from({ length: 25 }, (_, i) => `m${String(1 + i).padStart(3, '0')}`),
    );
    expect(await db.chatMessages.where('chatId').equals(CHAT).count()).toBe(25);

    closeChatDb(userId);
  });

  it('warm: Dexie already has the newest page → returns from Dexie, fetchHistory NOT called', async () => {
    const userId = 'user-rt-warm';
    const { db, fetchHistory, transport } = build(userId);
    await db.chatMessages.bulkPut(Array.from({ length: 25 }, (_, i) => mkMsg(i + 1)));

    const page = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(fetchHistory).not.toHaveBeenCalled();
    expect(page.map((x) => x._id)).toEqual(
      Array.from({ length: 25 }, (_, i) => `m${String(1 + i).padStart(3, '0')}`),
    );

    closeChatDb(userId);
  });

  it('gap fallback: partial Dexie slice → fetchHistory fills the gap, returns contiguous older run (no skip)', async () => {
    const userId = 'user-rt-gap';
    // Full history m001..m010. Only the newest 2 (m009, m010) are cached.
    const full = Array.from({ length: 10 }, (_, i) => mkMsg(i + 1));
    const { db, transport } = build(userId, {
      // Server returns the newest `limit` with createdAt < before, newest-first.
      fetchHistory: vi.fn(async ({ before, limit }) => {
        const older = full.filter((m) => !before || m.createdAt.getTime() < before.getTime());
        return older.slice(-limit).reverse() as unknown as Message[];
      }),
    });
    await db.chatMessages.bulkPut([mkMsg(9), mkMsg(10)]);

    const oldestSeeded = mkMsg(9).createdAt;
    // Ask for the page BEFORE m009 — Dexie has nothing older → fetchHistory fills m001..m008.
    const page = await transport.fetchOlder({ chatId: CHAT, before: oldestSeeded, limit: 5 });
    // Contiguous older run of 5 immediately before m009: m004..m008.
    expect(page.map((x) => x._id)).toEqual(['m004', 'm005', 'm006', 'm007', 'm008']);

    closeChatDb(userId);
  });

  it('gap fallback calls fetchHistory with the requested `before`', async () => {
    const userId = 'user-rt-gap2';
    const full = Array.from({ length: 10 }, (_, i) => mkMsg(i + 1));
    const fetchHistory = vi.fn(async ({ before, limit }: { before?: Date; limit: number }) => {
      const older = full.filter((m) => !before || m.createdAt.getTime() < before.getTime());
      return older.slice(-limit).reverse() as unknown as Message[];
    });
    const { db, transport } = build(userId, { fetchHistory });
    await db.chatMessages.bulkPut([mkMsg(9), mkMsg(10)]);

    const oldestSeeded = mkMsg(9).createdAt;
    await transport.fetchOlder({ chatId: CHAT, before: oldestSeeded, limit: 5 });
    expect(fetchHistory).toHaveBeenCalledWith({ chatId: CHAT, before: oldestSeeded, limit: 5 });

    closeChatDb(userId);
  });

  it('exhaustion: fetchHistory returns < limit once → later fetchOlder past oldest returns [] without re-calling', async () => {
    const userId = 'user-rt-exhaust';
    // Only 3 messages exist server-side; limit is 25 → short page marks exhausted.
    const server = Array.from({ length: 3 }, (_, i) => mkMsg(i + 1)).reverse() as unknown as Message[];
    const fetchHistory = vi.fn(async () => server);
    const { transport } = build(userId, { fetchHistory });

    const p1 = await transport.fetchOlder({ chatId: CHAT, limit: 25 });
    expect(fetchHistory).toHaveBeenCalledOnce();
    expect(p1.map((x) => x._id)).toEqual(['m001', 'm002', 'm003']);

    // Now ask for a page BEFORE the oldest → Dexie short + exhausted → no further network.
    const p2 = await transport.fetchOlder({ chatId: CHAT, before: p1[0].createdAt, limit: 25 });
    expect(p2).toEqual([]);
    expect(fetchHistory).toHaveBeenCalledOnce(); // unchanged

    closeChatDb(userId);
  });
});

describe('ReplicatedTransport live behavior driven through the real ChatSession', () => {
  it('reflects the Dexie snapshot, then live upsert / soft-delete / hard-delete', async () => {
    const userId = 'user-rt-live';
    const db = getChatDb(userId);

    // Seed a small ascending set so the whole-chat live snapshot is the loaded window.
    const seeded = Array.from({ length: 5 }, (_, i) => mkMsg(i + 1));
    await db.chatMessages.bulkPut(seeded);

    const send = vi.fn(async (draft: any) => ({ _id: 'srv-' + draft.clientToken, chatId: CHAT, text: draft.text, createdAt: new Date(), meta: { clientToken: draft.clientToken } }));
    const { transport } = build(userId, { db, send });
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
    const db = getChatDb(userId);
    const when = new Date(BASE + 5000);
    await db.chatMessages.put(mkMsg(1, { createdAt: when, updatedAt: when }));

    const markReadOnServer = vi.fn(async () => {});
    const { transport } = build(userId, { db, markReadOnServer });

    await transport.markRead({ chatId: CHAT, message: { _id: 'm001', chatId: CHAT, createdAt: when } as any });
    expect(markReadOnServer).toHaveBeenCalledWith({ chatId: CHAT, toCreatedAt: when });

    closeChatDb(userId);
  });
});
