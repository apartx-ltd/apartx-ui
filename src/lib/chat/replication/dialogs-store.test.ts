import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createDialogsStore } from './dialogs-store.svelte';
import { getChatDb, closeChatDb, type StoredDialog } from './chat-db';
import type { ChatReplication } from './chat-replication';

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));
const BASE = new Date('2026-07-01T00:00:00Z').getTime();
const mk = (id: string, kind: string, unread: number, offset = 0): StoredDialog => ({
  _id: id, chatId: id, kind, unread, updatedAt: new Date(BASE + offset),
});

describe('createDialogsStore', () => {
  it('sums totalUnread and unreadByKind over the live feed and reacts to updates', async () => {
    const userId = 'user-dlg-1';
    const db = getChatDb(userId);
    await db.chatDialogs.bulkPut([
      mk('d1', 'booking', 2, 0),
      mk('d2', 'booking', 1, 1000),
      mk('d3', 'support', 5, 2000),
    ]);

    const replication = { db } as unknown as ChatReplication;
    const store = createDialogsStore(replication);
    await tick();

    expect(store.dialogs.length).toBe(3);
    expect(store.totalUnread).toBe(8);
    expect(store.unreadByKind('booking')).toBe(3);
    expect(store.unreadByKind('support')).toBe(5);

    // Drop one booking dialog to 0 unread → totals react.
    await db.chatDialogs.update('d1', { unread: 0, updatedAt: new Date(BASE + 5000) });
    await tick();
    expect(store.totalUnread).toBe(6);
    expect(store.unreadByKind('booking')).toBe(1);

    store.dispose();
    closeChatDb(userId);
  });
});
