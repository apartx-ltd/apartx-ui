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

describe('ReplicatedTransport.subscribeLive — forward tail (signal + poll)', () => {
  it('tail on signal: fetchUpdates writes into Dexie, watermark advances, wrong chatId ignored', async () => {
    const userId = 'user-rt-tail-signal';
    const db = getChatDb(userId);
    let signalCb: ((chatId: string) => void) | undefined;
    const upd1 = mkMsg(10, { updatedAt: new Date(BASE + 10_000) });
    const upd2 = mkMsg(11, { updatedAt: new Date(BASE + 11_000) });
    const fetchUpdates = vi.fn(async () => [] as Message[]);
    fetchUpdates.mockResolvedValueOnce([]);         // immediate initial tailSync (empty)
    fetchUpdates.mockResolvedValueOnce([upd1] as unknown as Message[]); // 1st signal
    fetchUpdates.mockResolvedValueOnce([upd2] as unknown as Message[]); // 2nd signal
    const { transport } = build(userId, {
      db,
      fetchUpdates,
      subscribeSignal: (onNews) => { signalCb = onNews; return () => { signalCb = undefined; }; },
    });

    const unsub = transport.subscribeLive(CHAT, () => {});
    await tick(); // let the immediate tailSync settle
    expect(fetchUpdates).toHaveBeenCalledTimes(1);
    expect(fetchUpdates.mock.calls[0][0]).toMatchObject({ chatId: CHAT, since: undefined });

    // Wrong chatId → no fetch.
    signalCb?.('other-chat');
    await tick();
    expect(fetchUpdates).toHaveBeenCalledTimes(1);

    // Matching signal → fetchUpdates called, message stored, watermark advances.
    signalCb?.(CHAT);
    await tick();
    expect(fetchUpdates).toHaveBeenCalledTimes(2);
    expect(await db.chatMessages.get('m010')).toBeTruthy();

    // 2nd signal → `since` equals the max updatedAt from the 1st batch.
    signalCb?.(CHAT);
    await tick();
    expect(fetchUpdates).toHaveBeenCalledTimes(3);
    expect(fetchUpdates.mock.calls[2][0].since?.getTime()).toBe(upd1.updatedAt.getTime());

    unsub();
    closeChatDb(userId);
  });

  it('trailing re-sync: a signal fired during an in-flight tailSync is not dropped', async () => {
    const userId = 'user-rt-tail-trailing';
    const db = getChatDb(userId);
    let signalCb: ((chatId: string) => void) | undefined;

    // First fetchUpdates call blocks on a manually-resolved gate; later calls resolve immediately.
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => { releaseFirst = r; });
    let call = 0;
    const fetchUpdates = vi.fn(async () => {
      call += 1;
      if (call === 1) { await firstGate; }
      return [] as Message[];
    });

    const { transport } = build(userId, {
      db,
      fetchUpdates,
      subscribeSignal: (onNews) => { signalCb = onNews; return () => { signalCb = undefined; }; },
    });

    // subscribeLive triggers the immediate tailSync (call #1), which now blocks on firstGate.
    const unsub = transport.subscribeLive(CHAT, () => {});
    await tick();
    expect(fetchUpdates).toHaveBeenCalledTimes(1);

    // Fire a second signal while call #1 is still pending → dropped by the re-entrancy guard, remembered as pending.
    signalCb?.(CHAT);
    await tick();
    expect(fetchUpdates).toHaveBeenCalledTimes(1); // still in-flight, not yet re-called

    // Release the first call → the trailing re-sync must run a SECOND fetchUpdates.
    releaseFirst();
    await tick();
    expect(fetchUpdates).toHaveBeenCalledTimes(2);

    unsub();
    closeChatDb(userId);
  });

  it('drains a full page: a read that bumps > pageSize messages is walked gap-free with the compound (updatedAt,_id) cursor until a partial page', async () => {
    const userId = 'user-rt-tail-drain';
    const db = getChatDb(userId);
    // A single read stamps 5 messages with ONE identical updatedAt. With pageSize 2 the server
    // returns them in three round-trips: [m1,m2], [m3,m4], [m5]. The client must advance by the
    // compound cursor (since=updatedAt, sinceId=last _id) and keep pulling until the short page,
    // NOT stop after the first full page (which would strand m3..m5 — the "blue tick stuck grey
    // until reload" regression).
    const bump = new Date(BASE + 500_000);
    const all = [1, 2, 3, 4, 5].map((i) => mkMsg(i, { updatedAt: bump }));
    const fetchUpdates = vi.fn(async (a: { since?: Date; sinceId?: string; limit: number }) => {
      const after = all.filter((m) => {
        if (!a.since) return true;
        const dt = m.updatedAt.getTime() - a.since.getTime();
        if (dt > 0) return true;
        return dt === 0 && (a.sinceId == null || m._id > a.sinceId);
      });
      return after.slice(0, a.limit) as unknown as Message[];
    });

    const { transport } = build(userId, { db, fetchUpdates, pageSize: 2 });
    const unsub = transport.subscribeLive(CHAT, () => {});
    await tick();

    // 3 pages: [m1,m2] full → [m3,m4] full → [m5] partial (stop). All 5 land, none stranded.
    expect(fetchUpdates).toHaveBeenCalledTimes(3);
    expect(fetchUpdates.mock.calls[1][0]).toMatchObject({ since: bump, sinceId: 'm002' });
    expect(fetchUpdates.mock.calls[2][0]).toMatchObject({ since: bump, sinceId: 'm004' });
    expect(await db.chatMessages.where('chatId').equals(CHAT).count()).toBe(5);

    unsub();
    closeChatDb(userId);
  });

  it('tail on poll: self-reschedules — advancing pollIntervalMs re-calls fetchUpdates', async () => {
    vi.useFakeTimers();
    try {
      const userId = 'user-rt-tail-poll';
      const db = getChatDb(userId);
      const fetchUpdates = vi.fn(async () => [] as Message[]);
      const { transport } = build(userId, { db, fetchUpdates, pollIntervalMs: 5_000 });

      const unsub = transport.subscribeLive(CHAT, () => {});
      await vi.advanceTimersByTimeAsync(0); // immediate tailSync
      expect(fetchUpdates).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetchUpdates).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetchUpdates).toHaveBeenCalledTimes(3);

      unsub();
      closeChatDb(userId);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleanup: after unsub, advancing the poll interval does NOT call fetchUpdates again', async () => {
    vi.useFakeTimers();
    try {
      const userId = 'user-rt-tail-cleanup';
      const db = getChatDb(userId);
      const fetchUpdates = vi.fn(async () => [] as Message[]);
      const { transport } = build(userId, { db, fetchUpdates, pollIntervalMs: 5_000 });

      const unsub = transport.subscribeLive(CHAT, () => {});
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchUpdates).toHaveBeenCalledTimes(1);

      unsub();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(fetchUpdates).toHaveBeenCalledTimes(1); // unchanged after unsub

      closeChatDb(userId);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ReplicatedTransport.subscribeLive — bounded window emit', () => {
  it('only surfaces in-window (or known) messages; older background rows are suppressed', async () => {
    const userId = 'user-rt-bounded';
    const db = getChatDb(userId);
    // Full history m001..m010; only the newest 5 (m006..m010) constitute the loaded window.
    const full = Array.from({ length: 10 }, (_, i) => mkMsg(i + 1));
    const { transport } = build(userId, {
      db,
      fetchHistory: vi.fn(async ({ before, limit }: { before?: Date; limit: number }) => {
        const older = full.filter((m) => !before || m.createdAt.getTime() < before.getTime());
        return older.slice(-limit).reverse() as unknown as Message[];
      }),
    });
    await db.chatMessages.bulkPut(full.slice(5)); // seed m006..m010

    // Load the window via fetchOlder → windowOldest = m006.createdAt.
    const page = await transport.fetchOlder({ chatId: CHAT, limit: 5 });
    expect(page.map((x) => x._id)).toEqual(['m006', 'm007', 'm008', 'm009', 'm010']);

    const events: any[] = [];
    const unsub = transport.subscribeLive(CHAT, (e) => events.push(e));
    await tick();
    // Initial snapshot surfaces only the in-window messages (m006..m010), not older m001..m005.
    const initialUpserts = events.filter((e) => e.type === 'upsert').map((e) => e.message._id);
    expect(initialUpserts).toEqual(expect.arrayContaining(['m006', 'm010']));
    expect(initialUpserts).not.toContain('m005');

    events.length = 0;
    // Write an OLDER message (createdAt < windowOldest), not previously known → NO upsert.
    await db.chatMessages.put(mkMsg(3)); // older than m006
    await tick();
    expect(events.some((e) => e.type === 'upsert' && e.message._id === 'm003')).toBe(false);

    events.length = 0;
    // Write a NEWER message (>= windowOldest) → upsert emitted.
    await db.chatMessages.put(mkMsg(20, { createdAt: new Date(BASE + 20_000), updatedAt: new Date(BASE + 20_000) }));
    await tick();
    expect(events.some((e) => e.type === 'upsert' && e.message._id === 'm020')).toBe(true);

    events.length = 0;
    // Edit an already-emitted (known, in-window) message → upsert (edit) emitted.
    await db.chatMessages.update('m010', { text: 'edited', updatedAt: new Date(BASE + 30_000) });
    await tick();
    expect(events.some((e) => e.type === 'upsert' && e.message._id === 'm010')).toBe(true);

    events.length = 0;
    // Soft-delete a known message → soft-delete event.
    await db.chatMessages.update('m010', { removedAt: new Date(), updatedAt: new Date(BASE + 40_000) });
    await tick();
    expect(events.some((e) => e.type === 'delete' && e.targetId === 'm010' && e.hard === false)).toBe(true);

    unsub();
    closeChatDb(userId);
  });
});

