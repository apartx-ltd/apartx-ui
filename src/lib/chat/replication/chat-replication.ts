import { liveQuery, type Subscription } from 'dexie';
import { Replication, type PullHandler } from '../../sync';
import { getChatDb, type StoredMessage, type StoredDialog } from './chat-db';
import { createDeliveredAcker } from './delivered-acker';

export interface ChatReplicationDeps {
  userId: string;
  appVariant?: string;
  pullMessages: PullHandler<StoredMessage>;
  pullDialogs: PullHandler<StoredDialog>;
  wireLive?: (h: { onMessage: (chatId: string) => void; onDialogs: () => void }) => () => void;
  messagePollInterval?: number;
  dialogPollInterval?: number;
  /**
   * Receiver-side delivered ack — consumer-provided fetch closure (parity with `pullDialogs`). When
   * set, the engine watches the background dialogs stream and acks `markDelivered({chatId, uptoSeq})`
   * for freshly received counterpart messages, driving the sender's `counterpartDeliveredSeq` tick.
   */
  markDelivered?: (a: { chatId: string; uptoSeq: number }) => Promise<void> | void;
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

  // Receiver-side delivered ack: watch the whole dialogs table; on any change feed the acker, which
  // debounce-acks freshly received counterpart messages. Only active when a consumer supplies the
  // `markDelivered` closure (kit citizen; consumers just feed it, like `pullDialogs`).
  const acker = deps.markDelivered
    ? createDeliveredAcker({ ack: (a) => { void deps.markDelivered!(a); } })
    : null;
  let ackSub: Subscription | null = null;

  return {
    db, messages, dialogs,
    startDialogs() {
      dialogs.start();
      if (acker && !ackSub) {
        ackSub = liveQuery(() => db.chatDialogs.toArray()).subscribe({
          next: (list) => acker.note(list, deps.userId),
          error: () => {},
        });
      }
    },
    setActiveChats(chatIds: string[]) { messages.setActiveScopes(chatIds); },
    connectLive() {
      unwire?.();
      unwire = deps.wireLive?.({
        onMessage: (chatId) => messages.getScope(chatId)?.sync(),
        onDialogs: () => dialogs.sync(),
      }) ?? null;
    },
    stop() {
      unwire?.(); unwire = null;
      ackSub?.unsubscribe(); ackSub = null;
      acker?.dispose();
      messages.stop(); dialogs.stop();
    },
  };
}
export type ChatReplication = ReturnType<typeof createChatReplication>;
