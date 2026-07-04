import { Replication, type PullHandler } from '../../sync';
import { getChatDb, type StoredMessage, type StoredDialog } from './chat-db';

export interface ChatReplicationDeps {
  userId: string;
  appVariant?: string;
  pullMessages: PullHandler<StoredMessage>;
  pullDialogs: PullHandler<StoredDialog>;
  wireLive?: (h: { onMessage: (chatId: string) => void; onDialogs: () => void }) => () => void;
  messagePollInterval?: number;
  dialogPollInterval?: number;
}

export function createChatReplication(deps: ChatReplicationDeps) {
  const db = getChatDb(deps.userId, deps.appVariant);
  const dbRef = { name: db.name, _replicationMeta: db._replicationMeta, transaction: db.transaction.bind(db) };

  const messages = new Replication<StoredMessage>({
    name: 'chatMessages', db: dbRef, table: db.chatMessages,
    pull: { handler: deps.pullMessages, batchSize: 100 },
    deletedField: 'hardRemovedAt',            // keep removedAt tombstone rows in Dexie
    pollInterval: deps.messagePollInterval ?? 20_000,
    reconcileFilter: (chatIds) => (table) =>
      table.where('chatId').anyOf(chatIds).primaryKeys() as Promise<string[]>,
  });

  const dialogs = new Replication<StoredDialog>({
    name: 'chatDialogs', db: dbRef, table: db.chatDialogs,
    pull: { handler: deps.pullDialogs, batchSize: 200 },
    deletedField: 'removedAt',
    pollInterval: deps.dialogPollInterval ?? 30_000,
  });

  let unwire: (() => void) | null = null;

  return {
    db, messages, dialogs,
    startDialogs() { dialogs.start(); },
    setActiveChats(chatIds: string[]) { messages.setActiveScopes(chatIds); },
    connectLive() {
      unwire?.();
      unwire = deps.wireLive?.({
        onMessage: (chatId) => messages.getScope(chatId)?.sync(),
        onDialogs: () => dialogs.sync(),
      }) ?? null;
    },
    stop() { unwire?.(); unwire = null; messages.stop(); dialogs.stop(); },
  };
}
export type ChatReplication = ReturnType<typeof createChatReplication>;