describe('ReplicatedTransport.subscribeLive — background offline fill', () => {
  it('walks fetchHistory backward with a descending cursor, stops on a short page, then stops on unsub', async () => {
    const userId = 'user-rt-backfill';
    const db = getChatDb(userId);
    // 12 messages exist server-side; pageSize 5 → pages of 5, 5, then 2 (short → exhausted).
    const full = Array.from({ length: 12 }, (_, i) => mkMsg(i + 1));
    const fetchHistory = vi.fn(async ({ before, limit }: { before?: Date; limit: number }) => {
      const older = full.filter((m) => !before || m.createdAt.getTime() < before.getTime());
      return older.slice(-limit).reverse() as unknown as Message[];
    });
    const { transport } = build(userId, { db, fetchHistory, pageSize: 5 });

    // Establish the window first (subscribe-after-fetch order) so the deferred backfill runs.
    // fetchOlder on empty Dexie fetches the newest page (m008..m012), setting windowReady + windowOldest.
    await transport.fetchOlder({ chatId: CHAT, limit: 5 });
    expect(fetchHistory.mock.calls.length).toBe(1);           // page A: newest 5
    expect(fetchHistory.mock.calls[0][0].before).toBeUndefined();

    const unsub = transport.subscribeLive(CHAT, () => {});

    // Step past the 250ms throttle enough times for the backfill to reach exhaustion.
    for (let i = 0; i < 10 && fetchHistory.mock.calls.length < 3; i++) await tick(300);

    // Backfill added 2 more pages: next 5, then final 2 (< pageSize → exhausted). 3 fetchHistory calls total.
    expect(fetchHistory.mock.calls.length).toBe(3);
    // Descending `before` cursor across the backfill pages.
    const c1 = fetchHistory.mock.calls[1][0].before as Date;
    const c2 = fetchHistory.mock.calls[2][0].before as Date;
    expect(c1.getTime()).toBeGreaterThan(c2.getTime());
    // All 12 messages ended up in Dexie.
    expect(await db.chatMessages.where('chatId').equals(CHAT).count()).toBe(12);

    const callsAfterExhaustion = fetchHistory.mock.calls.length;
    unsub();
    await tick(400);
    expect(fetchHistory.mock.calls.length).toBe(callsAfterExhaustion); // no further fetch after unsub/exhaustion

    closeChatDb(userId);
  });
});

