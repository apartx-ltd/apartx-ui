import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { ChatDatabase, getChatDb, closeChatDb, type StoredMessage, type StoredDialog } from './chat-db';

describe('ChatDatabase', () => {
  it('puts and gets a message and a dialog', async () => {
    const db = new ChatDatabase('test-put-get-chat');
    const now = new Date('2026-07-01T10:00:00Z');
    const msg: StoredMessage = {
      _id: 'm1', chatId: 'c1', seq: 1, userId: 'u1', type: 'text',
      text: 'hello', createdAt: now, updatedAt: now,
    };
    const dialog: StoredDialog = {
      _id: 'd1', chatId: 'c1', userId: 'u1', unread: 3, kind: 'support', updatedAt: now,
    };
    await db.chatMessages.put(msg);
    await db.chatDialogs.put(dialog);

    const gotMsg = await db.chatMessages.get('m1');
    const gotDialog = await db.chatDialogs.get('d1');
    expect(gotMsg?.text).toBe('hello');
    expect(gotMsg?.createdAt.getTime()).toBe(now.getTime());
    expect(gotDialog?.unread).toBe(3);
    expect(gotDialog?.kind).toBe('support');

    db.close();
  });

  it('supports a compound-index range query on [chatId+createdAt]', async () => {
    const db = new ChatDatabase('test-compound-index-chat');
    const base = new Date('2026-07-01T00:00:00Z').getTime();
    const mk = (id: string, chatId: string, offsetMs: number): StoredMessage => {
      const d = new Date(base + offsetMs);
      return { _id: id, chatId, createdAt: d, updatedAt: d, text: id };
    };
    await db.chatMessages.bulkPut([
      mk('a', 'c1', 0),
      mk('b', 'c1', 1000),
      mk('c', 'c1', 2000),
      mk('d', 'c1', 5000),
      mk('e', 'c2', 1000), // other chat — must be excluded
    ]);

    const minDate = new Date(base + 500);
    const maxDate = new Date(base + 3000);
    const rows = await db.chatMessages
      .where('[chatId+createdAt]')
      .between(['c1', minDate], ['c1', maxDate])
      .toArray();

    const ids = rows.map((r) => r._id).sort();
    expect(ids).toEqual(['b', 'c']);

    // .equals on the compound index resolves a single point
    const exact = await db.chatMessages
      .where('[chatId+createdAt]')
      .equals(['c1', new Date(base)])
      .toArray();
    expect(exact.map((r) => r._id)).toEqual(['a']);

    db.close();
  });

  it('getChatDb returns a stable per-key instance and closeChatDb drops it', () => {
    const a = getChatDb('u1');
    const b = getChatDb('u1');
    expect(a).toBe(b);
    const other = getChatDb('u2');
    expect(other).not.toBe(a);
    closeChatDb('u1');
    const c = getChatDb('u1');
    expect(c).not.toBe(a);
    closeChatDb('u1');
    closeChatDb('u2');
  });
});
