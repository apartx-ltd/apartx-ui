import Dexie from 'dexie';

export interface StoredMessage {
  _id: string; chatId: string; seq?: number; userId?: string;
  type?: string; text?: string; createdAt: Date; updatedAt: Date;
  read?: any; removedAt?: Date | null; meta?: Record<string, any>; [k: string]: any;
}
export interface StoredDialog {
  _id: string; chatId: string; userId?: string; unread: number;
  kind?: string; updatedAt: Date; lastMessageAt?: Date; [k: string]: any;
}

export class ChatDatabase extends Dexie {
  chatMessages!: Dexie.Table<StoredMessage, string>;
  chatDialogs!: Dexie.Table<StoredDialog, string>;
  _replicationMeta!: Dexie.Table<any, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      chatMessages: '_id, chatId, [chatId+updatedAt], [chatId+seq], [chatId+createdAt]',
      chatDialogs: '_id, chatId, updatedAt, kind',
      _replicationMeta: 'key',
    });
  }
}

const DBS = new Map<string, ChatDatabase>();
/** One IndexedDB per user, namespaced by app variant. */
export function getChatDb(userId: string, appVariant = 'apartx'): ChatDatabase {
  const key = `${appVariant}-${userId}-chat`;
  let db = DBS.get(key);
  if (!db) { db = new ChatDatabase(key); DBS.set(key, db); }
  return db;
}
export function closeChatDb(userId: string, appVariant = 'apartx'): void {
  const key = `${appVariant}-${userId}-chat`;
  const db = DBS.get(key); if (db) { db.close(); DBS.delete(key); }
}