describe('ReplicatedTransport — windowReady gate prevents open-time flood (subscribe-before-fetch)', () => {
  it('warm cache no flood: 100 seeded messages → open shows only the loaded page (25), not the whole cache', async () => {
    const userId = 'user-rt-warm-noflood';
    const db = getChatDb(userId);
    // Warm cache: 100 messages already in Dexie.
    await db.chatMessages.bulkPut(Array.from({ length: 100 }, (_, i) => mkMsg(i + 1)));

    // Quiet network — everything the session needs is in the warm cache.
    const { transport } = build(userId, {
      db,
      fetchHistory: async () => [] as Message[],
      fetchUpdates: async () => [] as Message[],
    });
    // createChatSession subscribes BEFORE fetchOlder (production order).
    const session = createChatSession(transport, { chatId: CHAT, meUserId: 'me', pageSize: 25 });
    await session.open();
    await tick();

    // The warm cache did NOT flood the window — only the loaded page is visible.
    expect(session.status).toBe('ready');
    expect(session.messages.length).toBe(25);

    // A NEW (newer) message written post-open still surfaces via the live stream.
    await db.chatMessages.put(mkMsg(200, { createdAt: new Date(BASE + 200_000), updatedAt: new Date(BASE + 200_000) }));
    await tick();
    expect(session.messages.map((x) => x._id)).toContain('m200');

    session.dispose();
    closeChatDb(userId);
  });

  it('cold cache no flood: background fill writes older pages during open but they do NOT enter the window', async () => {
    const userId = 'user-rt-cold-noflood';
    const db = getChatDb(userId);
    // 80 messages exist server-side; pageSize 25. First fetch returns the newest 25, older pages follow.
    const full = Array.from({ length: 80 }, (_, i) => mkMsg(i + 1));
    const fetchHistory = vi.fn(async ({ before, limit }: { before?: Date; limit: number }) => {
      const older = full.filter((m) => !before || m.createdAt.getTime() < before.getTime());
      return older.slice(-limit).reverse() as unknown as Message[];
    });
    const { transport } = build(userId, { db, fetchHistory, fetchUpdates: async () => [] as Message[] });

    const session = createChatSession(transport, { chatId: CHAT, meUserId: 'me', pageSize: 25 });
    await session.open();
    // Let the background fill write several older pages.
    for (let i = 0; i < 6; i++) await tick(300);

    // The window holds only the loaded page — older fill rows are in Dexie but NOT surfaced.
    expect(session.status).toBe('ready');
    expect(session.messages.length).toBe(25);
    // The fill wrote more rows than the window (proving it ran without flooding the visible list).
    const stored = await db.chatMessages.where('chatId').equals(CHAT).count();
    expect(stored).toBeGreaterThan(25);

    session.dispose();
    closeChatDb(userId);
  });
});
